// Iteration 5 (local persistence): everything is keyed to the device/
// browser, never a user - no accounts, no login, see ARCHITECTURE.md's
// Storage section. This interface is deliberately backend-agnostic so a
// later SQLite/Tauri implementation (Iteration 7) can replace the
// localStorage one below without touching call sites.

import type { CardState as SchedulerState } from '@geoclick/srs';

// A packages/srs scheduler state plus the target it belongs to - the
// scheduler itself doesn't know about targets, only the repository layer
// needs to associate one with the other for storage.
export interface CardState extends SchedulerState {
	targetId: string;
}

// Mirrors packages/quiz-engine's QuizScore shape plus a timestamp - reuses
// an existing type's fields rather than inventing a new stats shape.
export interface SessionSummary {
	total: number;
	perfect: number;
	totalErrors: number;
	completedAt: string; // ISO date
}

export interface ProgressRepository {
	getCardStates(mapId: string): Promise<CardState[]>;
	saveCardState(mapId: string, state: CardState): Promise<void>;
	getLastSessionSummary(mapId: string): Promise<SessionSummary | undefined>;
	saveLastSessionSummary(mapId: string, summary: SessionSummary): Promise<void>;
	/** Forget one map's card states and last-session summary. Other maps untouched. */
	clearMap(mapId: string): Promise<void>;
	/** Forget ALL quiz progress on this device/backend. Progress only - UI
	 * preferences such as the chosen language are not progress and survive. */
	clearAll(): Promise<void>;
}

const STORAGE_PREFIX = 'geoclick:progress:v1';

function cardsKey(mapId: string): string {
	return `${STORAGE_PREFIX}:${mapId}:cards`;
}

function lastSessionKey(mapId: string): string {
	return `${STORAGE_PREFIX}:${mapId}:lastSession`;
}

// Local calendar date, not `toISOString().slice(0, 10)` - that's UTC, which
// would flip to "tomorrow" up to many hours before local midnight
// depending on timezone. "Today" here means the user's own day. Exported
// so callers (QuizView, the home page) compute "today" the same way the
// repository and packages/srs do - all three need to agree on what day it
// is for due-date comparisons to make sense.
export function todayLocalDate(): string {
	const d = new Date();
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Stored shapes are validated, not cast: a hand-edited or half-written value
// must read as "nothing saved yet", never as a CardState with undefined fields
// that crashes the scheduler later. `cleanStreak` may be absent - cards saved
// before v0.6.0 have no streak, and withCleanStreak fills it in.
function isCardState(value: unknown): value is CardState {
	if (!isRecord(value)) return false;
	return (
		typeof value.targetId === 'string' &&
		typeof value.easeFactor === 'number' &&
		typeof value.interval === 'number' &&
		typeof value.repetitions === 'number' &&
		typeof value.dueDate === 'string' &&
		typeof value.lastReviewedAt === 'string' &&
		(value.cleanStreak === undefined || typeof value.cleanStreak === 'number')
	);
}

function isCardStateArray(value: unknown): value is CardState[] {
	return Array.isArray(value) && value.every(isCardState);
}

function isSessionSummary(value: unknown): value is SessionSummary {
	if (!isRecord(value)) return false;
	return (
		typeof value.total === 'number' &&
		typeof value.perfect === 'number' &&
		typeof value.totalErrors === 'number' &&
		typeof value.completedAt === 'string'
	);
}

/**
 * Reads and validates one stored value. The whole access is inside the try,
 * not just JSON.parse: a disabled or sandboxed localStorage throws on getItem
 * itself (FT-57). Any failure - a throw, unparseable text, a value of the
 * wrong shape - reads as "nothing saved yet".
 */
function readJson<T>(key: string, isValue: (value: unknown) => value is T): T | undefined {
	try {
		if (typeof localStorage === 'undefined') return undefined;
		const raw = localStorage.getItem(key);
		if (!raw) return undefined;
		const parsed: unknown = JSON.parse(raw);
		return isValue(parsed) ? parsed : undefined;
	} catch {
		return undefined;
	}
}

let writeFailureLogged = false;

function writeJson(key: string, value: unknown): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch (e) {
		// setItem throws QuotaExceededError when storage is full, and in some
		// private-browsing modes always. Losing one save is better than the
		// quiz throwing mid-drag - same spirit as readJson's corrupt-data
		// guard. Logged once per page load, not once per drop.
		if (!writeFailureLogged) {
			writeFailureLogged = true;
			console.warn('Could not save quiz progress to localStorage; continuing without it.', e);
		}
	}
}

