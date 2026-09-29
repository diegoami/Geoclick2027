// My maps (FT-82, #91): the page the toolbar's star opens. A returning
// player's own choices come first: Favourites, then Recent.
import { beforeEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import MyMaps from '../routes/my-maps/+page.svelte';
import { setLanguage } from './i18n.svelte';
import { favouriteMaps, recordVisit, setUnrecordedMap, toggleFavourite } from './mapPrefs.svelte';

describe('My maps', () => {
	beforeEach(() => {
		setLanguage('en');
		setUnrecordedMap(undefined);
		for (const id of favouriteMaps()) toggleFavourite(id);
	});

	it('lists Favourites before Recent, each with its maps', async () => {
		toggleFavourite('italy-regions');
		recordVisit('usa-states');
		const screen = await render(MyMaps);
		const favourites = screen.getByRole('heading', { name: 'Favourites' });
		const recent = screen.getByRole('heading', { name: 'Recent' });
		await expect.element(favourites).toBeVisible();
		await expect.element(recent).toBeVisible();
		const order = favourites.element().compareDocumentPosition(recent.element());
		expect(order & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
		const italyFavourite = favourites
			.element()
			.closest('section')
			?.querySelector('a[href="/map/italy-regions"]');
		expect(italyFavourite?.textContent).toContain('Italy — Regions');
		await expect.element(screen.getByRole('link', { name: 'Back' })).toBeVisible();
	});
});
