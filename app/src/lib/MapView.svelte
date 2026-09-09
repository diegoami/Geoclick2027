<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as maplibregl from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import { Protocol } from 'pmtiles';
	import { overallBounds, type MapDefinition } from './mapDefinition';

	let { mapId }: { mapId: string } = $props();

	let container: HTMLDivElement;
	let map: maplibregl.Map | undefined;
	let mapDef = $state<MapDefinition | undefined>(undefined);
	let selectedName = $state<string | undefined>(undefined);
	let error = $state<string | undefined>(undefined);
	let selectedFeatureId: number | string | undefined;

	onMount(() => {
		// Idempotent: re-registering on remount just replaces the same handler.
		const protocol = new Protocol();
		maplibregl.addProtocol('pmtiles', protocol.tile);

		let cancelled = false;

		(async () => {
			const [mapDefRes, baseStyleRes] = await Promise.all([
				fetch(`/maps/${mapId}/map.json`),
				fetch(`/styles/base.json`)
			]);
			if (!mapDefRes.ok || !baseStyleRes.ok) {
				error = `Could not load map "${mapId}".`;
				return;
			}
			const loadedMapDef: MapDefinition = await mapDefRes.json();
			const baseStyle = await baseStyleRes.json();
			if (cancelled) return;
			mapDef = loadedMapDef;

			const style = {
				...baseStyle,
				sources: {
					...baseStyle.sources,
					targets: {
						...baseStyle.sources.targets,
						url: `pmtiles://${location.origin}/maps/${mapId}/tiles.pmtiles`
					}
				}
			};

			const bounds = overallBounds(loadedMapDef);

			map = new maplibregl.Map({
				container,
				style,
				bounds,
				fitBoundsOptions: { padding: 40 }
			});
			map.addControl(new maplibregl.NavigationControl(), 'top-right');

			map.on('click', 'targets-fill', (e: maplibregl.MapLayerMouseEvent) => {
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
				selectedName = feature.properties?.name as string;
			});

			map.on('mouseenter', 'targets-fill', () => {
				map!.getCanvas().style.cursor = 'pointer';
			});
			map.on('mouseleave', 'targets-fill', () => {
				map!.getCanvas().style.cursor = '';
			});
		})().catch((e) => {
			error = e instanceof Error ? e.message : String(e);
		});

		return () => {
			cancelled = true;
		};
	});

	onDestroy(() => {
		map?.remove();
	});
</script>

<div class="map-view">
	{#if error}
		<p class="error">{error}</p>
	{:else}
		<div class="info">
			{#if mapDef}
				<strong>{mapDef.name}</strong>
				{#if selectedName}<span> — selected: {selectedName}</span>{/if}
			{:else}
				Loading…
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
		background: rgba(255, 255, 255, 0.9);
		padding: 0.5rem 0.75rem;
		border-radius: 0.5rem;
		font-family: system-ui, sans-serif;
		font-size: 0.9rem;
	}
	.error {
		padding: 1rem;
		font-family: system-ui, sans-serif;
		color: #a33;
	}
</style>
