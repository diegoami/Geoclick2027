import { createAccountProgressRepository } from './accountProgressRepository';
import {
	GuestProgressImporter,
	type GuestImportPreview,
	type ImportMap
} from './guestProgressImport';
import { ProgressSync, type ProgressTransport, type SyncProgressJournal } from './progressSync';
import { progressOwnerKey, type ProgressOwner } from './progressEvents';
import type { ProgressRepository } from './progressRepository';
export interface BrowserAccountIdentity extends ProgressOwner {
	label: string;
}
export interface BrowserAccountAuth {
	current(): BrowserAccountIdentity | undefined;
	observe(listener: (identity: BrowserAccountIdentity | undefined) => void): () => void;
	signIn(remember: boolean): Promise<void>;
	signOut(): Promise<void>;
}
export interface BrowserAccountState {
	identity?: BrowserAccountIdentity;
	usingAccount: boolean;
	busy: boolean;
	sync: 'idle' | 'pending' | 'syncing' | 'synced' | 'error';
	error?: 'signin' | 'signout' | 'storage' | 'sync' | 'import';
	preview?: GuestImportPreview;
	imported?: number;
}
interface Dependencies {
	auth: BrowserAccountAuth;
	guest: ProgressRepository;
	maps: readonly ImportMap[];
	open(
		identity: BrowserAccountIdentity
	): Promise<{ journal: SyncProgressJournal; transport: ProgressTransport }>;
	bind(repository: ProgressRepository | undefined): void;
	changed(state: BrowserAccountState): void;
	progressChanged(): void;
	/** Tests drive explicit cycles. Runtime also retries on foreground/online. */
	automatic?: boolean;
	canSync?: () => boolean;
}
/** One browser app lifetime. All detached callbacks remain bound to their original journal. */
export class BrowserAccountSession {
	private value: BrowserAccountState = { usingAccount: false, busy: false, sync: 'idle' };
	get state(): BrowserAccountState {
		return this.value;
	}
	private generation = 0;
	private lifetime?: {
		generation: number;
		sync: ProgressSync;
		importer: GuestProgressImporter;
		journal: SyncProgressJournal;
	};
	private timer?: ReturnType<typeof setTimeout>;
	private due = Infinity;
	private failures = 0;
	private lastAttempt = 0;
	private unobserve?: () => void;
	private disposed = false;
	private allowIdentity = true;
	private actionCounter = 0;
	constructor(private readonly deps: Dependencies) {}
	start(): void {
		this.unobserve = this.deps.auth.observe((identity) => {
			void this.accept(identity);
		});
	}
	private update(patch: Partial<BrowserAccountState>): void {
		this.value = Object.freeze({ ...this.value, ...patch });
		this.deps.changed(this.value);
	}
	private detach(): number {
		const generation = ++this.generation;
		if (this.timer) clearTimeout(this.timer);
		this.timer = undefined;
		this.due = Infinity;
		this.lifetime?.sync.stop();
		this.lifetime = undefined;
		this.deps.bind(undefined);
		// Do not close the old journal under an already captured quiz write. IndexedDB
		// connections die with the page; old repositories cannot acquire a new owner.
		this.value = { usingAccount: false, busy: false, sync: 'idle' };
		return generation;
	}
	private active(generation: number): boolean {
		return !this.disposed && generation === this.generation;
	}
	private async accept(identity: BrowserAccountIdentity | undefined): Promise<void> {
		if (identity && !this.allowIdentity) {
			void this.deps.auth
				.signOut()
				.catch(() => this.update({ identity, error: 'signout', busy: false }));
			return;
		}
		const generation = this.detach();
		this.update({ identity, busy: !!identity });
		if (!identity || this.disposed) return;
		try {
			const { journal, transport } = await this.deps.open(identity);
			if (
				progressOwnerKey(journal.owner) !== progressOwnerKey(identity) ||
				progressOwnerKey(transport.owner) !== progressOwnerKey(identity)
			)
				throw new Error('owner-mismatch');
			await journal.snapshot(); // Storage must work before changing the player's destination.
			if (!this.active(generation)) return;
			const maps = new Map(this.deps.maps.map((map) => [map.mapId, map.targetIds]));
			const observed = {
				owner: journal.owner,
				snapshot: () => journal.snapshot(),
				append: async (...args: Parameters<SyncProgressJournal['append']>) => {
					const event = await journal.append(...args);
					if (this.active(generation)) {
						this.update({ sync: 'pending' });
						this.schedule(Math.max(2000, 30000 - (Date.now() - this.lastAttempt)));
					}
					return event;
				}
			};
			const repository = createAccountProgressRepository(observed, async (mapId) => {
				const ids = maps.get(mapId);
				if (!ids) throw new Error('unknown-map');
				return ids;
			});
			const sync = new ProgressSync(journal, transport);
			const importer = new GuestProgressImporter(this.deps.guest, observed, () =>
				this.active(generation) ? identity : undefined
			);
			this.lifetime = { generation, sync, importer, journal };
			this.deps.bind(repository);
			this.update({ usingAccount: true, busy: false, sync: 'pending', error: undefined });
			void this.refresh();
		} catch {
			if (this.active(generation)) this.update({ busy: false, error: 'storage' });
		}
	}
	async signIn(remember: boolean): Promise<void> {
		if (this.value.busy || this.disposed) return;
		this.allowIdentity = true;
		const action = ++this.actionCounter;
		this.update({ busy: true, error: undefined, preview: undefined });
		try {
			await this.deps.auth.signIn(remember);
		} catch {
			if (
				!this.disposed &&
				action === this.actionCounter &&
				this.allowIdentity &&
				!this.value.identity
			)
				this.update({ busy: false, error: 'signin' });
		}
	}
	async signOut(): Promise<void> {
		const identity = this.value.identity;
		this.allowIdentity = false;
		const action = ++this.actionCounter;
		this.detach();
		this.update({ identity, busy: true });
		try {
			await this.deps.auth.signOut();
			if (!this.disposed && action === this.actionCounter)
				this.update({ identity: undefined, busy: false, error: undefined });
		} catch {
			if (!this.disposed && action === this.actionCounter)
				this.update({ identity, busy: false, error: 'signout' });
		}
	}
	private schedule(delay: number): void {
		if (this.deps.automatic === false || !this.lifetime || this.disposed) return;
		const due = Date.now() + delay;
		if (due >= this.due) return;
		if (this.timer) clearTimeout(this.timer);
		this.due = due;
		this.timer = setTimeout(() => {
			this.timer = undefined;
			this.due = Infinity;
			void this.refresh();
		}, delay);
	}
	async refresh(): Promise<boolean> {
		const lifetime = this.lifetime;
		if (!lifetime || this.disposed) return false;
		if (this.deps.canSync && !this.deps.canSync()) {
			this.update({ sync: 'pending' });
			this.schedule(120000);
			return false;
		}
		this.lastAttempt = Date.now();
		this.update({ sync: 'syncing' });
		try {
			const result = await lifetime.sync.sync();
			if (!this.active(lifetime.generation)) return false;
			this.failures = 0;
			this.update({ sync: result.pending ? 'pending' : 'synced', error: undefined });
			this.deps.progressChanged();
			if (result.pending) this.schedule(30000); // No idle history polling on the free tier.
			return true;
		} catch (error) {
			if (this.active(lifetime.generation)) {
				const code =
					typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
				if (
					typeof code === 'string' &&
					[
						'permission-denied',
						'unauthenticated',
						'unavailable',
						'resource-exhausted',
						'failed-precondition',
						'deadline-exceeded',
						'history-limit',
						'incomplete-history',
						'unsupported-remote-history'
					].includes(code)
				)
					console.warn('Account synchronization failed:', code);
				this.update({ sync: 'error', error: 'sync' });
				this.schedule(Math.min(300000, 30000 * 2 ** Math.min(this.failures++, 4)));
			}
			return false;
		}
	}
	foreground(): void {
		if (Date.now() - this.lastAttempt >= 30000) void this.refresh();
	}
	async retry(): Promise<void> {
		if (this.lifetime) await this.refresh();
		else await this.accept(this.deps.auth.current());
	}
	async prepareImport(): Promise<void> {
		const lifetime = this.lifetime;
		if (!lifetime || this.value.busy) return;
		this.update({ busy: true, preview: undefined, imported: undefined });
		try {
			if (!(await this.refresh())) throw new Error('history-unavailable');
			const preview = await lifetime.importer.prepare(this.deps.maps);
			if (this.active(lifetime.generation)) this.update({ preview, busy: false, error: undefined });
		} catch {
			if (this.active(lifetime.generation)) this.update({ busy: false, error: 'import' });
		}
	}
	dismissImport(): void {
		this.update({ preview: undefined, imported: undefined });
	}
	async confirmImport(): Promise<void> {
		const lifetime = this.lifetime,
			preview = this.value.preview;
		if (!lifetime || !preview || this.value.busy) return;
		this.update({ busy: true });
		try {
			if (!(await this.refresh())) throw new Error('history-unavailable');
			const result = await lifetime.importer.confirm(preview);
			if (!this.active(lifetime.generation)) return;
			this.update({ busy: false, preview: undefined, imported: result.accepted, error: undefined });
			this.deps.progressChanged();
			await this.refresh();
		} catch {
			if (this.active(lifetime.generation)) this.update({ busy: false, error: 'import' });
		}
	}
	dispose(): void {
		this.disposed = true;
		this.unobserve?.();
		this.detach();
	}
}
