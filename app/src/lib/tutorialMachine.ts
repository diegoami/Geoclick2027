// The tutorial's steps and the rules for moving between them (FT-11). Pure:
// no Svelte, no DOM, no navigation, so every transition is unit-tested
// (tutorialMachine.test.ts). tutorial.svelte.ts holds the live state and
// carries out the effects returned here. The script itself, and why each
// step works the way it does, is docs/TUTORIAL.md.

import type { TranslationKey } from './i18n.svelte';

/** The screens the tutorial knows about, all on its own map. */
export type Screen = 'home' | 'overview' | 'explore' | 'quiz' | 'tour';
/** Where the player is: one of the tutorial's screens, or anywhere else. */
export type Place = Screen | 'elsewhere';

/** What moves a step on. */
export type Advance =
	| { kind: 'start' } // the intro's Start button
	| { kind: 'next' } // an explanation step's Next button
	| { kind: 'route'; to: Screen }
	| { kind: 'gesture' } // the player zoomed or panned the map
	| { kind: 'reveal' } // a region's name shown in Explore
	| { kind: 'terrain' } // the player pressed the Terrain button
	| { kind: 'continent' } // the start screen's map opened TUTORIAL_CONTINENT
	| { kind: 'country' } // a tap on TUTORIAL_COUNTRY on that continent
	| { kind: 'drop'; correct: boolean }
	| { kind: 'finish' }; // the outro

/** What a step highlights on one screen: a spotlight, optionally with rings. */
export interface Highlight {
	spot?: string; // a data-tutorial anchor
	rings?: string[];
	/** Dim the rest of the page. Off where the spotlight is the whole map. */
	dim: boolean;
}

export interface Step {
	id: string;
	/** Numbered in the card's counter (1-14); the intro and outro aren't. */
	numbered: boolean;
	/** The screens this step belongs on; the first is where Resume and Back go. */
	screens: Screen[];
	advance: Advance;
	copy: TranslationKey;
	/** Touch-screen wording, where the mouse wording says hover or click. */
	touchCopy?: TranslationKey;
	title?: TranslationKey;
	highlight: Partial<Record<Screen, Highlight>>;
}

const centred: Highlight = { dim: true };

/** Where the start screen's map leads to the tutorial's map (FT-79): Europe,
 * then Italy, then Italy's row - whose listbox holds Italy - Regions. */
export const TUTORIAL_CONTINENT = 'europe';
export const TUTORIAL_COUNTRY = 'italy';

