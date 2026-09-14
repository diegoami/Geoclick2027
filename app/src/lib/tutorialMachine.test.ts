import { describe, expect, it } from 'vitest';
import {
	NUMBERED_STEPS,
	STEPS,
	initialState,
	placeOf,
	showsNext,
	stepNumber,
	transition,
	type Place,
	type TutorialEvent,
	type TutorialState
} from './tutorialMachine';

// Runs events through the machine, collecting every effect.
function play(events: TutorialEvent[], from: TutorialState = initialState) {
	let state = from;
	const effects = [];
	for (const event of events) {
		const result = transition(state, event);
		state = result.state;
		effects.push(...result.effects);
	}
	return { state, effects, id: STEPS[state.step].id };
}

const route = (place: Place): TutorialEvent => ({ type: 'route', place });

// The intro on the home page, sandbox on.
const atIntro = play([route('home'), { type: 'start' }]).state;

describe('tutorial steps', () => {
	it('has eleven numbered steps between the intro and the outro', () => {
		expect(NUMBERED_STEPS).toBe(11);
		expect(STEPS[0].id).toBe('intro');
		expect(STEPS.at(-1)!.id).toBe('outro');
		expect(stepNumber(0)).toBeUndefined();
		expect(stepNumber(1)).toBe(1);
		expect(stepNumber(STEPS.length - 2)).toBe(11);
	});
});

