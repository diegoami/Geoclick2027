<script lang="ts">
	import { onMount, onDestroy, untrack } from 'svelte';
	import { getLanguage } from './i18n.svelte';
	import { targetName } from './targetName';
	import * as maplibregl from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import { fetchMapDefAndStyle, createMap } from './geoclickMap';
	import type { TerrainLayer } from './terrainLayer';
	import { followTerrainLanguage } from './terrainLanguage.svelte';
	import { terrainShown } from './mapPrefs.svelte';
	import MapNav from './MapNav.svelte';
	import type { MapDefinition } from './mapDefinition';
	import { mapDisplayName } from './mapCatalog';
	import { DOT_CLEARANCE_PX, areaShares, registerLabel } from './labelCollision';
	import FactCard from './FactCard.svelte';
	import ChartMapShell from './ChartMapShell.svelte';
	import { fetchFacts, placeFacts, type Facts } from './facts';
	import { StretchedNames } from './stretchedNames';

	let { mapId }: { mapId: string } = $props();

	let container: HTMLDivElement;
	let map: maplibregl.Map | undefined;
	let stretched: StretchedNames | undefined;
	// Sea, rivers and named terrain (FT-33). The $effect below follows the
	// map bar's Terrain button, which only writes the preference.
	let terrain = $state<TerrainLayer | undefined>(undefined);
	let mapDef = $state<MapDefinition | undefined>(undefined);
	let error = $state<string | undefined>(undefined);
	// The fact box (FT-35). Every name is already written on this screen, so
	// asking about a place gives nothing away - the card only says what the
	// place is. Fetched lazily: a map whose facts.json is missing simply has
	// no card, and opening a map is not made slower by it.
	let facts = $state<Facts>({});
	let asked = $state<{ id: string; name: string; origin?: string; extra?: string } | undefined>(
		undefined
	);
	// Not reactive state - popups are imperative MapLibre objects, only
	// created once on load and torn down on destroy. Same reasoning as
	// QuizView's solvedPopups.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const popups = new Map<string, maplibregl.Popup>();

	// A new language renames every name on the map (#71), and the open card's.
	$effect(() => {
		const language = getLanguage();
		untrack(() => {
			for (const target of mapDef?.targets ?? []) {
				const popup = popups.get(target.id);
				const shown = targetName(target, language);
				if (popup && popup.getElement()?.textContent !== shown) popup.setText(shown);
				if (popup && target.spine && target.type !== 'city')
					stretched?.set(target.id, { name: shown, spine: target.spine, tier: 'known', popup });
			}
		});
	});
	const askedName = $derived.by(() => {
		const target = asked && mapDef?.targets.find((x) => x.id === asked?.id);
		return target ? targetName(target) : asked?.name;
	});

	// Show or hide the Terrain layer as the preference changes (FT-33). An
	// $effect rather than a call from the button: the button has no idea
	// which map is open, and the preference is $state, so this is the
	// ordinary Svelte way to follow it.
	$effect(() => {
		const shown = terrainShown();
		terrain?.setVisible(shown).catch((e) => {
			// A missing or unreadable terrain.pmtiles must never break the map
			// the player came for.
			console.error('Could not show the terrain layer:', e);
		});
	});

	// A language switch has to reach the terrain names too (FT-53); the
	// helper reads getLanguage() so the subscription exists even on a map's
	// first open, when the labels are drawn after an await.
	followTerrainLanguage(() => terrain);
	onMount(() => {
		let cancelled = false;

		(async () => {
			const { mapDef: loadedMapDef, style } = await fetchMapDefAndStyle(mapId);
			if (cancelled) return;
			mapDef = loadedMapDef;

			({ map, terrain } = createMap(container, loadedMapDef, style));
			if (loadedMapDef.targets.some((target) => target.spine && target.type !== 'city'))
				stretched = new StretchedNames(map);
			fetchFacts(mapId).then((loaded) => {
				if (!cancelled) facts = loaded;
			});

			// Tap or click a place to be told what it is. Bound to the polygon
			// layer and to the point maps' invisible HIT layer, not to the dot
			// itself - the dot is 9 px in radius and a finger needs about 22
			// (FT-46). A map's tileset only ever has features for one of the
			// two (MAPS.md, "Point-target design"). Never bind targets-circle
			// as well: targets-hit covers it, so a tap would fire twice.
			for (const layerId of ['targets-fill', 'targets-hit']) {
				map.on('click', layerId, (e: maplibregl.MapLayerMouseEvent) => {
					const name = e.features?.[0]?.properties?.name as string | undefined;
					const target = loadedMapDef.targets.find((t) => t.name === name);
					asked = target
						? {
								id: target.id,
								name: target.name,
								...placeFacts(mapId, target.id, facts[target.id])
							}
						: undefined;
				});
				map.on('mouseenter', layerId, () => {
					map!.getCanvas().style.cursor = 'pointer';
				});
				map.on('mouseleave', layerId, () => {
					map!.getCanvas().style.cursor = '';
				});
			}
			// setFeatureState throws until the style has finished loading -
			// defer to the map's 'load' event (see QuizView.svelte for the
			// same fix, found the same way).
			map.once('load', () => {
				if (cancelled || !map) return;
				// Which name gives way when two don't fit (FT-23): the smaller
				// region's, so the overview still reads at a glance and the rest
				// come back as you zoom in.
				const shares = areaShares(loadedMapDef.targets);
				for (const target of loadedMapDef.targets) {
					map.setFeatureState(
						{ source: 'targets', sourceLayer: 'targets', id: target.name },
						{ quizCorrect: true }
					);
					const popup = new maplibregl.Popup({
						closeButton: false,
						closeOnClick: false,
						// On the place itself: the collision pass moves it from there
						// if it has to (FT-24).
						anchor: 'center',
						// A region's name without a box, as on Explore (FT-74).
						className:
							target.type === 'city'
								? 'geoclick-solved-popup'
								: 'geoclick-solved-popup geoclick-region-name'
					})
						.setLngLat(target.centroid)
						.setText(targetName(target))
						.addTo(map);
					registerLabel(popup, {
						priority: shares.get(target.id) ?? 0,
						// A town's name sits beside its dot, never on it.
						beside: target.type === 'city' ? DOT_CLEARANCE_PX : undefined
					});
					popups.set(target.id, popup);
					if (target.spine && target.type !== 'city')
						stretched?.set(target.id, {
							name: targetName(target),
							spine: target.spine,
							tier: 'known',
							popup
						});
				}
			});
		})().catch((e) => {
			error = e instanceof Error ? e.message : String(e);
		});

		return () => {
			cancelled = true;
		};
	});

	onDestroy(() => {
		for (const popup of popups.values()) popup.remove();
		stretched?.destroy();
		map?.remove();
	});
</script>

<div class="overview-view" data-map-fit-root>
	{#if error}
		<p class="error">{error}</p>
	{:else}
		<MapNav {mapId} mapName={mapDisplayName(mapId) ?? mapDef?.name} active="overview" />
	{/if}
	<ChartMapShell>
		<div class="container" bind:this={container}></div>
	</ChartMapShell>
	{#if asked}
		<FactCard
			name={askedName ?? asked.name}
			fact={facts[asked.id]}
			origin={asked.origin}
			extra={asked.extra}
			onclose={() => (asked = undefined)}
		/>
	{/if}
</div>

<style>
	.overview-view {
		position: relative;
		width: 100%;
		height: 100vh;
	}
	.error {
		position: relative;
		z-index: 2;
		padding: 1rem;
		font-family: system-ui, sans-serif;
		color: #a33;
	}
</style>
