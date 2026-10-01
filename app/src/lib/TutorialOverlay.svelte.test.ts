import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { userEvent } from 'vitest/browser';
import TutorialOverlay from './TutorialOverlay.svelte';
import { setLanguage } from './i18n.svelte';
import { dispatch, tutorialState } from './tutorial.svelte';
import { isTutorialSandboxActive } from './tutorialSandbox.svelte';

// Stand-ins for the real elements the steps point at.
function anchor(name: string): HTMLElement {
	const el = document.createElement('div');
	el.dataset.tutorial = name;
	el.style.cssText = 'position:fixed;left:40px;top:300px;width:200px;height:40px';
	document.body.append(el);
	return el;
}

const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');
const cardText = () => dialog()?.querySelector('.text')?.textContent ?? '';
const counter = () => dialog()?.querySelector('.counter')?.textContent ?? null;
const spotlight = () => document.querySelector('.spotlight');

describe('TutorialOverlay', () => {
	beforeEach(() => {
		setLanguage('en');
		// On the home page, where the tutorial starts without navigating.
		dispatch({ type: 'route', place: 'home' });
	});

	afterEach(() => {
		dispatch({ type: 'skip' });
		document.querySelectorAll('[data-tutorial]').forEach((el) => el.remove());
	});

	it('shows nothing until the tutorial starts', async () => {
		await render(TutorialOverlay);
		await expect.poll(() => dialog()).toBeNull();
		expect(document.querySelector('.paused')).toBeNull();
	});

	it('opens on the intro, then Start moves to step 1 and spotlights its element', async () => {
		anchor('picker-europe');
		const screen = await render(TutorialOverlay);
		dispatch({ type: 'start' });
		expect(isTutorialSandboxActive()).toBe(true);
		await expect
			.element(screen.getByRole('heading', { name: 'Welcome to Geoclick' }))
			.toBeVisible();

		await screen.getByRole('button', { name: 'Start' }).click();
		await expect.poll(counter).toBe('Step 1 of 14');
		expect(cardText()).toBe('Every map starts from the world. Choose Europe.');
		expect(dialog()!.querySelector('strong')?.textContent).toBe('Europe');
		await expect.poll(spotlight).not.toBeNull();
		// Step 1 waits for Europe to be opened: no Next, no Back.
		const labels = [...dialog()!.querySelectorAll('button')].map((b) => b.textContent?.trim());
		expect(labels).toEqual(['Exit tutorial']);
	});

	it('moves on with the player: a route change advances an action step', async () => {
		await render(TutorialOverlay);
		dispatch({ type: 'start' });
		dispatch({ type: 'next' });
		dispatch({ type: 'continent', id: 'europe' });
		await expect.poll(counter).toBe('Step 2 of 14');
		dispatch({ type: 'country', id: 'italy' });
		await expect.poll(counter).toBe('Step 3 of 14');
		// A map opens on its own screen now (FT-39), not on the Overview.
		dispatch({ type: 'route', place: 'explore' });
		await expect.poll(counter).toBe('Step 4 of 14');
		dispatch({ type: 'gesture' });
		await expect.poll(counter).toBe('Step 5 of 14');
		// Step 5 waits for the player to tap a name onto the map, so there is
		// no Next to press until they have.
		const labels = [...dialog()!.querySelectorAll('button')].map((b) => b.textContent?.trim());
		expect(labels).toEqual(['Back', 'Exit tutorial']);
		dispatch({ type: 'reveal' });
		await expect.poll(counter).toBe('Step 6 of 14');
	});

	it('Back returns to the previous step, which offers Next once done', async () => {
		const screen = await render(TutorialOverlay);
		dispatch({ type: 'start' });
		dispatch({ type: 'next' });
		dispatch({ type: 'route', place: 'explore' });
		dispatch({ type: 'gesture' });
		await expect.poll(counter).toBe('Step 5 of 14');
		await screen.getByRole('button', { name: 'Back' }).click();
		await expect.poll(counter).toBe('Step 4 of 14');
		await expect.element(screen.getByRole('button', { name: 'Next' })).toBeVisible();
	});

	it('shows the card without a spotlight while its element is missing, and finds it later', async () => {
		await render(TutorialOverlay);
		dispatch({ type: 'start' });
		dispatch({ type: 'next' });
		await expect.poll(counter).toBe('Step 1 of 14');
		await expect.poll(() => dialog()?.style.visibility).toBe('visible');
		expect(spotlight()).toBeNull();

		anchor('picker-europe');
		await expect.poll(spotlight).not.toBeNull();
	});

	it("spotlights Europe, then Italy, then Italy's row (FT-79)", async () => {
		const spots = ['picker-europe', 'picker-italy', 'home-map-card'].map((name, i) => {
			const el = anchor(name);
			el.style.top = `${100 + i * 120}px`;
			return el;
		});
		const spotTop = () => Math.round(spotlight()?.getBoundingClientRect().top ?? -1);
		const near = (el: HTMLElement) => Math.abs(spotTop() - el.getBoundingClientRect().top) < 20;
		await render(TutorialOverlay);
		dispatch({ type: 'start' });
		dispatch({ type: 'next' });
		await expect.poll(() => near(spots[0])).toBe(true);
		dispatch({ type: 'continent', id: 'europe' });
		await expect.poll(() => near(spots[1])).toBe(true);
		dispatch({ type: 'country', id: 'italy' });
		await expect.poll(() => near(spots[2])).toBe(true);
		expect(cardText()).toBe("Choose Regions in Italy's row to open that map.");
	});

	it('pauses off-script, and Resume brings the card back', async () => {
		const screen = await render(TutorialOverlay);
		dispatch({ type: 'start' });
		dispatch({ type: 'next' });
		dispatch({ type: 'route', place: 'elsewhere' });
		await expect.element(screen.getByText('Tutorial paused')).toBeVisible();
		expect(dialog()).toBeNull();

		// Back on the step's own screen first, so Resume needn't navigate.
		dispatch({ type: 'route', place: 'home' });
		await screen.getByRole('button', { name: 'Resume' }).click();
		await expect.poll(counter).toBe('Step 1 of 14');
	});

	it('Exit tutorial and Esc end the tutorial and switch the sandbox off', async () => {
		const screen = await render(TutorialOverlay);
		dispatch({ type: 'start' });
		await screen.getByRole('button', { name: 'Exit tutorial' }).click();
		await expect.poll(dialog).toBeNull();
		expect(tutorialState().status).toBe('idle');
		expect(isTutorialSandboxActive()).toBe(false);

		dispatch({ type: 'start' });
		await expect.poll(dialog).not.toBeNull();
		await userEvent.keyboard('{Escape}');
		await expect.poll(dialog).toBeNull();
	});

	it('speaks German when the app does', async () => {
		setLanguage('de');
		const screen = await render(TutorialOverlay);
		dispatch({ type: 'start' });
		await expect
			.element(screen.getByRole('heading', { name: 'Willkommen bei Geoclick' }))
			.toBeVisible();
		await expect.element(screen.getByRole('button', { name: "Los geht's" })).toBeVisible();
		await expect.element(screen.getByRole('button', { name: 'Tutorial beenden' })).toBeVisible();
	});

	it('uses the Italian exit label', async () => {
		setLanguage('it');
		const screen = await render(TutorialOverlay);
		dispatch({ type: 'start' });
		await expect.element(screen.getByRole('button', { name: 'Esci dal tutorial' })).toBeVisible();
	});
});
