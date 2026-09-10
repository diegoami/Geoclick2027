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

	let { mapId }: { mapId: string } = $props();

	let container: HTMLDivElement;
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

	let complete = $derived(session ? isSessionComplete(session) : false);
	let score = $derived(session ? scoreSession(session) : undefined);

	function regionAtPoint(clientX: number, clientY: number): string | undefined {
		if (!map) return undefined;
		const rect = container.getBoundingClientRect();
		const point: [number, number] = [clientX - rect.left, clientY - rect.top];
		if (point[0] < 0 || point[1] < 0 || point[0] > rect.width || point[1] > rect.height) {
			return undefined;
		}
		const features = map.queryRenderedFeatures(point, { layers: ['targets-fill'] });
		return features[0]?.properties?.name as string | undefined;
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

	function onSlipPointerUp(e: PointerEvent) {
		if (!dragging || !map || !session) return;
		const { targetId, name } = dragging;
		const droppedOnName = regionAtPoint(e.clientX, e.clientY);
		setHover(undefined);
		dragging = undefined;

		const droppedOnId = droppedOnName
			? mapDef?.targets.find((t) => t.name === droppedOnName)?.id
			: undefined;

		if (droppedOnId === targetId) {
			session = attemptMatch(session, targetId, droppedOnId);
			map.setFeatureState(
				{ source: 'targets', sourceLayer: 'targets', id: name },
				{ quizCorrect: true }
			);
		} else {
			session = attemptMatch(session, targetId, droppedOnId);
			wrongFlashId = targetId;
			setTimeout(() => {
				if (wrongFlashId === targetId) wrongFlashId = undefined;
			}, 450);
		}
	}

	function restart() {
		if (!mapDef || !map) return;
		for (const target of mapDef.targets) {
			map.setFeatureState(
				{ source: 'targets', sourceLayer: 'targets', id: target.name },
				{ quizCorrect: false, quizHover: false }
			);
		}
		session = createQuizSession(mapDef.targets.map((t) => ({ id: t.id, name: t.name })));
	}

	onMount(() => {
		let cancelled = false;

		(async () => {
			const { mapDef: loadedMapDef, style } = await fetchMapDefAndStyle(mapId);
			if (cancelled) return;
			mapDef = loadedMapDef;
			session = createQuizSession(loadedMapDef.targets.map((t) => ({ id: t.id, name: t.name })));

			map = createMap(container, loadedMapDef, style);
			if (typeof window !== 'undefined') {
				// Debug/test aid: lets integration tests (and manual debugging)
				// drive the real map instance, e.g. map.project(lngLat) to find
				// screen coordinates for a drag target.
				(window as unknown as { __map?: maplibregl.Map }).__map = map;
			}
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
					>Drag each name onto its region — {session.items.filter((i) => i.status === 'correct')
						.length} / {session.items.length} placed</span
				>
			{/if}
		</div>

		{#if complete && score}
			<div class="score-panel">
				<h2>Done!</h2>
				<p>
					<strong>{score.perfect}</strong> / {score.total} placed correctly on the first try.
				</p>
				<p>{score.totalErrors} total mistake{score.totalErrors === 1 ? '' : 's'}.</p>
				<button onclick={restart}>Play again</button>
			</div>
		{/if}
	{/if}

	<div class="container" bind:this={container}></div>

	{#if session}
		<div class="tray">
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
		animation: shake 0.45s;
		border-color: #c0392b;
		color: #c0392b;
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
		20%,
		60% {
			transform: translateX(-6px);
		}
		40%,
		80% {
			transform: translateX(6px);
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
</style>
