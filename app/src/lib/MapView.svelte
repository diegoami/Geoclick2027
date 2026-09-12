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
		<div class="nav-overlay">
			<div class="nav-row">
				<a class="nav-btn nav-btn--back" href={resolve('/')}>
					<svg
						class="nav-icon"
						width="22"
						height="22"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.8"
						stroke-linecap="round"
						stroke-linejoin="round"><path d="M15 6l-6 6 6 6" /></svg
					>
					<span class="nav-label">Maps</span>
				</a>
				{#if mapId}
					<a class="nav-btn nav-btn--action" href={resolve('/map/[mapId]/overview', { mapId })}>
						<svg
							class="nav-icon"
							width="22"
							height="22"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="1.8"
							stroke-linecap="round"
							stroke-linejoin="round"
							><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" /><circle
								cx="12"
								cy="12"
								r="3"
							/></svg
						>
						<span class="nav-label">Overview</span>
					</a>
					<a class="nav-btn nav-btn--action" href={resolve('/map/[mapId]/quiz', { mapId })}>
						<svg
							class="nav-icon"
							width="22"
							height="22"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="1.8"
							stroke-linecap="round"
							stroke-linejoin="round"
							><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.5 2.5 5.5-6" /></svg
						>
						<span class="nav-label">Quiz</span>
					</a>
					<a class="nav-btn nav-btn--action" href={resolve('/map/[mapId]/tour', { mapId })}>
						<svg class="nav-icon" width="22" height="22" viewBox="0 0 24 24"
							><path d="M8 5l11 7-11 7z" fill="currentColor" /></svg
						>
						<span class="nav-label">Tour</span>
					</a>
				{/if}
			</div>
			<span class="map-label">{mapDef ? mapDef.name : 'Loading…'}</span>
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
	.nav-overlay {
		position: absolute;
		top: 0.75rem;
		left: 0.75rem;
		right: 0.75rem;
		z-index: 1;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.4rem;
	}
	.nav-row {
		display: flex;
		gap: 0.5rem;
		width: 100%;
	}
	.nav-btn {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
		min-height: 2.75rem;
		box-sizing: border-box;
		padding: 0.65rem 0.25rem 0.6rem;
		background: rgba(255, 255, 255, 0.96);
		border: 1px solid rgba(17, 24, 21, 0.08);
		border-radius: 0.625rem;
		box-shadow: 0 1px 3px rgba(17, 24, 21, 0.12);
		text-decoration: none;
		font-family: system-ui, sans-serif;
	}
	.nav-icon {
		display: block;
	}
	.nav-label {
		font-size: 0.75rem;
		font-weight: 600;
		line-height: 1;
		white-space: nowrap;
	}
	.nav-btn--back {
		color: #4a5650;
	}
	.nav-btn--action {
		color: #b5691f;
	}
	.map-label {
		font-size: 0.75rem;
		color: rgba(30, 40, 36, 0.6);
		background: rgba(255, 255, 255, 0.75);
		padding: 0.2rem 0.55rem;
		border-radius: 0.4rem;
		font-family: system-ui, sans-serif;
	}
	@media (min-width: 640px) {
		.nav-overlay {
			right: auto;
		}
		.nav-row {
			width: auto;
		}
		.nav-btn {
			flex: none;
			flex-direction: row;
			gap: 0.5rem;
			padding: 0.6rem 1.1rem;
		}
		.nav-label {
			font-size: 0.875rem;
		}
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
