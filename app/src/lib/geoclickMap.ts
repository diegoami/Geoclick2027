// Shared map-bootstrapping logic used by both the free-explore viewer
// (MapView.svelte) and the guided tour player (TourView.svelte).

import * as maplibregl from 'maplibre-gl';
import type { StyleSpecification } from 'maplibre-gl';
import { asset } from '$app/paths';
import { enableLabelMagnify } from './labelMagnify';
import { enableLabelCollision } from './labelCollision';
import { isNativeShell } from './platform';
import { overallExtent, type MapDefinition } from './mapDefinition';
import { mapFitPadding } from './mapFit';
import { TerrainLayer } from './terrainLayer';
import { tutorialMapGesture } from './tutorial.svelte';
import { ensurePmtilesProtocol, registerTilesArchive } from './pmtilesSource';

export async function fetchMapDefAndStyle(
	mapId: string
): Promise<{ mapDef: MapDefinition; style: StyleSpecification }> {
	// Registers the pmtiles:// protocol before any style referencing it is
	// handed to MapLibre. registerTilesArchive below calls this too, but only
	// on the native shells.
	ensurePmtilesProtocol();
	// asset() prefixes kit.paths.base (or paths.assets) - a bare "/maps/..."
	// 404s as soon as the app is served under a subpath (e.g. GitHub Pages).
	const [mapDefRes, baseStyleRes] = await Promise.all([
		fetch(asset(`/maps/${mapId}/map.json`)),
		fetch(asset('/styles/base.json'))
	]);
	if (!mapDefRes.ok || !baseStyleRes.ok) {
		throw new Error(`Could not load map "${mapId}".`);
	}
	const mapDef: MapDefinition = await mapDefRes.json();
	const baseStyle = await baseStyleRes.json();

	// pmtiles needs an absolute URL; new URL() keeps it absolute while honouring
	// the base path (and stays correct if asset() ever returns a full CDN URL).
	const tilesUrl = new URL(asset(`/maps/${mapId}/tiles.pmtiles`), location.origin).href;
	if (await isNativeShell()) {
		await registerTilesArchive(tilesUrl);
	}

	const style: StyleSpecification = {
		...baseStyle,
		sources: {
			...baseStyle.sources,
			targets: {
				...baseStyle.sources.targets,
				url: `pmtiles://${tilesUrl}`
			}
		}
	};
	return { mapDef, style };
}

export function createMap(
	container: HTMLDivElement,
	mapDef: MapDefinition,
	style: StyleSpecification
): { map: maplibregl.Map; terrain: TerrainLayer } {
	ensurePmtilesProtocol();
	const map = new maplibregl.Map({
		container,
		style,
		bounds: overallExtent(mapDef),
		// The map bar is already on screen, so the opening fit can keep the
		// whole map clear of it (FT-25).
		fitBoundsOptions: { padding: mapFitPadding(container) }
	});
	map.addControl(new maplibregl.NavigationControl(), 'top-right');
	// The tutorial rings the +/- buttons in its zoom-and-pan step (FT-11).
	container
		.querySelector('.maplibregl-ctrl-top-right .maplibregl-ctrl-group')
		?.setAttribute('data-tutorial', 'zoom-control');

	// Each target's adjacency-aware colour slot (GC-032) is read by base.json
	// through feature-state, so recolouring never means rebuilding tiles.
	// 'style.load' is the earliest moment setFeatureState is legal (the source
	// exists) and it comes before the first tile paints - so there is no flash of
	// the fallback colour, unlike waiting for 'load'. Other feature-state keys
	// (quizCorrect, highlighted...) are merged, not replaced, so views that set
	// those later don't disturb it.
	const applyColorIndex = () => {
		for (const target of mapDef.targets) {
			if (target.colorIndex === undefined) continue;
			map.setFeatureState(
				{ source: 'targets', sourceLayer: 'targets', id: target.name },
				{ colorIndex: target.colorIndex }
			);
		}
	};
	map.on('style.load', applyColorIndex);
	if (map.isStyleLoaded()) applyColorIndex();

	// The tutorial's zoom-and-pan step (FT-11) waits for the player's own
	// gesture, and a move counts once it ends. Which events carry the
	// player's input differs: the +/- buttons pass it on every move event,
	// but a wheel zoom only on MapLibre's own 'wheel' event (its moves come
	// from an easing animation), so both are watched. A drag and a touch
	// pinch or pan start with 'dragstart' / 'touchstart'. The map's opening
	// fit has none of these.
	//
	// Here rather than in one view: the step moved from the Overview to the
	// map's own screen in FT-40 and the wiring did not move with it, so the
	// tutorial stuck on step 2 with nothing to say why. tutorialMapGesture()
	// does nothing when no tutorial is running, so every view can report.
	let playerMove = false;
	const byPlayer = (e: { originalEvent?: unknown }) => {
		if (e.originalEvent) playerMove = true;
	};
	map.on('wheel', byPlayer);
	map.on('dragstart', byPlayer);
	map.on('touchstart', byPlayer);
	map.on('move', byPlayer);
	map.on('moveend', () => {
		if (playerMove) tutorialMapGesture();
		playerMove = false;
	});

	// Sea, rivers and named terrain (FT-33). The layer is built here so every
	// screen gets the same one, but WHEN it is shown is the view's business:
	// each one runs an $effect on the stored preference, so pressing Terrain
	// in the map bar updates whatever map is open. This used to be a registry
	// of live maps in this module with a refreshTerrain() the button called,
	// which broke as soon as terrainLayer.ts imported back into this file -
	// see pmtilesSource.ts for what that cycle did.
	const terrain = new TerrainLayer(map, mapDef.id);
	map.once('remove', () => terrain.destroy());

	// Magnify a name label under the mouse (FT-02) or on a tap (FT-03). Labels
	// take no pointer input, so drags on them move the map (FT-18).
	map.once('remove', enableLabelMagnify(container));
	// Names never overlap (FT-23): whatever names a view draws, the ones that
	// don't fit are hidden until the player zooms in far enough for them. Every
	// town's dot counts, named or not - a quiz's unsolved ones too (FT-63).
	const towns = mapDef.targets.filter((t) => t.type === 'city').map((t) => t.centroid);
	map.once(
		'remove',
		enableLabelCollision(map, container, () => towns.map((c) => map.project(c)))
	);

	if (import.meta.env.DEV && typeof window !== 'undefined') {
		// Debug/test aid, on the dev server only (it used to ship to every user
		// of the production build): lets a browser check, or a person in the
		// console, drive the real map of whichever view is open - e.g.
		// map.project(lngLat) for the screen position of a place.
		(window as unknown as { __map?: maplibregl.Map }).__map = map;
	}
	return { map, terrain };
}
