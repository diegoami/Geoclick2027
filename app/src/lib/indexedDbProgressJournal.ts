// Account-bound local journal. Auth/Firestore are deliberately outside this layer.
import {
	analyzeProgressEvents,
	MAX_PROGRESS_PARENTS,
	parseProgressEvent,
	parseProgressOperation,
	progressFingerprint,
	progressOwnerKey,
	type ProgressEvent,
	type ProgressGraph,
	type ProgressIssue,
	type ProgressOperation,
	type ProgressOwner
} from './progressEvents';
interface EventRow {
	ownerKey: string;
	id: string;
	variants: ProgressEvent[];
	local: boolean;
	acknowledged: boolean;
}
interface QuarantineRow {
	ownerKey: string;
	fingerprint: string;
	issue: ProgressIssue;
	raw?: unknown;
}
interface Installation {
	key: 'installation';
	deviceId: string;
}
export class ProgressJournalError extends Error {
	constructor(readonly code: string) {
		super(code);
		this.name = 'ProgressJournalError';
	}
}
const request = <T>(value: IDBRequest<T>): Promise<T> =>
	new Promise((resolve, reject) => {
		value.onsuccess = () => resolve(value.result);
		value.onerror = () => reject(value.error ?? new ProgressJournalError('storage-failed'));
	});
