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

// Picks the SQLite-backed repository (desktop/src-tauri/src/lib.rs's
// migrations(), or capacitorProgressRepository.ts's identical schema on
// Android) when running inside the Tauri shell or a native Capacitor
// platform, localStorage otherwise - the one place that decides, so call
// sites (QuizView, the home page) stay backend-agnostic as designed.
// Dynamic imports so a plain-browser build never pulls in
// @tauri-apps/plugin-sql or @capacitor-community/sqlite at all.
export async function createProgressRepository(): Promise<ProgressRepository> {
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
		},

		async clearMap(mapId) {
			if (typeof localStorage === 'undefined') return;
			// Exact keys, not a prefix match: clearing "italy-regions" must never
			// touch a map whose id merely starts with that.
			localStorage.removeItem(cardsKey(mapId));
			localStorage.removeItem(lastSessionKey(mapId));
		},

		async clearAll() {
			if (typeof localStorage === 'undefined') return;
			// Only our progress namespace - the UI language (geoclick:language:v1)
			// and anything else sharing the origin stays. Collect first: removing
			// while indexing by key(i) would skip entries.
			const ours: string[] = [];
			for (let i = 0; i < localStorage.length; i++) {
				const key = localStorage.key(i);
				if (key?.startsWith(`${STORAGE_PREFIX}:`)) ours.push(key);
			}
			for (const key of ours) localStorage.removeItem(key);
		}
	};
}
