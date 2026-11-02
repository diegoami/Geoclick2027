// Delivery-only V2 protocol. Production account factories remain on V1 until
// durable checkpoints and migration/controller acceptance land separately.
import type { Auth } from 'firebase/auth';
import {
	collection,
	doc,
	getDoc,
	getDocs,
	limit,
	orderBy,
	query,
	runTransaction,
	where,
	type Firestore
} from 'firebase/firestore/lite';
import {
	createFirestoreProgressTransport,
	decodeCloudProgressEvent,
	encodeCloudProgressEvent
} from './firestoreProgressTransport';
import { progressFingerprint, type ProgressEvent, type ProgressOwner } from './progressEvents';
import { ProgressSyncError } from './progressSync';
export interface ProgressDeliveryHead {
	version: 2;
	sequence: number;
	lastEventId: string | null;
}
const sequence = (value: unknown): value is number =>
	Number.isSafeInteger(value) && (value as number) >= 0;
export function parseProgressDeliveryHead(input: unknown): ProgressDeliveryHead {
	const v = input as Partial<ProgressDeliveryHead> | null;
	if (
		!v ||
		typeof v !== 'object' ||
		Array.isArray(v) ||
		Object.keys(v).length !== 3 ||
		v.version !== 2 ||
		!sequence(v.sequence) ||
		(v.sequence === 0
			? v.lastEventId !== null
			: typeof v.lastEventId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(v.lastEventId))
	)
		throw new ProgressSyncError('unsupported-delivery-head');
	return { version: 2, sequence: v.sequence, lastEventId: v.lastEventId as string | null };
}
export interface SequencedProgressTransport {
	readonly owner: Readonly<ProgressOwner>;
	currentOwner(): Readonly<ProgressOwner> | undefined;
	/** Creates the per-account freeze only when explicitly called. */
	open(): Promise<ProgressDeliveryHead>;
	head(): Promise<ProgressDeliveryHead>;
	pullLegacy(
		after: string | undefined,
		count: number
	): Promise<{ records: unknown[]; next?: string }>;
	pull(
		after: number,
		through: number,
		count: number
	): Promise<{ records: unknown[]; sequence: number }>;
	put(event: ProgressEvent): Promise<number>;
}
export function createSequencedProgressTransport(
	db: Firestore,
	auth: Auth
): SequencedProgressTransport {
	// Reuse the existing exact app/project/identity-lifetime checks and legacy decoder.
	const legacy = createFirestoreProgressTransport(db, auth);
	const { owner, currentOwner } = legacy;
	const headRef = doc(db, 'users', owner.uid, 'progressSyncV2', 'head');
	const events = collection(db, 'users', owner.uid, 'progressEventsV2');
	let opened = false;
	function active(requireOpen = true): void {
		if (!currentOwner()) throw new ProgressSyncError('account-changed');
		if (requireOpen && !opened) throw new ProgressSyncError('delivery-not-open');
	}
	function pageSize(count: number): void {
		if (!Number.isInteger(count) || count < 1 || count > 100)
			throw new ProgressSyncError('invalid-page-size');
	}
	return {
		owner,
		currentOwner,
		async open() {
			active(false);
			let result: ProgressDeliveryHead;
			try {
				result = await runTransaction(db, async (transaction) => {
					active(false);
					const existing = await transaction.get(headRef);
					active(false);
					if (existing.exists()) return parseProgressDeliveryHead(existing.data());
					const initial: ProgressDeliveryHead = { version: 2, sequence: 0, lastEventId: null };
					transaction.set(headRef, initial);
					return initial;
				});
			} catch (error) {
				active(false);
				if (
					!error ||
					typeof error !== 'object' ||
					!('code' in error) ||
					error.code !== 'permission-denied'
				)
					throw error;
				// A concurrent initializer can make our now-stale create an invalid
				// head update. A valid authorized existing head proves cutover is done.
				const existing = await getDoc(headRef);
				active(false);
				if (!existing.exists()) throw error;
				result = parseProgressDeliveryHead(existing.data());
			}
			active(false);
			opened = true;
			return result;
		},
		async head() {
			active();
			const result = await getDoc(headRef);
			active();
			return parseProgressDeliveryHead(result.data());
		},
		async pullLegacy(after, count) {
			active();
			pageSize(count);
			const result = await legacy.pull(after, count);
			active();
			return result;
		},
		async pull(after, through, count) {
			active();
			pageSize(count);
			if (!sequence(after) || !sequence(through) || through < after)
				throw new ProgressSyncError('invalid-delivery-cursor');
			if (after === through) return { records: [], sequence: after };
			const page = await getDocs(
				query(
					events,
					where('sequence', '>', after),
					where('sequence', '<=', through),
					orderBy('sequence'),
					limit(count)
				)
			);
			active();
			if (page.size !== Math.min(count, through - after))
				throw new ProgressSyncError('incomplete-delivery');
			const records = page.docs.map((record, index) => {
				const data = record.data();
				if (
					Object.keys(data).length !== 2 ||
					data.sequence !== after + index + 1 ||
					!('event' in data)
				)
					throw new ProgressSyncError('unsupported-delivery-page');
				return decodeCloudProgressEvent(record.id, data.event);
			});
			return { records, sequence: after + records.length };
		},
		async put(event) {
			active();
			const encoded = encodeCloudProgressEvent(event, owner);
			const eventRef = doc(events, event.id);
			// Rules can reject a stale proposed sequence before an optimistic SDK
			// transaction reports ABORTED. Retry only if a fresh authorized head
			// proves another writer advanced it; never blindly retry permission errors.
			for (let attempt = 0; ; attempt++) {
				let observed: number | undefined;
				try {
					const result = await runTransaction(db, async (transaction) => {
						active();
						const existing = await transaction.get(eventRef);
						active();
						if (existing.exists()) {
							const data = existing.data();
							if (
								Object.keys(data).length !== 2 ||
								!sequence(data.sequence) ||
								data.sequence === 0 ||
								progressFingerprint(data.event) !== progressFingerprint(encoded)
							)
								throw new ProgressSyncError('conflicting-delivery-event');
							return data.sequence;
						}
						const head = parseProgressDeliveryHead((await transaction.get(headRef)).data());
						active();
						observed = head.sequence;
						if (head.sequence === Number.MAX_SAFE_INTEGER)
							throw new ProgressSyncError('delivery-sequence-exhausted');
						const next = head.sequence + 1;
						transaction.set(eventRef, { sequence: next, event: encoded });
						transaction.set(headRef, { version: 2, sequence: next, lastEventId: event.id });
						return next;
					});
					active();
					return result;
				} catch (error) {
					active();
					if (
						attempt >= 4 ||
						observed === undefined ||
						!error ||
						typeof error !== 'object' ||
						!('code' in error) ||
						error.code !== 'permission-denied'
					)
						throw error;
					const latest = await getDoc(headRef);
					active();
					if (parseProgressDeliveryHead(latest.data()).sequence <= observed) throw error;
				}
			}
		}
	};
}