export const STEPS: Step[] = [
	{
		id: 'intro',
		numbered: false,
		screens: ['home'],
		advance: { kind: 'start' },
		title: 'tutorial.intro.title',
		copy: 'tutorial.intro.body',
		highlight: { home: centred }
	},
	{
		// The start screen opens on the world map (FT-77), so the way to a
		// map is the way the player will find every other one: the continent,
		// the country, then the map in its row (FT-79). The page shows the map
		// for these steps even when the player has chosen the list.
		id: 'choose-continent',
		numbered: true,
		screens: ['home'],
		advance: { kind: 'continent' },
		copy: 'tutorial.continent',
		highlight: { home: { spot: `picker-${TUTORIAL_CONTINENT}`, dim: true } }
	},
	{
		id: 'choose-country',
		numbered: true,
		screens: ['home'],
		advance: { kind: 'country' },
		copy: 'tutorial.country',
		touchCopy: 'tutorial.country.touch',
		highlight: { home: { spot: `picker-${TUTORIAL_COUNTRY}`, dim: true } }
	},
	{
		id: 'choose-map',
		numbered: true,
		screens: ['home'],
		// A map opens on its own screen now (FT-39), not on the Overview.
		advance: { kind: 'route', to: 'explore' },
		copy: 'tutorial.step1',
		highlight: { home: { spot: 'home-map-card', dim: true } }
	},
	{
		id: 'zoom-pan',
		numbered: true,
		screens: ['explore'],
		advance: { kind: 'gesture' },
		copy: 'tutorial.step2',
		touchCopy: 'tutorial.step2.touch',
		highlight: { explore: { rings: ['zoom-control'], dim: false } }
	},
	{
		// The heart of it since FT-39: a tap puts a name on the map and
		// leaves it there, so the player builds the set they want to study.
		id: 'tap-names',
		numbered: true,
		screens: ['explore'],
		advance: { kind: 'reveal' },
		copy: 'tutorial.step3',
		touchCopy: 'tutorial.step3.touch',
		highlight: { explore: { dim: false } }
	},
	{
		// Terrain is ON by default since FT-43, so this step is not "switch
		// this on" but "this is what you are looking at, and here is how to
		// turn it off". The layer shipped off and invisible; explaining it is
		// the other half of fixing that.
		//
		// The copy key is 'tutorial.terrain', not a number: inserting a step
		// here would otherwise mean renumbering eight keys across three
		// dictionaries for no user-visible gain. The counter on the card is
		// computed from POSITION (stepNumber), so the numbers a player sees
		// stay correct - the key names are just historical ids.
		id: 'terrain',
		numbered: true,
		screens: ['explore'],
		advance: { kind: 'terrain' },
		copy: 'tutorial.terrain',
		touchCopy: 'tutorial.terrain.touch',
		highlight: { explore: { spot: 'terrain-toggle', dim: true } }
	},
	{
		id: 'overview',
		numbered: true,
		screens: ['explore', 'overview'],
		advance: { kind: 'route', to: 'overview' },
		copy: 'tutorial.step4',
		touchCopy: 'tutorial.step4.touch',
		highlight: {
			explore: { spot: 'nav-overview', dim: true },
			overview: { dim: false }
		}
	},
	{
		id: 'open-quiz',
		numbered: true,
		screens: ['overview'],
		advance: { kind: 'route', to: 'quiz' },
		copy: 'tutorial.step5',
		highlight: { overview: { spot: 'nav-quiz', dim: true } }
	},
	{
		id: 'correct-drop',
		numbered: true,
		screens: ['quiz'],
		advance: { kind: 'drop', correct: true },
		copy: 'tutorial.step6',
		highlight: { quiz: { spot: 'slip-sicilia', dim: true } }
	},
	{
		id: 'wrong-drop',
		numbered: true,
		screens: ['quiz'],
		advance: { kind: 'drop', correct: false },
		copy: 'tutorial.step7',
		highlight: { quiz: { spot: 'slip-sardegna', dim: true } }
	},
	{
		id: 'check-overview',
		numbered: true,
		screens: ['quiz'],
		advance: { kind: 'route', to: 'overview' },
		copy: 'tutorial.step8',
		highlight: { quiz: { spot: 'nav-overview', dim: true } }
	},
	{
		id: 'back-to-quiz',
		numbered: true,
		screens: ['overview'],
		advance: { kind: 'route', to: 'quiz' },
		copy: 'tutorial.step9',
		highlight: { overview: { spot: 'nav-quiz', dim: true } }
	},
	{
		id: 'spaced-repetition',
		numbered: true,
		screens: ['quiz'],
		advance: { kind: 'next' },
		copy: 'tutorial.step10',
		highlight: { quiz: { spot: 'quiz-progress', dim: true } }
	},
	{
		id: 'tour',
		numbered: true,
		screens: ['quiz'],
		advance: { kind: 'route', to: 'tour' },
		copy: 'tutorial.step11',
		highlight: { quiz: { spot: 'nav-tour', dim: true } }
	},
	{
		id: 'outro',
		numbered: false,
		screens: ['tour'],
		advance: { kind: 'finish' },
		title: 'tutorial.outro.title',
		copy: 'tutorial.outro.body',
		highlight: { tour: { dim: false } }
	}
];

/** The slips the tutorial spotlights in the quiz, as target ids ('sicilia',
 * 'sardegna'). QuizView deals them into the first hand while a tutorial runs,
 * because a hand of ten (FT-60) no longer holds every region. */
export function tutorialSlipIds(): string[] {
	return STEPS.flatMap((step) => {
		const spot = step.highlight.quiz?.spot;
		return spot?.startsWith('slip-') ? [spot.slice('slip-'.length)] : [];
	});
}

