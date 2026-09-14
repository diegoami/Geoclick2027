import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import TutorialNudge from './TutorialNudge.svelte';
import { setLanguage } from './i18n.svelte';
import { dispatch, tutorialState } from './tutorial.svelte';
import { showTutorialNudge } from './tutorialSeen.svelte';

const stored = () => localStorage.getItem('geoclick:tutorial-seen:v1');

describe('TutorialNudge', () => {
	beforeEach(() => {
		setLanguage('en');
		dispatch({ type: 'route', place: 'home' });
	});
	afterEach(() => dispatch({ type: 'skip' }));

	it('"No thanks" stops offering the tutorial on this device', async () => {
		const screen = await render(TutorialNudge);
		await expect
			.element(screen.getByText('New here? A three-minute tutorial shows you around.'))
			.toBeVisible();
		await screen.getByRole('button', { name: 'No thanks' }).click();
		expect(showTutorialNudge()).toBe(false);
		expect(stored()).toBe('1');
		expect(tutorialState().status).toBe('idle');
	});

	it('"Start the tutorial" starts it and counts as seen', async () => {
		localStorage.removeItem('geoclick:tutorial-seen:v1');
		const screen = await render(TutorialNudge);
		await screen.getByRole('button', { name: 'Start the tutorial' }).click();
		expect(tutorialState().status).toBe('running');
		expect(showTutorialNudge()).toBe(false);
		expect(stored()).toBe('1');
	});

	it('speaks Italian without assuming the player is male', async () => {
		setLanguage('it');
		const screen = await render(TutorialNudge);
		await expect
			.element(
				screen.getByText('Prima volta qui? Un tutorial di tre minuti ti mostra come funziona.')
			)
			.toBeVisible();
	});
});
