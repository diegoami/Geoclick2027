import { afterEach, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Home from '../routes/+page.svelte';
import MapNav from './MapNav.svelte';
import { setHomeView } from './mapPrefs.svelte';
import { setLanguage } from './i18n.svelte';

vi.mock('$app/navigation', () => ({ goto: vi.fn(), afterNavigate: vi.fn() }));
vi.mock('$app/paths', () => ({
	asset: (file: string) => file,
	resolve: (route: string, params: Record<string, string> = {}) =>
		Object.entries(params).reduce((value, [key, text]) => value.replace(`[${key}]`, text), route)
}));
vi.mock('./platform', async (importOriginal) => ({
	...(await importOriginal<typeof import('./platform')>()),
	isNativeShell: async () => false
}));
vi.mock('./progressRepository', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./progressRepository')>();
	return {
		...actual,
		createProgressRepository: async () => actual.createInMemoryProgressRepository()
	};
});

afterEach(() => {
	setLanguage('en');
	setHomeView('map');
});
it('restores the home title after leaving a map component (#250)', async () => {
	setLanguage('en');
	setHomeView('list');
	document.title = 'Geoclick';
	const map = await render(MapNav, {
		mapId: 'singapore-regions',
		mapName: 'Singapore — Regions',
		active: 'quiz'
	});
	await expect.poll(() => document.title).toBe('Singapore — Regions · Quiz · Geoclick');
	map.unmount();
	await render(Home);
	await expect.poll(() => document.title).toBe('Geoclick');
});