describe('tutorial machine', () => {
	it('walks the whole script on real actions', () => {
		const steps: string[] = [];
		let state = atIntro;
		const run = (event: TutorialEvent) => {
			state = transition(state, event).state;
			steps.push(STEPS[state.step].id);
		};
		run({ type: 'next' }); // Start
		run(route('overview')); // opened Italy - Regions
		run({ type: 'gesture' });
		run({ type: 'next' });
		run(route('explore'));
		run({ type: 'reveal' });
		run(route('quiz'));
		run({ type: 'drop', correct: true });
		run({ type: 'drop', correct: false });
		run(route('overview'));
		run(route('quiz'));
		run({ type: 'next' });
		run(route('tour'));
		expect(steps).toEqual([
			'choose-map',
			'zoom-pan',
			'overview',
			'explore',
			'explore', // still step 4 in Explore, until a region is clicked
			'open-quiz',
			'correct-drop',
			'wrong-drop',
			'check-overview',
			'back-to-quiz',
			'spaced-repetition',
			'tour',
			'outro'
		]);
		const finished = transition(state, { type: 'next' });
		expect(finished.state.status).toBe('idle');
		expect(finished.effects).toEqual([{ type: 'endSandbox' }]);
	});

	it('starting on the home page starts the sandbox without navigating', () => {
		const { state, effects } = play([route('home'), { type: 'start' }]);
		expect(state.status).toBe('running');
		expect(effects).toEqual([{ type: 'startSandbox' }]);
	});

	it('starting from a map screen goes to the home page first, then starts the sandbox', () => {
		const { effects } = play([route('quiz'), { type: 'start' }]);
		expect(effects).toEqual([{ type: 'navigate', screen: 'home' }, { type: 'startSandbox' }]);
	});

	it('waits on action steps: Next does nothing until the action happens', () => {
		const atZoom = play([{ type: 'next' }, route('overview')], atIntro).state;
		expect(STEPS[atZoom.step].id).toBe('zoom-pan');
		expect(showsNext(atZoom)).toBe(false);
		expect(play([{ type: 'next' }], atZoom).id).toBe('zoom-pan');
	});

	it('opening Explore during step 3 skips ahead to step 4', () => {
		const { id } = play(
			[{ type: 'next' }, route('overview'), { type: 'gesture' }, route('explore')],
			atIntro
		);
		expect(id).toBe('explore');
	});

	it("pauses off-script, and Resume goes back to the step's screen", () => {
		const paused = play([{ type: 'next' }, route('overview'), route('home')], atIntro).state;
		expect(paused.status).toBe('paused');
		// Route changes while paused never resume by themselves.
		expect(play([route('overview')], paused).state.status).toBe('paused');

		const resumed = transition({ ...paused, place: 'home' }, { type: 'resume' });
		expect(resumed.state.status).toBe('running');
		expect(STEPS[resumed.state.step].id).toBe('zoom-pan');
		expect(resumed.effects).toEqual([{ type: 'navigate', screen: 'overview' }]);
	});

	it('pauses when another map is opened', () => {
		const { state } = play([{ type: 'next' }, route('elsewhere')], atIntro);
		expect(state.status).toBe('paused');
	});

	it('the Tutorial button resumes a paused tutorial instead of restarting it', () => {
		const paused = play([{ type: 'next' }, route('overview'), route('home')], atIntro).state;
		const { state, effects } = play([{ type: 'start' }], paused);
		expect(STEPS[state.step].id).toBe('zoom-pan');
		expect(effects).not.toContainEqual({ type: 'startSandbox' });
	});

	it('Back goes to the previous step and its screen; a step already done offers Next', () => {
		const atQuiz = play(
			[
				{ type: 'next' },
				route('overview'),
				{ type: 'gesture' },
				{ type: 'next' },
				route('explore'),
				{ type: 'reveal' },
				route('quiz')
			],
			atIntro
		).state;
		expect(STEPS[atQuiz.step].id).toBe('correct-drop');

		const back = transition(atQuiz, { type: 'back' });
		expect(STEPS[back.state.step].id).toBe('open-quiz');
		expect(back.effects).toEqual([{ type: 'navigate', screen: 'explore' }]);

		// Back again, landing in Explore: the region was already clicked.
		const backTwice = play([route('explore'), { type: 'back' }], back.state).state;
		expect(STEPS[backTwice.step].id).toBe('explore');
		expect(showsNext(backTwice)).toBe(true);
		expect(play([{ type: 'next' }], backTwice).id).toBe('open-quiz');
	});

	it('has no Back on step 1', () => {
		const atStep1 = play([{ type: 'next' }], atIntro).state;
		expect(transition(atStep1, { type: 'back' }).state).toEqual(atStep1);
	});

	it('remembers an early mistake: step 7 then offers Next straight away', () => {
		const atDrop = play(
			[
				{ type: 'next' },
				route('overview'),
				{ type: 'gesture' },
				{ type: 'next' },
				route('explore'),
				{ type: 'reveal' },
				route('quiz')
			],
			atIntro
		).state;
		const { state } = play(
			[
				{ type: 'drop', correct: false },
				{ type: 'drop', correct: true }
			],
			atDrop
		);
		expect(STEPS[state.step].id).toBe('wrong-drop');
		expect(showsNext(state)).toBe(true);
	});

	it('Skip ends the tutorial from any step and keeps the player where they are', () => {
		const { state, effects } = play(
			[{ type: 'next' }, route('overview'), { type: 'skip' }],
			atIntro
		);
		expect(state).toEqual({ ...initialState, place: 'overview' });
		expect(effects.at(-1)).toEqual({ type: 'endSandbox' });
	});

	it('Replay starts over from the intro with a fresh sandbox and nothing done', () => {
		const atOutro = {
			...atIntro,
			step: STEPS.length - 1,
			place: 'tour' as const,
			done: { ...atIntro.done, gesture: true }
		};
		const { state, effects } = transition(atOutro, { type: 'replay' });
		expect(state.step).toBe(0);
		expect(state.done.gesture).toBe(false);
		expect(effects).toEqual([{ type: 'navigate', screen: 'home' }, { type: 'startSandbox' }]);
	});

	it('ignores actions while no tutorial is running', () => {
		expect(transition(initialState, { type: 'drop', correct: true }).state).toEqual(initialState);
		expect(transition(initialState, { type: 'next' }).state).toEqual(initialState);
		expect(transition(initialState, { type: 'skip' }).effects).toEqual([]);
	});
});

describe('placeOf', () => {
	it("recognises the tutorial map's screens, with or without a base path", () => {
		expect(placeOf('/', '', 'italy-regions')).toBe('home');
		expect(placeOf('/map/italy-regions', '', 'italy-regions')).toBe('explore');
		expect(placeOf('/map/italy-regions/overview', '', 'italy-regions')).toBe('overview');
		expect(placeOf('/app/map/italy-regions/quiz/', '/app', 'italy-regions')).toBe('quiz');
		expect(placeOf('/app/map/italy-regions/tour', '/app', 'italy-regions')).toBe('tour');
	});

	it('treats any other map or page as elsewhere', () => {
		expect(placeOf('/map/usa-states/quiz', '', 'italy-regions')).toBe('elsewhere');
		expect(placeOf('/map/italy-regions/editor', '', 'italy-regions')).toBe('elsewhere');
	});
});
