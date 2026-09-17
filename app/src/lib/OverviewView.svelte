<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as maplibregl from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import { fetchMapDefAndStyle, createMap } from './geoclickMap';
	import MapNav from './MapNav.svelte';
	import type { MapDefinition } from './mapDefinition';
	import { mapDisplayName } from './mapCatalog';
	import { tutorialMapGesture } from './tutorial.svelte';
	import { areaShares, setLabelPriority } from './labelCollision';

	let { mapId }: { mapId: string } = $props();

	let container: HTMLDivElement;
	let map: maplibregl.Map | undefined;
	let mapDef = $state<MapDefinition | undefined>(undefined);
	let error = $state<string | undefined>(undefined);
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
						className: 'geoclick-solved-popup'
					})
						.setLngLat(target.centroid)
						.setText(target.name)
						.addTo(map);
					setLabelPriority(popup, shares.get(target.id) ?? 0);
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
