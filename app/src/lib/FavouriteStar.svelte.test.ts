import { beforeEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import FavouriteStar from './FavouriteStar.svelte';
import { setLanguage } from './i18n.svelte';
import { isFavourite, toggleFavourite } from './mapPrefs.svelte';

const stored = () => JSON.parse(localStorage.getItem('geoclick:favourite-maps:v1') ?? '[]');

describe('FavouriteStar', () => {
	beforeEach(() => {
		setLanguage('en');
		// Favourites are module-scope state persisted to localStorage: start clean.
		if (isFavourite('italy-regions')) toggleFavourite('italy-regions');
	});

	it('toggles the favourite, saves it on the device, and keeps one accessible name', async () => {
		const screen = await render(FavouriteStar, { mapId: 'italy-regions' });
		const star = screen.getByRole('button', { name: 'Favourite: Italy — Regions' });

		await expect.element(star).toHaveAttribute('aria-pressed', 'false');
		await expect.element(star).toHaveAttribute('title', 'Add to favourites');

		await star.click();
		await expect.element(star).toHaveAttribute('aria-pressed', 'true');
		await expect.element(star).toHaveAttribute('title', 'Remove from favourites');
		expect(stored()).toContain('italy-regions');

		await star.click();
		await expect.element(star).toHaveAttribute('aria-pressed', 'false');
		expect(stored()).not.toContain('italy-regions');
	});

	it('two stars for the same map stay in sync (home card and map bar)', async () => {
		const card = await render(FavouriteStar, { mapId: 'italy-regions' });
		const bar = await render(FavouriteStar, { mapId: 'italy-regions', size: 'bar' });
		// Each render's own button, so this can't pass by clicking and reading
		// the same element.
		const cardButton = card.container.querySelector('button')!;
		const barButton = bar.container.querySelector('button')!;
		expect(cardButton).not.toBe(barButton);
		expect(barButton.classList.contains('star--bar')).toBe(true);

		cardButton.click();
		await expect.poll(() => barButton.getAttribute('aria-pressed')).toBe('true');
	});
});
