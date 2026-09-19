// The running tutorial (FT-11): its live state, and the hooks the views call.
// The rules live in tutorialMachine.ts (pure, unit-tested); this file only
// holds the state and carries out the effects: navigating, and switching the
// progress sandbox (tutorialSandbox.svelte.ts, FT-10). Every hook does
// nothing while no tutorial is running.

import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import {
	initialState,
	placeOf,
	transition,
	type Effect,
	type Screen,
	type TutorialEvent,
	type TutorialState
} from './tutorialMachine';
import {
	TUTORIAL_MAP_ID,
	endTutorialSandbox,
	startTutorialSandbox
} from './tutorialSandbox.svelte';
import { markTutorialSeen } from './tutorialSeen.svelte';

// Replaced whole on every transition, never mutated, so $state.raw.
let state = $state.raw<TutorialState>(initialState);
// Bumped whenever a run starts or ends, so a delayed event from an earlier
// run (a drop that landed just before Skip) can't reach the next one.
let run = 0;

export function tutorialState(): TutorialState {
	return state;
}

export function dispatch(event: TutorialEvent): void {
	const result = transition(state, event);
	const freshRun = event.type === 'replay' || (event.type === 'start' && state.status === 'idle');
	const endedRun = result.state.status === 'idle' && state.status !== 'idle';
	if (freshRun || endedRun) run++;
	// Started once, from anywhere: the home page stops offering it (FT-12).
	if (freshRun) markTutorialSeen();
	state = result.state;
	void carryOut(result.effects);
}

function navigateTo(screen: Screen): Promise<void> {
	const mapId = TUTORIAL_MAP_ID;
	switch (screen) {
		case 'home':
			return goto(resolve('/'));
		case 'explore':
			return goto(resolve('/map/[mapId]', { mapId }));
		case 'overview':
			return goto(resolve('/map/[mapId]', { mapId }));
		case 'quiz':
			return goto(resolve('/map/[mapId]/quiz', { mapId }));
		case 'tour':
			return goto(resolve('/map/[mapId]/tour', { mapId }));
	}
}

async function carryOut(effects: Effect[]): Promise<void> {
	for (const effect of effects) {
		if (effect.type === 'navigate') await navigateTo(effect.screen);
		else if (effect.type === 'startSandbox') startTutorialSandbox();
		else endTutorialSandbox();
	}
}

// Actions move a step on after a short pause, so the player sees what they
// did work (the map settling, the name popping up, the slip landing) before
// the card changes.
function later(event: TutorialEvent, ms: number): void {
	if (state.status === 'idle') return;
	const scheduledIn = run;
	setTimeout(() => {
		if (run === scheduledIn) dispatch(event);
	}, ms);
}

/** Every navigation, from the layout. Tracked even with no tutorial running,
 * so starting one on the home page doesn't navigate to it again. */
export function tutorialRouteChanged(pathname: string): void {
	dispatch({
		type: 'route',
		place: placeOf(pathname, resolve('/').replace(/\/$/, ''), TUTORIAL_MAP_ID)
	});
}

/** The player zoomed or panned the overview map (step 2). */
export function tutorialMapGesture(): void {
	later({ type: 'gesture' }, 500);
}

/** A region's name was shown in Explore (step 4). */
export function tutorialExploreReveal(): void {
	later({ type: 'reveal' }, 1000);
}

/** The quiz scored a drop (steps 6 and 7). */
export function tutorialDrop(correct: boolean): void {
	later({ type: 'drop', correct }, 700);
}
