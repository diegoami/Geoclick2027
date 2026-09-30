<script lang="ts">
	// The start screen's map (FT-77, #58; revised 2026-09-29, proposal #110).
	// Two levels on one map: the world, and a continent fitted to its Countries
	// map's box. A tap on a mapped country opens its configured broadest map
	// directly (openCountryMap); during the tutorial it marks the row instead
	// (FT-79), and a country with no maps keeps the continent notice. Beside it
	// (below it on a phone) the panel holds the maps in sections: on the world,
	// the continents' own maps and then a section per continent; on a continent,
	// that continent's maps and its countries. The view left is where the start
	// screen opens next time (mapPrefs). The tutorial's first steps
	// walk this map: Europe, Italy, then Italy's row.
	import { onDestroy, onMount, tick, untrack } from 'svelte';
	import * as maplibregl from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { getLanguage, t, type TranslationKey } from './i18n.svelte';
	import { foldCreditOnNarrowScreens } from './geoclickMap';
	import { enableLabelCollision, registerLabel } from './labelCollision';
	import { CROWDED_CLASS, MAGNIFIED_CLASS } from './labelMagnify';
	import type { Mastery } from './homeProgress';
	import MapSections from './MapSections.svelte';
	import { pickerDefaultMapIdOf, pickerIdOf } from './mapCatalog';
	import { pickerView, setPickerShown, setPickerView } from './mapPrefs.svelte';
	import { targetName } from './targetName';
	import { tutorialContinentChosen, tutorialCountryChosen, tutorialState } from './tutorial.svelte';
	import { STEPS, TUTORIAL_CONTINENT, TUTORIAL_COUNTRY } from './tutorialMachine';
	import { TUTORIAL_MAP_ID } from './tutorialSandbox.svelte';
	import {
		WORLD_VIEW,
		fetchPicker,
		hasMaps,
		validView,
		type Box,
		type Picker
	} from './worldPicker';

	interface Row {
		country: string;
		pickerId?: string;
		pickerDefaultMapId?: string;
		maps: { id: string; label: string }[];
	}

	let {
		groups,
		masteries,
		targetCount
	}: {
		groups: Row[];
		masteries: Record<string, Mastery | undefined>;
		targetCount: (mapId: string) => number;
	} = $props();

	let container: HTMLDivElement;
	let map: maplibregl.Map | undefined;
	let picker = $state<Picker>();
	let error = $state<string>();
	let loaded = $state(false);
	let panelEl = $state<HTMLElement>();
	/** The row a tap on the map marks, by its picker id. */
	let highlight = $state<string>();
	/** Keep a country selected while the picker enters its continent. */
	let countryToMark = $state<string>();
	/** Said above the rows when a tapped country has no maps of its own. */
	let note = $state<string>();
	let labels: { remove(): void }[] = [];
	let countryLabelElements: Record<string, HTMLElement> = {};
	let countryLabelPopups: Record<string, maplibregl.Popup> = {};
	let tutorialSpot: maplibregl.Marker | undefined;
	let stopCollision: (() => void) | undefined;

	const view = $derived(picker ? validView(picker, pickerView()) : 'world');

	// One colour per continent for the countries with maps; the rest pale.
	const CONTINENT_COLOURS: Record<string, string> = {
		europe: '#5b9fc8',
		africa: '#e58a73',
		asia: '#de7fa6',
		'north-america': '#8b86d4',
		'south-america': '#b87dc4',
		oceania: '#97a3b2'
	};
	const NO_MAPS = '#e9e2d0';
	const CONTINENT_COLOUR = [
		'match',
		['get', 'continent'],
		...Object.entries(CONTINENT_COLOURS).flat(),
		NO_MAPS
	] as unknown as maplibregl.ExpressionSpecification;

	const continentName = (id: string) => t(`continent.${id}` as TranslationKey);

	function boxOf(v: string): Box {
		if (v === 'world' || !picker) return WORLD_VIEW;
		return picker.continents.find((c) => c.id === v)?.view ?? WORLD_VIEW;
	}

	function fit(v: string, animate: boolean) {
		if (!map) return;
		const [west, south, east, north] = boxOf(v);
		map.fitBounds(
			[
				[west, south],
				[east, north]
			],
			{ padding: 24, duration: animate ? 700 : 0 }
		);
	}

	// Inside the continent, full colour; the rest of the world steps back.
	function paint(v: string) {
		if (!map) return;
		map.setPaintProperty(
			'countries-fill',
			'fill-opacity',
			v === 'world' ? 0.85 : ['case', ['==', ['get', 'continent'], v], 0.9, 0.3]
		);
	}

	// A continent the player chose - its name, a country on the world, or its
	// heading in the panel. Only these tell the tutorial (#80): a view restored
	// from storage, or set by the tutorial itself, is no choice.
	function chooseContinent(id: string, countryId?: string) {
		countryToMark = countryId;
		setPickerView(id);
		tutorialContinentChosen(id);
	}

	function openCountryMap(id: string): boolean {
		const group = groups.find((candidate) => pickerIdOf(candidate) === id);
		const mapId = group && pickerDefaultMapIdOf(group);
		if (!mapId) return false;
		countryToMark = undefined;
		void goto(resolve('/map/[mapId]', { mapId }));
		return true;
	}

	function continentAt(lng: number, lat: number): string | undefined {
		if (!picker?.continents.length) return;
		const distance = (view: number[]) => {
			const [west, south, east, north] = view;
			const dx = lng < west ? west - lng : lng > east ? lng - east : 0;
			const dy = lat < south ? south - lat : lat > north ? lat - north : 0;
			return dx * dx + dy * dy;
		};
		return picker.continents.reduce((nearest, continent) =>
			distance(continent.view) < distance(nearest.view) ? continent : nearest
		).id;
	}

	function chooseContinentFromLand(id: string): void {
		// Open the continent's picker section first; its first map type is
		// Countries, already selected unless the player chose another type.
		chooseContinent(id);
	}

	function clearLabels() {
		for (const label of labels) label.remove();
		labels = [];
		countryLabelElements = {};
		countryLabelPopups = {};
	}

	// The world view names the continents, and a name is a way in too. A
	// continent names its countries with maps, in the player's language.
	function drawLabels(v: string, language = getLanguage()) {
		if (!map || !picker) return;
		clearLabels();
		if (v === 'world') {
			for (const continent of picker.continents) {
				const [west, south, east, north] = continent.view;
				const button = document.createElement('button');
				button.type = 'button';
				button.className = 'picker-continent';
				button.textContent = continentName(continent.id);
				button.dataset.tutorial = `picker-${continent.id}`;
				button.addEventListener('click', () => chooseContinent(continent.id));
				labels.push(
					new maplibregl.Marker({ element: button })
						.setLngLat([(west + east) / 2, (south + north) / 2])
						.addTo(map)
				);
			}
			return;
		}
		for (const country of picker.countries) {
			if (country.continent !== v || !hasMaps(country.id)) continue;
			const popup = new maplibregl.Popup({
				closeButton: false,
				closeOnClick: false,
				anchor: 'center',
				className: 'geoclick-solved-popup'
			})
				.setLngLat(country.centroid)
				.setText(targetName(country, language))
				.addTo(map);
			countryLabelElements[country.id] = popup.getElement();
			const [w, s, e, n] = country.bbox;
			// The bigger country keeps its name when two collide.
			registerLabel(popup, { priority: (e - w) * (n - s) });
			countryLabelPopups[country.id] = popup;
			labels.push(popup);
		}
	}

	// Country labels only open their map after the player taps the visible name.
	function countryLabelVisible(id: string): boolean {
		const label = countryLabelElements[id];
		return !!label && !label.classList.contains(CROWDED_CLASS);
	}

	function countryLabelAt(point: { x: number; y: number }): string | undefined {
		if (!container) return;
		const bounds = container.getBoundingClientRect();
		return Object.entries(countryLabelElements).find(([id, label]) => {
			if (!countryLabelVisible(id)) return false;
			const rect = label.getBoundingClientRect();
			return (
				point.x >= rect.left - bounds.left &&
				point.x <= rect.right - bounds.left &&
				point.y >= rect.top - bounds.top &&
				point.y <= rect.bottom - bounds.top
			);
		})?.[0];
	}

	function revealCountryLabel(id: string, position: [number, number]) {
		const popup = countryLabelPopups[id];
		const element = countryLabelElements[id];
		if (!popup || !element || !map) return;
		// Give a deliberately requested name first placement choice and make it
		// visibly legible at the tapped location, including large countries whose
		// canonical label anchor is outside the current continent view.
		popup.setLngLat(position);
		registerLabel(popup, { priority: Number.MAX_SAFE_INTEGER });
		element.classList.remove(CROWDED_CLASS);
		element.querySelector('.maplibregl-popup-content')?.classList.add(MAGNIFIED_CLASS);
		map.resize();
	}

	// A country with maps marks its own row; one with none marks its
	// continent's, since that is where it can be played.
	async function markCountry(id: string) {
		const country = picker?.countries.find((c) => c.id === id);
		if (!country) return;
		const own = hasMaps(id);
		highlight = own ? id : country.continent;
		note = own
			? undefined
			: t('picker.noMaps', {
					country: targetName(country),
					continent: continentName(country.continent)
				});
		await tick();
		panelEl
			?.querySelector(`[data-picker-id="${highlight}"]`)
			?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
	}

	// A continent's name sits on the middle of its box, which on a phone can
	// put North America's or Oceania's past the map's edge, or over Europe's
	// (#79). Once the map settles, each name is nudged back inside, and below
	// any name before it that it would cover - with `translate`, which adds to
	// the transform MapLibre places the marker with.
	function keepContinentsInside() {
		if (!map || view !== 'world') return;
		const bounds = container.getBoundingClientRect();
		const margin = 4;
		const placed: DOMRect[] = [];
		for (const label of container.querySelectorAll<HTMLElement>('.picker-continent')) {
			label.style.translate = '';
			const box = label.getBoundingClientRect();
			const dx =
				Math.max(0, bounds.left + margin - box.left) -
				Math.max(0, box.right - (bounds.right - margin));
			let dy =
				Math.max(0, bounds.top + margin - box.top) -
				Math.max(0, box.bottom - (bounds.bottom - margin));
			for (const other of placed) {
				const left = box.left + dx;
				const top = box.top + dy;
				const overlaps =
					left < other.right &&
					left + box.width > other.left &&
					top < other.bottom &&
					top + box.height > other.top;
				if (overlaps) dy = other.bottom + margin - box.top;
			}
			if (dx || dy) label.style.translate = `${dx}px ${dy}px`;
			placed.push(new DOMRect(box.left + dx, box.top + dy, box.width, box.height));
		}
	}

	onMount(() => {
		let cancelled = false;
		(async () => {
			try {
				const { picker: loadedPicker, tilesUrl } = await fetchPicker();
				if (cancelled) return;
				picker = loadedPicker;
				const start = validView(loadedPicker, pickerView());
				// A stored continent the picker no longer has is the world, in
				// storage too, so the back button sees what the player sees (#81).
				if (start !== pickerView()) setPickerView(start);
				const [west, south, east, north] = boxOf(start);
				map = new maplibregl.Map({
					container,
					// Keep a double tap from zooming the map between label taps.
					doubleClickZoom: false,
					bounds: [
						[west, south],
						[east, north]
					],
					fitBoundsOptions: { padding: 24 },
					renderWorldCopies: false,
					attributionControl: {
						compact: true,
						customAttribution: [
							'<a href="https://maplibre.org/">MapLibre</a>',
							loadedPicker.attribution
						]
					},
					style: {
						version: 8,
						sources: {
							picker: { type: 'vector', url: `pmtiles://${tilesUrl}`, promoteId: 'id' }
						},
						layers: [
							{ id: 'sea', type: 'background', paint: { 'background-color': '#cfe2ea' } },
							{
								id: 'land',
								type: 'fill',
								source: 'picker',
								'source-layer': 'land',
								paint: { 'fill-color': '#e4ded0' }
							},
							{
								id: 'countries-fill',
								type: 'fill',
								source: 'picker',
								'source-layer': 'countries',
								paint: {
									'fill-color': [
										'case',
										['boolean', ['feature-state', 'hasMaps'], false],
										CONTINENT_COLOUR,
										NO_MAPS
									],
									'fill-opacity': 0.85
								}
							},
							{
								id: 'countries-line',
								type: 'line',
								source: 'picker',
								'source-layer': 'countries',
								paint: { 'line-color': '#7d7564', 'line-width': 0.5 }
							}
						]
					}
				});
				// On a phone the credit starts folded behind its (i), as on every map.
				foldCreditOnNarrowScreens(map, container);
				map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
				stopCollision = enableLabelCollision(map, container);
				map.on('load', () => {
					if (!map || !picker) return;
					for (const country of picker.countries) {
						if (!hasMaps(country.id)) continue;
						map.setFeatureState(
							{ source: 'picker', sourceLayer: 'countries', id: country.id },
							{ hasMaps: true }
						);
					}
					paint(start);
					drawLabels(start);
					keepContinentsInside();
					loaded = true;
					// The map is up (#87): only now is there a continent to go
					// up from, so Back during a slow or failed load exits.
					setPickerShown(true);
				});
				map.on('click', (e) => {
					// A continent's name is a button of its own, not a map tap.
					if ((e.originalEvent.target as Element | null)?.closest('.picker-continent')) return;
					// Labels are pointer-transparent so panning still works. Convert
					// their map-container bounds to the click's map-relative point.
					const labelId = countryLabelAt(e.point);
					if (labelId) {
						if (tutorialState().status === 'idle' && openCountryMap(labelId)) return;
						void markCountry(labelId);
						tutorialCountryChosen(labelId);
						return;
					}
					const feature = map?.queryRenderedFeatures(e.point, { layers: ['countries-fill'] })[0];
					const id = feature?.properties?.id as string | undefined;
					const continent = feature?.properties?.continent as string | undefined;
					if (id && continent) {
						if (view === 'world') {
							chooseContinent(continent, id);
							return;
						}
						if (continent !== view) return;
						if (hasMaps(id)) {
							revealCountryLabel(id, [e.lngLat.lng, e.lngLat.lat]);
							return;
						}
						countryToMark = undefined;
						void markCountry(id);
						tutorialCountryChosen(id);
						return;
					}
					// Every click outside a country polygon opens the current continent's
					// picker section; in world view choose the nearest continent instead.
					if (!e.lngLat) return;
					const landContinent = view === 'world' ? continentAt(e.lngLat.lng, e.lngLat.lat) : view;
					if (landContinent) chooseContinentFromLand(landContinent);
				});
				map.on('mouseenter', 'countries-fill', () => {
					if (map) map.getCanvas().style.cursor = 'pointer';
				});
				map.on('mouseleave', 'countries-fill', () => {
					if (map) map.getCanvas().style.cursor = '';
				});
				// After a pan, a zoom, a resize or the fly back to the world.
				map.on('moveend', keepContinentsInside);
			} catch (e) {
				error = e instanceof Error ? e.message : String(e);
			}
		})();
		return () => {
			cancelled = true;
		};
	});

	// A new view - a tap, the World button, or the phone's back button through
	// mapPrefs - flies there, clears the mark and redraws the names.
	$effect(() => {
		const v = view;
		if (!loaded) return;
		if (v === 'world') countryToMark = undefined;
		untrack(() => {
			highlight = undefined;
			note = undefined;
			panelEl?.scrollTo({ top: 0 });
			paint(v);
			fit(v, true);
			drawLabels(v);
		});
	});

	// The tutorial's step (FT-79) sets the view it points into: the world for
	// Europe's name, Europe for Italy and Italy's row. Only on entering a step,
	// so the player is free to wander within one.
	const tutorialStep = $derived(
		tutorialState().status === 'running' ? STEPS[tutorialState().step].id : undefined
	);
	$effect(() => {
		const step = tutorialStep;
		if (!loaded) return;
		untrack(() => {
			countryToMark = undefined;
			if (step === 'choose-continent') setPickerView('world');
			else if (step === 'choose-country' || step === 'choose-map')
				setPickerView(TUTORIAL_CONTINENT);
		});
	});

	// Carry a no-map or tutorial country selection into its continent so the
	// existing notice/highlight remains visible after the view changes.
	$effect(() => {
		const v = view;
		const selected = countryToMark;
		if (!loaded || v === 'world' || !selected) return;
		if (picker?.countries.some((country) => country.id === selected && country.continent === v))
			void markCountry(selected);
	});

	// Italy's row lit for the step that points at it, however the player got
	// there. After the view's own effect, which clears the mark.
	$effect(() => {
		if (loaded && tutorialStep === 'choose-map' && view === TUTORIAL_CONTINENT)
			untrack(() => markCountry(TUTORIAL_COUNTRY));
	});

	// A country is no element of its own, so the tutorial's spotlight on Italy
	// is a marker the size of a finger over it, which lets clicks through.
	$effect(() => {
		const wanted =
			loaded && tutorialState().status !== 'idle' && view === TUTORIAL_CONTINENT && picker;
		untrack(() => {
			tutorialSpot?.remove();
			tutorialSpot = undefined;
			const country = wanted && picker?.countries.find((c) => c.id === TUTORIAL_COUNTRY);
			if (!map || !country) return;
			const spot = document.createElement('div');
			spot.className = 'picker-tutorial-spot';
			spot.dataset.tutorial = `picker-${TUTORIAL_COUNTRY}`;
			tutorialSpot = new maplibregl.Marker({ element: spot })
				.setLngLat(country.centroid)
				.addTo(map);
		});
	});

	// A new language renames the continents and the countries (#71).
	$effect(() => {
		const language = getLanguage();
		if (!loaded) return;
		untrack(() => {
			drawLabels(view, language);
			keepContinentsInside();
		});
	});

	onDestroy(() => {
		setPickerShown(false);
		clearLabels();
		tutorialSpot?.remove();
		stopCollision?.();
		map?.remove();
	});
