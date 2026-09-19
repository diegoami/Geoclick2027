// The Terrain layer (FT-33, docs/PLAN_V0.8.md): sea, rivers and named
// terrain, drawn behind the map a player is learning.
//
// Why it exists: until v0.8.0 every map was politics only - flat coloured
// shapes on sand, with the sea exactly the same sand as the land, so no
// coastline read at all. A region drawn like that has nothing to sit
// against, and a name with nothing to hang on is a name you re-learn every
// session. With this on, Liguria is the one on the sea, Trentino is the one
// against the Alps, and Lombardia is where the Po runs.
//
// Three things about the shape of this module, each of them deliberate:
//
//  1. It is added at RUNTIME, not declared in data/styles/base.json, and it
//     comes from its own archive (terrain.pmtiles, not tiles.pmtiles).
//     geoclickMap.ts pulls a whole archive into memory on desktop and
//     Android - neither shell serves range requests - so a layer that is
//     off by default must not be inside the tileset every map already
//     loads. Nothing is fetched until the button is pressed the first time.
//  2. The names are DOM popups through labelCollision.ts, not a MapLibre
//     symbol layer, for the reason base.json's own note gives: the style's
//     glyph URL points at a public font server, and the desktop and Android
//     builds have to work with no network at all.
//  3. The paint is here rather than in base.json because the layers cannot
//     be declared in a style whose source does not exist yet - MapLibre
//     rejects a layer with a missing source at style load. base.json's
//     metadata note points here so the style file still tells the story.

import * as maplibregl from 'maplibre-gl';
import type { LayerSpecification } from 'maplibre-gl';
import { asset } from '$app/paths';
import { registerTilesArchive } from './geoclickMap';
import { registerLabel } from './labelCollision';
import { isNativeShell } from './platform';
import { getLanguage } from './i18n.svelte';

export const TERRAIN_SOURCE = 'terrain';

// Below every target layer: this is background, and the target fills are
// translucent enough (0.55) to let it through. base.json's first layer id.
const BEFORE_LAYER = 'context-fill';

// A name the collision pass gives way on first. Every target name outranks
// it - a region's own name matters more than the range behind it - and
// area share, which the views use for target priority, is below 1, so a
// negative number keeps terrain under all of them (labelCollision.ts). On a
// fully labelled Overview the big ranges therefore lose their space; in the
// quiz, where few names are on the map yet, they show. That is the right way
// round: the terrain is there to help while you are still learning.
const TERRAIN_LABEL_PRIORITY = -1;

/**
 * Where one terrain name ranks against the others. Natural Earth's
 * scalerank is how important a feature is - 1 for the Alps, 9 for a minor
 * range - so the Alps win the space against a ridge next door, while both
 * still give way to any region's own name.
 */
function terrainPriority(rank: unknown): number {
	const scale = typeof rank === 'number' && Number.isFinite(rank) ? rank : 9;
	return TERRAIN_LABEL_PRIORITY - scale / 100;
}

const LAYERS: LayerSpecification[] = [
	{
		id: 'sea-fill',
		type: 'fill',
		source: TERRAIN_SOURCE,
		'source-layer': 'sea',
		paint: { 'fill-color': '#c5dcea', 'fill-opacity': 0.85 }
	},
	{
		id: 'terrain-fill',
		type: 'fill',
		source: TERRAIN_SOURCE,
		'source-layer': 'terrain',
		paint: {
			// Ranges and plateaus read warm-brown, everything else (deserts,
			// plains, basins, coasts) a flatter sand. Kept well away from the
			// palette in base.json and from the quiz state colours: this is
			// background, and it sits under a 0.55-opacity target fill.
			'fill-color': [
				'match',
				['get', 'kind'],
				['Range/mtn', 'Plateau', 'Foothills'],
				'#d8c9a8',
				'#e2dcc4'
			],
			'fill-opacity': 0.55
		}
	},
	{
		id: 'rivers-line',
		type: 'line',
		source: TERRAIN_SOURCE,
		'source-layer': 'rivers',
		paint: {
			'line-color': '#7fb0cc',
			// Natural Earth's scalerank is "how important is this river": 1 is
			// the Amazon, 10 a tributary. Thin them out when zoomed out so a
			// country-wide view shows its big rivers, not a cobweb.
			'line-width': [
				'interpolate',
				['linear'],
				['zoom'],
				3,
				['case', ['<=', ['get', 'rank'], 4], 1.1, 0],
				6,
				['case', ['<=', ['get', 'rank'], 4], 1.8, 0.9],
				9,
				2.6
			],
			'line-opacity': 0.9
		}
	}
];

