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
import { registerTilesArchive } from './pmtilesSource';
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

// A summit beats the range it sits in - it is the sharper hook - and a great
// circle, which is a fact about the whole map rather than a place on it,
// gives way to both. All three still sit below every target name.
const PEAK_LABEL_PRIORITY = -0.5;
const LINE_LABEL_PRIORITY = -2;
// A peak's name goes beside its 3 px dot, never on it (the same rule a
// town's name follows, FT-24 - see labelCollision.ts's DOT_CLEARANCE_PX).
const PEAK_CLEARANCE_PX = 9;

/** "4807" as "4807 m", in the player's own digits. */
function formatMetres(elevation: number): string {
	return `${Math.round(elevation).toLocaleString(getLanguage())} m`;
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
		// The great circles (FT-37): Equator, Tropics, Polar Circles, Date
		// Line. Dashed and grey, because they are not a thing on the ground -
		// a solid line here would read as a border or a river.
		id: 'lines-line',
		type: 'line',
		source: TERRAIN_SOURCE,
		'source-layer': 'lines',
		paint: {
			'line-color': '#9a8f74',
			'line-width': 1.2,
			'line-dasharray': [4, 3],
			'line-opacity': 0.8
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
	},
	{
		// A peak's marker (FT-37). A small triangle would need an image or a
		// glyph server; a tiny brown circle with a ring reads as "a point on
		// the ground" and needs neither, and it is deliberately smaller and a
		// different colour from a town's target dot so the two can never be
		// confused while playing a towns map.
		id: 'peaks-point',
		type: 'circle',
		source: TERRAIN_SOURCE,
		'source-layer': 'peaks',
		paint: {
			'circle-radius': 3,
			'circle-color': '#7a6242',
			'circle-stroke-width': 1.2,
			'circle-stroke-color': '#f6f1e2',
			'circle-opacity': 0.95
		}
	}
];

