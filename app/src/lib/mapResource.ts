import { asset } from './appPaths';
export type MapResource = 'map.json' | 'facts.json' | 'tour.json';
interface Bundle {
	map: Record<string, unknown>;
	facts: Record<string, unknown>;
	tour: Record<string, unknown>;
}
const object = (value: unknown): value is Record<string, unknown> =>
	!!value && typeof value === 'object' && !Array.isArray(value);
type Result = { ok: true; bundle: Bundle } | { ok: false; status: number };
/** One portable JSON per map keeps a complete export below the file budget. */
export function createMapResourceFetcher(
	bundled: boolean,
	assetPath: (file: string) => string = (file) => asset(file as Parameters<typeof asset>[0])
) {
	const cache = new Map<string, Promise<Result>>();
	return async (mapId: string, file: MapResource): Promise<Response> => {
		const path = '/maps/' + encodeURIComponent(mapId) + '/';
		if (!bundled) return fetch(assetPath(path + file));
		let pending = cache.get(mapId);
		if (!pending) {
			pending = fetch(assetPath(path + 'bundle.json'))
				.then(async (response) => {
					if (!response.ok) {
						cache.delete(mapId);
						return { ok: false, status: response.status } as const;
					}
					const data: unknown = await response.json();
					if (
						!object(data) ||
						!object(data.map) ||
						data.map.id !== mapId ||
						!object(data.facts) ||
						!object(data.tour) ||
						data.tour.mapId !== mapId
					)
						throw new Error('Invalid bundled map data for ' + mapId);
					return { ok: true, bundle: data as unknown as Bundle } as const;
				})
				.catch((error) => {
					cache.delete(mapId);
					throw error;
				});
			cache.set(mapId, pending);
		}
		const result = await pending;
		if (!result.ok)
			return result.status === 0 ? Response.error() : new Response(null, { status: result.status });
		const part = file === 'map.json' ? 'map' : file === 'facts.json' ? 'facts' : 'tour';
		// Fresh Response bodies preserve normal fetch semantics and prevent caller mutations.
		return new Response(JSON.stringify(result.bundle[part]), {
			headers: { 'Content-Type': 'application/json' }
		});
	};
}
export const fetchMapResource = createMapResourceFetcher(
	import.meta.env.VITE_GEOCLICK_HTML5 === '1'
);