function completed(transaction: IDBTransaction): Promise<void> {
	return new Promise((resolve, reject) => {
		transaction.oncomplete = () => resolve();
		transaction.onabort = transaction.onerror = () =>
			reject(transaction.error ?? new ProgressJournalError('storage-aborted'));
	});
}
export interface JournalOptions {
	databaseName?: string;
	indexedDB?: IDBFactory;
	idFactory?: () => string;
}
export class IndexedDbProgressJournal {
	readonly owner: Readonly<ProgressOwner>;
	private readonly ownerKey: string;
	private readonly database: Promise<IDBDatabase>;
	private readonly idFactory: () => string;
	private closed = false;
	constructor(owner: ProgressOwner, options: JournalOptions = {}) {
		this.owner = Object.freeze({ projectId: owner.projectId, uid: owner.uid });
		this.ownerKey = progressOwnerKey(this.owner);
		this.idFactory = options.idFactory ?? (() => crypto.randomUUID());
		const factory = options.indexedDB ?? globalThis.indexedDB;
		if (!factory) throw new ProgressJournalError('storage-unavailable');
		this.database = new Promise((resolve, reject) => {
			let rejected = false;
			const open = factory.open(options.databaseName ?? 'geoclick-account-progress-v1', 1);
			open.onupgradeneeded = () => {
				const db = open.result;
				const events = db.createObjectStore('events', { keyPath: ['ownerKey', 'id'] });
				events.createIndex('owner', 'ownerKey');
				const quarantine = db.createObjectStore('quarantine', {
					keyPath: ['ownerKey', 'fingerprint']
				});
				quarantine.createIndex('owner', 'ownerKey');
				db.createObjectStore('metadata', { keyPath: 'key' });
			};
			open.onerror = () => reject(new ProgressJournalError('storage-open-failed'));
			open.onblocked = () => {
				rejected = true;
				reject(new ProgressJournalError('storage-upgrade-blocked'));
			};
			open.onsuccess = () => {
				const db = open.result;
				if (rejected) {
					db.close();
					return;
				}
				db.onversionchange = () => {
					this.closed = true;
					db.close();
				};
				resolve(db);
			};
		});
		// Keep early open failures observable without an unhandled background rejection.
		void this.database.catch(() => undefined);
	}
	private async transaction<T>(
		stores: string[],
		mode: IDBTransactionMode,
		body: (transaction: IDBTransaction) => Promise<T>
	): Promise<T> {
		const db = await this.database;
		if (this.closed) throw new ProgressJournalError('storage-closed');
		const transaction = db.transaction(stores, mode),
			done = completed(transaction);
		// Observe aborts immediately; the caller still receives the same rejection below.
		void done.catch(() => undefined);
		try {
			const value = await body(transaction);
			await done;
			return value;
		} catch (error) {
			try {
				transaction.abort();
			} catch {
				/* Already completed/aborted. */
			}
			await done.catch(() => undefined);
			throw error;
		}
	}
	private rows(transaction: IDBTransaction): Promise<EventRow[]> {
		return request(transaction.objectStore('events').index('owner').getAll(this.ownerKey));
	}
	async snapshot(): Promise<ProgressGraph> {
		return this.transaction(['events'], 'readonly', async (transaction) => {
			const rows = await this.rows(transaction);
			return analyzeProgressEvents(
				rows.flatMap((row) => row.variants),
				this.owner
			);
		});
	}
	/** Resolves only after the event and installation metadata commit atomically. */
	append(operationInput: ProgressOperation, operationKey: string): Promise<ProgressEvent> {
		const operation = parseProgressOperation(operationInput);
		if (
			!operation ||
			typeof operationKey !== 'string' ||
			!operationKey ||
			operationKey.length > 512
		)
			return Promise.reject(new ProgressJournalError('invalid-operation'));
		return this.transaction(['events', 'metadata'], 'readwrite', async (transaction) => {
			const rows = await this.rows(transaction),
				all = rows.flatMap((row) => row.variants);
			const graph = analyzeProgressEvents(all, this.owner);
			const retries = all.filter((event) => event.operationKey === operationKey);
			if (retries.length) {
				const existing = graph.events.find((event) => event.operationKey === operationKey);
				if (
					!existing ||
					retries.some(
						(event) =>
							event.id !== existing.id ||
							progressFingerprint(event.operation) !== progressFingerprint(operation)
					)
				)
					throw new ProgressJournalError('operation-conflict');
				return structuredClone(existing);
			}
			if (graph.heads.length > MAX_PROGRESS_PARENTS)
				throw new ProgressJournalError('too-many-concurrent-branches');
			const metadata = transaction.objectStore('metadata');
			let installation = await request<Installation | undefined>(metadata.get('installation'));
			if (!installation) {
				installation = { key: 'installation', deviceId: this.idFactory() };
				await request(metadata.add(installation));
			}
			const candidate: ProgressEvent = {
				version: 1,
				id: this.idFactory(),
				...this.owner,
				deviceId: installation.deviceId,
				sequence: (graph.clock.get(installation.deviceId) ?? 0) + 1,
				logicalTime: graph.logicalTime + 1,
				parents: [...graph.heads],
				operationKey,
				operation
			};
			const parsed = parseProgressEvent(candidate, this.owner);
			if (!parsed.event) throw new ProgressJournalError('invalid-clock-or-identity');
			if (rows.some((row) => row.id === candidate.id))
				throw new ProgressJournalError('event-id-collision');
			await request(
				transaction.objectStore('events').add({
					ownerKey: this.ownerKey,
					id: candidate.id,
					variants: [parsed.event],
					local: true,
					acknowledged: false
				} satisfies EventRow)
			);
			return structuredClone(parsed.event);
		});
	}
	/** Receipt is not an upload acknowledgement. Existing local events stay pending. */
	async ingest(
		input: readonly unknown[]
	): Promise<{ accepted: number; rejected: ProgressIssue[] }> {
		const valid: ProgressEvent[] = [],
			rejected: ProgressIssue[] = [],
			quarantine: QuarantineRow[] = [];
		for (const raw of input) {
			const parsed = parseProgressEvent(raw, this.owner);
			if (parsed.event) {
				valid.push(parsed.event);
				continue;
			}
			const issue: ProgressIssue = { reason: parsed.reason! };
			rejected.push(issue);
			if (
				typeof raw !== 'object' ||
				raw === null ||
				Array.isArray(raw) ||
				!('projectId' in raw) ||
				!('uid' in raw) ||
				raw.projectId !== this.owner.projectId ||
				raw.uid !== this.owner.uid
			)
				continue;
			// Preserve bounded own-account JSON for a later supported-schema migration.
			let rawCopy: unknown;
			try {
				const json = JSON.stringify(raw);
				if (json && json.length <= 65536) rawCopy = JSON.parse(json);
			} catch {
				/* Non-JSON is not a transport record. */
			}
			const fingerprint =
				rawCopy === undefined ? progressFingerprint(issue) : progressFingerprint(rawCopy);
			quarantine.push({
				ownerKey: this.ownerKey,
				fingerprint,
				issue,
				...(rawCopy === undefined ? {} : { raw: rawCopy })
			});
		}
		return this.transaction(['events', 'quarantine'], 'readwrite', async (transaction) => {
			const events = transaction.objectStore('events');
			for (const event of valid) {
				const row = await request<EventRow | undefined>(events.get([this.ownerKey, event.id]));
				if (!row)
					await request(
						events.add({
							ownerKey: this.ownerKey,
							id: event.id,
							variants: [event],
							local: false,
							acknowledged: true
						} satisfies EventRow)
					);
				else if (
					!row.variants.some((old) => progressFingerprint(old) === progressFingerprint(event))
				) {
					row.variants.push(event);
					await request(events.put(row));
				}
			}
			for (const row of quarantine) await request(transaction.objectStore('quarantine').put(row));
			return { accepted: valid.length, rejected };
		});
	}
	async pending(): Promise<ProgressEvent[]> {
		return this.transaction(['events'], 'readonly', async (transaction) => {
			const rows = await this.rows(transaction),
				pendingIds = new Set(
					rows
						.filter((row) => row.local && !row.acknowledged && row.variants.length === 1)
						.map((row) => row.id)
				);
			return analyzeProgressEvents(
				rows.flatMap((row) => row.variants),
				this.owner
			).events.filter((event) => pendingIds.has(event.id));
		});
	}
	/** Confirm exact immutable envelopes, not bare IDs that could belong to another account. */
	async acknowledge(input: readonly ProgressEvent[]): Promise<void> {
		const events = input.map((raw) => {
			const parsed = parseProgressEvent(raw, this.owner);
			if (!parsed.event) throw new ProgressJournalError('acknowledgement-owner-or-schema-mismatch');
			return parsed.event;
		});
		await this.transaction(['events'], 'readwrite', async (transaction) => {
			const store = transaction.objectStore('events');
			for (const event of events) {
				const row = await request<EventRow | undefined>(store.get([this.ownerKey, event.id]));
				if (
					!row ||
					row.variants.length !== 1 ||
					progressFingerprint(row.variants[0]) !== progressFingerprint(event)
				)
					throw new ProgressJournalError('acknowledgement-content-mismatch');
				row.acknowledged = true;
				await request(store.put(row));
			}
		});
	}
	async quarantined(): Promise<QuarantineRow[]> {
		return this.transaction(['quarantine'], 'readonly', (transaction) =>
			request(transaction.objectStore('quarantine').index('owner').getAll(this.ownerKey))
		);
	}
	async close(): Promise<void> {
		this.closed = true;
		(await this.database).close();
	}
}