// What the layers ABOVE the terrain get multiplied down to while it is on.
// Without this the layer is there but unreadable: a polygon map paints every
// target at 0.55, and 0.85 once it is solved or revealed - which on the
// Overview is all of them - and a points map lays its country context over
// the whole country at 0.85 too. The product owner's report on the first
// build was exactly that: hardly visible under the dark green, and hardly
// visible under the other colours either.
//
// The factors are deliberately different. A target fill is the game and has
// to stay legible enough to tell two neighbours apart, so it keeps about
// half its weight. The country-context fill on a points map is pure
// backdrop, and with the sea drawn the coastline already says where the
// country is, so it gives up most of its own.
const TARGET_DIM = 0.45;
const CONTEXT_DIM = 0.25;
const DIMMED: { layer: string; property: 'fill-opacity' | 'circle-opacity'; factor: number }[] = [
	{ layer: 'targets-fill', property: 'fill-opacity', factor: TARGET_DIM },
	{ layer: 'context-fill', property: 'fill-opacity', factor: CONTEXT_DIM }
	// targets-circle is deliberately absent: a town marker is a 9 px dot the
	// player has to hit, not a wash of colour over the terrain.
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
	// The opacity each dimmed layer had before this class touched it, so
	// switching off restores the map exactly and switching on twice does not
	// multiply the factor in twice.
	private originalOpacity = new globalThis.Map<string, unknown>();

	constructor(
		private map: maplibregl.Map,
		private mapId: string
	) {}

	/**
	 * Multiplies the layers above the terrain down so it can be seen through
	 * them, or puts them back exactly as they were.
	 */
	private dimOverlyingLayers(dim: boolean): void {
		for (const { layer, property, factor } of DIMMED) {
			if (!this.map.getLayer(layer)) continue;
			if (dim) {
				if (!this.originalOpacity.has(layer)) {
					this.originalOpacity.set(layer, this.map.getPaintProperty(layer, property));
				}
				const original = this.originalOpacity.get(layer);
				// Wrapping the original rather than restating it: targets-fill's
				// opacity is a `case` over five feature-states (base.json), and a
				// second copy of that here would rot the moment either changed.
				this.map.setPaintProperty(layer, property, [
					'*',
					original as number,
					factor
				] as unknown as number);
			} else if (this.originalOpacity.has(layer)) {
				this.map.setPaintProperty(layer, property, this.originalOpacity.get(layer) as number);
			}
		}
	}

	async setVisible(visible: boolean): Promise<void> {
		if (!visible) {
			this.removeLabels();
			this.dimOverlyingLayers(false);
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
			this.dimOverlyingLayers(true);
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

	/**
	 * Resolves once the style will accept `addSource`.
	 *
	 * This did not use to matter: Terrain was off by default, so nothing
	 * called `add()` until a player pressed the button, long after the map had
	 * loaded. Since FT-43 it is on by default and the view asks for it as soon
	 * as it mounts, which races the style - MapLibre throws "Style is not done
	 * loading" and the layer silently never appears. That is the same
	 * complaint the default flip was meant to fix, so it is worth getting
	 * right rather than leaving to chance.
	 */
	private whenStyleReady(): Promise<void> {
		if (this.map.isStyleLoaded()) return Promise.resolve();
		return new Promise((resolve) => {
			const check = () => {
				if (!this.map.isStyleLoaded()) return;
				this.map.off('styledata', check);
				this.map.off('load', check);
				resolve();
			};
			this.map.on('styledata', check);
			// 'styledata' fires repeatedly while a style loads, but subscribe to
			// 'load' too in case the last one slipped past between the check
			// above and this line.
			this.map.on('load', check);
		});
	}

	private async add(): Promise<void> {
		const url = new URL(asset(`/maps/${this.mapId}/terrain.pmtiles`), location.origin).href;
		if (await isNativeShell()) await registerTilesArchive(url);
		await this.whenStyleReady();
		if (this.map.getSource(TERRAIN_SOURCE)) return;

		this.map.addSource(TERRAIN_SOURCE, { type: 'vector', url: `pmtiles://${url}` });
		const before = this.map.getLayer(BEFORE_LAYER) ? BEFORE_LAYER : undefined;
		for (const layer of LAYERS) this.map.addLayer(layer, before);
		this.added = true;
		this.dimOverlyingLayers(true);

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
		const seen = new Set<string>();
		// Ranges and seas, then the peaks, then the great circles. Each is a
		// point layer in the same archive; the peaks add their height to the
		// name, because "Mont Blanc 4 807 m" is a better hook than the name
		// alone, and a circle's label rides on the line itself.
		this.drawLabelLayer(
			'physical_labels',
			seen,
			(p) => labelFor(p),
			(p) => terrainPriority(p.rank)
		);
		this.drawLabelLayer(
			'peaks',
			seen,
			(p) =>
				`${labelFor(p)}${typeof p.elevation === 'number' ? ` ${formatMetres(p.elevation)}` : ''}`,
			// Above the ranges and seas, below every target name: a summit is a
			// sharper hook than the range it sits in, and the tallest wins.
			(p) => PEAK_LABEL_PRIORITY + (typeof p.elevation === 'number' ? p.elevation / 1e5 : 0)
		);
		this.drawLabelLayer(
			'lines',
			seen,
			(p) => labelFor(p),
			() => LINE_LABEL_PRIORITY
		);
	}

	/** One popup per named feature of a point layer in the terrain archive. */
	private drawLabelLayer(
		sourceLayer: string,
		seen: Set<string>,
		text: (properties: Record<string, unknown>) => string,
		priority: (properties: Record<string, unknown>) => number
	): void {
		for (const feature of this.map.querySourceFeatures(TERRAIN_SOURCE, { sourceLayer })) {
			const properties = (feature.properties ?? {}) as Record<string, unknown>;
			const label = text(properties);
			// A feature split across tile boundaries comes back once per tile.
			if (label === '' || seen.has(label)) continue;
			const geometry = feature.geometry;
			// A great circle is a line: its label goes where the line enters
			// the map, which for a clipped line is its first point.
			const at =
				geometry.type === 'Point'
					? (geometry.coordinates as [number, number])
					: geometry.type === 'LineString'
						? (geometry.coordinates[Math.floor(geometry.coordinates.length / 2)] as [
								number,
								number
							])
						: undefined;
			if (!at) continue;
			seen.add(label);
			const popup = new maplibregl.Popup({
				closeButton: false,
				closeOnClick: false,
				anchor: 'center',
				className: `geoclick-terrain-label geoclick-terrain-${sourceLayer}`
			})
				.setLngLat(at)
				.setText(label)
				.addTo(this.map);
			registerLabel(popup, {
				priority: priority(properties),
				// A peak's name sits beside its dot, never on it - the same rule
				// a town's name follows (FT-24).
				beside: sourceLayer === 'peaks' ? PEAK_CLEARANCE_PX : undefined
			});
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
