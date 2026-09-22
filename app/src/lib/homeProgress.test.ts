import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadHomeProgress } from './homeProgress';
import {
	createInMemoryProgressRepository,
	type CardState,
	type ProgressRepository,
	type SessionSummary
} from './progressRepository';

const summary = (perfect: number): SessionSummary => ({
	total: 10,
	perfect,
	totalErrors: 0,
	completedAt: '2026-09-22T10:00:00.000Z'
});

const card = (targetId: string, cleanStreak: number): CardState => ({
	targetId,
	easeFactor: 2.5,
	interval: 1,
	repetitions: cleanStreak,
	cleanStreak,
	dueDate: '2026-09-22',
	lastReviewedAt: '2026-09-22'
});

describe('loadHomeProgress', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('reads every map it is given', async () => {
		const repository = createInMemoryProgressRepository();
		await repository.saveLastSessionSummary('italy-regions', summary(9));
		await repository.saveCardState('italy-regions', card('piemonte', 3));

		const { summaries, masteries } = await loadHomeProgress(
			repository,
			['italy-regions', 'usa-states'],
			new Map([
				['italy-regions', ['piemonte', 'lombardia']],
				['usa-states', ['texas']]
			])
		);

		expect(summaries['italy-regions']).toEqual(summary(9));
		expect(summaries['usa-states']).toBeUndefined();
		// One of two names known: 3 is the known streak, 0 is "never played".
		expect(masteries['italy-regions']).toEqual({ known: 1, total: 2, level: 1 });
		expect(masteries['usa-states']).toBeUndefined();
	});

	it('lets one map fail without losing the others', async () => {
		const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
		const repository = createInMemoryProgressRepository();
		await repository.saveLastSessionSummary('italy-regions', summary(9));
		await repository.saveCardState('italy-regions', card('piemonte', 3));

		// The shape of a real transient failure: one map's rows come back
		// unreadable, every other map is fine.
		const broken: ProgressRepository = {
			...repository,
			async getLastSessionSummary(mapId) {
				if (mapId === 'usa-states') throw new Error('row is unreadable');
				return repository.getLastSessionSummary(mapId);
			},
			async getCardStates(mapId) {
				if (mapId === 'usa-states') throw new Error('row is unreadable');
				return repository.getCardStates(mapId);
			}
		};

		const { summaries, masteries } = await loadHomeProgress(
			broken,
			['italy-regions', 'usa-states'],
			new Map([
				['italy-regions', ['piemonte']],
				['usa-states', ['texas']]
			])
		);

		expect(summaries['italy-regions']).toEqual(summary(9));
		expect(masteries['italy-regions']).toMatchObject({ known: 1, total: 1 });
		expect(summaries['usa-states']).toBeUndefined();
		expect(masteries['usa-states']).toBeUndefined();
		expect(logged).toHaveBeenCalled();
	});
});
