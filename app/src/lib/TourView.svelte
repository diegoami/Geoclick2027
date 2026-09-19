<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as maplibregl from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import { fetchMapDefAndStyle, createMap } from './geoclickMap';
	import type { TerrainLayer } from './terrainLayer';
	import { terrainShown } from './mapPrefs.svelte';
	import { mapFitPadding } from './mapFit';
	import MapNav from './MapNav.svelte';
	import { t } from './i18n.svelte';
	import { mapDisplayName } from './mapCatalog';
	import { fetchTour, type Tour } from './tour';
	import { TOUR_SPEEDS, defaultTourSpeed } from './tourSpeed';
	import { DOT_CLEARANCE_PX, registerLabel } from './labelCollision';
	import type { MapDefinition, Target } from './mapDefinition';
	import FactCard from './FactCard.svelte';
	import { fetchFacts, rotateHook, type Facts } from './facts';

	let { mapId }: { mapId: string } = $props();

	let container: HTMLDivElement;
	let map: maplibregl.Map | undefined;
	// Sea, rivers and named terrain (FT-33). The $effect below follows the
	// map bar's Terrain button, which only writes the preference.
	let terrain = $state<TerrainLayer | undefined>(undefined);
	let popup: maplibregl.Popup | undefined;
	let advanceTimer: ReturnType<typeof setTimeout> | undefined;

	let mapDef = $state<MapDefinition | undefined>(undefined);
	let tour = $state<Tour | undefined>(undefined);
	let error = $state<string | undefined>(undefined);
	let stepIndex = $state(0);
	let playing = $state(false);
	let finished = $state(false);
	let speed = $state(1);

	const BASE_FLIGHT_MS = 1200;
	// Air around the place a stop is looking at, on top of whatever the view
	// furniture already takes (mapFitPadding adds its own margin).
	const STOP_MARGIN_PX = 40;
	// Above every other label: the tour is showing this one name on purpose.
	const TOUR_NAME_PRIORITY = 1000;
	// A point target's bbox is degenerate (see mapDefinition.ts) - fitting
	// to it would zoom to the map's max zoom with no sense of "looking at
	// one city". flyTo to a fixed zoom instead. Tuned against italy-towns-
	// 100k's actual Trento, not guessed and left: zoom 10 left a marker
	// floating alone with nothing else visible (there's no base map layer,
	// so "context" only ever comes from other targets/lakes being in
	// frame) - zoom 7 keeps several neighboring cities and a nearby lake
	// shape in view, giving an actual sense of place. See MAPS.md's
	// "Point-target implementation" section.
	const POINT_TOUR_ZOOM = 7;

	// The fact box (FT-35), following the tour a step at a time. This is what
	// `TourStep.narration` was declared for in iteration 6 and never filled:
	// the narration is the place's own fact, so there is nothing to author.
	let facts = $state<Facts>({});
	// Picked once per step rather than derived from currentTarget: choosing a
	// name-fact advances that place's rotation (FT-36), and a $derived would
	// advance it again on every unrelated re-render.
	let tourHook = $state<string | undefined>(undefined);

	let currentTarget = $derived.by((): Target | undefined => {
		if (!mapDef || !tour) return undefined;
		const step = tour.steps[stepIndex];
		return step ? mapDef.targets.find((t) => t.id === step.targetId) : undefined;
	});

	function clearHighlight(name: string | undefined) {
		if (!map || !name) return;
		map.setFeatureState(
			{ source: 'targets', sourceLayer: 'targets', id: name },
			{ highlighted: false }
		);
	}

	function showStep(index: number) {
		if (!map || !mapDef || !tour) return;
		const step = tour.steps[index];
		if (!step) return;
		const target = mapDef.targets.find((t) => t.id === step.targetId);
		if (!target) return;

		clearHighlight(currentTarget?.name);
		stepIndex = index;
		finished = false;
		// A new stop is a new encounter with the place, so its name-fact moves
		// on: a second run of the tour tells you something different.
		tourHook = rotateHook(mapId, target.id, facts[target.id]);

		map.setFeatureState(
			{ source: 'targets', sourceLayer: 'targets', id: target.name },
			{ highlighted: true }
		);
		const flightDuration = Math.max(150, BASE_FLIGHT_MS / speed);
		// Frame the stop in the space the map bar and the controls leave, not
		// in the whole canvas (FT-25) - otherwise a northern target flies to
		// a spot half-covered by the bar.
		const padding = mapFitPadding(container, { top: STOP_MARGIN_PX, bottom: STOP_MARGIN_PX });
		if (target.type === 'city') {
			map.flyTo({
				center: target.centroid,
				zoom: POINT_TOUR_ZOOM,
				padding,
				duration: flightDuration
			});
		} else {
			map.fitBounds(target.bbox, { padding, duration: flightDuration });
		}

		popup ??= new maplibregl.Popup({
			closeButton: false,
			closeOnClick: false,
			anchor: 'center',
			className: 'geoclick-popup'
		});
		const [lon, lat] = target.centroid;
		popup.setLngLat([lon, lat]).setText(target.name).addTo(map);
		// The tour shows one name at a time, and that name is the whole point of
		// the step: it outranks anything else on the map, and on a towns map it
		// sits beside the dot rather than on it (FT-24).
		registerLabel(popup, {
			priority: TOUR_NAME_PRIORITY,
			beside: target.type === 'city' ? DOT_CLEARANCE_PX : undefined
		});

		scheduleAdvance(step.dwellMs);
	}

	function scheduleAdvance(dwellMs: number) {
		if (advanceTimer) clearTimeout(advanceTimer);
		if (playing) {
			advanceTimer = setTimeout(() => advance(), dwellMs / speed);
		}
	}

	function setSpeed(newSpeed: number) {
		speed = newSpeed;
		// Restarts the current step's countdown at the new speed, rather than
		// trying to preserve exact elapsed progress - simple, and the only
		// visible effect is the timing (no re-flying or re-popup).
		if (tour) {
			const step = tour.steps[stepIndex];
			if (step) scheduleAdvance(step.dwellMs);
		}
	}

	function advance() {
		if (!tour) return;
		if (stepIndex + 1 >= tour.steps.length) {
			finished = true;
			playing = false;
			return;
		}
		showStep(stepIndex + 1);
	}

	function back() {
		if (stepIndex > 0) showStep(stepIndex - 1);
	}

	function togglePlay() {
		if (finished) {
			playing = true;
			showStep(0);
			return;
		}
		playing = !playing;
		if (playing) showStep(stepIndex);
		else if (advanceTimer) clearTimeout(advanceTimer);
	}

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
	onMount(() => {
		let cancelled = false;

		(async () => {
			const [{ mapDef: loadedMapDef, style }, loadedTour] = await Promise.all([
				fetchMapDefAndStyle(mapId),
				fetchTour(mapId)
			]);
			if (cancelled) return;
			mapDef = loadedMapDef;
			tour = loadedTour;
			fetchFacts(mapId).then((loaded) => {
				if (!cancelled) facts = loaded;
			});
			// Big maps start faster so the tour fits ~3 minutes (GC-033); the speed
			// menu below still overrides it.
			speed = defaultTourSpeed(loadedTour.steps);

			({ map, terrain } = createMap(container, loadedMapDef, style));
			map.once('load', () => {
				if (cancelled) return;
				playing = true;
				showStep(0);
			});
		})().catch((e) => {
			error = e instanceof Error ? e.message : String(e);
		});

		return () => {
			cancelled = true;
		};
	});

	onDestroy(() => {
		if (advanceTimer) clearTimeout(advanceTimer);
		popup?.remove();
		map?.remove();
	});
