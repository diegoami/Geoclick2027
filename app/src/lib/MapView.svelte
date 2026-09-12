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
	let popup: maplibregl.Popup | undefined;
	let mapDef = $state<MapDefinition | undefined>(undefined);
	let error = $state<string | undefined>(undefined);
	let selectedFeatureId: number | string | undefined;

	onMount(() => {
		let cancelled = false;

		(async () => {
			const { mapDef: loadedMapDef, style } = await fetchMapDefAndStyle(mapId);
			if (cancelled) return;
			mapDef = loadedMapDef;

			map = createMap(container, loadedMapDef, style);

			// Bound to both the polygon (targets-fill) and point
			// (targets-circle) layers - a given map's tileset only ever has
			// features for one of the two, so binding both is a harmless
			// no-op for whichever doesn't apply. See MAPS.md's "Point-target
			// design" section.
			for (const layerId of ['targets-fill', 'targets-circle']) {
				map.on('click', layerId, (e: maplibregl.MapLayerMouseEvent) => {
					const feature = e.features?.[0];
					if (!feature) return;

					if (selectedFeatureId !== undefined) {
						map!.setFeatureState(
							{ source: 'targets', sourceLayer: 'targets', id: selectedFeatureId },
							{ highlighted: false }
						);
					}
					selectedFeatureId = feature.id;
					map!.setFeatureState(
						{ source: 'targets', sourceLayer: 'targets', id: feature.id! },
						{ highlighted: true }
					);

					const name = feature.properties?.name as string;
					popup ??= new maplibregl.Popup({
						closeButton: false,
						closeOnClick: false,
						className: 'geoclick-popup'
					});
					popup.setLngLat(e.lngLat).setHTML(`<strong>${name}</strong>`).addTo(map!);
				});

				map.on('mouseenter', layerId, () => {
					map!.getCanvas().style.cursor = 'pointer';
				});
				map.on('mouseleave', layerId, () => {
					map!.getCanvas().style.cursor = '';
				});
			}
		})().catch((e) => {
			error = e instanceof Error ? e.message : String(e);
		});

		return () => {
			cancelled = true;
		};
	});

	onDestroy(() => {
		popup?.remove();
		map?.remove();
	});
</script>

<div class="map-view">
	{#if error}
		<p class="error">{error}</p>
	{:else}
		<div class="info">
			<a class="back" href={resolve('/')}>← Maps</a>
			<strong>{mapDef ? mapDef.name : 'Loading…'}</strong>
			{#if mapId}
				<a class="tour-link" href={resolve('/map/[mapId]/overview', { mapId })}>✓ Show overview</a>
				<a class="tour-link" href={resolve('/map/[mapId]/tour', { mapId })}>▶ Start tour</a>
				<a class="tour-link" href={resolve('/map/[mapId]/quiz', { mapId })}>✎ Start quiz</a>
			{/if}
		</div>
	{/if}
	<div class="container" bind:this={container}></div>
</div>

<style>
	.map-view {
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
	.tour-link {
		font-size: 0.85rem;
		font-weight: 600;
		text-decoration: none;
		color: #b5691f;
	}
	.tour-link:hover {
		text-decoration: underline;
	}
	.error {
		padding: 1rem;
		font-family: system-ui, sans-serif;
		color: #a33;
	}
	:global(.geoclick-popup .maplibregl-popup-content) {
		font-family: system-ui, sans-serif;
		font-size: 1.15rem;
		padding: 0.5rem 0.9rem;
		border-radius: 0.5rem;
	}
</style>
