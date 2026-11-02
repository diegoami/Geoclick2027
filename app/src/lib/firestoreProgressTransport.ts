// Firestore Lite has no persistent cache or SDK-owned offline write queue.
import type { Auth } from 'firebase/auth';
import {
	collection,
	doc,
	documentId,
	getDocs,
	limit,
	orderBy,
	query,
	setDoc,
	startAfter,
	type Firestore,
	type QueryConstraint
} from 'firebase/firestore/lite';
import {
	parseProgressEvent,
	progressOwnerKey,
	type ProgressEvent,
	type ProgressOwner
} from './progressEvents';
import { ProgressSyncError, type ProgressTransport } from './progressSync';
/** A string frontier permits complete bounded element validation in Firestore rules. */
export function encodeCloudProgressEvent(
	input: ProgressEvent,
	owner: ProgressOwner
): Record<string, unknown> {
	const parsed = parseProgressEvent(input, owner);
	if (!parsed.event) throw new ProgressSyncError('invalid-event');
	const event = parsed.event;
	if (event.operation.kind === 'import-map' && event.operation.records.confusions) {
		const confusions = event.operation.records.confusions
			.map((c) => `${c.targetId}\t${c.chosenId}\t${c.count}`)
			.join('\n');
		return {
			...event,
			parents: event.parents.join(','),
			operation: { ...event.operation, records: { ...event.operation.records, confusions } }
		};
	}
	return { ...event, parents: event.parents.join(',') };
}
export function decodeCloudProgressEvent(id: string, input: unknown): unknown {
	if (!input || typeof input !== 'object' || Array.isArray(input)) return input;
	const record = input as Record<string, unknown>;
	// Keep malformed own-account records visible to the journal quarantine.
	if (record.id !== id || typeof record.parents !== 'string') return { ...record, version: -1 };
	let operation = record.operation;
	if (operation && typeof operation === 'object' && !Array.isArray(operation)) {
		const op = operation as Record<string, unknown>;
		if (
			op.kind === 'import-map' &&
			op.records &&
			typeof op.records === 'object' &&
			!Array.isArray(op.records)
		) {
			const records = op.records as Record<string, unknown>;
			if ('confusions' in records) {
				if (typeof records.confusions !== 'string' || records.confusions.length > 10439)
					return { ...record, version: -1 };
				const entries = records.confusions ? records.confusions.split('\n') : [];
				if (entries.length > 20) return { ...record, version: -1 };
				const confusions = [];
				for (const raw of entries) {
					const parts = typeof raw === 'string' ? raw.split('\t') : [];
					if (parts.length !== 3 || !/^([1-9][0-9]{0,5}|1000000)$/.test(parts[2]))
						return { ...record, version: -1 };
					// The journal's closed operation parser validates the decoded target IDs.
					confusions.push({ targetId: parts[0], chosenId: parts[1], count: Number(parts[2]) });
				}
				operation = { ...op, records: { ...records, confusions } };
			}
		}
	}
	return { ...record, operation, parents: record.parents ? record.parents.split(',') : [] };
}
export function createFirestoreProgressTransport(db: Firestore, auth: Auth): ProgressTransport {
	const user = auth.currentUser,
		projectId = db.app.options.projectId;
	if (!user || !projectId || db.app !== auth.app)
		throw new ProgressSyncError('auth-project-mismatch');
	const owner = Object.freeze({ projectId, uid: user.uid });
	progressOwnerKey(owner);
	const currentOwner = () => (auth.currentUser === user ? owner : undefined);
	function active(): void {
		if (!currentOwner()) throw new ProgressSyncError('account-changed');
	}
	const events = collection(db, 'users', owner.uid, 'progressEventsV1');
	return {
		owner,
		currentOwner,
		async pull(after, count) {
			active();
			if (!Number.isInteger(count) || count < 1 || count > 100)
				throw new ProgressSyncError('invalid-page-size');
			const constraints: QueryConstraint[] = [orderBy(documentId()), limit(count)];
			if (after !== undefined) constraints.push(startAfter(after));
			const result = await getDocs(query(events, ...constraints));
			active();
			return {
				records: result.docs.map((record) => decodeCloudProgressEvent(record.id, record.data())),
				...(result.size === count ? { next: result.docs[result.size - 1].id } : {})
			};
		},
		async put(event) {
			active();
			const encoded = encodeCloudProgressEvent(event, owner);
			// Rules allow creation or an EXACT retry; changed existing IDs are denied.
			await setDoc(doc(events, event.id), encoded);
			active();
		}
	};
}
