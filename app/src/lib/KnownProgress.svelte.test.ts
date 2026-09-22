// A map's standing bar (FT-65, docs/PLAN_V0.10.md). Runs in the browser
// project: the bar is DOM, and the accessible name comes from the dictionary.
import { beforeEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import KnownProgress from './KnownProgress.svelte';
import { setLanguage } from './i18n.svelte';

describe('KnownProgress', () => {
	beforeEach(() => setLanguage('en'));

	it('shows nothing until the first name is known', async () => {
		// The line used to read "0 / 49 known" on a map that had been played
		// but had no name at a clean streak yet; a bar at zero is worse.
		const screen = await render(KnownProgress, { known: 0, total: 49 });
		expect(screen.container.querySelector('[role="progressbar"]')).toBeNull();
	});

	it('draws the bar, with the count as its accessible name', async () => {
		const screen = await render(KnownProgress, { known: 3, total: 6 });
		const bar = screen.container.querySelector('[role="progressbar"]')!;
		expect(bar.getAttribute('aria-valuenow')).toBe('3');
		expect(bar.getAttribute('aria-valuemax')).toBe('6');
		expect(bar.getAttribute('aria-label')).toBe('3 / 6 known');
		expect(bar.querySelector<HTMLElement>('.known-bar-fill')!.style.width).toBe('50%');
	});

	it('marks a map with nothing left to learn as done', async () => {
		const screen = await render(KnownProgress, { known: 4, total: 4, allKnown: true });
		expect(screen.container.querySelector('.known-bar')!.classList.contains('all-known')).toBe(
			true
		);
	});
});
