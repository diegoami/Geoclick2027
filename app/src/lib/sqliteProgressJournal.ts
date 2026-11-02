// Native journal commits one owner row with compare-and-swap. No pooled BEGIN.
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
	id: string;
	variants: ProgressEvent[];
	local: boolean;
	acknowledged: boolean;
}
interface Quarantine {
	fingerprint: string;
	issue: ProgressIssue;
	raw?: unknown;
}
interface JournalData {
	version: 1;
	owner: ProgressOwner;
	deviceId?: string;
	rows: EventRow[];
	quarantine: Quarantine[];
}
export interface SqliteJournalRecord {
	revision: number;
	payload: string;
}
export interface SqliteJournalStore {
	read(ownerKey: string): Promise<SqliteJournalRecord | undefined>;
	compareAndSwap(
		ownerKey: string,
		expected: SqliteJournalRecord | undefined,
		payload: string
	): Promise<boolean>;
}
export interface JournalSqlDatabase {
	query(sql: string, values: readonly (string | number)[]): Promise<unknown[]>;
	execute(sql: string, values: readonly (string | number)[]): Promise<number>;
}
export class SqliteProgressJournalError extends Error {
	constructor(readonly code: string) {
		super(code);
		this.name = 'SqliteProgressJournalError';
	}
}
export const MAX_SQLITE_JOURNAL_CHARACTERS = 16 * 1024 * 1024;
const record = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);
const token = (value: unknown): value is string =>
	typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const fields = (value: Record<string, unknown>, allowed: readonly string[]) =>
	Object.keys(value).every((key) => allowed.includes(key));
