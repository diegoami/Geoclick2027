<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as maplibregl from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import { resolve } from '$app/paths';
	import { fetchMapDefAndStyle, createMap } from './geoclickMap';
	import type { MapDefinition } from './mapDefinition';

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

			// setFeatureState throws until the style has finished loading -
			// defer to the map's 'load' event (see QuizView.svelte for the
			// same fix, found the same way).
			map.once('load', () => {
				if (cancelled || !map) return;
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
						.setHTML(target.name)
						.addTo(map);
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
		<div class="info">
			<a class="back" href={mapId ? resolve('/map/[mapId]', { mapId }) : resolve('/')}>← Map</a>
			<strong>{mapDef ? mapDef.name : 'Loading…'} — Overview</strong>
		</div>
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
	.info {
		position: absolute;
		top: 0.75rem;
		left: 0.75rem;
		z-index: 1;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.35rem;
		background: rgba(255, 255, 255, 0.9);
		padding: 0.5rem 0.75rem;
		border-radius: 0.5rem;
		font-family: system-ui, sans-serif;
		font-size: 0.9rem;
	}
	.back {
		font-size: 0.8rem;
		text-decoration: none;
		color: inherit;
		opacity: 0.7;
	}
	.back:hover {
		opacity: 1;
	}
	.error {
		padding: 1rem;
		font-family: system-ui, sans-serif;
		color: #a33;
	}
	:global(.geoclick-solved-popup .maplibregl-popup-content) {
		font-family: system-ui, sans-serif;
		font-size: 0.75rem;
		font-weight: 600;
		padding: 0.15rem 0.5rem;
		border-radius: 0.35rem;
		color: #1f3d2a;
	}
	:global(.geoclick-solved-popup .maplibregl-popup-tip) {
		display: none;
	}
</style>