export const NUMBERED_STEPS = STEPS.filter((s) => s.numbered).length;

/** Actions the player has done at least once in this run. */
export interface Done {
	gesture: boolean;
	reveal: boolean;
	terrain: boolean;
	continent: boolean;
	country: boolean;
	quizDone: boolean;
	correctDrop: boolean;
	wrongDrop: boolean;
}

export interface TutorialState {
	status: 'idle' | 'running' | 'paused';
	step: number; // index into STEPS
	place: Place;
	done: Done;
}

export type TutorialEvent =
	| { type: 'start' } // the Tutorial button
	| { type: 'next' } // Start, Next, Finish
	| { type: 'back' }
	| { type: 'skip' } // Skip, End tutorial, Esc
	| { type: 'replay' }
	| { type: 'resume' }
	| { type: 'route'; place: Place }
	| { type: 'gesture' }
	| { type: 'reveal' }
	| { type: 'terrain' }
	| { type: 'continent'; id: string } // the start screen's map opened a continent
	| { type: 'country'; id: string } // a country tapped on a continent
	| { type: 'quizDone' } // no slips left, so no further drop is possible
	| { type: 'drop'; correct: boolean };

export type Effect =
	{ type: 'navigate'; screen: Screen } | { type: 'startSandbox' } | { type: 'endSandbox' };

const noneDone: Done = {
	gesture: false,
	reveal: false,
	terrain: false,
	continent: false,
	country: false,
	quizDone: false,
	correctDrop: false,
	wrongDrop: false
};

export const initialState: TutorialState = {
	status: 'idle',
	step: 0,
	place: 'elsewhere',
	done: noneDone
};

/** Whether a step's action has already happened, so its card offers Next. */
export function isStepDone(state: TutorialState, index = state.step): boolean {
	const advance = STEPS[index].advance;
	switch (advance.kind) {
		case 'route':
			return state.place === advance.to;
		case 'gesture':
			return state.done.gesture;
		case 'reveal':
			return state.done.reveal;
		case 'terrain':
			return state.done.terrain;
		case 'continent':
			return state.done.continent;
		case 'country':
			return state.done.country;
		case 'drop':
			// A finished quiz counts as done for either drop step. Without
			// this, a player who places every region correctly can never make
			// the wrong drop the step is waiting for, and the tutorial has no
			// way forward but Skip.
			if (state.done.quizDone) return true;
			return advance.correct ? state.done.correctDrop : state.done.wrongDrop;
		default:
			return false;
	}
}

/** Whether the card shows a Next button: explanation steps, and steps already done. */
export function showsNext(state: TutorialState): boolean {
	return STEPS[state.step].advance.kind === 'next' || isStepDone(state);
}

/** The card's position in the counter, 1-14, or undefined for the intro and outro. */
export function stepNumber(index: number): number | undefined {
	if (!STEPS[index].numbered) return undefined;
	return STEPS.slice(0, index + 1).filter((s) => s.numbered).length;
}

// Going to a step: navigate to its first screen unless the player is already
// on one of its screens.
function goTo(state: TutorialState, step: number): { state: TutorialState; effects: Effect[] } {
	const screens = STEPS[step].screens;
	const onScreen = (screens as Place[]).includes(state.place);
	return {
		state: { ...state, status: 'running', step },
		effects: onScreen ? [] : [{ type: 'navigate', screen: screens[0] }]
	};
}

const ended = (state: TutorialState): { state: TutorialState; effects: Effect[] } => ({
	state: { ...initialState, place: state.place },
	effects: [{ type: 'endSandbox' }]
});

// A fresh run from the intro, with a fresh sandbox. Navigating first means a
// quiz open when the button is pressed isn't remounted on the sandbox for
// nothing on its way out.
function fresh(place: Place): { state: TutorialState; effects: Effect[] } {
	const started = goTo({ ...initialState, place }, 0);
	return { ...started, effects: [...started.effects, { type: 'startSandbox' }] };
}