function failure(code = 'invalid-local-journal'): never {
	throw new SqliteProgressJournalError(code);
}
/** SQL is SQLite on both bridges; parameters are bound, never interpolated. */
export function createSqliteJournalStore(db: JournalSqlDatabase): SqliteJournalStore {
	return {
		async read(ownerKey) {
			const rows = await db.query(
				'SELECT revision, payload FROM account_progress_journal_v1 WHERE owner_key = ?',
				[ownerKey]
			);
			if (!Array.isArray(rows) || rows.length > 1) failure('storage-read-failed');
			if (!rows.length) return;
			const row = rows[0];
			if (
				!record(row) ||
				!Number.isSafeInteger(row.revision) ||
				(row.revision as number) < 1 ||
				typeof row.payload !== 'string'
			)
				failure();
			return { revision: row.revision as number, payload: row.payload as string };
		},
		async compareAndSwap(ownerKey, expected, payload) {
			let count: number;
			if (expected) {
				if (expected.revision >= Number.MAX_SAFE_INTEGER) failure('storage-revision-exhausted');
				count = await db.execute(
					'UPDATE account_progress_journal_v1 SET revision = ?, payload = ? WHERE owner_key = ? AND revision = ? AND payload = ?',
					[expected.revision + 1, payload, ownerKey, expected.revision, expected.payload]
				);
			} else
				count = await db.execute(
					'INSERT INTO account_progress_journal_v1 (owner_key, revision, payload) VALUES (?, 1, ?) ON CONFLICT (owner_key) DO NOTHING',
					[ownerKey, payload]
				);
			if (count !== 0 && count !== 1) failure('storage-write-failed');
			return count === 1;
		}
	};
}
export class SqliteProgressJournal {
	readonly owner: Readonly<ProgressOwner>;
	private readonly ownerKey: string;
	private closed = false;
	private readonly idFactory: () => string;
	private readonly attempts: number;
	private readonly deviceId?: string;
	constructor(
		owner: ProgressOwner,
		private readonly store: SqliteJournalStore,
		options: { idFactory?: () => string; attempts?: number; deviceId?: string } = {}
	) {
		this.owner = Object.freeze({ projectId: owner.projectId, uid: owner.uid });
		this.ownerKey = progressOwnerKey(this.owner);
		this.idFactory = options.idFactory ?? (() => crypto.randomUUID());
		this.attempts = options.attempts ?? 32;
		this.deviceId = options.deviceId;
		if (this.deviceId !== undefined && !token(this.deviceId)) failure('invalid-device-id');
		if (!Number.isInteger(this.attempts) || this.attempts < 1 || this.attempts > 128)
			failure('invalid-retry-limit');
	}
	private opened() {
		if (this.closed) failure('storage-closed');
	}
	private decode(stored: SqliteJournalRecord | undefined): JournalData {
		if (!stored) return { version: 1, owner: { ...this.owner }, rows: [], quarantine: [] };
		if (stored.payload.length > MAX_SQLITE_JOURNAL_CHARACTERS) failure('local-journal-too-large');
		let value: unknown;
		try {
			value = JSON.parse(stored.payload);
		} catch {
			failure();
		}
		if (!record(value) || value.version !== 1) failure('unsupported-local-journal');
		if (
			!fields(value, ['version', 'owner', 'deviceId', 'rows', 'quarantine']) ||
			!record(value.owner) ||
			!fields(value.owner, ['projectId', 'uid']) ||
			value.owner.projectId !== this.owner.projectId ||
			value.owner.uid !== this.owner.uid ||
			!Array.isArray(value.rows) ||
			!Array.isArray(value.quarantine) ||
			(value.deviceId !== undefined && !token(value.deviceId))
		)
			failure();
		const rows: EventRow[] = [],
			ids = new Set<string>();
		for (const raw of value.rows) {
			if (
				!record(raw) ||
				!fields(raw, ['id', 'variants', 'local', 'acknowledged']) ||
				!token(raw.id) ||
				ids.has(raw.id) ||
				!Array.isArray(raw.variants) ||
				!raw.variants.length ||
				typeof raw.local !== 'boolean' ||
				typeof raw.acknowledged !== 'boolean'
			)
				failure();
			ids.add(raw.id);
			const variants = raw.variants.map((input) => {
				const parsed = parseProgressEvent(input, this.owner);
				if (!parsed.event || parsed.event.id !== raw.id) failure();
				return parsed.event;
			});
			rows.push({ id: raw.id, variants, local: raw.local, acknowledged: raw.acknowledged });
		}
		const quarantine: Quarantine[] = [],
			fingerprints = new Set<string>();
		for (const raw of value.quarantine) {
			if (
				!record(raw) ||
				!fields(raw, ['fingerprint', 'issue', 'raw']) ||
				typeof raw.fingerprint !== 'string' ||
				raw.fingerprint.length > 131072 ||
				fingerprints.has(raw.fingerprint) ||
				!record(raw.issue) ||
				!fields(raw.issue, ['id', 'reason']) ||
				typeof raw.issue.reason !== 'string' ||
				raw.issue.reason.length > 128 ||
				(raw.issue.id !== undefined && !token(raw.issue.id))
			)
				failure();
			if (
				raw.raw !== undefined &&
				(!record(raw.raw) ||
					raw.raw.projectId !== this.owner.projectId ||
					raw.raw.uid !== this.owner.uid ||
					JSON.stringify(raw.raw).length > 65536)
			)
				failure();
			const issue = raw.issue as unknown as ProgressIssue;
			if (progressFingerprint(raw.raw ?? issue) !== raw.fingerprint) failure();
			fingerprints.add(raw.fingerprint);
			quarantine.push({
				fingerprint: raw.fingerprint,
				issue,
				...(raw.raw === undefined ? {} : { raw: raw.raw })
			});
		}
		return {
			version: 1,
			owner: { ...this.owner },
			...(value.deviceId === undefined ? {} : { deviceId: value.deviceId as string }),
			rows,
			quarantine
		};
	}
	private async read() {
		this.opened();
		const stored = await this.store.read(this.ownerKey);
		this.opened();
		return this.decode(stored);
	}
	private async mutate<T>(change: (data: JournalData) => T): Promise<T> {
		for (let attempt = 0; attempt < this.attempts; attempt++) {
			this.opened();
			const stored = await this.store.read(this.ownerKey);
			this.opened();
			const data = this.decode(stored),
				before = JSON.stringify(data),
				result = change(data),
				payload = JSON.stringify(data);
			if (payload === before) return result;
			if (payload.length > MAX_SQLITE_JOURNAL_CHARACTERS) failure('local-journal-too-large');
			if (await this.store.compareAndSwap(this.ownerKey, stored, payload)) return result;
		}
		return failure('storage-contention');
	}
	async snapshot(): Promise<ProgressGraph> {
		const data = await this.read();
		return analyzeProgressEvents(
			data.rows.flatMap((row) => row.variants),
			this.owner
		);
	}
	append(input: ProgressOperation, key: string): Promise<ProgressEvent> {
		const operation = parseProgressOperation(input);
		if (!operation || typeof key !== 'string' || !key || key.length > 512)
			return Promise.reject(new SqliteProgressJournalError('invalid-operation'));
		return this.mutate((data) => {
			const all = data.rows.flatMap((row) => row.variants),
				graph = analyzeProgressEvents(all, this.owner);
			const retries = all.filter((event) => event.operationKey === key);
			if (retries.length) {
				const existing = graph.events.find((event) => event.operationKey === key);
				if (
					!existing ||
					retries.some(
						(event) =>
							event.id !== existing.id ||
							progressFingerprint(event.operation) !== progressFingerprint(operation)
					)
				)
					failure('operation-conflict');
				return structuredClone(existing);
			}
			if (graph.heads.length > MAX_PROGRESS_PARENTS) failure('too-many-concurrent-branches');
			data.deviceId = this.deviceId ?? data.deviceId ?? this.idFactory();
			const recordedSequence = all.reduce(
				(max, event) => (event.deviceId === data.deviceId ? Math.max(max, event.sequence) : max),
				0
			);
			if (recordedSequence !== (graph.clock.get(data.deviceId) ?? 0))
				failure('actor-history-unavailable');
			const parsed = parseProgressEvent(
				{
					version: 1,
					...this.owner,
					id: this.idFactory(),
					deviceId: data.deviceId,
					sequence: (graph.clock.get(data.deviceId) ?? 0) + 1,
					logicalTime: graph.logicalTime + 1,
					parents: graph.heads,
					operationKey: key,
					operation
				},
				this.owner
			);
			if (!parsed.event) failure('invalid-clock-or-identity');
			if (data.rows.some((row) => row.id === parsed.event!.id)) failure('event-id-collision');
			data.rows.push({
				id: parsed.event.id,
				variants: [parsed.event],
				local: true,
				acknowledged: false
			});
			return structuredClone(parsed.event);
		});
	}
	async ingest(
		input: readonly unknown[]
	): Promise<{ accepted: number; rejected: ProgressIssue[] }> {
		const valid: ProgressEvent[] = [],
			rejected: ProgressIssue[] = [],
			quarantine: Quarantine[] = [];
		for (const original of input) {
			let raw: unknown;
			try {
				raw = structuredClone(original);
			} catch {
				raw = undefined;
			}
			const parsed = parseProgressEvent(raw, this.owner);
			if (parsed.event) {
				valid.push(parsed.event);
				continue;
			}
			const issue = { reason: parsed.reason! };
			rejected.push(issue);
			if (!record(raw) || raw.projectId !== this.owner.projectId || raw.uid !== this.owner.uid)
				continue;
			let rawCopy: unknown;
			try {
				const json = JSON.stringify(raw);
				if (json && json.length <= 65536) rawCopy = JSON.parse(json);
			} catch {
				/* Non-JSON is not a transport record. */
			}
			quarantine.push({
				fingerprint: progressFingerprint(rawCopy ?? issue),
				issue,
				...(rawCopy === undefined ? {} : { raw: rawCopy })
			});
		}
		return this.mutate((data) => {
			for (const event of valid) {
				const row = data.rows.find((row) => row.id === event.id);
				if (!row)
					data.rows.push({ id: event.id, variants: [event], local: false, acknowledged: true });
				else if (
					!row.variants.some((old) => progressFingerprint(old) === progressFingerprint(event))
				)
					row.variants.push(event);
			}
			for (const entry of quarantine) {
				const index = data.quarantine.findIndex((old) => old.fingerprint === entry.fingerprint);
				if (index < 0) data.quarantine.push(entry);
				else data.quarantine[index] = entry;
			}
			return { accepted: valid.length, rejected };
		});
	}
	async pending(): Promise<ProgressEvent[]> {
		const data = await this.read(),
			ids = new Set(
				data.rows
					.filter((row) => row.local && !row.acknowledged && row.variants.length === 1)
					.map((row) => row.id)
			);
		return analyzeProgressEvents(
			data.rows.flatMap((row) => row.variants),
			this.owner
		).events.filter((event) => ids.has(event.id));
	}
	async acknowledge(input: readonly ProgressEvent[]): Promise<void> {
		const events = input.map((raw) => {
			const parsed = parseProgressEvent(raw, this.owner);
			if (!parsed.event) failure('acknowledgement-owner-or-schema-mismatch');
			return parsed.event;
		});
		await this.mutate((data) => {
			for (const event of events) {
				const row = data.rows.find((row) => row.id === event.id);
				if (
					!row ||
					row.variants.length !== 1 ||
					progressFingerprint(row.variants[0]) !== progressFingerprint(event)
				)
					failure('acknowledgement-content-mismatch');
				row.acknowledged = true;
			}
		});
	}
	async quarantined() {
		const data = await this.read();
		return data.quarantine.map((entry) => ({ ownerKey: this.ownerKey, ...structuredClone(entry) }));
	}
	/** Closes this handle, never the app-owned shared SQL pool/connection. */
	async close(): Promise<void> {
		this.closed = true;
	}
}