// The tutorial's sandbox (FT-10, docs/TUTORIAL.md "The sandbox"): while it's
// set, createProgressRepository keeps this one map's progress in `memory` and
// every other map goes to the real store. Set and cleared only through
// tutorialSandbox.svelte.ts.
let sandbox: { mapId: string; memory: ProgressRepository } | undefined;

export function setProgressSandbox(
	next: { mapId: string; memory: ProgressRepository } | undefined
): void {
	sandbox = next;
}

// Picks the SQLite-backed repository (desktop/src-tauri/src/lib.rs's
// migrations(), or capacitorProgressRepository.ts's identical schema on
// Android) when running inside the Tauri shell or a native Capacitor
// platform, localStorage otherwise - the one place that decides, so call
// sites (QuizView, the home page) stay backend-agnostic as designed.
// During the tutorial that real store comes wrapped in the sandbox.
export async function createProgressRepository(): Promise<ProgressRepository> {
	const real = await createRealProgressRepository();
	// The sandbox is read once, here: a repository handed out during the
	// tutorial keeps writing to that tutorial's memory even after it ends, so a
	// view still open at the end can never write sandbox results into real
	// progress. Views remount when the tutorial ends to pick up the real store.
	return sandbox ? createSandboxedProgressRepository(real, sandbox.memory, sandbox.mapId) : real;
}

/**
 * A repository and the card states it holds for one map, falling back to
 * memory if either opening the repository or reading it fails (FT-57). The
 * read is part of opening: the native repositories create their database
 * connection lazily, on the first read, so a real open failure surfaces here
 * rather than when the repository is created. The round is playable either
 * way; `failed` says its progress will not be saved. The `create` seam is for
 * tests.
 */
export async function loadPlayableCardStates(
	mapId: string,
	create: () => Promise<ProgressRepository> = createProgressRepository
): Promise<{ repository: ProgressRepository; cardStates: CardState[]; failed: boolean }> {
	try {
		const repository = await create();
		const cardStates = await repository.getCardStates(mapId);
		return { repository, cardStates, failed: false };
	} catch (e) {
		console.error('Could not read saved progress; this round will not be remembered.', e);
		return { repository: createInMemoryProgressRepository(), cardStates: [], failed: true };
	}
}

// Dynamic imports so a plain-browser build never pulls in
// @tauri-apps/plugin-sql or @capacitor-community/sqlite at all.
async function createRealProgressRepository(): Promise<ProgressRepository> {
	const { isTauri } = await import('@tauri-apps/api/core');
	if (isTauri()) {
		const { createSqliteProgressRepository } = await import('./sqliteProgressRepository');
		return createSqliteProgressRepository();
	}
	const { Capacitor } = await import('@capacitor/core');
	if (Capacitor.isNativePlatform()) {
		const { createCapacitorProgressRepository } = await import('./capacitorProgressRepository');
		return createCapacitorProgressRepository();
	}
	return createLocalStorageProgressRepository();
}

// Cards saved before v0.6.0 have no cleanStreak. Rather than migrate the
// stored JSON, every read fills it in as 0: "not known yet", which is what an
// unknown history should mean. The next clean answer starts a real streak.
function withCleanStreak(states: CardState[]): CardState[] {
	return states.map((state) =>
		state.cleanStreak === undefined ? { ...state, cleanStreak: 0 } : state
	);
}

