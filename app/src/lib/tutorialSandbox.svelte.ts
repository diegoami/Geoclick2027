// The tutorial's sandbox (FT-10): while it's on, Italy - Regions' progress
// lives in memory, starting empty, and is thrown away when the tutorial ends.
// Every other map keeps its real progress (docs/TUTORIAL.md, "The sandbox";
// FEATURE_PLAN.md, decision 18). Nothing the tutorial's quiz does becomes
// real progress. The tutorial engine (FT-11) is the only caller.

import { setUnrecordedMap } from './mapPrefs.svelte';
import { forgetRound } from './quizRound';
import { createInMemoryProgressRepository, setProgressSandbox } from './progressRepository';

/** The map the tutorial always uses (FEATURE_PLAN.md, decision 7). */
export const TUTORIAL_MAP_ID = 'italy-regions';

let active = $state(false);

/** Starts a fresh sandbox, replacing any earlier one (Replay starts fresh too). */
export function startTutorialSandbox(): void {
	setProgressSandbox({ mapId: TUTORIAL_MAP_ID, memory: createInMemoryProgressRepository() });
	setUnrecordedMap(TUTORIAL_MAP_ID);
	// Nor may a round left open before it began - a real half-played one, or
	// an earlier run's on Replay - be resumed inside it: the map would not
	// start empty, and its hand would skip the slips the tutorial deals first
	// (FT-60).
	forgetRound(TUTORIAL_MAP_ID);
	active = true;
}

/** Throws the sandbox away. Progress repositories created from now on are the real ones. */
export function endTutorialSandbox(): void {
	setProgressSandbox(undefined);
	setUnrecordedMap(undefined);
	// A round played inside the tutorial is part of the sandbox: without this
	// it would be waiting on the tutorial map the next time the player opened
	// its quiz for real (FT-26, quizRound.ts).
	forgetRound(TUTORIAL_MAP_ID);
	active = false;
}

/** Reactive, so a view can key on it and remount with the real store when the tutorial ends. */
export function isTutorialSandboxActive(): boolean {
	return active;
}
