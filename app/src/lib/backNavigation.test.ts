import { describe, expect, it } from 'vitest';
import { parentRoute } from './backNavigation';

describe('parentRoute (Android back button)', () => {
	// Since FT-39 the bare /map/<id> is the map itself - the Known map that a
	// map now opens on - so the hierarchy hangs off that rather than off the
	// Overview, which became one sub-screen among the others.
	it('sends every sub-screen back to the map itself', () => {
		for (const view of ['quiz', 'tour', 'overview'])
			expect(parentRoute(`/map/italy-regions/${view}`)).toEqual({
				kind: 'map',
				mapId: 'italy-regions'
			});
	});

	it('sends the map itself to the map list, and the map list out of the app', () => {
		expect(parentRoute('/map/italy-regions')).toEqual({ kind: 'home' });
		expect(parentRoute('/')).toEqual({ kind: 'exit' });
		expect(parentRoute('')).toEqual({ kind: 'exit' });
	});

	it('ignores trailing slashes', () => {
		expect(parentRoute('/map/usa-states/quiz/')).toEqual({ kind: 'map', mapId: 'usa-states' });
		expect(parentRoute('/map/usa-states/')).toEqual({ kind: 'home' });
	});

	it('honours a base path', () => {
		expect(parentRoute('/geoclick/map/usa-states/tour', '/geoclick')).toEqual({
			kind: 'map',
			mapId: 'usa-states'
		});
		expect(parentRoute('/geoclick/map/usa-states', '/geoclick')).toEqual({ kind: 'home' });
		expect(parentRoute('/geoclick/', '/geoclick')).toEqual({ kind: 'exit' });
		expect(parentRoute('/geoclick', '/geoclick')).toEqual({ kind: 'exit' });
	});

	it('decodes a map id that needed escaping', () => {
		expect(parentRoute('/map/c%C3%B4te/quiz')).toEqual({ kind: 'map', mapId: 'côte' });
	});

	it('sends anything unexpected to the map list', () => {
		expect(parentRoute('/nonsense')).toEqual({ kind: 'home' });
		// The start screen's toolbar pages (FT-82) go back to it.
		expect(parentRoute('/my-maps')).toEqual({ kind: 'home' });
		expect(parentRoute('/about/')).toEqual({ kind: 'home' });
		expect(parentRoute('/map/a/b/c')).toEqual({ kind: 'home' });
	});
});
