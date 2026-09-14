import { describe, expect, it } from 'vitest';
import { parentRoute } from './backNavigation';

describe('parentRoute (Android back button)', () => {
	it('sends every map screen to that map’s overview', () => {
		for (const view of ['quiz', 'tour'])
			expect(parentRoute(`/map/italy-regions/${view}`)).toEqual({
				kind: 'overview',
				mapId: 'italy-regions'
			});
		// Explore is the bare map route.
		expect(parentRoute('/map/italy-regions')).toEqual({ kind: 'overview', mapId: 'italy-regions' });
	});

	it('sends the overview to the map list, and the map list out of the app', () => {
		expect(parentRoute('/map/italy-regions/overview')).toEqual({ kind: 'home' });
		expect(parentRoute('/')).toEqual({ kind: 'exit' });
		expect(parentRoute('')).toEqual({ kind: 'exit' });
	});

	it('ignores trailing slashes', () => {
		expect(parentRoute('/map/usa-states/quiz/')).toEqual({ kind: 'overview', mapId: 'usa-states' });
		expect(parentRoute('/map/usa-states/overview/')).toEqual({ kind: 'home' });
	});

	it('honours a base path', () => {
		expect(parentRoute('/geoclick/map/usa-states/tour', '/geoclick')).toEqual({
			kind: 'overview',
			mapId: 'usa-states'
		});
		expect(parentRoute('/geoclick/map/usa-states/overview', '/geoclick')).toEqual({ kind: 'home' });
		expect(parentRoute('/geoclick/', '/geoclick')).toEqual({ kind: 'exit' });
		expect(parentRoute('/geoclick', '/geoclick')).toEqual({ kind: 'exit' });
	});

	it('decodes an encoded map id', () => {
		expect(parentRoute('/map/c%C3%B4te/quiz')).toEqual({ kind: 'overview', mapId: 'côte' });
	});

	it('falls back to the map list for anything unexpected', () => {
		expect(parentRoute('/somewhere/else')).toEqual({ kind: 'home' });
		expect(parentRoute('/map/italy-regions/quiz/extra')).toEqual({ kind: 'home' });
	});
});
