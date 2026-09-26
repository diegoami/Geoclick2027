import { describe, expect, it } from 'vitest';
import {
	NUMBERED_STEPS,
	STEPS,
	initialState,
	placeOf,
	showsNext,
	stepNumber,
	transition,
	tutorialSlipIds,
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
	it('has fourteen numbered steps between the intro and the outro', () => {
		// Twelve since FT-43 added the Terrain step, fourteen since FT-79's
		// Europe and Italy. The counter the card shows is derived from
		// NUMBERED_STEPS, so it follows on its own.
		expect(NUMBERED_STEPS).toBe(14);
		expect(STEPS[0].id).toBe('intro');
		expect(STEPS.at(-1)!.id).toBe('outro');
		expect(stepNumber(0)).toBeUndefined();
		expect(stepNumber(1)).toBe(1);
		expect(stepNumber(STEPS.length - 2)).toBe(14);
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
		run({ type: 'continent', id: 'europe' }); // Europe on the world map
		run({ type: 'country', id: 'italy' }); // Italy on Europe
		run(route('explore')); // opened Italy - Regions, which lands on Known
		run({ type: 'gesture' });
		run({ type: 'reveal' }); // tapped a region: its name is on the map
		run({ type: 'terrain' }); // pressed Terrain, either direction
		run(route('overview'));
		run(route('quiz'));
		run({ type: 'drop', correct: true });
		run({ type: 'drop', correct: false });
		run(route('overview'));
		run(route('quiz'));
		run({ type: 'next' });
		run(route('tour'));
		expect(steps).toEqual([
			'choose-continent',
			'choose-country',
			'choose-map',
			'zoom-pan',
			'tap-names',
			'terrain',
			'overview',
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
		const atZoom = play([{ type: 'next' }, route('explore')], atIntro).state;
		expect(STEPS[atZoom.step].id).toBe('zoom-pan');
		expect(showsNext(atZoom)).toBe(false);
		expect(play([{ type: 'next' }], atZoom).id).toBe('zoom-pan');
	});

	it("pauses off-script, and Resume goes back to the step's screen", () => {
		const paused = play([{ type: 'next' }, route('explore'), route('home')], atIntro).state;
		expect(paused.status).toBe('paused');
		// Route changes while paused never resume by themselves.
		expect(play([route('explore')], paused).state.status).toBe('paused');

		const resumed = transition({ ...paused, place: 'home' }, { type: 'resume' });
		expect(resumed.state.status).toBe('running');
		expect(STEPS[resumed.state.step].id).toBe('zoom-pan');
		expect(resumed.effects).toEqual([{ type: 'navigate', screen: 'explore' }]);
	});

	it('pauses when another map is opened', () => {
		const { state } = play([{ type: 'next' }, route('elsewhere')], atIntro);
		expect(state.status).toBe('paused');
	});

	it('the Tutorial button resumes a paused tutorial instead of restarting it', () => {
		const paused = play([{ type: 'next' }, route('explore'), route('home')], atIntro).state;
		const { state, effects } = play([{ type: 'start' }], paused);
		expect(STEPS[state.step].id).toBe('zoom-pan');
		expect(effects).not.toContainEqual({ type: 'startSandbox' });
	});

	it('Back goes to the previous step and its screen; a step already done offers Next', () => {
		const atQuiz = play(
			[
				{ type: 'next' },
				route('explore'),
				{ type: 'gesture' },
				{ type: 'reveal' },
				{ type: 'terrain' },
				route('overview'),
				route('quiz')
			],
			atIntro
		).state;
		expect(STEPS[atQuiz.step].id).toBe('correct-drop');

		const back = transition(atQuiz, { type: 'back' });
		expect(STEPS[back.state.step].id).toBe('open-quiz');
		expect(back.effects).toEqual([{ type: 'navigate', screen: 'overview' }]);

		// Back again reaches the step that teaches tapping - one more hop than
		// before FT-43, because the Terrain step now sits between them. The
		// player has already tapped a name, so it offers Next rather than
		// waiting; so does Terrain, which they have already pressed.
		const atOverviewStep = play([route('overview'), { type: 'back' }], back.state).state;
		expect(STEPS[atOverviewStep.step].id).toBe('overview');
		const backToTerrain = play([route('explore'), { type: 'back' }], atOverviewStep).state;
		expect(STEPS[backToTerrain.step].id).toBe('terrain');
		expect(showsNext(backToTerrain)).toBe(true);
		const backToTap = play([{ type: 'back' }], backToTerrain).state;
		expect(STEPS[backToTap.step].id).toBe('tap-names');
		expect(showsNext(backToTap)).toBe(true);
	});

	it('has no Back on step 1', () => {
		const atStep1 = play([{ type: 'next' }], atIntro).state;
		expect(transition(atStep1, { type: 'back' }).state).toEqual(atStep1);
	});

	it('remembers an early mistake: step 7 then offers Next straight away', () => {
		const atDrop = play(
			[
				{ type: 'next' },
				route('explore'),
				{ type: 'gesture' },
				{ type: 'reveal' },
				{ type: 'terrain' },
				route('overview'),
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

	// FT-44. Reported by the product owner: at "get one wrong on purpose", he
	// put Sardegna in the RIGHT place. The step waits for a wrong drop, so it
	// sat there - and Sardegna, the name the copy tells you to use, was gone
	// from the tray.
	describe('the wrong-drop step cannot trap the player', () => {
		const atWrongDrop = play(
			[
				{ type: 'next' },
				route('explore'),
				{ type: 'gesture' },
				{ type: 'reveal' },
				{ type: 'terrain' },
				route('overview'),
				route('quiz'),
				{ type: 'drop', correct: true }
			],
			atIntro
		).state;

		it('still waits for a wrong drop while the quiz has names left', () => {
			expect(STEPS[atWrongDrop.step].id).toBe('wrong-drop');
			// Placing more names correctly does not satisfy it, and must not:
			// the step is there to show what a mistake looks like.
			const more = play([{ type: 'drop', correct: true }], atWrongDrop).state;
			expect(STEPS[more.step].id).toBe('wrong-drop');
			expect(showsNext(more)).toBe(false);
		});

		it('offers Next once the quiz is finished, when no wrong drop is possible', () => {
			// Place everything correctly and the tray empties. Without this the
			// step waits for something that can never happen and the only way
			// out is Skip.
			const finished = play([{ type: 'quizDone' }], atWrongDrop).state;
			expect(STEPS[finished.step].id).toBe('wrong-drop');
			expect(showsNext(finished)).toBe(true);
			expect(STEPS[play([{ type: 'next' }], finished).state.step].id).toBe('check-overview');
		});

		it('a finished quiz never advances a step by itself', () => {
			// It is a flag, not an action: it must not skip the player past the
			// step they are on.
			const same = play([{ type: 'quizDone' }], atWrongDrop).state;
			expect(same.step).toBe(atWrongDrop.step);
		});

		it('frees the correct-drop step too, for the same reason', () => {
			const atCorrectDrop = play(
				[
					{ type: 'next' },
					route('explore'),
					{ type: 'gesture' },
					{ type: 'reveal' },
					{ type: 'terrain' },
					route('overview'),
					route('quiz')
				],
				atIntro
			).state;
			expect(STEPS[atCorrectDrop.step].id).toBe('correct-drop');
			expect(showsNext(atCorrectDrop)).toBe(false);
			expect(showsNext(play([{ type: 'quizDone' }], atCorrectDrop).state)).toBe(true);
		});
	});

	it('Skip ends the tutorial from any step and keeps the player where they are', () => {
		const { state, effects } = play(
			[{ type: 'next' }, route('explore'), { type: 'skip' }],
			atIntro
		);
		expect(state).toEqual({ ...initialState, place: 'explore' });
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

describe('tutorialSlipIds', () => {
	it('names the slips the quiz steps spotlight (FT-60)', () => {
		expect(tutorialSlipIds()).toEqual(['sicilia', 'sardegna']);
	});
});

describe("the start screen's map in the tutorial (FT-79)", () => {
	const atContinent = play([{ type: 'next' }], atIntro).state;

	it('opens on Europe, then Italy, then the map in its row', () => {
		expect(STEPS[atContinent.step].id).toBe('choose-continent');
		expect(STEPS[atContinent.step].highlight.home?.spot).toBe('picker-europe');
		const atCountry = play([{ type: 'continent', id: 'europe' }], atContinent);
		expect(atCountry.id).toBe('choose-country');
		expect(STEPS[atCountry.state.step].highlight.home?.spot).toBe('picker-italy');
		const atMap = play([{ type: 'country', id: 'italy' }], atCountry.state);
		expect(atMap.id).toBe('choose-map');
		expect(STEPS[atMap.state.step].highlight.home?.spot).toBe('home-map-card');
	});

	it('another continent or country is a look around, not the step', () => {
		const asia = play([{ type: 'continent', id: 'asia' }], atContinent);
		expect(asia.id).toBe('choose-continent');
		expect(showsNext(asia.state)).toBe(false);
		const atCountry = play([{ type: 'continent', id: 'europe' }], atContinent).state;
		expect(play([{ type: 'country', id: 'france' }], atCountry).id).toBe('choose-country');
	});

	it('Back from Italy returns to Europe, which offers Next', () => {
		const atCountry = play([{ type: 'continent', id: 'europe' }], atContinent).state;
		const back = play([{ type: 'back' }], atCountry);
		expect(back.id).toBe('choose-continent');
		expect(back.effects).toEqual([]);
		expect(showsNext(back.state)).toBe(true);
	});

	it('opening Italy - Regions some other way skips ahead instead of pausing', () => {
		const { state, id } = play([route('explore')], atContinent);
		expect(state.status).toBe('running');
		expect(id).toBe('zoom-pan');
	});

	it('a choice made before its step does not count for it (#80)', () => {
		// The start screen's map restoring Europe while the intro shows.
		const early = play([{ type: 'continent', id: 'europe' }], atIntro).state;
		const atStep1 = play([{ type: 'next' }], early);
		expect(atStep1.id).toBe('choose-continent');
		expect(showsNext(atStep1.state)).toBe(false);
		const italyEarly = play([{ type: 'country', id: 'italy' }], atContinent).state;
		const atCountry = play([{ type: 'continent', id: 'europe' }], italyEarly);
		expect(atCountry.id).toBe('choose-country');
		expect(showsNext(atCountry.state)).toBe(false);
	});

	it('does nothing with no tutorial running', () => {
		const idle = play([route('home'), { type: 'continent', id: 'europe' }]).state;
		expect(idle).toEqual({ ...initialState, place: 'home' });
	});
});