export function createLocalStorageProgressRepository(): ProgressRepository {
	return {
		async getCardStates(mapId) {
			return withCleanStreak(readJson<CardState[]>(cardsKey(mapId), isCardStateArray) ?? []);
		},

		async saveCardState(mapId, state) {
			const states = readJson<CardState[]>(cardsKey(mapId), isCardStateArray) ?? [];
			const index = states.findIndex((s) => s.targetId === state.targetId);
			if (index === -1) states.push(state);
			else states[index] = state;
			writeJson(cardsKey(mapId), states);
		},

		async getLastSessionSummary(mapId) {
			return readJson<SessionSummary>(lastSessionKey(mapId), isSessionSummary);
		},

		async saveLastSessionSummary(mapId, summary) {
			writeJson(lastSessionKey(mapId), summary);
		},

		async clearMap(mapId) {
			try {
				if (typeof localStorage === 'undefined') return;
				// Exact keys, not a prefix match: clearing "italy-regions" must
				// never touch a map whose id merely starts with that.
				localStorage.removeItem(cardsKey(mapId));
				localStorage.removeItem(lastSessionKey(mapId));
			} catch (e) {
				console.warn('Could not clear saved progress for this map.', e);
			}
		},

		async clearAll() {
			try {
				if (typeof localStorage === 'undefined') return;
				// Only our progress namespace - the UI language
				// (geoclick:language:v1) and anything else sharing the origin
				// stays. Collect first: removing while indexing by key(i) would
				// skip entries.
				const ours: string[] = [];
				for (let i = 0; i < localStorage.length; i++) {
					const key = localStorage.key(i);
					if (key?.startsWith(`${STORAGE_PREFIX}:`)) ours.push(key);
				}
				for (const key of ours) localStorage.removeItem(key);
			} catch (e) {
				console.warn('Could not clear saved progress.', e);
			}
		}
	};
}

// Progress held in memory only, gone when the page is (FT-10). The tutorial's
// sandbox uses it for its map. Values are copied in and out, so a caller that
// mutates what it read or saved can't change what's stored - the same as
// the JSON round trip in the localStorage repository.
export function createInMemoryProgressRepository(): ProgressRepository {
	const cards = new Map<string, CardState[]>();
	const summaries = new Map<string, SessionSummary>();
	return {
		async getCardStates(mapId) {
			return (cards.get(mapId) ?? []).map((s) => ({ ...s }));
		},

		async saveCardState(mapId, state) {
			const states = cards.get(mapId) ?? [];
			const index = states.findIndex((s) => s.targetId === state.targetId);
			if (index === -1) states.push({ ...state });
			else states[index] = { ...state };
			cards.set(mapId, states);
		},

		async getLastSessionSummary(mapId) {
			const summary = summaries.get(mapId);
			return summary && { ...summary };
		},

		async saveLastSessionSummary(mapId, summary) {
			summaries.set(mapId, { ...summary });
		},

		async clearMap(mapId) {
			cards.delete(mapId);
			summaries.delete(mapId);
		},

		async clearAll() {
			cards.clear();
			summaries.clear();
		}
	};
}

// The tutorial's view of progress: `sandboxedMapId` lives in `memory`, every
// other map in `real`. Only Italy - Regions is sandboxed (FEATURE_PLAN.md,
// decision 18), so the home page keeps showing real progress for the other
// maps and a map played while the tutorial is paused is saved as usual.
export function createSandboxedProgressRepository(
	real: ProgressRepository,
	memory: ProgressRepository,
	sandboxedMapId: string
): ProgressRepository {
	const pick = (mapId: string) => (mapId === sandboxedMapId ? memory : real);
	return {
		getCardStates: (mapId) => pick(mapId).getCardStates(mapId),
		saveCardState: (mapId, state) => pick(mapId).saveCardState(mapId, state),
		getLastSessionSummary: (mapId) => pick(mapId).getLastSessionSummary(mapId),
		saveLastSessionSummary: (mapId, summary) => pick(mapId).saveLastSessionSummary(mapId, summary),
		clearMap: (mapId) => pick(mapId).clearMap(mapId),
		// "Forget all progress" is a real request, so it reaches the real store
		// too; nothing calls it during the tutorial today.
		clearAll: async () => {
			await memory.clearAll();
			await real.clearAll();
		}
	};
}