export function transition(
	state: TutorialState,
	event: TutorialEvent
): { state: TutorialState; effects: Effect[] } {
	const same = { state, effects: [] as Effect[] };
	const step = STEPS[state.step];

	if (event.type === 'route') {
		const moved = { ...state, place: event.place };
		if (state.status !== 'running') return { state: moved, effects: [] };
		// The step's own target: move on. A player who finds the map without
		// the start screen's map (the Europe and Italy steps) is on the step
		// after it too.
		let target = state.step;
		while (['continent', 'country'].includes(STEPS[target].advance.kind)) target++;
		const own = STEPS[target].advance;
		if (own.kind === 'route' && event.place === own.to)
			return { state: { ...moved, step: target + 1 }, effects: [] };
		// Anywhere the step doesn't belong: pause until the player chooses.
		if (!(step.screens as Place[]).includes(event.place))
			return { state: { ...moved, status: 'paused' }, effects: [] };
		return { state: moved, effects: [] };
	}

	switch (event.type) {
		case 'start':
			if (state.status === 'idle') return fresh(state.place);
			if (state.status === 'paused') return goTo(state, state.step);
			return same;

		case 'replay':
			return fresh(state.place);

		case 'skip':
			return state.status === 'idle' ? same : ended(state);

		case 'resume':
			return state.status === 'paused' ? goTo(state, state.step) : same;

		case 'next':
			if (state.status !== 'running') return same;
			if (step.advance.kind === 'finish') return ended(state);
			if (step.advance.kind === 'start' || showsNext(state)) return goTo(state, state.step + 1);
			return same;

		case 'back':
			if (state.status !== 'running' || !step.numbered || state.step <= 1) return same;
			return goTo(state, state.step - 1);

		case 'quizDone': {
			// Only a flag: it makes Next appear on a drop step (above), and
			// never advances a step by itself.
			if (state.status === 'idle') return same;
			return { state: { ...state, done: { ...state.done, quizDone: true } }, effects: [] };
		}

		case 'continent':
		case 'country': {
			// Only the tutorial's own continent and country count: Asia is a
			// view, not the way to Italy.
			const target = event.type === 'continent' ? TUTORIAL_CONTINENT : TUTORIAL_COUNTRY;
			if (state.status === 'idle' || event.id !== target) return same;
			return movedOn(state, event.type, { ...state.done, [event.type]: true });
		}

		case 'gesture':
		case 'reveal':
		case 'terrain':
		case 'drop': {
			if (state.status === 'idle') return same;
			const done =
				event.type === 'drop'
					? { ...state.done, [event.correct ? 'correctDrop' : 'wrongDrop']: true }
					: { ...state.done, [event.type]: true };
			if (event.type !== 'drop') return movedOn(state, event.type, done);
			const matches = step.advance.kind === 'drop' && step.advance.correct === event.correct;
			return movedOn(state, matches ? 'drop' : undefined, done);
		}
	}
}

// An action recorded in `done`; it moves the step on when it is the step's
// own, on one of the step's screens.
function movedOn(
	state: TutorialState,
	kind: Advance['kind'] | undefined,
	done: Done
): { state: TutorialState; effects: Effect[] } {
	const step = STEPS[state.step];
	const next = { ...state, done };
	const onScreen = (step.screens as Place[]).includes(state.place);
	if (state.status === 'running' && step.advance.kind === kind && onScreen)
		return { state: { ...next, step: state.step + 1 }, effects: [] };
	return { state: next, effects: [] };
}

/** Which tutorial screen a path is, given the app's base path. */
export function placeOf(pathname: string, base: string, mapId: string): Place {
	const path = pathname.startsWith(base) ? pathname.slice(base.length) : pathname;
	const parts = path.split('/').filter(Boolean);
	if (parts.length === 0) return 'home';
	if (parts[0] !== 'map' || parts[1] !== mapId) return 'elsewhere';
	if (parts.length === 2) return 'explore';
	if (parts.length === 3 && ['overview', 'quiz', 'tour'].includes(parts[2]))
		return parts[2] as Screen;
	return 'elsewhere';
}
