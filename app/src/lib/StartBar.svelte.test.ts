// The start screen's toolbar (FT-82, #91): every action an icon with a name
// a screen reader reads, big enough for a finger, and Exit in the apps only.
import { beforeEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import '../app.css';
import { setLanguage } from './i18n.svelte';
import StartBar from './StartBar.svelte';

const props = {
	showMap: true,
	switchDisabled: false,
	onView: () => {},
	isApp: false,
	myMapsCount: 0
};

describe('StartBar', () => {
	beforeEach(() => setLanguage('en'));

	it('names every icon, and each is a 44px target', async () => {
		const screen = await render(StartBar, props);
		for (const name of ['Map', 'List', 'My maps', 'Tutorial', 'About']) {
			const el = screen.getByRole(name === 'My maps' || name === 'About' ? 'link' : 'button', {
				name
			});
			await expect.element(el).toBeVisible();
			const { width, height } = el.element().getBoundingClientRect();
			expect(Math.min(width, height), name).toBeGreaterThanOrEqual(40);
		}
		// The toolbar's own icons are 44px; Map and List sit in one 40px pair.
		const about = screen.getByRole('link', { name: 'About' }).element();
		expect(about.getBoundingClientRect().height).toBe(44);
	});

	it('shows Exit only in the apps', async () => {
		const web = await render(StartBar, props);
		expect(web.container.querySelector('button[aria-label="Exit"]')).toBeNull();
		web.unmount();
		const app = await render(StartBar, { ...props, isApp: true });
		await expect.element(app.getByRole('button', { name: 'Exit' })).toBeVisible();
	});

	it('marks the chosen view, and says how many maps My maps holds', async () => {
		const screen = await render(StartBar, { ...props, showMap: false, myMapsCount: 3 });
		await expect
			.element(screen.getByRole('button', { name: 'List' }))
			.toHaveAttribute('aria-pressed', 'true');
		await expect.element(screen.getByRole('link', { name: 'My maps (3)' })).toBeVisible();
	});
});
