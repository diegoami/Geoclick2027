<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as maplibregl from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import { fetchMapDefAndStyle, createMap } from './geoclickMap';
	import MapNav from './MapNav.svelte';
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
		<MapNav {mapId} mapName={mapDef?.name} />
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
	.error {
		padding: 1rem;
		font-family: system-ui, sans-serif;
		color: #a33;
	}
	:global(.geoclick-popup .maplibregl-popup-content) {
		font-family: system-ui, sans-serif;
		font-size: 11px;
		font-weight: 600;
		padding: 1px 6px;
		border-radius: 5px;
		background: rgba(31, 61, 42, 0.65);
		color: #ffffff;
		box-shadow: none;
	}
	:global(.geoclick-popup .maplibregl-popup-tip) {
		display: none;
	}
</style>
