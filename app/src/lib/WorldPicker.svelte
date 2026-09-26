<script lang="ts">
	// The start screen's map (FT-77, #58). Two levels on one map: the world,
	// where a tap on any country goes to its continent; and a continent, fitted
	// to its Countries map's box, where a tap on a country opens a panel with
	// its maps - or, for a country with none, its continent's. The panel is a
	// side panel on a wide screen and a bottom sheet on a phone, and the map
	// stays live beside it, so the next country is one tap away. The view left
	// is where the start screen opens next time (mapPrefs).
	//
	// The panel's cards are the home page's own (`card`), so a map reads the
	// same here as in the list: progress bar, star, one tap to open.
	import { onDestroy, onMount, untrack, type Snippet } from 'svelte';
	import * as maplibregl from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import { getLanguage, t, type TranslationKey } from './i18n.svelte';
	import { foldCreditOnNarrowScreens } from './geoclickMap';
	import { enableLabelCollision, registerLabel } from './labelCollision';
	import { mapTypeLabel } from './mapCatalog';
	import { pickerView, setPickerView } from './mapPrefs.svelte';
	import { targetName } from './targetName';
	import {
		WORLD_VIEW,
		fetchPicker,
		hasMaps,
		panelFor,
		validView,
		type Box,
		type Picker
	} from './worldPicker';

	let { card }: { card: Snippet<[string, string]> } = $props();

	let container: HTMLDivElement;
	let map: maplibregl.Map | undefined;
	let picker = $state<Picker>();
	let error = $state<string>();
	let loaded = $state(false);
	/** The country whose maps the panel shows, if it is open. */
	let panelCountry = $state<string>();
	let labels: { remove(): void }[] = [];
	let stopCollision: (() => void) | undefined;

	const view = $derived(picker ? validView(picker, pickerView()) : 'world');
	const panel = $derived(picker && panelCountry ? panelFor(picker, panelCountry) : undefined);

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

	function clearLabels() {
		for (const label of labels) label.remove();
		labels = [];
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
				button.addEventListener('click', () => setPickerView(continent.id));
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
			const [w, s, e, n] = country.bbox;
			// The bigger country keeps its name when two collide.
			registerLabel(popup, { priority: (e - w) * (n - s) });
			labels.push(popup);
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
				const [west, south, east, north] = boxOf(start);
				map = new maplibregl.Map({
					container,
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
					loaded = true;
				});
				map.on('click', 'countries-fill', (e) => {
					// A continent's name is a button of its own: its click is not also
					// a tap on the country under it, in the view it has just opened.
					if ((e.originalEvent.target as Element | null)?.closest('.picker-continent')) return;
					const feature = e.features?.[0];
					const id = feature?.properties?.id as string | undefined;
					const continent = feature?.properties?.continent as string | undefined;
					if (!id || !continent) return;
					// On the world, any country is a way into its continent; on a
					// continent, only its own countries answer.
					if (view === 'world') setPickerView(continent);
					else if (continent === view) panelCountry = id;
				});
				map.on('mouseenter', 'countries-fill', () => {
					if (map) map.getCanvas().style.cursor = 'pointer';
				});
				map.on('mouseleave', 'countries-fill', () => {
					if (map) map.getCanvas().style.cursor = '';
				});
			} catch (e) {
				error = e instanceof Error ? e.message : String(e);
			}
		})();
		return () => {
			cancelled = true;
		};
	});

	// A new view - a tap, the World button, or the phone's back button through
	// mapPrefs - flies there, closes the panel and redraws the names.
	$effect(() => {
		const v = view;
		if (!loaded) return;
		untrack(() => {
			panelCountry = undefined;
			paint(v);
			fit(v, true);
			drawLabels(v);
		});
	});

	// A new language renames the continents and the countries (#71).
	$effect(() => {
		const language = getLanguage();
		if (!loaded) return;
		untrack(() => drawLabels(view, language));
	});

	onDestroy(() => {
		clearLabels();
		stopCollision?.();
		map?.remove();
	});
</script>

<div class="picker" aria-label={t('picker.label')} role="region">
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
	{#if panel}
		<aside class="panel" aria-live="polite">
			<header>
				<h2>{targetName(panel.country)}</h2>
				<button
					type="button"
					class="close"
					aria-label={t('picker.close')}
					onclick={() => (panelCountry = undefined)}>×</button
				>
			</header>
			{#if panel.continentInstead}
				<p class="instead">
					{t('picker.noMaps', {
						country: targetName(panel.country),
						continent: continentName(panel.country.continent)
					})}
				</p>
			{/if}
			<ul>
				{#each panel.groups as group (group.country)}
					{#each group.maps as map (map.id)}
						{@render card(map.id, mapTypeLabel(map))}
					{/each}
				{/each}
			</ul>
		</aside>
	{/if}
</div>

<style>
	.picker {
		position: relative;
		height: min(70vh, 40rem);
		min-height: 20rem;
		border-radius: 0.75rem;
		overflow: hidden;
		border: 1px solid rgba(17, 24, 21, 0.12);
		background: #cfe2ea;
		text-align: left;
	}
	.map {
		position: absolute;
		inset: 0;
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
	/* A side panel where there is room, a bottom sheet on a phone. */
	.panel {
		position: absolute;
		z-index: 3;
		top: 0.6rem;
		right: 3.4rem;
		bottom: 0.6rem;
		width: min(20rem, 45%);
		overflow-y: auto;
		padding: 0.75rem;
		background: rgba(255, 255, 255, 0.97);
		border-radius: 0.75rem;
		box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);
	}
	@media (max-width: 40rem) {
		.panel {
			top: auto;
			left: 0;
			right: 0;
			bottom: 0;
			width: auto;
			max-height: 55%;
			border-radius: 0.75rem 0.75rem 0 0;
		}
	}
	.panel header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.panel h2 {
		margin: 0;
		font-size: 1.1rem;
	}
	.close {
		font: inherit;
		font-size: 1.4rem;
		line-height: 1;
		border: none;
		background: none;
		cursor: pointer;
		padding: 0.2rem 0.4rem;
	}
	.instead {
		margin: 0.4rem 0 0;
		font-size: 0.9rem;
		color: #5a5446;
	}
	.panel ul {
		list-style: none;
		margin: 0.6rem 0 0;
		padding: 0;
		display: grid;
		gap: 0.5rem;
	}
</style>
