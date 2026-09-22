// Runs in the browser project: `tutorial.svelte.ts` is a runes module with
// module-scope state, and `$app/paths`' resolve is the client runtime.
//
// FT-55, issue #1. The pure state machine was already correct and tested; the
// defect was in the effect layer, where a `navigate` effect becomes a goto().
// The bug survived because `overview` resolved to the Known route, so a step
// that promised the Overview arrived on a screen it does not claim and
// re-paused. These drive the effect handler itself, with goto captured, so
// they fail if the handler goes back to the wrong mapping even when the
// mapping helper looks right.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { gotoMock } = vi.hoisted(() => ({
	gotoMock: vi.fn<(...args: [string]) => Promise<void>>(() => Promise.resolve())
}));
vi.mock('$app/navigation', () => ({ goto: gotoMock }));

import { STEPS, type Screen } from './tutorialMachine';
import { navigateTo } from './tutorial.svelte';
import { TUTORIAL_MAP_ID } from './tutorialSandbox.svelte';

const map = TUTORIAL_MAP_ID;

// The URL every screen must produce. `overview` and `explore` are deliberately
// different: sharing one was the bug.
const URL_OF: Record<Screen, string> = {
	home: '/',
	explore: `/map/${map}`,
	overview: `/map/${map}/overview`,
	quiz: `/map/${map}/quiz`,
	tour: `/map/${map}/tour`
};

const screens = Object.keys(URL_OF) as Screen[];

describe('the navigate effect', () => {
	beforeEach(() => gotoMock.mockClear());

	it('sends every screen to the URL it promises', async () => {
		for (const screen of screens) {
			await navigateTo(screen);
			expect(gotoMock).toHaveBeenLastCalledWith(URL_OF[screen]);
		}
	});

	it('gives every screen a URL of its own', async () => {
		// The regression: overview and explore shared one URL, so arriving at
		// the Overview re-paused the tutorial on the Known step.
		for (const screen of screens) await navigateTo(screen);
		const urls = gotoMock.mock.calls.map(([url]) => url);
		expect(new Set(urls).size).toBe(screens.length);
	});

	it('resolves every screen a route step navigates to', async () => {
		// Ties the machine's effects to the handler: whatever screen a step
		// emits, the effect has somewhere to send the player.
		const targets = new Set(
			STEPS.flatMap((step) => (step.advance.kind === 'route' ? [step.advance.to] : []))
		);
		expect(targets.size).toBeGreaterThan(0);
		for (const target of targets) {
			await navigateTo(target);
			expect(gotoMock).toHaveBeenLastCalledWith(URL_OF[target]);
		}
	});
});
