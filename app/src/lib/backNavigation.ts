// Where Android's hardware back button goes (FT-14). It goes up the app's
// hierarchy, not back through history (FEATURE_PLAN.md, decision 11):
//   quiz / tour / overview  ->  that map's own screen (Known)
//   the map itself          ->  the map list
//   map list               ->  leave the app
// Pure, so every route is unit-tested; +layout.svelte wires it to the button.

export type BackTarget = { kind: 'map'; mapId: string } | { kind: 'home' } | { kind: 'exit' };

/**
 * @param pathname `location.pathname`, which includes the app's base path
 * @param base the app's base path (`base` from `$app/paths`), '' at the root
 */
export function parentRoute(pathname: string, base = ''): BackTarget {
	let path = base && pathname.startsWith(base) ? pathname.slice(base.length) : pathname;
	path = '/' + path.replace(/^\/+|\/+$/g, '');

	const map = /^\/map\/([^/]+)(?:\/([^/]+))?$/.exec(path);
	if (map) {
		const [, mapId, view] = map;
		// The bare /map/<id> IS the map now (Known, FT-39), so it is the one
		// that goes back to the list; every sub-screen goes back to it.
		if (!view) return { kind: 'home' };
		return { kind: 'map', mapId: decodeURIComponent(mapId) };
	}
	if (path === '/') return { kind: 'exit' };
	return { kind: 'home' }; // anything unexpected: safest is the map list
}
