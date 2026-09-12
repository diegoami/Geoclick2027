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
	import {
		createProgressRepository,
		todayLocalDate,
		type ProgressRepository
	} from './progressRepository';
	import {
		isDue,
		rate,
		daysUntil,
		type CardState as SchedulerState,
		type Grade
	} from '@geoclick/srs';

	let { mapId }: { mapId: string } = $props();

	// Assigned at the top of onMount's async init, before anything below
	// (computeNotDueIds, the completion $effect, onSlipPointerUp) can run -
	// a plain module-scope variable, not $state, same as cardStatesByTargetId.
	let progressRepository: ProgressRepository;

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

	// Tray height, in vh - user-resizable via the drag handle (onTrayHandle*
	// below). Not persisted across sessions; resets to the default each time
	// the view mounts, same as every other view's transient UI state.
	let trayHeight = $state(30);
	const TRAY_MIN_VH = 15;
	const TRAY_MAX_VH = 70;
	// Not reactive - just bookkeeping for the drag gesture itself, same
	// reasoning as hoveredName below.
	let trayResizeStart: { clientY: number; height: number } | undefined;

	// 'loading' until the map/due-state check resolves; 'upToDate' when
	// every target is not-due (nothing to review); 'quiz' while a session
	// (due or practice) is actually being played.
	let phase = $state<'loading' | 'upToDate' | 'quiz'>('loading');
	// 'due': a normal spaced-repetition session - attempts feed the
	// scheduler. 'practice': the "practice all regions" override once
	// nothing's due - full blank re-test, results never touch SRS state.
	let mode = $state<'due' | 'practice'>('due');

	// Not reactive state - a plain cache of each target's current scheduler
	// state, refreshed whenever a session is (re)built. `rate()` needs the
	// *previous* state to compute the next one. Never read in the template,
	// same reasoning as solvedPopups below.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	let cardStatesByTargetId = new Map<string, SchedulerState>();

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
	// stays true. Reset whenever a new session starts so the next
	// completion saves/computes again.
	let summarySaved = false;

	// Whether finishing a *due* session actually cleared the map for today,
	// vs. something (typically a revealed target, which stays due same-day)
	// is still outstanding - drives which message/button the score panel
	// shows, so "Play again" doesn't lie about there being more to play.
	// Only meaningful when mode === 'due'; undefined until computed.
	let allCaughtUp = $state<boolean | undefined>(undefined);
	let daysUntilNextReview = $state<number | undefined>(undefined);

	$effect(() => {
		if (complete && score && !summarySaved) {
			summarySaved = true;
			progressRepository
				.saveLastSessionSummary(mapId, { ...score, completedAt: new Date().toISOString() })
				.catch((e) => console.error('Failed to save quiz progress:', e));

			if (mode === 'due' && mapDef) {
				const today = todayLocalDate();
				const stillDue = mapDef.targets.some((t) => isDue(cardStatesByTargetId.get(t.id), today));
				allCaughtUp = !stillDue;
				if (!stillDue) {
					const nextDueDate = mapDef.targets
						.map((t) => cardStatesByTargetId.get(t.id)!.dueDate)
						.reduce((soonest, due) => (due < soonest ? due : soonest));
					daysUntilNextReview = daysUntil(nextDueDate, today);
				}
			}
		}
	});

	// Small regions (Bremen, Saarland...) can be a couple of screen pixels
	// wide at a normal zoom level - an exact-pixel drop test makes them
	// nearly impossible to hit. Hover stays exact (precision while
	// exploring), but the final drop gets a tolerance: if the exact point
	// misses, a small radius around it is searched for the *correct*
	// target specifically, not as general slop for any region.
	const DROP_TOLERANCE_PX = 24;
	// A point target (city marker, circle-radius 9px in the shared style)
	// has zero inherent area - the tolerance radius *is* the entire target,
	// unlike a polygon where it's just an assist. Starts larger than the
	// polygon tolerance for exactly that reason; tuned against the actual
	// rendered map the same way DROP_TOLERANCE_PX was tuned against Bremen,
	// not guessed once and left - see MAPS.md's "Point-target implementation".
	const POINT_DROP_TOLERANCE_PX = 30;
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
		// Both layers queried unconditionally - a given map's tileset only
		// ever has features for one of the two (polygon or point), so this
		// is a harmless no-op for whichever doesn't apply.
		const features = map.queryRenderedFeatures(radius ? box : [x, y], {
			layers: ['targets-fill', 'targets-circle']
		});
		return features.map((f) => f.properties?.name as string).filter((n): n is string => !!n);
	}

	// For point maps specifically: which of `candidateNames` is actually
	// nearest to the drop point, in screen space. Needed because two city
	// markers can sit closer together than the tolerance radius itself
	// (e.g. Essen/Duisburg, ~22px apart on-screen at the default zoom, well
	// inside a 30px tolerance) - without this, tolerance-based correctness
	// checked only "is the dragged target's name present somewhere in the
	// tolerance box", which let a drop land squarely on the WRONG city and
	// still count as correct for whichever OTHER slip you happened to be
	// holding, as long as that other city was also nearby. Caught directly
	// by testing the actual Ruhr-area cluster, not assumed. Polygon maps
	// don't get this treatment - the existing membership check has shipped
	// and been tested for months, no reason to risk it for a problem that's
	// specific to dense point clusters.
	function closestNameAmong(
		candidateNames: string[],
		clientX: number,
		clientY: number
	): string | undefined {
		if (!map || !mapDef) return undefined;
		// map.project() returns container-relative pixels (the same space
		// queryRenderedFeatures uses) - clientX/clientY are viewport
		// coordinates from the PointerEvent, so convert the same way
		// regionsNear does before comparing.
		const rect = container.getBoundingClientRect();
		const x = clientX - rect.left;
		const y = clientY - rect.top;
		let closestName: string | undefined;
		let closestDistSq = Infinity;
		for (const candidateName of candidateNames) {
			const target = mapDef.targets.find((t) => t.name === candidateName);
			if (!target) continue;
			const screenPoint = map.project(target.centroid);
			const dx = screenPoint.x - x;
			const dy = screenPoint.y - y;
			const distSq = dx * dx + dy * dy;
			if (distSq < closestDistSq) {
				closestDistSq = distSq;
				closestName = candidateName;
			}
		}
		return closestName;
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
		const isPointMap = mapDef?.targets[0]?.type === 'city';
		const exactName = regionAtPoint(e.clientX, e.clientY);
		const tolerance = isPointMap ? POINT_DROP_TOLERANCE_PX : DROP_TOLERANCE_PX;
		const nearbyNames = regionsNear(e.clientX, e.clientY, tolerance);
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
		// Point maps need an extra check: two city markers can sit closer
		// together than the tolerance radius (Essen/Duisburg, ~22px apart
		// at the default zoom, inside a 30px tolerance) - "is the dragged
		// target's name present somewhere nearby" isn't enough there, or a
		// drop squarely on the WRONG city can still count as correct for a
		// different, merely-nearby one. Requiring it to be the *closest*
		// candidate fixes that; not applied to polygon maps, which don't
		// have this failure mode and have shipped with the simpler check
		// for months.
		const isCorrect =
			exactName === name ||
			(isPointMap
				? closestNameAmong(nearbyNames, e.clientX, e.clientY) === name
				: nearbyNames.includes(name));

		session = attemptMatch(session, targetId, isCorrect ? targetId : undefined);
		const item = session.items.find((i) => i.target.id === targetId)!;
		const target = mapDef.targets.find((t) => t.id === targetId)!;

		if (item.status === 'correct' || item.status === 'revealed') {
			const revealed = item.status === 'revealed';
			markSolved(targetId, name, target.centroid, revealed);
			// Practice-mode results never touch SRS state - see
			// ROADMAP.md's Iteration 6 design. A due-mode attempt grades the
			// review: clean (no wrong drops) is "good", eventually correct
			// but only after a mistake is "hard" (still a pass, but a
			// weaker one - see the "hard graduates normally" decision),
			// and revealed/gave-up is "again" (forces a same-day repeat).
			if (mode === 'due') {
				const grade: Grade = revealed ? 'again' : item.errors === 0 ? 'good' : 'hard';
				const today = todayLocalDate();
				const previous = cardStatesByTargetId.get(targetId);
				const next = rate(previous, grade, today);
				cardStatesByTargetId.set(targetId, next);
				progressRepository
					.saveCardState(mapId, { targetId, ...next })
					.catch((e) => console.error('Failed to save quiz progress:', e));
			}
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

	// Drag the handle up to grow the tray (see more slips at once, e.g. on a
	// 100+-target map), down to shrink it (see more map). Deliberately a
	// separate pointer-capture gesture from the slip drag above - the handle
	// and the slips are different elements, so there's no conflict between
	// the two.
	function onTrayHandlePointerDown(e: PointerEvent) {
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		trayResizeStart = { clientY: e.clientY, height: trayHeight };
	}

	function onTrayHandlePointerMove(e: PointerEvent) {
		if (!trayResizeStart) return;
		const deltaPx = trayResizeStart.clientY - e.clientY;
		const deltaVh = (deltaPx / window.innerHeight) * 100;
		trayHeight = Math.min(TRAY_MAX_VH, Math.max(TRAY_MIN_VH, trayResizeStart.height + deltaVh));
	}

	function onTrayHandlePointerUp() {
		trayResizeStart = undefined;
	}

	const TRAY_KEY_STEP_VH = 5;

	function onTrayHandleKeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
			trayHeight = Math.min(TRAY_MAX_VH, trayHeight + TRAY_KEY_STEP_VH);
			e.preventDefault();
		} else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
			trayHeight = Math.max(TRAY_MIN_VH, trayHeight - TRAY_KEY_STEP_VH);
			e.preventDefault();
		}
	}

	// Reads each target's current card state and returns the ids that are
	// NOT due yet - refreshes `cardStatesByTargetId` as a side effect, since
	// `rate()` needs each target's previous state and this is the one place
	// that state gets (re)loaded from the repository.
	async function computeNotDueIds(targets: { id: string }[]): Promise<Set<string>> {
		const cardStates = await progressRepository.getCardStates(mapId);
		cardStatesByTargetId = new Map(cardStates.map((c) => [c.targetId, c]));
		const today = todayLocalDate();
		return new Set(
			targets.filter((t) => !isDue(cardStatesByTargetId.get(t.id), today)).map((t) => t.id)
		);
	}

	function clearAllVisuals() {
		if (!mapDef || !map) return;
		for (const target of mapDef.targets) {
			map.setFeatureState(
				{ source: 'targets', sourceLayer: 'targets', id: target.name },
				{ quizCorrect: false, quizRevealed: false, quizHover: false, quizWrong: false }
			);
		}
		for (const popup of solvedPopups.values()) popup.remove();
		solvedPopups.clear();
	}

	// Pre-marks not-due targets as discovered - same visual treatment as a
	// live correct drop. Only ever called once the map has actually
	// finished loading (setFeatureState throws before then).
	function applyPreSolvedVisuals(notDueIds: Set<string>, def: MapDefinition) {
		for (const target of def.targets) {
			if (!notDueIds.has(target.id)) continue;
			markSolved(target.id, target.name, target.centroid, false);
		}
	}

	// Builds (or rebuilds) a due-mode session from current card state. If
	// nothing's due, drops into the 'upToDate' phase instead of a
	// zero-slip session - that's what offers the "practice all" fallback.
	async function startDueSession() {
		if (!mapDef || !map) return;
		allCaughtUp = undefined;
		daysUntilNextReview = undefined;
		const notDueIds = await computeNotDueIds(mapDef.targets);
		if (notDueIds.size === mapDef.targets.length) {
			phase = 'upToDate';
			session = undefined;
			return;
		}
		mode = 'due';
		phase = 'quiz';
		session = createQuizSession(
			mapDef.targets.map((t) => ({ id: t.id, name: t.name })),
			notDueIds
		);
		applyPreSolvedVisuals(notDueIds, mapDef);
	}

	// "Practice all regions": ignores due dates entirely, full blank
	// re-test, no SRS write-back (see onSlipPointerUp). Only reachable
	// from the 'upToDate' phase - see ROADMAP.md's Iteration 6 design for
	// why this isn't a general-purpose always-available control.
	function startPractice() {
		if (!mapDef || !map) return;
		clearAllVisuals();
		summarySaved = false;
		mode = 'practice';
		phase = 'quiz';
		session = createQuizSession(mapDef.targets.map((t) => ({ id: t.id, name: t.name })));
	}

	// After a *due* session: re-checks due state, since something (a
	// revealed target) may still be due right now. After a *practice*
	// session: goes straight into another practice round rather than
	// re-checking - nothing about due-state changed while practicing, so
	// there'd be nothing new to find.
	function playAgain() {
		if (mode === 'practice') {
			startPractice();
			return;
		}
		clearAllVisuals();
		summarySaved = false;
		startDueSession();
	}

	onMount(() => {
		let cancelled = false;

		(async () => {
			progressRepository = await createProgressRepository();
			const { mapDef: loadedMapDef, style } = await fetchMapDefAndStyle(mapId);
			if (cancelled) return;
			mapDef = loadedMapDef;

			const notDueIds = await computeNotDueIds(loadedMapDef.targets);
			if (cancelled) return;

			map = createMap(container, loadedMapDef, style);
			if (typeof window !== 'undefined') {
				// Debug/test aid: lets integration tests (and manual debugging)
				// drive the real map instance, e.g. map.project(lngLat) to find
				// screen coordinates for a drag target.
				(window as unknown as { __map?: maplibregl.Map }).__map = map;
			}

			if (notDueIds.size === loadedMapDef.targets.length) {
				phase = 'upToDate';
			} else {
				mode = 'due';
				phase = 'quiz';
				session = createQuizSession(
					loadedMapDef.targets.map((t) => ({ id: t.id, name: t.name })),
					notDueIds
				);
			}

			// setFeatureState throws until the style has finished loading -
			// defer the pre-marking loop to the map's 'load' event rather
			// than running it immediately after construction.
			map.once('load', () => {
				if (cancelled || phase !== 'quiz') return;
				applyPreSolvedVisuals(notDueIds, loadedMapDef);
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
			<strong
				>{mapDef ? mapDef.name : 'Loading…'} — Quiz{mode === 'practice'
					? ' (practice)'
					: ''}</strong
			>
			{#if session}
				<span class="subtitle"
					>Drag each name onto its region — {session.items.filter((i) => i.status !== 'pending')
						.length} / {session.items.length} placed</span
				>
			{/if}
		</div>

		{#if phase === 'upToDate'}
			<div class="score-panel">
				<h2>Up to date!</h2>
				<p>No reviews needed on this map right now.</p>
				<button onclick={startPractice}>Practice all regions</button>
			</div>
		{/if}

		{#if complete && score && session}
			{@const revealedCount = session.items.filter((i) => i.status === 'revealed').length}
			<div class="score-panel">
				<h2>{mode === 'due' && allCaughtUp ? 'All caught up!' : 'Done!'}</h2>
				<p>
					<strong>{score.perfect}</strong> / {score.total} placed correctly on the first try.
				</p>
				<p>{score.totalErrors} total mistake{score.totalErrors === 1 ? '' : 's'}.</p>
				{#if revealedCount > 0}
					<p class="revealed-note">
						{revealedCount} revealed after too many misses.
					</p>
				{/if}
				{#if mode === 'due' && allCaughtUp}
					<p class="next-review-note">
						Next review in {daysUntilNextReview} day{daysUntilNextReview === 1 ? '' : 's'}.
					</p>
					<div class="score-panel-actions">
						<a class="score-panel-button" href={resolve('/')}>Back to maps</a>
						<button class="secondary" onclick={startPractice}>Practice all regions</button>
					</div>
				{:else}
					{#if mode === 'practice'}
						<p class="practice-note">Practice results don't affect your review schedule.</p>
					{/if}
					<button onclick={playAgain}>Play again</button>
				{/if}
			</div>
		{/if}
	{/if}

	<div class="container" bind:this={container}></div>

	{#if session}
		<div class="tray" bind:this={trayEl} style="height: {trayHeight}vh">
			<div class="tray-handle-row">
				<div
					class="tray-handle"
					role="slider"
					tabindex="0"
					aria-label="Resize name tray"
					aria-valuemin={TRAY_MIN_VH}
					aria-valuemax={TRAY_MAX_VH}
					aria-valuenow={Math.round(trayHeight)}
					onpointerdown={onTrayHandlePointerDown}
					onpointermove={onTrayHandlePointerMove}
					onpointerup={onTrayHandlePointerUp}
					onkeydown={onTrayHandleKeydown}
				></div>
			</div>
			<div class="tray-slips">
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
		flex-direction: column;
		box-sizing: border-box;
		background: rgba(255, 255, 255, 0.92);
		border-top: 1px solid rgba(0, 0, 0, 0.1);
	}
	.tray-handle-row {
		display: flex;
		justify-content: center;
		flex: none;
		padding: 0.3rem 0;
	}
	.tray-handle {
		width: 2.5rem;
		height: 4px;
		border-radius: 2px;
		background: rgba(0, 0, 0, 0.22);
		cursor: ns-resize;
		touch-action: none;
	}
	.tray-handle-row:hover .tray-handle {
		background: rgba(0, 0, 0, 0.35);
	}
	.tray-slips {
		flex: 1;
		display: flex;
		flex-wrap: wrap;
		align-content: flex-start;
		gap: 0.5rem;
		padding: 0 0.75rem 0.75rem;
		overflow-y: auto;
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
	.practice-note {
		font-size: 0.85rem;
		opacity: 0.7;
	}
	.next-review-note {
		font-size: 0.9rem;
		font-weight: 600;
		color: #2f6b45;
	}
	.score-panel-actions {
		display: flex;
		justify-content: center;
		gap: 0.5rem;
		margin-top: 0.75rem;
	}
	.score-panel button,
	.score-panel-button {
		font-family: inherit;
		font-size: 0.9rem;
		font-weight: 600;
		padding: 0.5rem 1rem;
		border-radius: 0.5rem;
		border: none;
		background: #5a9c6f;
		color: white;
		text-decoration: none;
		cursor: pointer;
	}
	.score-panel > button {
		margin-top: 0.75rem;
	}
	.score-panel button.secondary {
		background: transparent;
		color: #5a9c6f;
		border: 1px solid #5a9c6f;
	}
	.error {
		padding: 1rem;
		font-family: system-ui, sans-serif;
		color: #a33;
	}
	:global(.geoclick-solved-popup .maplibregl-popup-content) {
		font-family: system-ui, sans-serif;
		font-size: 11px;
		font-weight: 600;
		padding: 1px 6px;
		border-radius: 5px;
		background: rgba(31, 61, 42, 0.65);
		color: #ffffff;
		box-shadow: none;
	}
	:global(.geoclick-solved-popup .maplibregl-popup-tip) {
		display: none;
	}
	:global(.geoclick-solved-popup.revealed .maplibregl-popup-content) {
		background: rgba(95, 65, 27, 0.65);
	}
</style>