</script>

<div class="picker" aria-label={t('picker.label')} role="region">
	<div class="stage">
		{#if error}
			<p class="error">{error}</p>
		{/if}
		<div class="map" bind:this={container}></div>
		{#if view !== 'world'}
			<div class="where">
				<button type="button" class="world" onclick={() => setPickerView('world')}>
					← {t('picker.world')}
				</button>
				<span class="continent">{continentName(view)}</span>
			</div>
		{/if}
	</div>
	<aside class="panel" bind:this={panelEl}>
		{#if note}
			<p class="note" aria-live="polite">{note}</p>
		{/if}
		<MapSections
			{groups}
			{masteries}
			{targetCount}
			{highlight}
			tutorialMapId={TUTORIAL_MAP_ID}
			only={view === 'world' ? undefined : view}
			onContinent={chooseContinent}
		/>
	</aside>
</div>

<style>
	.picker {
		display: flex;
		gap: 1rem;
		height: min(70vh, 40rem);
		min-height: 22rem;
		text-align: left;
	}
	.stage {
		position: relative;
		flex: 1;
		border-radius: 0.75rem;
		overflow: hidden;
		border: 1px solid rgba(17, 24, 21, 0.12);
		background: #cfe2ea;
	}
	.map {
		position: absolute;
		inset: 0;
	}
	.panel {
		width: 22rem;
		overflow-y: auto;
		padding: 0.25rem 0.25rem 0.5rem;
	}
	.note {
		margin: 0 0 0.75rem;
		font-size: 0.9rem;
		color: #5a5446;
	}
	/* On a phone the panel goes under the map, and scrolls with the page. */
	@media (max-width: 48rem) {
		/* Smaller continent names, so all six fit a phone's world view. */
		:global(.picker-continent) {
			font-size: 0.65rem;
			letter-spacing: 0.06em;
			padding: 0.15rem 0.45rem;
		}
		.picker {
			flex-direction: column;
			height: auto;
		}
		.stage {
			flex: none;
			height: 60vh;
			min-height: 18rem;
		}
		.panel {
			width: auto;
			overflow: visible;
		}
	}
	.error {
		position: absolute;
		inset: auto 1rem 1rem;
		z-index: 2;
		margin: 0;
		color: #8a2a1e;
	}
	.where {
		position: absolute;
		top: 0.6rem;
		left: 0.6rem;
		z-index: 2;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.world {
		font: inherit;
		font-size: 0.9rem;
		padding: 0.35rem 0.75rem;
		border-radius: 999px;
		border: 1px solid rgba(17, 24, 21, 0.2);
		background: rgba(255, 255, 255, 0.95);
		cursor: pointer;
	}
	.continent {
		font-family: Georgia, 'Times New Roman', serif;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #3f3a30;
		text-shadow: 0 0 3px #fff;
	}
	:global(.picker-continent) {
		font-family: Georgia, 'Times New Roman', serif;
		font-size: 0.95rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: #3f3a30;
		background: rgba(255, 255, 255, 0.75);
		border: 1px solid rgba(17, 24, 21, 0.15);
		border-radius: 999px;
		padding: 0.25rem 0.7rem;
		cursor: pointer;
	}
	/* Only an anchor for the tutorial's spotlight (FT-79): nothing to see or click. */
	:global(.picker-tutorial-spot) {
		width: 3rem;
		height: 3rem;
		border-radius: 50%;
		pointer-events: none;
	}
</style>
