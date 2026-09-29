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
// Four things about the shape of this module, each of them deliberate:
//
//  1. It is added at RUNTIME, not declared in data/styles/base.json, and it
//     comes from its own archive (terrain.pmtiles, not tiles.pmtiles).
//     geoclickMap.ts pulls a whole archive into memory on desktop and
//     Android - neither shell serves range requests - so it is not inside
//     the tileset every map already loads. It is on by default (FT-43), so
//     it loads with every map unless the player has turned Terrain off.
//  2. The names are DOM popups through labelCollision.ts, not a MapLibre
//     symbol layer, for the reason base.json's own note gives: the style's
//     glyph URL points at a public font server, and the desktop and Android
//     builds have to work with no network at all.
//  3. The paint is here rather than in base.json because the layers cannot
//     be declared in a style whose source does not exist yet - MapLibre
//     rejects a layer with a missing source at style load. base.json's
//     metadata note points here so the style file still tells the story.
//  4. The antique sea-chart pattern is a bundled SVG, added only when Terrain
//     is shown. It needs no glyph or network dependency and cannot intercept
//     clicks because it is a fill beneath the playable targets.

import * as maplibregl from 'maplibre-gl';
import type { FillLayerSpecification, LayerSpecification } from 'maplibre-gl';
import { asset } from '$app/paths';
import { registerTilesArchive } from './pmtilesSource';
import { registerLabel } from './labelCollision';
import { isNativeShell } from './platform';
import { getLanguage, type Language } from './i18n.svelte';
import { loadSeaChartPattern, seaChartPatternImageId } from './seaChartPattern';

