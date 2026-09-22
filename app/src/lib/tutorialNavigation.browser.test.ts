// Runs in the browser project: `tutorial.svelte.ts` is a runes module with
// module-scope state, and `$app/paths`' resolve is the client runtime.
//
// FT-55, issue #1. The pure state machine was already correct and tested; the
// defect was here, where a `navigate` effect becomes a URL. The bug survived
// because `overview` resolved to the Known route, so a step that promised the
// Overview arrived on a screen it does not claim and re-paused.
import { describe, expect, it } from 'vitest';
import { STEPS } from './tutorialMachine';
import { screenPath } from './tutorial.svelte';
import { TUTORIAL_MAP_ID } from './tutorialSandbox.svelte';

const map = TUTORIAL_MAP_ID;

describe('tutorial navigation', () => {
	it('gives every screen the URL it promises', () => {
		expect(screenPath('home')).toBe('/');
		expect(screenPath('explore')).toBe(`/map/${map}`);
		expect(screenPath('overview')).toBe(`/map/${map}/overview`);
		expect(screenPath('quiz')).toBe(`/map/${map}/quiz`);
		expect(screenPath('tour')).toBe(`/map/${map}/tour`);
	});

	it('gives every screen a URL of its own', () => {
		// The regression: overview and explore shared one URL, so arriving at
		// the Overview re-paused the tutorial on the Known step.
		const screens = ['home', 'explore', 'overview', 'quiz', 'tour'] as const;
		const urls = screens.map(screenPath);
		expect(new Set(urls).size).toBe(screens.length);
	});

	it('resolves every screen a route step navigates to', () => {
		// Ties the machine's effects to the URLs: whatever screen a step
		// emits, the effect layer has a place to send the player.
		const targets = new Set(
			STEPS.flatMap((step) => (step.advance.kind === 'route' ? [step.advance.to] : []))
		);
		expect(targets.size).toBeGreaterThan(0);
		for (const target of targets) expect(screenPath(target)).toMatch(/^\//);
	});
});
