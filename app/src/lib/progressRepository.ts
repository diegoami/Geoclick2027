// Iteration 5 (local persistence): everything is keyed to the device/
// browser, never a user - no accounts, no login, see ARCHITECTURE.md's
// Storage section. This interface is deliberately backend-agnostic so a
// later SQLite/Tauri implementation (Iteration 7) can replace the
// localStorage one below without touching call sites.

// Per-(mapId, targetId) spaced-repetition card state. Nothing writes this
// yet - Iteration 6 (packages/srs) is what actually produces these values
// via an SM-2 scheduler. The repository just needs to be able to store
// and retrieve them once it does.
export interface CardState {
	targetId: string;
	easeFactor: number;
	interval: number; // days
	repetitions: number;
	dueDate: string; // ISO date
	lastReviewedAt: string; // ISO date
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
}

const STORAGE_PREFIX = 'geoclick:progress:v1';

function cardsKey(mapId: string): string {
	return `${STORAGE_PREFIX}:${mapId}:cards`;
}

function lastSessionKey(mapId: string): string {
	return `${STORAGE_PREFIX}:${mapId}:lastSession`;
}

function readJson<T>(key: string): T | undefined {
	if (typeof localStorage === 'undefined') return undefined;
	const raw = localStorage.getItem(key);
	if (!raw) return undefined;
	try {
		return JSON.parse(raw) as T;
	} catch {
		// Corrupt/foreign data under our own key shouldn't crash the app -
		// treat it the same as "nothing saved yet".
		return undefined;
	}
}

function writeJson(key: string, value: unknown): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(key, JSON.stringify(value));
}

export function createLocalStorageProgressRepository(): ProgressRepository {
	return {
		async getCardStates(mapId) {
			return readJson<CardState[]>(cardsKey(mapId)) ?? [];
		},

		async saveCardState(mapId, state) {
			const states = readJson<CardState[]>(cardsKey(mapId)) ?? [];
			const index = states.findIndex((s) => s.targetId === state.targetId);
			if (index === -1) states.push(state);
			else states[index] = state;
			writeJson(cardsKey(mapId), states);
		},

		async getLastSessionSummary(mapId) {
			return readJson<SessionSummary>(lastSessionKey(mapId));
		},

		async saveLastSessionSummary(mapId, summary) {
			writeJson(lastSessionKey(mapId), summary);
		}
	};
}
