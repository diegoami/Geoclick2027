// Explicit bounded sync cycles. Local commits never wait for this transport.
import {
	parseProgressEvent,
	progressOwnerKey,
	type ProgressEvent,
	type ProgressIssue,
	type ProgressJournal,
	type ProgressOwner
} from './progressEvents';
export interface SyncProgressJournal extends ProgressJournal {
	ingest(records: readonly unknown[]): Promise<{ accepted: number; rejected: ProgressIssue[] }>;
	pending(): Promise<ProgressEvent[]>;
	acknowledge(events: readonly ProgressEvent[]): Promise<void>;
}
export interface ProgressTransport {
	readonly owner: Readonly<ProgressOwner>;
	currentOwner(): Readonly<ProgressOwner> | undefined;
	pull(after: string | undefined, limit: number): Promise<{ records: unknown[]; next?: string }>;
	put(event: ProgressEvent): Promise<void>;
}
export class ProgressSyncError extends Error {
	constructor(readonly code: string) {
		super(code);
		this.name = 'ProgressSyncError';
	}
}
export type ProgressSyncState = 'idle' | 'syncing' | 'synced' | 'pending' | 'error' | 'stopped';
export interface ProgressSyncResult {
	downloaded: number;
	uploaded: number;
	pending: number;
}
/** One instance per authenticated lifetime. stop() is irreversible, including same-UID re-login. */
export class ProgressSync {
	private stopped = false;
	private running?: Promise<ProgressSyncResult>;
	private readonly ownerKey: string;
	private stateValue: ProgressSyncState = 'idle';
	get state(): ProgressSyncState {
		return this.stateValue;
	}
	constructor(
		private readonly journal: SyncProgressJournal,
		private readonly transport: ProgressTransport
	) {
		this.ownerKey = progressOwnerKey(journal.owner);
		if (this.ownerKey !== progressOwnerKey(transport.owner))
			throw new ProgressSyncError('owner-mismatch');
	}
	stop(): void {
		this.stopped = true;
		this.stateValue = 'stopped';
	}
	private active(): void {
		if (this.stopped) throw new ProgressSyncError('sync-stopped');
		const current = this.transport.currentOwner();
		if (!current || progressOwnerKey(current) !== this.ownerKey) {
			this.stop();
			throw new ProgressSyncError('account-changed');
		}
	}
	sync(): Promise<ProgressSyncResult> {
		if (this.running) return this.running;
		this.running = this.cycle()
			.catch((error: unknown) => {
				if (!this.stopped) this.stateValue = 'error';
				throw error;
			})
			.finally(() => {
				this.running = undefined;
			});
		return this.running;
	}
	private async cycle(): Promise<ProgressSyncResult> {
		this.active();
		this.stateValue = 'syncing';
		let downloaded = 0,
			uploaded = 0,
			after: string | undefined;
		// Always rescan: random event IDs are not a chronological change cursor.
		do {
			this.active();
			const page = await this.transport.pull(after, 100);
			this.active();
			if (
				page.records.length > 100 ||
				(page.next !== undefined &&
					(page.records.length !== 100 ||
						!page.next ||
						(after !== undefined && page.next <= after)))
			)
				throw new ProgressSyncError('invalid-page');
			downloaded += page.records.length;
			if (downloaded > 10000) throw new ProgressSyncError('history-limit');
			const receipt = await this.journal.ingest(page.records);
			this.active();
			if (receipt.rejected.length) throw new ProgressSyncError('unsupported-remote-history');
			after = page.next;
		} while (after !== undefined);
		const graph = await this.journal.snapshot();
		this.active();
		if (graph.quarantined.length || graph.deferred.length)
			throw new ProgressSyncError('incomplete-history');
		const pending = await this.journal.pending();
		this.active();
		// Bound work/cost. The caller schedules a later cycle if more remain.
		for (const raw of pending.slice(0, 100)) {
			this.active();
			const parsed = parseProgressEvent(raw, this.journal.owner);
			if (!parsed.event) throw new ProgressSyncError('invalid-pending-event');
			await this.transport.put(parsed.event);
			this.active();
			await this.journal.acknowledge([parsed.event]);
			this.active();
			uploaded++;
		}
		const remaining = (await this.journal.pending()).length;
		this.active();
		this.stateValue = remaining ? 'pending' : 'synced';
		return { downloaded, uploaded, pending: remaining };
	}
}
