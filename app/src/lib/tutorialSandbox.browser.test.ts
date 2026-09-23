// Runs in the browser project: the sandbox wraps the real localStorage
// repository and the Recent list, both of which need a real localStorage.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createQuizSession } from '@geoclick/quiz-engine';
import { rate } from '@geoclick/srs';
import { recentMaps, recordVisit } from './mapPrefs.svelte';
import { rememberRound, roundInProgress } from './quizRound';
import {
	createLocalStorageProgressRepository,
	createProgressRepository,
	todayLocalDate,
	type CardState
} from './progressRepository';
import {
	TUTORIAL_MAP_ID,
	endTutorialSandbox,
	isTutorialSandboxActive,
	startTutorialSandbox
} from './tutorialSandbox.svelte';

const today = todayLocalDate();
const targets = ['abruzzo', 'lazio', 'sardegna', 'sicilia'].map((id) => ({ id, name: id }));
const goodCard = (targetId: string): CardState => ({ targetId, ...rate(undefined, 'good', today) });

// The player's real progress on the tutorial map, which the sandbox must
// neither show nor touch.
const real = createLocalStorageProgressRepository();

beforeEach(async () => {
	await real.clearMap(TUTORIAL_MAP_ID);
	await real.clearMap('usa-states');
	await real.saveCardState(TUTORIAL_MAP_ID, goodCard('lazio'));
});

afterEach(() => {
	endTutorialSandbox();
	vi.restoreAllMocks();
});

// What QuizView does on mount: ask for a repository, read the map's cards
// (they set the round's difficulty), and put the whole map in play - every
// round covers all of it since v0.6.0 (FT-26).
async function mountQuiz() {
	const repository = await createProgressRepository();
	const cards = new Map(
		(await repository.getCardStates(TUTORIAL_MAP_ID)).map((c) => [c.targetId, c])
	);
	return { repository, cards, session: createQuizSession(targets) };
}

describe('tutorial sandbox', () => {
	it('starts the tutorial map empty, whatever the real progress is', async () => {
		startTutorialSandbox();
		expect(isTutorialSandboxActive()).toBe(true);
		const { session } = await mountQuiz();
		expect(session.items.every((i) => i.status === 'pending')).toBe(true);
	});

	it('does not resume a round left open on the tutorial map before it began (FT-60)', () => {
		rememberRound(TUTORIAL_MAP_ID, { session: createQuizSession(targets), hand: ['abruzzo'] });
		startTutorialSandbox();
		expect(roundInProgress(TUTORIAL_MAP_ID)).toBeUndefined();
	});

	it('a whole tutorial quiz writes nothing to localStorage, not even Recent', async () => {
		const recentBefore = recentMaps();
		// This file's own Storage: writes from other test files, which run in
		// their own frames, can't show up here and make this flaky.
		const writes = [
			vi.spyOn(Storage.prototype, 'setItem'),
			vi.spyOn(Storage.prototype, 'removeItem'),
			vi.spyOn(Storage.prototype, 'clear')
		];

		startTutorialSandbox();
		recordVisit(TUTORIAL_MAP_ID);
		const { repository } = await mountQuiz();
		for (const target of targets)
			await repository.saveCardState(TUTORIAL_MAP_ID, goodCard(target.id));
		await repository.saveLastSessionSummary(TUTORIAL_MAP_ID, {
			total: targets.length,
			perfect: targets.length,
			totalErrors: 0,
			completedAt: new Date().toISOString()
		});
		endTutorialSandbox();

		for (const spy of writes) expect(spy).not.toHaveBeenCalled();
		expect(recentMaps()).toEqual(recentBefore);
		expect((await real.getCardStates(TUTORIAL_MAP_ID)).map((c) => c.targetId)).toEqual(['lazio']);
		expect(await real.getLastSessionSummary(TUTORIAL_MAP_ID)).toBeUndefined();
	});

	it('keeps what was learned across a quiz remount while the tutorial runs', async () => {
		startTutorialSandbox();
		const first = await mountQuiz();
		await first.repository.saveCardState(TUTORIAL_MAP_ID, goodCard('sicilia'));

		// Overview and back: QuizView mounts again and asks for a new repository.
		const second = await mountQuiz();
		// The round itself covers the whole map either way (FT-26); what has to
		// survive the remount is the streak behind it.
		expect(second.session.items.every((i) => i.status === 'pending')).toBe(true);
		expect(second.cards.get('sicilia')?.cleanStreak).toBe(1);
		expect(second.cards.has('abruzzo')).toBe(false);
	});

	it('saves other maps as usual during the tutorial', async () => {
		startTutorialSandbox();
		const repository = await createProgressRepository();
		await repository.saveCardState('usa-states', goodCard('texas'));
		recordVisit('usa-states');

		expect((await real.getCardStates('usa-states')).map((c) => c.targetId)).toEqual(['texas']);
		expect(recentMaps()[0]).toBe('usa-states');
	});

	it('ending the tutorial brings back the real store and throws the sandbox away', async () => {
		startTutorialSandbox();
		const during = await createProgressRepository();
		await during.saveCardState(TUTORIAL_MAP_ID, goodCard('sicilia'));
		endTutorialSandbox();
		expect(isTutorialSandboxActive()).toBe(false);

		const after = await createProgressRepository();
		expect((await after.getCardStates(TUTORIAL_MAP_ID)).map((c) => c.targetId)).toEqual(['lazio']);

		// A view still holding the tutorial's repository keeps writing to the
		// discarded sandbox, never to real progress.
		await during.saveCardState(TUTORIAL_MAP_ID, goodCard('sardegna'));
		expect((await real.getCardStates(TUTORIAL_MAP_ID)).map((c) => c.targetId)).toEqual(['lazio']);

		// Replay starts from an empty sandbox again.
		startTutorialSandbox();
		expect(await (await createProgressRepository()).getCardStates(TUTORIAL_MAP_ID)).toEqual([]);
	});

	it('records visits to the tutorial map again once it ends', () => {
		startTutorialSandbox();
		endTutorialSandbox();
		recordVisit(TUTORIAL_MAP_ID);
		expect(recentMaps()[0]).toBe(TUTORIAL_MAP_ID);
	});
});