</script>

<div class="tour-view">
	{#if error}
		<p class="error">{error}</p>
	{:else}
		<MapNav {mapId} mapName={mapDisplayName(mapId) ?? mapDef?.name} active="tour" />

		<!-- The step's own fact, above the controls (FT-35). No close button:
		     the tour drives it, and it changes with every step. -->
		{#if currentTarget}
			<FactCard
				name={currentTarget.name}
				fact={facts[currentTarget.id]}
				hook={tourHook}
				max={2}
				bottom="4.25rem"
			/>
		{/if}

		{#if tour}
			<div class="controls" data-map-overlay="bottom">
				<button onclick={back} disabled={stepIndex === 0}>{t('tour.prev')}</button>
				<button onclick={togglePlay}>
					{#if finished}{t('tour.replay')}{:else if playing}{t('tour.pause')}{:else}{t(
							'tour.play'
						)}{/if}
				</button>
				<button onclick={advance} disabled={finished}>{t('tour.next')}</button>
				<span class="progress">{stepIndex + 1} / {tour.steps.length}</span>
				<select
					class="speed"
					value={speed}
					onchange={(e) => setSpeed(Number(e.currentTarget.value))}
				>
					{#each TOUR_SPEEDS as s (s)}
						<option value={s}>{s}×</option>
					{/each}
				</select>
			</div>
		{/if}
	{/if}
	<div class="container" bind:this={container}></div>
</div>

<style>
	.tour-view {
		position: relative;
		width: 100%;
		height: 100vh;
	}
	.container {
		width: 100%;
		height: 100%;
	}
	.controls {
		position: absolute;
		bottom: 1.5rem;
		left: 50%;
		transform: translateX(-50%);
		z-index: 1;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: rgba(255, 255, 255, 0.9);
		padding: 0.5rem 0.9rem;
		border-radius: 2rem;
		font-family: system-ui, sans-serif;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
	}
	.controls button {
		border: none;
		background: none;
		font-size: 1.1rem;
		cursor: pointer;
		padding: 0.25rem 0.5rem;
		border-radius: 0.5rem;
	}
	.controls button:disabled {
		opacity: 0.35;
		cursor: default;
	}
	.controls button:not(:disabled):hover {
		background: rgba(0, 0, 0, 0.06);
	}
	.progress {
		font-size: 0.85rem;
		opacity: 0.7;
		min-width: 3.5rem;
		text-align: center;
	}
	.speed {
		font-family: inherit;
		font-size: 0.85rem;
		border: none;
		background: rgba(0, 0, 0, 0.06);
		border-radius: 0.5rem;
		padding: 0.25rem 0.4rem;
		cursor: pointer;
	}
	.error {
		padding: 1rem;
		font-family: system-ui, sans-serif;
		color: #a33;
	}
</style>
