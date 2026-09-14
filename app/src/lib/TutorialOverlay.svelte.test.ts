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
		anchor('home-map-card');
		const screen = await render(TutorialOverlay);
		dispatch({ type: 'start' });
		expect(isTutorialSandboxActive()).toBe(true);
		await expect
			.element(screen.getByRole('heading', { name: 'Welcome to Geoclick' }))
			.toBeVisible();

		await screen.getByRole('button', { name: 'Start' }).click();
		await expect.poll(counter).toBe('Step 1 of 11');
		expect(cardText()).toBe("Let's start with a map. Open Regions, under Italy.");
		expect(dialog()!.querySelector('strong')?.textContent).toBe('Regions');
		await expect.poll(spotlight).not.toBeNull();
		// Step 1 waits for the map to be opened: no Next, no Back.
		const labels = [...dialog()!.querySelectorAll('button')].map((b) => b.textContent?.trim());
		expect(labels).toEqual(['Skip']);
	});

	it('moves on with the player: a route change advances an action step', async () => {
		await render(TutorialOverlay);
		dispatch({ type: 'start' });
		dispatch({ type: 'next' });
		dispatch({ type: 'route', place: 'overview' });
		await expect.poll(counter).toBe('Step 2 of 11');
		dispatch({ type: 'gesture' });
		await expect.poll(counter).toBe('Step 3 of 11');
		// An explanation step has Next, and Back.
		const labels = [...dialog()!.querySelectorAll('button')].map((b) => b.textContent?.trim());
		expect(labels).toEqual(['Back', 'Skip', 'Next']);
	});

	it('Back returns to the previous step, which offers Next once done', async () => {
		const screen = await render(TutorialOverlay);
		dispatch({ type: 'start' });
		dispatch({ type: 'next' });
		dispatch({ type: 'route', place: 'overview' });
		dispatch({ type: 'gesture' });
		await expect.poll(counter).toBe('Step 3 of 11');
		await screen.getByRole('button', { name: 'Back' }).click();
		await expect.poll(counter).toBe('Step 2 of 11');
		await expect.element(screen.getByRole('button', { name: 'Next' })).toBeVisible();
	});

	it('shows the card without a spotlight while its element is missing, and finds it later', async () => {
		await render(TutorialOverlay);
		dispatch({ type: 'start' });
		dispatch({ type: 'next' });
		await expect.poll(counter).toBe('Step 1 of 11');
		await expect.poll(() => dialog()?.style.visibility).toBe('visible');
		expect(spotlight()).toBeNull();

		anchor('home-map-card');
		await expect.poll(spotlight).not.toBeNull();
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
		await expect.poll(counter).toBe('Step 1 of 11');
	});

	it('Skip and Esc end the tutorial and switch the sandbox off', async () => {
		const screen = await render(TutorialOverlay);
		dispatch({ type: 'start' });
		await screen.getByRole('button', { name: 'Skip' }).click();
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
	});
});
