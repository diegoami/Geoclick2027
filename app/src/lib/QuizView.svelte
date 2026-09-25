<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as maplibregl from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import { resolve } from '$app/paths';
	import { fetchMapDefAndStyle, createMap } from './geoclickMap';
	import type { TerrainLayer } from './terrainLayer';
	import { followTerrainLanguage } from './terrainLanguage.svelte';
	import { terrainShown } from './mapPrefs.svelte';
	import { mapFitPadding } from './mapFit';
	import { resolveDrop } from './quizDrop';
	import MapNav from './MapNav.svelte';
	import { t, tPlural } from './i18n.svelte';
	import { mapDisplayName } from './mapCatalog';
	import { tutorialDrop, tutorialQuizComplete, tutorialState } from './tutorial.svelte';
	import { tutorialSlipIds } from './tutorialMachine';
	import { TUTORIAL_MAP_ID } from './tutorialSandbox.svelte';
	import { DOT_CLEARANCE_PX, registerLabel } from './labelCollision';
	import { forgetRound, rememberRound, roundInProgress } from './quizRound';
	import FactCard from './FactCard.svelte';
	import { fetchFacts, placeFacts, type Facts } from './facts';
	import {
		createQuizSession,
		attemptMatch,
		isSessionComplete,
		scoreSession,
		type QuizSession
	} from '@geoclick/quiz-engine';
	import { overallExtent, type MapDefinition } from './mapDefinition';
	import { handSize, knownCount, mapLevel, refillHand, type Level } from './difficulty';
	import { publishBottomOverlay } from './mapBottomOverlay';
	import {
		loadPlayableCardStates,
		todayLocalDate,
		type ProgressRepository
	} from './progressRepository';
	import { rate, type CardState as SchedulerState, type Grade } from '@geoclick/srs';

	let { mapId }: { mapId: string } = $props();

	// Assigned at the top of onMount's async init, before anything below (the
	// completion $effect, onSlipPointerUp) can run - a plain module-scope
	// variable, not $state, same as cardStatesByTargetId.
	let progressRepository: ProgressRepository;

	let container: HTMLDivElement;
	// $state because the tray-measuring $effect below reads them: as plain
	// variables, a tray that bound after the effect first ran was never
	// measured, and svelte-check flagged all three (non_reactive_update).
	let trayEl = $state<HTMLDivElement>();
	let trayHandleRowEl = $state<HTMLDivElement>();
	let traySlipsEl = $state<HTMLDivElement>();
	let map: maplibregl.Map | undefined;
	// Sea, rivers and named terrain (FT-33). The $effect below follows the
	// map bar's Terrain button, which only writes the preference.
	let terrain = $state<TerrainLayer | undefined>(undefined);
	// MapLibre throws on setFeatureState until the style's sources exist.
	// Set in the map's 'load' handler; gates everything that touches
	// feature state from outside that handler.
	let styleLoaded = $state(false);
	// Pending wrong-drop flash resets. A Set, not one handle: two wrong
	// drops inside WRONG_PAUSE_MS each need their own reset, and clearing
	// the first would leave that region stuck red. Cleared on destroy.
	// Set, not SvelteSet: never read in the template, pure bookkeeping.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const flashTimers = new Set<ReturnType<typeof setTimeout>>();

	let mapDef = $state<MapDefinition | undefined>(undefined);
	let session = $state<QuizSession | undefined>(undefined);
	let error = $state<string | undefined>(undefined);
	// True when saved progress could not be opened and the round is running on
	// the in-memory stand-in: playable, but nothing will be remembered (FT-57).
	let storageWarning = $state(false);
	let dragging = $state<{ targetId: string; name: string; x: number; y: number } | undefined>(
		undefined
	);
	let wrongFlashId = $state<string | undefined>(undefined);

	// The fact box (FT-35). It can only ever appear AFTER a name is resolved,
	// because it is set in markSolved - so it cannot give an answer away.
	// Since FT-62 it is shown only for a name the player could NOT place: a
	// correct drop clears it, so it no longer competes with the next slip.
	let facts = $state<Facts>({});
	let told = $state<{ id: string; name: string; origin?: string; extra?: string } | undefined>(
		undefined
	);

	// How hard this map plays, and which names the tray is offering right now
	// (FT-21, difficulty.ts). The better the map is known, the fewer names are
	// on offer, so the last drops of a round can't be worked out by
	// elimination. The session still holds every name; the hand is only what
	// the tray shows.
	let level = $state<Level>(0);
	let hand = $state<string[]>([]);
	const pendingIds = () =>
		session ? session.items.filter((i) => i.status === 'pending').map((i) => i.target.id) : [];

	/** Draw or top up the names on offer. Called when a session starts and
	 * after every resolved drop. While a tutorial runs, the slips it spotlights
	 * are dealt first, or "Try Sicilia" could point at an empty tray (FT-60). */
	function dealHand() {
		const inTutorial = tutorialState().status !== 'idle' && mapId === TUTORIAL_MAP_ID;
		const preferred = inTutorial ? tutorialSlipIds() : [];
		hand = refillHand(pendingIds(), hand, handSize(level), Math.random, preferred);
	}

	/** The map's level from the clean streaks of its targets; a target with no
	 * card state has never been placed right, so it counts as 0. */
	function refreshLevel(def: MapDefinition) {
		level = mapLevel(def.targets.map((t) => cardStatesByTargetId.get(t.id)?.cleanStreak ?? 0));
	}

	// Tray height, in px - user-resizable via the drag handle (onTrayHandle*
	// below). Not persisted across sessions; resets to the default each time
	// the view mounts, same as every other view's transient UI state.
	//
	// Deliberately px, not vh: a slip row's height comes from font
	// size/padding (fixed, not viewport-relative), so a fixed vh minimum
	// only matches "exactly one row" by coincidence at one particular
	// viewport height - everywhere else it either leaves dead space below
	// the row (tray "starts too big") or is a few px short, clipping the
	// *next* row's buttons instead of cleanly hiding them (can't actually
	// get down to one clean row). Measured from the real DOM instead, see
	// measureTraySizing below.
	let trayHeightPx = $state<number | undefined>(undefined);
	let trayMinPx = $state(60); // replaced by a real measurement before first paint
	let trayMaxPx = $state(500); // replaced once window is available (see onMount)
	const TRAY_MAX_FRACTION = 0.7; // drag ceiling, as a fraction of the viewport
	// Caps the auto-sized default (which otherwise fits every row with no
	// scrolling) so a tray of long names on a phone doesn't default to
	// covering most of the map. Written when a new map dealt every name
	// (110 slips on italy-provinces); the hand is ten at most since FT-60.
	const TRAY_DEFAULT_CAP_FRACTION = 0.3;
	// Not reactive - just bookkeeping for the drag gesture itself, same
	// reasoning as hoveredName below.
	let trayResizeStart: { clientY: number; height: number } | undefined;

	// Measures the real rendered size of one slip row (handle row + one row
	// of slips + the slips container's own bottom padding) so the tray's
	// minimum and default height are derived from actual content, not a
	// guessed constant. Sets the default (auto-fit every row, capped) only
	// once; later calls (e.g. on window resize) just refresh the min/max
	// and clamp whatever height the user has already chosen.
	function measureTraySizing() {
		if (!trayHandleRowEl || !traySlipsEl || typeof window === 'undefined') return;
		const handleRowPx = trayHandleRowEl.getBoundingClientRect().height;
		const firstSlip = traySlipsEl.querySelector<HTMLElement>('.slip');
		const rowPx = firstSlip?.getBoundingClientRect().height ?? 0;
		const paddingBottomPx = parseFloat(getComputedStyle(traySlipsEl).paddingBottom) || 0;
		trayMinPx = handleRowPx + rowPx + paddingBottomPx;
		trayMaxPx = window.innerHeight * TRAY_MAX_FRACTION;

		if (trayHeightPx === undefined) {
			const naturalPx = handleRowPx + traySlipsEl.scrollHeight;
			const defaultCapPx = window.innerHeight * TRAY_DEFAULT_CAP_FRACTION;
			trayHeightPx = Math.min(Math.max(naturalPx, trayMinPx), Math.min(defaultCapPx, trayMaxPx));
			// Fit the map into the space the tray and the map bar leave it, once
			// the tray's height is known. Fitted to the whole view, the
			// southernmost targets started out under the tray (Sicily on Italy -
			// Regions, at 1280x800 and on phones), which the tutorial's "try
			// Sicilia" step ran straight into (FT-11), and the northernmost ones
			// under the map bar (FT-25). The tray's new height is not on screen
			// yet, so it is passed in rather than measured.
			if (map && mapDef && container)
				map.fitBounds(overallExtent(mapDef), {
					padding: mapFitPadding(container, { bottom: trayHeightPx }),
					duration: 0
				});
		} else {
			trayHeightPx = Math.min(Math.max(trayHeightPx, trayMinPx), trayMaxPx);
		}
	}

	// Runs once the tray/slips actually exist in the DOM (session starts
	// undefined; the tray only renders once it's set - see the template).
	// requestAnimationFrame waits for that render to be committed/laid out
	// before measuring.
	$effect(() => {
		if (session && trayEl) {
			requestAnimationFrame(measureTraySizing);
		}
	});

	// Lifts the map's credit line and the version badge above the tray, so
	// they are not drawn over the names (mapBottomOverlay.ts).
	$effect(() => {
		if (trayEl) return publishBottomOverlay(trayEl);
	});

	// There is one kind of round now, and it covers the whole map (v0.6.0,
	// docs/PLAN_V0.6.md): no due-only round that can come up empty, so the
	// "Up to date!" screen and the practice mode that existed to escape it are
	// both gone, and with them the view's phases - the tray simply appears once
	// there is a session. The scheduler still grades every answer underneath.

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
	// MapView/TourView already use) are placed by labelCollision.ts instead,
	// which drops a name only when a more important one is already there
	// (FT-23). Plain Map, not SvelteMap: never read in the template, purely an
	// imperative side-table for cleanup on restart/destroy.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const solvedPopups = new Map<string, maplibregl.Popup>();
	// Counts up with every name placed, so the newest label outranks the ones
	// already on the map when they fight for the same spot.
	let labelPriority = 0;

	let complete = $derived(session ? isSessionComplete(session) : false);
	let score = $derived(session ? scoreSession(session) : undefined);

	// Not reactive state - just a guard so a completed session's score is
	// persisted exactly once, not on every reactive re-run while `complete`
	// stays true. Reset whenever a new session starts so the next
	// completion saves/computes again.
	let summarySaved = false;

	// How much of the map is known once the round is over (FT-26). The score
	// panel's copy stays written text while the map card's became a bar
	// (FT-65): the two record different things - what this round left behind,
	// against a map's standing. Undefined until a round ends.
	let knownAfterRound = $state<number | undefined>(undefined);
	// Lets the score panel be dismissed to see the finished map underneath
	// (it's a centered overlay with no other way to look past it) without
	// forcing a replay. Reset whenever a new session starts, so the next
	// completion shows the panel again.
	let scorePanelDismissed = $state(false);

	// Tell the tutorial when the tray is empty (FT-44). Its "get one wrong on
	// purpose" step waits for a wrong drop, and a player who places every
	// region correctly can no longer make one - without this the step waits
	// for something that can never happen.
	$effect(() => {
		if (complete) tutorialQuizComplete();
	});

	$effect(() => {
		if (complete && score && !summarySaved) {
			summarySaved = true;
			// Finished: there is nothing left to come back to.
			forgetRound(mapId);
			progressRepository
				.saveLastSessionSummary(mapId, { ...score, completedAt: new Date().toISOString() })
				.catch((e) => console.error('Failed to save quiz progress:', e));

			// What the round did to the map: how many names are known now, and
			// whether that moved the tray to a smaller hand (FT-21).
			if (mapDef) {
				knownAfterRound = knownCount(
					mapDef.targets.map((t) => cardStatesByTargetId.get(t.id)?.cleanStreak ?? 0)
				);
				refreshLevel(mapDef);
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
		if (!trayEl) return false;
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

	function onSlipPointerCancel() {
		// The tablet's own gesture - a text-selection gesture, or the browser
		// taking the pointer for a scroll - can cancel the drag mid-flight.
		// Put the slip back rather than leaving it stuck under the finger
		// (FT-61). No error is recorded: this is "changed my mind", like a
		// drop back on the tray.
		setHover(undefined);
		dragging = undefined;
	}

	function markSolved(
		targetId: string,
		name: string,
		centroid: [number, number],
		revealed: boolean,
		isTown: boolean
	) {
		if (!map) return;
		map.setFeatureState(
			{ source: 'targets', sourceLayer: 'targets', id: name },
			revealed ? { quizRevealed: true } : { quizCorrect: true }
		);
		const popup = new maplibregl.Popup({
			closeButton: false,
			closeOnClick: false,
			anchor: 'center',
			// A region's name without a box, as on Explore (FT-74); a town keeps
			// its pill beside the dot.
			className: [
				'geoclick-solved-popup',
				revealed && 'revealed',
				!isTown && 'geoclick-region-name'
			]
				.filter(Boolean)
				.join(' ')
		})
			.setLngLat(centroid)
			.setText(name)
			.addTo(map);
		// When two names don't fit (FT-23), the one just placed wins: it is the
		// answer to what the player did a moment ago - and a name shown after a
		// mistake (FT-20) is exactly the one the player has to read. Older names
		// give way and come back on a zoom.
		registerLabel(popup, {
			priority: ++labelPriority,
			// On a towns map the name goes beside the dot, so the dot the next
			// slip has to be dropped on stays visible (FT-24).
			beside:
				mapDef?.targets.find((t) => t.id === targetId)?.type === 'city'
					? DOT_CLEARANCE_PX
					: undefined
		});
		solvedPopups.set(targetId, popup);

		// Now that the name is on the map, say what the place is (FT-35), but
		// only for a name the player could NOT place (FT-62): a correct drop
		// replaces the card with nothing, so it stops competing with the next
		// slip, and the fact lands at the one moment the player has a reason to
		// read it. No timer either way - the next resolved drop, or the close
		// button, takes it away.
		told = revealed
			? { id: targetId, name, ...placeFacts(mapId, targetId, facts[targetId]) }
			: undefined;
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

		// The decision itself lives in quizDrop.ts (pure, unit-tested); this
		// component only does the hit-testing it needs.
		const { scored, correct: isCorrect } = resolveDrop({
			exactName,
			nearbyNames,
			draggedName: name,
			isPointMap,
			closestName: isPointMap ? closestNameAmong(nearbyNames, e.clientX, e.clientY) : undefined
		});
		if (!scored) return;
		// The tutorial's drop steps (FT-11) wait for a scored drop; does nothing
		// when no tutorial is running.
		tutorialDrop(isCorrect);

		session = attemptMatch(session, targetId, isCorrect ? targetId : undefined);
		const item = session.items.find((i) => i.target.id === targetId)!;
		const target = mapDef.targets.find((t) => t.id === targetId)!;
		// This name is resolved either way now (one miss reveals, FT-20), so
		// the tray draws a replacement for it.
		dealHand();
		// Keep the round in case the player steps out to the Overview and back
		// (quizRound.ts); the completion effect throws it away at the end.
		rememberRound(mapId, { session, hand });

		if (item.status === 'correct' || item.status === 'revealed') {
			const revealed = item.status === 'revealed';
			// Since v0.6.0 one miss ends that name's turn: the region that was
			// hit still flashes red, and then the name is shown where it really
			// belongs, so a mistake teaches the answer instead of buying two
			// more guesses (FT-20).
			if (revealed) flashWrongRegion(targetId, exactName);
			markSolved(targetId, name, target.centroid, revealed, target.type === 'city');
			// Every answer is graded, in every round (FT-26 - there are no
			// ungraded practice rounds any more): clean is "good", a name that
			// had to be shown is "again" (same-day repeat). "hard" (right, but
			// only after a wrong drop) can no longer happen in the quiz since one
			// miss reveals, but the scheduler still understands it. The review
			// date it writes is kept, just not shown anywhere - see
			// DECISIONS.md, "The scheduler keeps running, out of sight".
			const grade: Grade = revealed ? 'again' : item.errors === 0 ? 'good' : 'hard';
			const today = todayLocalDate();
			const previous = cardStatesByTargetId.get(targetId);
			const next = rate(previous, grade, today);
			cardStatesByTargetId.set(targetId, next);
			progressRepository
				.saveCardState(mapId, { targetId, ...next })
				.catch((e) => console.error('Failed to save quiz progress:', e));
		} else {
			flashWrongRegion(targetId, exactName);
		}
	}

	// The red flash on the region a wrong drop landed on, plus the slip's own
	// shake while it is still in the tray.
	function flashWrongRegion(targetId: string, exactName: string | undefined) {
		wrongFlashId = targetId;
		if (exactName && map) {
			map.setFeatureState(
				{ source: 'targets', sourceLayer: 'targets', id: exactName },
				{ quizWrong: true }
			);
		}
		const timer = setTimeout(() => {
			flashTimers.delete(timer);
			if (wrongFlashId === targetId) wrongFlashId = undefined;
			if (exactName && map) {
				map.setFeatureState(
					{ source: 'targets', sourceLayer: 'targets', id: exactName },
					{ quizWrong: false }
				);
			}
		}, WRONG_PAUSE_MS);
		flashTimers.add(timer);
	}

	// Drag the handle up to grow the tray (see more slips at once, e.g. on a
	// 100+-target map), down to shrink it (see more map). Deliberately a
	// separate pointer-capture gesture from the slip drag above - the handle
	// and the slips are different elements, so there's no conflict between
	// the two.
	function onTrayHandlePointerDown(e: PointerEvent) {
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		trayResizeStart = { clientY: e.clientY, height: trayHeightPx ?? trayMinPx };
	}

	function onTrayHandlePointerMove(e: PointerEvent) {
		if (!trayResizeStart) return;
		const deltaPx = trayResizeStart.clientY - e.clientY;
		trayHeightPx = Math.min(trayMaxPx, Math.max(trayMinPx, trayResizeStart.height + deltaPx));
	}

	function onTrayHandlePointerUp() {
		trayResizeStart = undefined;
	}

	const TRAY_KEY_STEP_PX = 32;

	function onTrayHandleKeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
			trayHeightPx = Math.min(trayMaxPx, (trayHeightPx ?? trayMinPx) + TRAY_KEY_STEP_PX);
			e.preventDefault();
		} else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
			trayHeightPx = Math.max(trayMinPx, (trayHeightPx ?? trayMinPx) - TRAY_KEY_STEP_PX);
			e.preventDefault();
		}
	}

	function clearAllVisuals() {
		// Before 'load' there are no visuals to clear, and setFeatureState
		// would throw - and "Play again", the only way in, can't be reached
		// before a round has been played on a loaded map anyway.
		if (!mapDef || !map || !styleLoaded) return;
		for (const target of mapDef.targets) {
			map.setFeatureState(
				{ source: 'targets', sourceLayer: 'targets', id: target.name },
				{ quizCorrect: false, quizRevealed: false, quizHover: false, quizWrong: false }
			);
		}
		for (const popup of solvedPopups.values()) popup.remove();
		solvedPopups.clear();
		told = undefined;
	}

	// Builds a round: the whole map, every time (FT-26). What changes from one
	// round to the next is how much the tray gives away (FT-21), which is
	// taken from the streaks the last round wrote.
	function startRound() {
		if (!mapDef || !map) return;
		knownAfterRound = undefined;
		scorePanelDismissed = false;
		summarySaved = false;
		forgetRound(mapId);
		session = createQuizSession(mapDef.targets.map((t) => ({ id: t.id, name: t.name })));
		refreshLevel(mapDef);
		hand = [];
		dealHand();
	}

	/** Picks a round back up where it was left, if the player only stepped out
	 * to the Overview and came back (quizRound.ts). Returns false if there was
	 * nothing to resume. */
	function resumeRound(): boolean {
		if (!mapDef || !map) return false;
		const round = roundInProgress(mapId);
		if (!round || isSessionComplete(round.session)) return false;
		knownAfterRound = undefined;
		scorePanelDismissed = false;
		summarySaved = false;
		session = round.session;
		refreshLevel(mapDef);
		hand = round.hand;
		dealHand();
		return true;
	}

	/** Paints the names already placed in a resumed round - the same marks a
	 * live drop leaves. Runs after the style loads, since it sets feature
	 * state. */
	function repaintResolved(def: MapDefinition) {
		if (!session) return;
		for (const item of session.items) {
			if (item.status === 'pending') continue;
			const target = def.targets.find((t) => t.id === item.target.id);
			if (!target) continue;
			markSolved(
				target.id,
				target.name,
				target.centroid,
				item.status === 'revealed',
				target.type === 'city'
			);
		}
	}

	/** The score panel's "Play again": the same map again, from a blank slate. */
	function playAgain() {
		clearAllVisuals();
		startRound();
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

	// A language switch has to reach the terrain names too (FT-53); the
	// helper reads getLanguage() so the subscription exists even on a map's
	// first open, when the labels are drawn after an await.
	followTerrainLanguage(() => terrain);
	onMount(() => {
		let cancelled = false;

		(async () => {
			// Reads what the scheduler knows, falling back to memory if the
			// native database cannot be opened - the round plays on, it just
			// will not be remembered (FT-57).
			const loaded = await loadPlayableCardStates(mapId);
			progressRepository = loaded.repository;
			cardStatesByTargetId = new Map(loaded.cardStates.map((c) => [c.targetId, c]));
			storageWarning = loaded.failed;

			const { mapDef: loadedMapDef, style } = await fetchMapDefAndStyle(mapId);
			if (cancelled) return;
			mapDef = loadedMapDef;

			({ map, terrain } = createMap(container, loadedMapDef, style));
			fetchFacts(mapId).then((loaded) => {
				if (!cancelled) facts = loaded;
			});
			// A round left half-played (the player went to look a name up in the
			// Overview) carries on; otherwise a new one over the whole map.
			const resumed = resumeRound();
			if (!resumed) startRound();

			// setFeatureState throws until the style has finished loading, so
			// anything that paints a region waits for the map's 'load' event.
			map.once('load', () => {
				if (cancelled) return;
				styleLoaded = true;
				if (resumed) repaintResolved(loadedMapDef);
			});
		})().catch((e) => {
			error = e instanceof Error ? e.message : String(e);
		});

		return () => {
			cancelled = true;
		};
	});

	onMount(() => {
		// Re-measure on resize/rotation: trayMinPx and trayMaxPx are derived
		// from the current viewport/layout, so they go stale otherwise (a
		// user's chosen trayHeightPx is clamped to the fresh bounds, not
		// reset - see measureTraySizing).
		window.addEventListener('resize', measureTraySizing);
		return () => window.removeEventListener('resize', measureTraySizing);
	});

	onDestroy(() => {
		// Clear pending flash resets before removing the map: a removed map is
		// still a truthy reference, so their `if (map)` guard would pass and
		// setFeatureState would throw on it.
		for (const timer of flashTimers) clearTimeout(timer);
		flashTimers.clear();
		map?.remove();
		map = undefined;
	});
</script>

<div class="quiz-view">
	{#if error}
		<p class="error">{error}</p>
	{:else}
		<MapNav {mapId} mapName={mapDisplayName(mapId) ?? mapDef?.name} active="quiz">
			{#snippet subtitle()}
				{#if session}
					<span data-tutorial="quiz-progress"
						>{t('quiz.subtitle', {
							placed: session.items.filter((i) => i.status !== 'pending').length,
							total: session.items.length
						})}</span
					>
					<!-- Only once the map is known well enough for the hand to
					     shrink (FT-21); level 0's hand of ten is the default and
					     there is nothing to explain (FT-60). -->
					{#if level > 0}
						<span class="level"
							>· {tPlural('quiz.namesAtATime', handSize(level), { count: handSize(level) })}</span
						>
					{/if}
				{/if}
			{/snippet}
		</MapNav>

		{#if storageWarning}
			<p class="storage-warning" role="status">{t('quiz.storageWarning')}</p>
		{/if}

		{#if complete && score && session && !scorePanelDismissed}
			{@const revealedCount = session.items.filter((i) => i.status === 'revealed').length}
			<div class="score-panel">
				<button
					class="score-panel-close"
					aria-label={t('quiz.closeAriaLabel')}
					onclick={() => (scorePanelDismissed = true)}
				>
					&times;
				</button>
				<h2>{t('quiz.done')}</h2>
				<p>
					<strong>{score.perfect}</strong>
					{t('quiz.scoreLineRest', { total: score.total })}
				</p>
				<p>{tPlural('quiz.totalMistakes', score.totalErrors, { count: score.totalErrors })}</p>
				{#if revealedCount > 0}
					<p class="revealed-note">
						{t('quiz.revealedNote', { count: revealedCount })}
					</p>
				{/if}
				<!-- What the round left behind (FT-26). The map list shows a bar
				     (FT-65); this panel keeps the number, because it records what
				     this round left behind rather than the map's standing. -->
				{#if knownAfterRound !== undefined && mapDef}
					<p class="known-note">
						{t('quiz.known', { known: knownAfterRound, total: mapDef.targets.length })}
						{#if level > 0}
							· {tPlural('quiz.namesAtATime', handSize(level), { count: handSize(level) })}
						{/if}
					</p>
				{/if}
				<div class="score-panel-actions">
					<a class="score-panel-button secondary" href={resolve('/')}>{t('quiz.backToMaps')}</a>
					<button onclick={playAgain}>{t('quiz.playAgain')}</button>
				</div>
			</div>
		{/if}
	{/if}

	<div class="container" bind:this={container}></div>

	<!-- Above the tray, whose height the player can drag (FT-35). Two clauses
	     rather than three: the map is already sharing this screen with a tray
	     full of names, and a paragraph here would be read by nobody. -->
	{#if told && !complete}
		<FactCard
			name={told.name}
			fact={facts[told.id]}
			origin={told.origin}
			extra={told.extra}
			bottom="calc({trayHeightPx ?? trayMinPx}px + 0.5rem)"
			onclose={() => (told = undefined)}
		/>
	{/if}

	{#if session}
		<div
			class="tray"
			data-map-overlay="bottom"
			bind:this={trayEl}
			style="height: {trayHeightPx ?? trayMinPx}px"
		>
			<div class="tray-handle-row" bind:this={trayHandleRowEl}>
				<div
					class="tray-handle"
					role="slider"
					tabindex="0"
					aria-label={t('quiz.resizeTrayAriaLabel')}
					aria-valuemin={Math.round(trayMinPx)}
					aria-valuemax={Math.round(trayMaxPx)}
					aria-valuenow={Math.round(trayHeightPx ?? trayMinPx)}
					onpointerdown={onTrayHandlePointerDown}
					onpointermove={onTrayHandlePointerMove}
					onpointerup={onTrayHandlePointerUp}
					onpointercancel={onTrayHandlePointerUp}
					onkeydown={onTrayHandleKeydown}
				></div>
			</div>
			<div class="tray-slips" bind:this={traySlipsEl}>
				{#each session.items.filter((i) => i.status === 'pending' && hand.includes(i.target.id)) as item (item.target.id)}
					{@const isDragging = dragging?.targetId === item.target.id}
					<button
						class="slip"
						data-tutorial="slip-{item.target.id}"
						class:slip-dragging={isDragging}
						class:wrong={wrongFlashId === item.target.id}
						style={isDragging && dragging ? `left: ${dragging.x}px; top: ${dragging.y}px;` : ''}
						onpointerdown={(e) => onSlipPointerDown(e, item.target.id, item.target.name)}
						onpointermove={onSlipPointerMove}
						onpointerup={onSlipPointerUp}
						onpointercancel={onSlipPointerCancel}
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
	.tray {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		z-index: 1;
		display: flex;
		flex-direction: column;
		box-sizing: border-box;
		overflow: hidden;
		background: rgba(255, 255, 255, 0.92);
		border-top: 1px solid rgba(0, 0, 0, 0.1);
	}
	/* The grab strip is 4px of paint; the row around it is what a finger
	   actually hits, so it is padded to about 22px (review F8, FT-32). Not
	   the full 44: the tray's own names start right below it and the map is
	   right above, so a taller invisible strip would take taps meant for
	   either. */
	.tray-handle-row {
		display: flex;
		justify-content: center;
		flex: none;
		padding: 0.55rem 0;
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
		/* Flex items default to min-height: auto, which for a wrapping flex
		   container resolves to the height needed to fit every row - that
		   silently overrides the explicit, smaller height the resize handle
		   sets on the tray, so shrinking below "fits everything" did
		   nothing. min-height: 0 is what actually lets it shrink and defer
		   to overflow-y: auto instead. */
		min-height: 0;
		display: flex;
		flex-wrap: wrap;
		align-content: flex-start;
		gap: 0.5rem;
		padding: 0 0.75rem 0.75rem;
		overflow-y: auto;
	}
	/* The difficulty note beside the progress line (FT-21). Quieter than the
	   count itself: it explains the tray, it isn't a score. */
	.level {
		margin-left: 0.3rem;
		color: rgba(30, 40, 36, 0.55);
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
		/* A tablet can read a press on text as a selection gesture and raise
		   the native copy UI, taking the pointer mid-drag (FT-61). The slip
		   is a control, not selectable text. */
		user-select: none;
		-webkit-user-select: none;
		-webkit-touch-callout: none;
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
	.score-panel button.score-panel-close {
		position: absolute;
		top: 0.4rem;
		right: 0.4rem;
		width: 1.75rem;
		height: 1.75rem;
		padding: 0;
		border-radius: 50%;
		background: transparent;
		color: rgba(0, 0, 0, 0.45);
		font-size: 1.3rem;
		line-height: 1;
		margin: 0;
	}
	.score-panel button.score-panel-close:hover {
		background: rgba(0, 0, 0, 0.06);
		color: rgba(0, 0, 0, 0.75);
	}
	.score-panel h2 {
		margin: 0 0 0.75rem;
	}
	.revealed-note {
		font-size: 0.85rem;
		color: #8a6d3b;
	}
	.known-note {
		font-size: 0.85rem;
		opacity: 0.7;
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
	.score-panel-button.secondary {
		background: transparent;
		color: #5a9c6f;
		border: 1px solid #5a9c6f;
	}
	.error {
		padding: 1rem;
		font-family: system-ui, sans-serif;
		color: #a33;
	}
	/* A round that cannot be saved is still worth playing: the notice sits
	   quietly at the top and does not take the map away (FT-57). */
	.storage-warning {
		position: absolute;
		top: 4.5rem;
		left: 50%;
		transform: translateX(-50%);
		z-index: 5;
		margin: 0;
		padding: 0.4rem 0.8rem;
		max-width: calc(100% - 2rem);
		font-family: system-ui, sans-serif;
		font-size: 0.85rem;
		text-align: center;
		color: #7a4a12;
		background: #fdf1dd;
		border: 1px solid rgba(181, 105, 31, 0.35);
		border-radius: 0.5rem;
	}
</style>
