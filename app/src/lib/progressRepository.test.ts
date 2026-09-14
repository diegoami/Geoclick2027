import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	createInMemoryProgressRepository,
	createLocalStorageProgressRepository,
	createSandboxedProgressRepository,
	todayLocalDate,
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

describe('localStorage progress repository - clearing (GC-041)', () => {
	async function seed(repo: ReturnType<typeof createLocalStorageProgressRepository>) {
		for (const mapId of ['italy-regions', 'italy-regions-2', 'germany-states']) {
			await repo.saveCardState(mapId, sampleCard);
			await repo.saveLastSessionSummary(mapId, sampleSummary);
		}
	}

	it('clearMap removes that map only - including a map whose id merely starts with it', async () => {
		const repo = createLocalStorageProgressRepository();
		await seed(repo);
		await repo.clearMap('italy-regions');
		expect(await repo.getCardStates('italy-regions')).toEqual([]);
		expect(await repo.getLastSessionSummary('italy-regions')).toBeUndefined();
		for (const survivor of ['italy-regions-2', 'germany-states']) {
			expect(await repo.getCardStates(survivor)).toEqual([sampleCard]);
			expect(await repo.getLastSessionSummary(survivor)).toEqual(sampleSummary);
		}
	});

	it('clearMap on a map with nothing saved is a no-op', async () => {
		const repo = createLocalStorageProgressRepository();
		await seed(repo);
		await repo.clearMap('usa-states');
		expect(await repo.getCardStates('germany-states')).toEqual([sampleCard]);
	});

	it('clearAll removes every map but keeps non-progress keys (e.g. the UI language)', async () => {
		const repo = createLocalStorageProgressRepository();
		await seed(repo);
		localStorage.setItem('geoclick:language:v1', 'de');
		localStorage.setItem('someone-else:key', 'x');
		await repo.clearAll();
		for (const mapId of ['italy-regions', 'italy-regions-2', 'germany-states']) {
			expect(await repo.getCardStates(mapId)).toEqual([]);
			expect(await repo.getLastSessionSummary(mapId)).toBeUndefined();
		}
		expect(localStorage.getItem('geoclick:language:v1')).toBe('de');
		expect(localStorage.getItem('someone-else:key')).toBe('x');
		expect(localStorage.length).toBe(2);
	});
});

describe('localStorage progress repository - failed writes (GC-041)', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('a throwing setItem (quota / private mode) does not propagate, and is logged exactly once', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		localStorage.setItem = () => {
			throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
		};
		const repo = createLocalStorageProgressRepository();
		await expect(repo.saveCardState('italy-regions', sampleCard)).resolves.toBeUndefined();
		await expect(
			repo.saveLastSessionSummary('italy-regions', sampleSummary)
		).resolves.toBeUndefined();
		await expect(repo.saveCardState('germany-states', sampleCard)).resolves.toBeUndefined();
		expect(warn).toHaveBeenCalledTimes(1);
		// Nothing was stored - the failure is swallowed, not faked as success.
		expect(await repo.getCardStates('italy-regions')).toEqual([]);
	});
});

describe('todayLocalDate', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it('formats as YYYY-MM-DD using the local calendar day, not UTC', () => {
		vi.useFakeTimers();
		// Late local evening - a UTC-based read could already say "tomorrow"
		// depending on timezone offset, which would be wrong here. Iteration
		// 6's due-date comparisons (packages/srs) all rely on this being the
		// user's actual day, same reasoning as Iteration 5's retired
		// same-day mechanism this replaces.
		vi.setSystemTime(new Date(2026, 8, 11, 23, 30, 0));
		expect(todayLocalDate()).toBe('2026-09-11');
	});
});

describe('in-memory progress repository (FT-10)', () => {
	it('saves, updates by targetId, and keeps maps apart, like the stored ones', async () => {
		const repo = createInMemoryProgressRepository();
		expect(await repo.getCardStates('italy-regions')).toEqual([]);
		await repo.saveCardState('italy-regions', sampleCard);
		await repo.saveCardState('italy-regions', { ...sampleCard, repetitions: 2 });
		expect(await repo.getCardStates('italy-regions')).toEqual([{ ...sampleCard, repetitions: 2 }]);
		expect(await repo.getCardStates('usa-states')).toEqual([]);

		await repo.saveLastSessionSummary('italy-regions', sampleSummary);
		expect(await repo.getLastSessionSummary('italy-regions')).toEqual(sampleSummary);
		expect(await repo.getLastSessionSummary('usa-states')).toBeUndefined();
	});

	it('clearMap forgets one map; clearAll forgets everything', async () => {
		const repo = createInMemoryProgressRepository();
		await repo.saveCardState('italy-regions', sampleCard);
		await repo.saveLastSessionSummary('italy-regions', sampleSummary);
		await repo.saveCardState('usa-states', sampleCard);

		await repo.clearMap('italy-regions');
		expect(await repo.getCardStates('italy-regions')).toEqual([]);
		expect(await repo.getLastSessionSummary('italy-regions')).toBeUndefined();
		expect(await repo.getCardStates('usa-states')).toEqual([sampleCard]);

		await repo.clearAll();
		expect(await repo.getCardStates('usa-states')).toEqual([]);
	});

	it('hands out copies, so changing what was read or saved changes nothing stored', async () => {
		const repo = createInMemoryProgressRepository();
		const saved = { ...sampleCard };
		await repo.saveCardState('italy-regions', saved);
		saved.interval = 99;
		(await repo.getCardStates('italy-regions'))[0].interval = 42;
		expect((await repo.getCardStates('italy-regions'))[0].interval).toBe(sampleCard.interval);
	});

	it('writes nothing to localStorage', async () => {
		const repo = createInMemoryProgressRepository();
		await repo.saveCardState('italy-regions', sampleCard);
		await repo.saveLastSessionSummary('italy-regions', sampleSummary);
		expect(localStorage.length).toBe(0);
	});
});

describe('sandboxed progress repository (FT-10)', () => {
	it('keeps the sandboxed map in memory and every other map in the real store', async () => {
		const real = createLocalStorageProgressRepository();
		await real.saveCardState('italy-regions', sampleCard);
		const memory = createInMemoryProgressRepository();
		const repo = createSandboxedProgressRepository(real, memory, 'italy-regions');

		expect(await repo.getCardStates('italy-regions')).toEqual([]);
		const tutorialCard: CardState = { ...sampleCard, targetId: 'Sicilia' };
		await repo.saveCardState('italy-regions', tutorialCard);
		await repo.saveLastSessionSummary('italy-regions', sampleSummary);
		expect(await memory.getCardStates('italy-regions')).toEqual([tutorialCard]);
		expect(await real.getCardStates('italy-regions')).toEqual([sampleCard]);
		expect(await real.getLastSessionSummary('italy-regions')).toBeUndefined();

		await repo.saveCardState('usa-states', sampleCard);
		expect(await real.getCardStates('usa-states')).toEqual([sampleCard]);
		expect(await memory.getCardStates('usa-states')).toEqual([]);
	});

	it('clearMap on the sandboxed map leaves real progress alone', async () => {
		const real = createLocalStorageProgressRepository();
		await real.saveCardState('italy-regions', sampleCard);
		const repo = createSandboxedProgressRepository(
			real,
			createInMemoryProgressRepository(),
			'italy-regions'
		);
		await repo.clearMap('italy-regions');
		expect(await real.getCardStates('italy-regions')).toEqual([sampleCard]);
	});
});
