<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as maplibregl from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import { fetchMapDefAndStyle, createMap } from './geoclickMap';
	import MapNav from './MapNav.svelte';
	import type { MapDefinition } from './mapDefinition';
	import { mapDisplayName } from './mapCatalog';
	import { tutorialMapGesture } from './tutorial.svelte';
	import { DOT_CLEARANCE_PX, areaShares, registerLabel } from './labelCollision';
	import FactCard from './FactCard.svelte';
	import { fetchFacts, type Facts } from './facts';

	let { mapId }: { mapId: string } = $props();

	let container: HTMLDivElement;
	let map: maplibregl.Map | undefined;
	let mapDef = $state<MapDefinition | undefined>(undefined);
	let error = $state<string | undefined>(undefined);
	// The fact box (FT-35). Every name is already written on this screen, so
	// asking about a place gives nothing away - the card only says what the
	// place is. Fetched lazily: a map whose facts.json is missing simply has
	// no card, and opening a map is not made slower by it.
	let facts = $state<Facts>({});
	let asked = $state<{ id: string; name: string } | undefined>(undefined);
	// Not reactive state - popups are imperative MapLibre objects, only
	// created once on load and torn down on destroy. Same reasoning as
	// QuizView's solvedPopups.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const popups = new Map<string, maplibregl.Popup>();

	onMount(() => {
		let cancelled = false;

		(async () => {
			const { mapDef: loadedMapDef, style } = await fetchMapDefAndStyle(mapId);
			if (cancelled) return;
			mapDef = loadedMapDef;

			map = createMap(container, loadedMapDef, style);
			fetchFacts(mapId).then((loaded) => {
				if (!cancelled) facts = loaded;
			});

			// Tap or click a place to be told what it is. Bound to both target
			// layers, as every view does: a map's tileset only ever has
			// features for one of the two (MAPS.md, "Point-target design").
			for (const layerId of ['targets-fill', 'targets-circle']) {
				map.on('click', layerId, (e: maplibregl.MapLayerMouseEvent) => {
					const name = e.features?.[0]?.properties?.name as string | undefined;
					const target = loadedMapDef.targets.find((t) => t.name === name);
					asked = target ? { id: target.id, name: target.name } : undefined;
				});
				map.on('mouseenter', layerId, () => {
					map!.getCanvas().style.cursor = 'pointer';
				});
				map.on('mouseleave', layerId, () => {
					map!.getCanvas().style.cursor = '';
				});
			}
			// The tutorial's zoom-and-pan step (FT-11) waits for the player's own
			// gesture, and a move counts once it ends. Which events carry the
			// player's input differs: the +/- buttons pass it on every move event,
			// but a wheel zoom only on MapLibre's own 'wheel' event (its moves come
			// from an easing animation), so both are watched. A drag and a touch
			// pinch or pan start with 'dragstart' / 'touchstart'. The map's opening
			// fit has none of these.
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
						className: 'geoclick-solved-popup'
					})
						.setLngLat(target.centroid)
						.setText(target.name)
						.addTo(map);
					registerLabel(popup, {
						priority: shares.get(target.id) ?? 0,
						// A town's name sits beside its dot, never on it.
						beside: target.type === 'city' ? DOT_CLEARANCE_PX : undefined
					});
					popups.set(target.id, popup);
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
		map?.remove();
	});
</script>

<div class="overview-view">
	{#if error}
		<p class="error">{error}</p>
	{:else}
		<MapNav {mapId} mapName={mapDisplayName(mapId) ?? mapDef?.name} active="overview" />
	{/if}
	<div class="container" bind:this={container}></div>
	{#if asked}
		<FactCard name={asked.name} fact={facts[asked.id]} onclose={() => (asked = undefined)} />
	{/if}
</div>

<style>
	.overview-view {
		position: relative;
		width: 100%;
		height: 100vh;
	}
	.container {
		width: 100%;
		height: 100%;
	}
	.error {
		padding: 1rem;
		font-family: system-ui, sans-serif;
		color: #a33;
	}
</style>
