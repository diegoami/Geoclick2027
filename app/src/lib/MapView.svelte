<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as maplibregl from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import { fetchMapDefAndStyle, createMap } from './geoclickMap';
	import MapNav from './MapNav.svelte';
	import type { MapDefinition } from './mapDefinition';
	import { mapDisplayName } from './mapCatalog';
	import { t } from './i18n.svelte';
	import { createProgressRepository } from './progressRepository';
	import { KNOWN_CLEAN_STREAK } from './difficulty';
	import { tutorialExploreReveal } from './tutorial.svelte';

	let { mapId }: { mapId: string } = $props();

	let container: HTMLDivElement;
	let map: maplibregl.Map | undefined;
	let popup: maplibregl.Popup | undefined;
	let mapDef = $state<MapDefinition | undefined>(undefined);
	let error = $state<string | undefined>(undefined);
	let selectedFeatureId: number | string | undefined;

	// This view shows how well the map is known: every name the player has
	// placed right at least once is written on it, as strongly as they know it
	// (FT-22, docs/PLAN_V0.6.md). Names never placed cleanly stay blank, so the
	// view is also still the old Explore - click a region to find out what it
	// is. Plain Map, not SvelteMap: imperative bookkeeping for popup cleanup,
	// never read in the template (same reasoning as QuizView's solvedPopups).
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const retentionPopups = new Map<string, maplibregl.Popup>();
	// Whether any name is known well enough to be drawn, i.e. whether the
	// legend has anything to explain.
	let hasRetention = $state(false);

	/** Which strength a name is drawn at, or undefined for "don't draw it". */
	function tierOf(cleanStreak: number): 'known' | 'nearly' | 'seen' | undefined {
		if (cleanStreak >= KNOWN_CLEAN_STREAK) return 'known';
		if (cleanStreak === 2) return 'nearly';
		if (cleanStreak === 1) return 'seen';
		return undefined;
	}

	/** Draws one label per target the player has placed cleanly at least once. */
	async function showRetention(def: MapDefinition) {
		const repository = await createProgressRepository();
		const streaks = new Map(
			(await repository.getCardStates(mapId)).map((c) => [c.targetId, c.cleanStreak])
		);
		if (!map) return;
		for (const target of def.targets) {
			const tier = tierOf(streaks.get(target.id) ?? 0);
			if (!tier) continue;
			const popup = new maplibregl.Popup({
				closeButton: false,
				closeOnClick: false,
				className: `geoclick-solved-popup geoclick-retention retention-${tier}`
			})
				.setLngLat(target.centroid)
				.setText(target.name)
				.addTo(map);
			retentionPopups.set(target.id, popup);
			hasRetention = true;
		}
	}

	onMount(() => {
		let cancelled = false;

		(async () => {
			const { mapDef: loadedMapDef, style } = await fetchMapDefAndStyle(mapId);
			if (cancelled) return;
			mapDef = loadedMapDef;

			map = createMap(container, loadedMapDef, style);
			showRetention(loadedMapDef).catch((e) =>
				console.error('Failed to read progress for the retention map:', e)
			);

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
					popup.setLngLat(e.lngLat).setText(name).addTo(map!);
					// The tutorial's Explore step (FT-11) moves on once a name shows.
					tutorialExploreReveal();
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
		for (const p of retentionPopups.values()) p.remove();
		retentionPopups.clear();
		map?.remove();
	});
</script>

<div class="map-view">
	{#if error}
		<p class="error">{error}</p>
	{:else}
		<MapNav {mapId} mapName={mapDisplayName(mapId) ?? mapDef?.name} active="explore" />
	{/if}
	<div class="container" bind:this={container}></div>
	{#if hasRetention}
		<div class="legend">
			<span class="swatch retention-known">{t('retention.known')}</span>
			<span class="swatch retention-nearly">{t('retention.nearly')}</span>
			<span class="swatch retention-seen">{t('retention.seen')}</span>
		</div>
	{/if}
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
	/* What the three label strengths mean (FT-22). Bottom-left, clear of the
	   map bar, the zoom buttons and the version badge. */
	.legend {
		position: absolute;
		left: 0.75rem;
		bottom: 0.75rem;
		z-index: 1;
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		max-width: calc(100% - 1.5rem);
		padding: 0.4rem 0.5rem;
		background: rgba(255, 255, 255, 0.92);
		border: 1px solid rgba(17, 24, 21, 0.1);
		border-radius: 0.6rem;
		font-family: system-ui, sans-serif;
	}
	.swatch {
		padding: 1px 6px;
		border-radius: 5px;
		background: rgba(31, 61, 42, 0.65);
		color: #ffffff;
		font-size: 0.8125rem;
		font-weight: 600;
		white-space: nowrap;
	}
	/* The same steps the labels themselves use, in app.css. */
	.swatch.retention-nearly {
		font-size: 0.75rem;
		opacity: 0.72;
	}
	.swatch.retention-seen {
		font-size: 0.7rem;
		opacity: 0.45;
	}
</style>
