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

function writeJson(key: string, value: unknown): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(key, JSON.stringify(value));
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
		}
	};
}
