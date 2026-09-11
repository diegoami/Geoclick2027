import { describe, it, expect, beforeEach } from 'vitest';
import {
	createLocalStorageProgressRepository,
	type CardState,
	type SessionSummary
} from './progressRepository';

class MemoryStorage implements Storage {
	private store = new Map<string, string>();
	get length() {
		return this.store.size;
	}
	clear() {
		this.store.clear();
	}
	getItem(key: string) {
		return this.store.has(key) ? this.store.get(key)! : null;
	}
	key(index: number) {
		return [...this.store.keys()][index] ?? null;
	}
	removeItem(key: string) {
		this.store.delete(key);
	}
	setItem(key: string, value: string) {
		this.store.set(key, value);
	}
}

beforeEach(() => {
	// Node has no global localStorage - stand in a fresh in-memory one per
	// test so the repository's SSR guard (`typeof localStorage === 'undefined'`)
	// doesn't short-circuit everything to no-ops here.
	globalThis.localStorage = new MemoryStorage();
});

const sampleCard: CardState = {
	targetId: 'Abruzzo',
	easeFactor: 2.5,
	interval: 1,
	repetitions: 1,
	dueDate: '2026-09-12',
	lastReviewedAt: '2026-09-11'
};

const sampleSummary: SessionSummary = {
	total: 20,
	perfect: 18,
	totalErrors: 3,
	completedAt: '2026-09-11T12:00:00.000Z'
};

describe('localStorage progress repository', () => {
	it('has no card states for a map that has never been saved to', async () => {
		const repo = createLocalStorageProgressRepository();
		expect(await repo.getCardStates('italy-regions')).toEqual([]);
	});

	it('saves and retrieves a card state', async () => {
		const repo = createLocalStorageProgressRepository();
		await repo.saveCardState('italy-regions', sampleCard);
		expect(await repo.getCardStates('italy-regions')).toEqual([sampleCard]);
	});

	it('updates an existing card state by targetId instead of duplicating it', async () => {
		const repo = createLocalStorageProgressRepository();
		await repo.saveCardState('italy-regions', sampleCard);
		const updated: CardState = { ...sampleCard, repetitions: 2, interval: 3 };
		await repo.saveCardState('italy-regions', updated);
		expect(await repo.getCardStates('italy-regions')).toEqual([updated]);
	});

	it('keeps card state separate per map', async () => {
		const repo = createLocalStorageProgressRepository();
		await repo.saveCardState('italy-regions', sampleCard);
		expect(await repo.getCardStates('germany-states')).toEqual([]);
	});

	it('has no last-session summary for a map that has never been played', async () => {
		const repo = createLocalStorageProgressRepository();
		expect(await repo.getLastSessionSummary('italy-regions')).toBeUndefined();
	});

	it('saves and retrieves the last session summary', async () => {
		const repo = createLocalStorageProgressRepository();
		await repo.saveLastSessionSummary('italy-regions', sampleSummary);
		expect(await repo.getLastSessionSummary('italy-regions')).toEqual(sampleSummary);
	});

	it('overwrites the previous session summary rather than accumulating history', async () => {
		const repo = createLocalStorageProgressRepository();
		await repo.saveLastSessionSummary('italy-regions', sampleSummary);
		const second: SessionSummary = { ...sampleSummary, perfect: 20, totalErrors: 0 };
		await repo.saveLastSessionSummary('italy-regions', second);
		expect(await repo.getLastSessionSummary('italy-regions')).toEqual(second);
	});

	it('ignores corrupt data under its own key instead of throwing', async () => {
		localStorage.setItem('geoclick:progress:v1:italy-regions:lastSession', '{not json');
		const repo = createLocalStorageProgressRepository();
		expect(await repo.getLastSessionSummary('italy-regions')).toBeUndefined();
	});
});
