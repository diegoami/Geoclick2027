<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as maplibregl from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import { resolve } from '$app/paths';
	import { fetchMapDefAndStyle, createMap } from './geoclickMap';
	import {
		createQuizSession,
		attemptMatch,
		isSessionComplete,
		scoreSession,
		type QuizSession
	} from '@geoclick/quiz-engine';
	import type { MapDefinition } from './mapDefinition';
	import { createLocalStorageProgressRepository } from './progressRepository';

	let { mapId }: { mapId: string } = $props();

	const progressRepository = createLocalStorageProgressRepository();

	let container: HTMLDivElement;
	let trayEl: HTMLDivElement;
	let map: maplibregl.Map | undefined;

	let mapDef = $state<MapDefinition | undefined>(undefined);
	let session = $state<QuizSession | undefined>(undefined);
	let error = $state<string | undefined>(undefined);
	let dragging = $state<{ targetId: string; name: string; x: number; y: number } | undefined>(
		undefined
	);
	let wrongFlashId = $state<string | undefined>(undefined);

	// Not reactive state - just bookkeeping for which feature currently has
	// quizHover set, so it can be cleared when the pointer moves off it.
	let hoveredName: string | undefined;
	// Persistent per-target popups revealing the name of each solved region.
	// A MapLibre symbol layer driven by feature-state opacity was tried
	// first and dropped: even with text-allow-overlap/text-ignore-placement
	// set, MapLibre's collision/placement system unpredictably hid some
	// labels regardless of opacity. Plain DOM popups (same mechanism
	// MapView/TourView already use) have no such collision system. Plain
	// Map, not SvelteMap: never read in the template, purely an imperative
	// side-table for cleanup on restart/destroy.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const solvedPopups = new Map<string, maplibregl.Popup>();

	let complete = $derived(session ? isSessionComplete(session) : false);
	let score = $derived(session ? scoreSession(session) : undefined);

	// Not reactive state - just a guard so a completed session's score is
	// persisted exactly once, not on every reactive re-run while `complete`
	// stays true. Reset on restart so the next completion saves again.
	let summarySaved = false;

	$effect(() => {
		if (complete && score && !summarySaved) {
			summarySaved = true;
			progressRepository
				.saveLastSessionSummary(mapId, { ...score, completedAt: new Date().toISOString() })
				.catch((e) => console.error('Failed to save quiz progress:', e));
		}
	});

	// Small regions (Bremen, Saarland...) can be a couple of screen pixels
	// wide at a normal zoom level - an exact-pixel drop test makes them
	// nearly impossible to hit. Hover stays exact (precision while
	// exploring), but the final drop gets a tolerance: if the exact point
	// misses, a small radius around it is searched for the *correct*
	// target specifically, not as general slop for any region.
	const DROP_TOLERANCE_PX = 24;
	const WRONG_PAUSE_MS = 700;

	function regionAtPoint(clientX: number, clientY: number): string | undefined {
		const names = regionsNear(clientX, clientY, 0);
		return names[0];
	}

	function isOverMap(clientX: number, clientY: number): boolean {
		const rect = container.getBoundingClientRect();
		const x = clientX - rect.left;
		const y = clientY - rect.top;
		return x >= 0 && y >= 0 && x <= rect.width && y <= rect.height;
	}

	// The tray sits absolutely-positioned over the bottom of the map
	// container, so "is the drop point over the map" alone doesn't catch
	// the most natural cancel gesture: dragging a slip back down onto the
	// tray it came from.
	function isOverTray(clientX: number, clientY: number): boolean {
		const rect = trayEl.getBoundingClientRect();
		return (
			clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom
		);
	}

	function regionsNear(clientX: number, clientY: number, radius: number): string[] {
		if (!map || !isOverMap(clientX, clientY)) return [];
		const rect = container.getBoundingClientRect();
		const x = clientX - rect.left;
		const y = clientY - rect.top;
		const box: [[number, number], [number, number]] = [
			[x - radius, y - radius],
			[x + radius, y + radius]
		];
		const features = map.queryRenderedFeatures(radius ? box : [x, y], {
			layers: ['targets-fill']
		});
		return features.map((f) => f.properties?.name as string).filter((n): n is string => !!n);
	}

	function setHover(name: string | undefined) {
		if (name === hoveredName) return;
		if (hoveredName && map) {
			map.setFeatureState(
				{ source: 'targets', sourceLayer: 'targets', id: hoveredName },
				{ quizHover: false }
			);
		}
		hoveredName = name;
		if (name && map) {
			map.setFeatureState(
				{ source: 'targets', sourceLayer: 'targets', id: name },
				{ quizHover: true }
			);
		}
	}

	function onSlipPointerDown(e: PointerEvent, targetId: string, name: string) {
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		dragging = { targetId, name, x: e.clientX, y: e.clientY };
	}

	function onSlipPointerMove(e: PointerEvent) {
		if (!dragging) return;
		dragging = { ...dragging, x: e.clientX, y: e.clientY };
		setHover(regionAtPoint(e.clientX, e.clientY));
	}

	function markSolved(
		targetId: string,
		name: string,
		centroid: [number, number],
		revealed: boolean
	) {
		if (!map) return;
		map.setFeatureState(
			{ source: 'targets', sourceLayer: 'targets', id: name },
			revealed ? { quizRevealed: true } : { quizCorrect: true }
		);
		const popup = new maplibregl.Popup({
			closeButton: false,
			closeOnClick: false,
			className: revealed ? 'geoclick-solved-popup revealed' : 'geoclick-solved-popup'
		})
			.setLngLat(centroid)
			.setHTML(name)
			.addTo(map);
		solvedPopups.set(targetId, popup);
	}

	function onSlipPointerUp(e: PointerEvent) {
		if (!dragging || !map || !session || !mapDef) return;
		if (!isOverMap(e.clientX, e.clientY) || isOverTray(e.clientX, e.clientY)) {
			// Dropped outside the map, or back over the tray - treat as
			// "changed my mind", not a wrong attempt: no error recorded, slip
			// just returns to the tray.
			setHover(undefined);
			dragging = undefined;
			return;
		}
		const { targetId, name } = dragging;
		const exactName = regionAtPoint(e.clientX, e.clientY);
		const nearbyNames = regionsNear(e.clientX, e.clientY, DROP_TOLERANCE_PX);
		setHover(undefined);
		dragging = undefined;

		// A drop only counts as an attempt if it landed on or near some
		// region at all - sea, gaps between regions, or empty map padding
		// isn't a plausible guess, so it shouldn't be scored as wrong any
		// more than dropping back on the tray is.
		if (!exactName && nearbyNames.length === 0) return;

		// Correct if the exact point or a small tolerance radius around it
		// hit the right region - the tolerance only ever helps a *correct*
		// drop land, it never reattributes which region a wrong drop hit.
		const isCorrect = exactName === name || nearbyNames.includes(name);

		session = attemptMatch(session, targetId, isCorrect ? targetId : undefined);
		const item = session.items.find((i) => i.target.id === targetId)!;
		const target = mapDef.targets.find((t) => t.id === targetId)!;

		if (item.status === 'correct') {
			markSolved(targetId, name, target.centroid, false);
			progressRepository
				.markTargetSolvedToday(mapId, targetId)
				.catch((e) => console.error('Failed to save quiz progress:', e));
		} else if (item.status === 'revealed') {
			markSolved(targetId, name, target.centroid, true);
			// Revealed counts as "settled for today" too - no reason to make
			// you fail the same slip 3 more times if you reopen this map
			// later today. The distinction from a genuinely correct answer
			// isn't preserved across a reload (see progressRepository.ts);
			// accepted simplification for this iteration.
			progressRepository
				.markTargetSolvedToday(mapId, targetId)
				.catch((e) => console.error('Failed to save quiz progress:', e));
		} else {
			wrongFlashId = targetId;
			if (exactName) {
				map.setFeatureState(
					{ source: 'targets', sourceLayer: 'targets', id: exactName },
					{ quizWrong: true }
				);
			}
			setTimeout(() => {
				if (wrongFlashId === targetId) wrongFlashId = undefined;
				if (exactName && map) {
					map.setFeatureState(
						{ source: 'targets', sourceLayer: 'targets', id: exactName },
						{ quizWrong: false }
					);
				}
			}, WRONG_PAUSE_MS);
		}
	}

	function restart() {
		if (!mapDef || !map) return;
		for (const target of mapDef.targets) {
			map.setFeatureState(
				{ source: 'targets', sourceLayer: 'targets', id: target.name },
				{ quizCorrect: false, quizRevealed: false, quizHover: false, quizWrong: false }
			);
		}
		for (const popup of solvedPopups.values()) popup.remove();
		solvedPopups.clear();
		summarySaved = false;
		session = createQuizSession(mapDef.targets.map((t) => ({ id: t.id, name: t.name })));
	}

	onMount(() => {
		let cancelled = false;

		(async () => {
			const { mapDef: loadedMapDef, style } = await fetchMapDefAndStyle(mapId);
			if (cancelled) return;
			mapDef = loadedMapDef;

			// Targets already solved today (in this or an earlier session)
			// start pre-resolved rather than pending, so reopening a map
			// you're partway through today doesn't ask you to re-solve what
			// you already got right.
			const solvedToday = await progressRepository.getTargetsSolvedToday(mapId);
			if (cancelled) return;
			session = createQuizSession(
				loadedMapDef.targets.map((t) => ({ id: t.id, name: t.name })),
				solvedToday
			);

			map = createMap(container, loadedMapDef, style);
			if (typeof window !== 'undefined') {
				// Debug/test aid: lets integration tests (and manual debugging)
				// drive the real map instance, e.g. map.project(lngLat) to find
				// screen coordinates for a drag target.
				(window as unknown as { __map?: maplibregl.Map }).__map = map;
			}

			// setFeatureState throws until the style has finished loading -
			// defer the pre-marking loop to the map's 'load' event rather
			// than running it immediately after construction.
			map.once('load', () => {
				if (cancelled || !session) return;
				for (const item of session.items) {
					if (item.status !== 'correct') continue;
					const target = loadedMapDef.targets.find((t) => t.id === item.target.id)!;
					markSolved(item.target.id, item.target.name, target.centroid, false);
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
		map?.remove();
	});
</script>

<div class="quiz-view">
	{#if error}
		<p class="error">{error}</p>
	{:else}
		<div class="info">
			<a class="back" href={mapId ? resolve('/map/[mapId]', { mapId }) : resolve('/')}>← Map</a>
			<strong>{mapDef ? mapDef.name : 'Loading…'} — Quiz</strong>
			{#if session}
				<span class="subtitle"
					>Drag each name onto its region — {session.items.filter((i) => i.status !== 'pending')
						.length} / {session.items.length} placed</span
				>
			{/if}
		</div>

		{#if complete && score && session}
			{@const revealedCount = session.items.filter((i) => i.status === 'revealed').length}
			<div class="score-panel">
				<h2>Done!</h2>
				<p>
					<strong>{score.perfect}</strong> / {score.total} placed correctly on the first try.
				</p>
				<p>{score.totalErrors} total mistake{score.totalErrors === 1 ? '' : 's'}.</p>
				{#if revealedCount > 0}
					<p class="revealed-note">
						{revealedCount} revealed after too many misses.
					</p>
				{/if}
				<button onclick={restart}>Play again</button>
			</div>
		{/if}
	{/if}

	<div class="container" bind:this={container}></div>

	{#if session}
		<div class="tray" bind:this={trayEl}>
			{#each session.items.filter((i) => i.status === 'pending') as item (item.target.id)}
				{@const isDragging = dragging?.targetId === item.target.id}
				<button
					class="slip"
					class:slip-dragging={isDragging}
					class:wrong={wrongFlashId === item.target.id}
					style={isDragging && dragging ? `left: ${dragging.x}px; top: ${dragging.y}px;` : ''}
					onpointerdown={(e) => onSlipPointerDown(e, item.target.id, item.target.name)}
					onpointermove={onSlipPointerMove}
					onpointerup={onSlipPointerUp}
				>
					{item.target.name}
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.quiz-view {
		position: relative;
		width: 100%;
		height: 100vh;
		overflow: hidden;
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
		max-width: 20rem;
	}
	.subtitle {
		font-size: 0.8rem;
		opacity: 0.75;
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
	.tray {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		z-index: 1;
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		padding: 0.75rem;
		max-height: 30vh;
		overflow-y: auto;
		background: rgba(255, 255, 255, 0.92);
		border-top: 1px solid rgba(0, 0, 0, 0.1);
	}
	.slip {
		font-family: system-ui, sans-serif;
		font-size: 0.9rem;
		font-weight: 600;
		background: white;
		border: 1px solid rgba(0, 0, 0, 0.15);
		border-radius: 0.5rem;
		padding: 0.4rem 0.7rem;
		cursor: grab;
		touch-action: none;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}
	.slip.wrong {
		animation: shake 0.7s;
		background: #f6d7d3;
		border-color: #c0392b;
		border-width: 2px;
		color: #a3271b;
	}
	.slip-dragging {
		position: fixed;
		transform: translate(-50%, -50%);
		z-index: 10;
		cursor: grabbing;
		pointer-events: auto;
	}
	@keyframes shake {
		0%,
		100% {
			transform: translateX(0);
		}
		10%,
		30%,
		50%,
		70% {
			transform: translateX(-9px);
		}
		20%,
		40%,
		60%,
		80% {
			transform: translateX(9px);
		}
		90% {
			transform: translateX(-4px);
		}
	}
	.score-panel {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 2;
		background: white;
		border-radius: 0.75rem;
		padding: 1.5rem 2rem;
		text-align: center;
		font-family: system-ui, sans-serif;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
	}
	.score-panel h2 {
		margin: 0 0 0.75rem;
	}
	.revealed-note {
		font-size: 0.85rem;
		color: #8a6d3b;
	}
	.score-panel button {
		margin-top: 0.75rem;
		font-family: inherit;
		font-size: 0.9rem;
		font-weight: 600;
		padding: 0.5rem 1rem;
		border-radius: 0.5rem;
		border: none;
		background: #5a9c6f;
		color: white;
		cursor: pointer;
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
	:global(.geoclick-solved-popup.revealed .maplibregl-popup-content) {
		color: #5a4626;
	}
</style>