export const TERRAIN_SOURCE = 'terrain';
const SEA_DECORATION_LAYER = 'sea-chart-decoration';

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
function formatMetres(elevation: number, language: Language): string {
	return `${Math.round(elevation).toLocaleString(language)} m`;
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
		id: SEA_DECORATION_LAYER,
		type: 'fill',
		source: TERRAIN_SOURCE,
		'source-layer': 'sea',
		paint: { 'fill-pattern': seaChartPatternImageId('en'), 'fill-opacity': 0.55 }
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
function labelFor(properties: Record<string, unknown>, language: Language): string {
	const localized =
		language === 'de' ? properties.name_de : language === 'it' ? properties.name_it : undefined;
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
	private seaDecorationGeneration = 0;
	/**
	 * Set when a sea-chart image failed to load and the layer was hidden, so
	 * the next successful load shows it again without waiting for a Terrain
	 * toggle (#120).
	 */
	private seaDecorationHidden = false;
	/**
	 * The latest visibility the button asked for (FT-53). Kept so a label
	 * refresh cannot put names back on a layer the player has switched off.
	 */
	private visible = false;
	private pending = false;
	/**
	 * The pending "the tiles have arrived" handler, if the source was still
	 * loading when the labels were last asked for. At most one is live, and
	 * hiding the layer drops it, so tiles landing later cannot put names back
	 * on a map the player switched off (FT-54).
	 */
	private sourceReady: ((e: maplibregl.MapSourceDataEvent) => void) | undefined;
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
		this.visible = visible;
		if (this.added) {
			this.applyVisibility(visible);
			return;
		}
		if (!visible) {
			// Nothing is on the map yet. The flag set above is what stops an
			// in-flight `add()` from showing the terrain when it lands.
			this.applyVisibility(false);
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
	 * Shows or hides the layers already on the map, and follows them with the
	 * dimming and the labels. Only meaningful once `add()` has run.
	 */
	private applyVisibility(visible: boolean): void {
		if (visible) {
			for (const layer of LAYERS) {
				if (this.map.getLayer(layer.id)) {
					this.map.setLayoutProperty(layer.id, 'visibility', 'visible');
				}
			}
			// Turning Terrain on shows the decoration again too, so the next
			// pattern load has nothing to restore (#120).
			this.seaDecorationHidden = false;
			this.dimOverlyingLayers(true);
			void this.updateSeaDecoration(getLanguage());
			this.drawLabelsWhenSourceReady();
			return;
		}
		this.seaDecorationGeneration++;
		this.removeLabels();
		this.clearSourceReady();
		this.dimOverlyingLayers(false);
		for (const layer of LAYERS) {
			if (this.map.getLayer(layer.id)) {
				this.map.setLayoutProperty(layer.id, 'visibility', 'none');
			}
		}
	}

	/**
	 * Draws the labels, waiting for the tiles if they have not arrived yet.
	 * The label points come with the source, so asking before it loads would
	 * draw nothing and never retry.
	 */
	private drawLabelsWhenSourceReady(): void {
		// "Loaded" is not enough on its own. While the layers were hidden,
		// MapLibre let the source drop its tiles, so right after switching
		// back on the source reports loaded with nothing in it - and a draw
		// then finds no names and never retries. That was the second press
		// of Terrain leaving the map without its names. Nothing drawn means
		// wait for the tiles, as on a first load.
		if (this.map.isSourceLoaded(TERRAIN_SOURCE) && this.drawLabels(getLanguage()) > 0) return;
		// One pending wait is enough: turning it on again before the tiles
		// arrive must not stack a second handler.
		if (this.sourceReady) return;
		const onData = (e: maplibregl.MapSourceDataEvent) => {
			if (e.sourceId !== TERRAIN_SOURCE || !e.isSourceLoaded) return;
			// The player may have switched Terrain off while the tiles were on
			// their way; the names must not come back (FT-54).
			if (!this.visible) {
				this.clearSourceReady();
				return;
			}
			// Keep waiting until the names are really there: a "loaded" can
			// come before the dropped tiles are fetched again. Hiding the
			// layer or leaving the map drops this wait.
			if (this.drawLabels(getLanguage()) > 0) this.clearSourceReady();
		};
		this.sourceReady = onData;
		this.map.on('sourcedata', onData);
	}

	/** Drops the pending tiles-arrived handler, if there is one. */
	private clearSourceReady(): void {
		if (!this.sourceReady) return;
		this.map.off('sourcedata', this.sourceReady);
		this.sourceReady = undefined;
	}

	/**
	 * Redraws the labels in `language` (FT-53). The views call this from an
	 * effect that reads `getLanguage()`, so a language switch reaches the
	 * terrain even on a map's first open - when `setVisible(true)` draws the
	 * labels after `await this.add()` and the read therefore lands outside
	 * the effect's tracking window. The subscription is not missing; it is
	 * never established, which is why the redraw cannot simply live inside
	 * `setVisible`.
	 *
	 * A no-op unless the layer is on the map and visible: a refresh while it
	 * is off must not put labels back.
	 */
	refreshLabels(language: Language): void {
		if (!this.visible || !this.added) return;
		this.drawLabels(language);
		void this.updateSeaDecoration(language);
	}

	/** Load the localized pattern and change only the non-interactive sea layer. */
	private async updateSeaDecoration(language: Language): Promise<void> {
		if (!this.visible || !this.added || !this.map.getLayer(SEA_DECORATION_LAYER)) return;
		const generation = ++this.seaDecorationGeneration;
		const imageId = seaChartPatternImageId(language);
		try {
			if (!this.map.hasImage(imageId)) {
				const image = await this.loadSeaDecorationImage(language);
				if (!this.map.hasImage(imageId)) this.map.addImage(imageId, image, { pixelRatio: 1 });
			}
			// A later language choice or Terrain-off press wins over this load.
			if (generation !== this.seaDecorationGeneration || !this.visible) return;
			// A failed earlier load hid the layer (below); show it again now
			// that an image is in place, rather than making the player toggle
			// Terrain to get the art back (#120).
			if (this.seaDecorationHidden) {
				this.map.setLayoutProperty(SEA_DECORATION_LAYER, 'visibility', 'visible');
				this.seaDecorationHidden = false;
			}
			this.map.setPaintProperty(SEA_DECORATION_LAYER, 'fill-pattern', imageId);
		} catch {
			// Leave the plain sea fill rather than showing an inscription in the
			// wrong language or letting optional art affect gameplay.
			if (generation === this.seaDecorationGeneration) {
				this.map.setLayoutProperty(SEA_DECORATION_LAYER, 'visibility', 'none');
				this.seaDecorationHidden = true;
			}
		}
	}

	/**
	 * The rasterised sea-chart art. A method rather than the imported function
	 * directly, so a test can make the optional art fail and still see the
	 * geographic Terrain layers survive.
	 */
	protected loadSeaDecorationImage(language: Language): Promise<ImageData> {
		return loadSeaChartPattern(language);
	}

	/**
	 * The popup one terrain label is drawn in. A method rather than a direct
	 * `new` so a test can stand a popup in without a MapLibre map - the same
	 * stand-in `registerLabel` already accepts (labelCollision.ts).
	 */
	protected createPopup(className: string): maplibregl.Popup {
		return new maplibregl.Popup({
			closeButton: false,
			closeOnClick: false,
			anchor: 'center',
			className
		});
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

		// The art is local and decorative: if an older shell or a packaging
		// mistake cannot load it, keep the geographic Terrain layers working.
		const language = getLanguage();
		const imageId = seaChartPatternImageId(language);
		let hasSeaDecoration = this.map.hasImage(imageId);
		try {
			if (!hasSeaDecoration) {
				const image = await this.loadSeaDecorationImage(language);
				this.map.addImage(imageId, image, { pixelRatio: 1 });
				hasSeaDecoration = true;
			}
		} catch {
			// Sea art is optional; never let it break a map or the Terrain toggle.
		}

		this.map.addSource(TERRAIN_SOURCE, { type: 'vector', url: `pmtiles://${url}` });
		const before = this.map.getLayer(BEFORE_LAYER) ? BEFORE_LAYER : undefined;
		for (const layer of LAYERS) {
			if (layer.id === SEA_DECORATION_LAYER && !hasSeaDecoration) continue;
			if (layer.id === SEA_DECORATION_LAYER) {
				const fillLayer = layer as FillLayerSpecification;
				this.map.addLayer(
					{
						...fillLayer,
						paint: { ...fillLayer.paint, 'fill-pattern': imageId }
					},
					before
				);
			} else this.map.addLayer(layer, before);
		}
		this.added = true;

		// The player may have switched Terrain off while the archive was
		// loading. The button wins: apply the latest request now the layers
		// exist, rather than the `true` this load was started with (FT-54).
		if (!this.visible) {
			this.applyVisibility(false);
			return;
		}
		this.dimOverlyingLayers(true);
		void this.updateSeaDecoration(getLanguage());

		// The label points arrive with the tiles, so wait for the source
		// before asking for them.
		this.drawLabelsWhenSourceReady();
	}

	/** One popup per named feature currently in view, in `language`. */
	/** Draws the labels and says how many; none means the tiles are not in yet. */
	private drawLabels(language: Language): number {
		this.removeLabels();
		const seen = new Set<string>();
		// Ranges and seas, then the peaks, then the great circles. Each is a
		// point layer in the same archive; the peaks add their height to the
		// name, because "Mont Blanc 4 807 m" is a better hook than the name
		// alone, and a circle's label rides on the line itself.
		this.drawLabelLayer(
			'physical_labels',
			seen,
			(p) => labelFor(p, language),
			(p) => terrainPriority(p.rank)
		);
		this.drawLabelLayer(
			'peaks',
			seen,
			(p) =>
				`${labelFor(p, language)}${typeof p.elevation === 'number' ? ` ${formatMetres(p.elevation, language)}` : ''}`,
			// Above the ranges and seas, below every target name: a summit is a
			// sharper hook than the range it sits in, and the tallest wins.
			(p) => PEAK_LABEL_PRIORITY + (typeof p.elevation === 'number' ? p.elevation / 1e5 : 0)
		);
		this.drawLabelLayer(
			'lines',
			seen,
			(p) => labelFor(p, language),
			() => LINE_LABEL_PRIORITY
		);
		return this.popups.length;
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
			const popup = this.createPopup(`geoclick-terrain-label geoclick-terrain-${sourceLayer}`)
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
		this.seaDecorationGeneration++;
		this.clearSourceReady();
		this.removeLabels();
	}
}