/** The label text in the player's language, falling back to the source's. */
function labelFor(properties: Record<string, unknown>): string {
	const lang = getLanguage();
	const localized =
		lang === 'de' ? properties.name_de : lang === 'it' ? properties.name_it : undefined;
	return typeof localized === 'string' && localized !== ''
		? localized
		: String(properties.name ?? '');
}

/**
 * Adds or removes the Terrain layer on a live map. One instance per map
 * view; `setVisible` is what the button calls.
 */
export class TerrainLayer {
	private popups: maplibregl.Popup[] = [];
	private added = false;
	private pending = false;

	constructor(
		private map: maplibregl.Map,
		private mapId: string
	) {}

	async setVisible(visible: boolean): Promise<void> {
		if (!visible) {
			this.removeLabels();
			for (const layer of LAYERS) {
				if (this.map.getLayer(layer.id)) {
					this.map.setLayoutProperty(layer.id, 'visibility', 'none');
				}
			}
			return;
		}
		if (this.added) {
			for (const layer of LAYERS) {
				if (this.map.getLayer(layer.id)) {
					this.map.setLayoutProperty(layer.id, 'visibility', 'visible');
				}
			}
			this.drawLabels();
			return;
		}
		// Two presses in quick succession must not fetch twice.
		if (this.pending) return;
		this.pending = true;
		try {
			await this.add();
		} finally {
			this.pending = false;
		}
	}

	private async add(): Promise<void> {
		const url = new URL(asset(`/maps/${this.mapId}/terrain.pmtiles`), location.origin).href;
		if (await isNativeShell()) await registerTilesArchive(url);
		if (this.map.getSource(TERRAIN_SOURCE)) return;

		this.map.addSource(TERRAIN_SOURCE, { type: 'vector', url: `pmtiles://${url}` });
		const before = this.map.getLayer(BEFORE_LAYER) ? BEFORE_LAYER : undefined;
		for (const layer of LAYERS) this.map.addLayer(layer, before);
		this.added = true;

		// The label points arrive with the tiles, so wait for the source
		// before asking for them.
		if (this.map.isSourceLoaded(TERRAIN_SOURCE)) {
			this.drawLabels();
		} else {
			const onData = (e: maplibregl.MapSourceDataEvent) => {
				if (e.sourceId !== TERRAIN_SOURCE || !e.isSourceLoaded) return;
				this.map.off('sourcedata', onData);
				this.drawLabels();
			};
			this.map.on('sourcedata', onData);
		}
	}

	/** One popup per named feature currently in view. */
	private drawLabels(): void {
		this.removeLabels();
		const features = this.map.querySourceFeatures(TERRAIN_SOURCE, {
			sourceLayer: 'physical_labels'
		});
		const seen = new Set<string>();
		for (const feature of features) {
			const properties = (feature.properties ?? {}) as Record<string, unknown>;
			const text = labelFor(properties);
			// A feature split across tile boundaries comes back once per tile.
			if (text === '' || seen.has(text)) continue;
			seen.add(text);
			const geometry = feature.geometry;
			if (geometry.type !== 'Point') continue;
			const popup = new maplibregl.Popup({
				closeButton: false,
				closeOnClick: false,
				anchor: 'center',
				className: 'geoclick-terrain-label'
			})
				.setLngLat(geometry.coordinates as [number, number])
				.setText(text)
				.addTo(this.map);
			registerLabel(popup, { priority: terrainPriority(properties.rank) });
			this.popups.push(popup);
		}
	}

	private removeLabels(): void {
		for (const popup of this.popups) popup.remove();
		this.popups = [];
	}

	destroy(): void {
		this.removeLabels();
	}
}
