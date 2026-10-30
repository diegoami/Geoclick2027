<script lang="ts">
	import { onMount, onDestroy, untrack } from 'svelte';
	import * as maplibregl from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import { fetchMapDefAndStyle, createMap } from './geoclickMap';
	import type { TerrainLayer } from './terrainLayer';
	import { followTerrainLanguage } from './terrainLanguage.svelte';
	import { terrainShown } from './mapPrefs.svelte';
	import { mapFitPadding } from './mapFit';
	import { resolveDrop } from './quizDrop';
	import { aimPoint, movedPastSlop } from './touchDrag';
	import { forgetLearned, partnersOf, recordConfusion } from './confusions';
	import { answerFeedback } from './feedback';
	import { choiceCount, choicesFor } from './nameIt';
	import { quizMode, setQuizMode } from './mapPrefs.svelte';
	import MapNav from './MapNav.svelte';
	import { getLanguage, t, tPlural } from './i18n.svelte';
	import { targetName } from './targetName';
	import { mapDisplayName } from './mapCatalog';
	import { tutorialDrop, tutorialQuizComplete, tutorialState } from './tutorial.svelte';
	import { tutorialSlipIds } from './tutorialMachine';
	import { TUTORIAL_MAP_ID } from './tutorialSandbox.svelte';
	import { DOT_CLEARANCE_PX, registerLabel } from './labelCollision';
	import { forgetRound, rememberRound, roundInProgress } from './quizRound';
	import FactCard from './FactCard.svelte';
	import ScorePanel from './ScorePanel.svelte';
	import { isNewBest, isTimedRound, roundChange, type RoundChange } from './roundReport';
	import { goto } from '$app/navigation';
	import { resolve } from '$lib/appPaths';
	import { setNameOverride } from './mapPrefs.svelte';
	import ChartMapShell from './ChartMapShell.svelte';
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
		type MapRecords,
		type ProgressRepository,
		type SessionSummary
	} from './progressRepository';
	import {
		KNOWN_CLEAN_STREAK,
		rate,
		type CardState as SchedulerState,
		type Grade
	} from '@geoclick/srs';
	import { StretchedNames } from './stretchedNames';

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
	let stretched: StretchedNames | undefined;
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
	// A press on a slip: where the pointer is and where it started, whether it
	// is a finger or pen (#261 - those aim a fingertip above), and whether it
	// has moved far enough to be a drag rather than a tap (#260).
	let dragging = $state<
		| {
				targetId: string;
				name: string;
				x: number;
				y: number;
				startX: number;
				startY: number;
				touch: boolean;
				moved: boolean;
		  }
		| undefined
	>(undefined);
	/** Where the dragged name would land: the pointer, or the pin above a finger. */
	const aim = $derived(
		dragging?.moved ? aimPoint(dragging.x, dragging.y, dragging.touch) : undefined
	);
	// Tap-to-place (#260): a slip pressed without moving is selected, and the
	// next tap on the map answers for it.
	let selectedId = $state<string | undefined>(undefined);
	// A drag ends with a click on the slip it started on; that click must not
	// select it as well. Reset on the next press in case the browser sends none.
	let suppressClick = false;
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
	// Which way the round asks (#264). In 'name' mode there is no hand: one
	// place is lit up (`asking`) and the tray offers a few names (`choices`).
	// The tutorial always teaches the drag, so it plays in 'place' mode.
	let mode = $state<'place' | 'name'>(quizMode());
	let asking = $state<string | undefined>(undefined);
	let choices = $state<string[]>([]);
	const inTutorialMap = () => tutorialState().status !== 'idle' && mapId === TUTORIAL_MAP_ID;
	const pendingIds = () =>
		session ? session.items.filter((i) => i.status === 'pending').map((i) => i.target.id) : [];

	/** Draw or top up the names on offer. Called when a session starts and
	 * after every resolved drop. While a tutorial runs, the slips it spotlights
	 * are dealt first, or "Try Sicilia" could point at an empty tray (FT-60). */
	function dealHand() {
		const inTutorial = tutorialState().status !== 'idle' && mapId === TUTORIAL_MAP_ID;
		// Outside the tutorial, a name the player has mixed up with one on offer
		// is dealt next to it (#266), so the two have to be told apart.
		const preferred = inTutorial
			? tutorialSlipIds()
			: partnersOf(records.confusions ?? [], [...hand, ...(lastAnswered ? [lastAnswered] : [])]);
		if (mode === 'name') {
			askNext(preferred);
			return;
		}
		hand = refillHand(pendingIds(), hand, handSize(level), Math.random, preferred);
	}

	/** Name-it mode (#264): lights up the next place and lays out its choices. */
	function askNext(preferred: readonly string[]) {
		const [next] = refillHand(pendingIds(), [], 1, Math.random, preferred);
		asking = next;
		choices = next && mapDef ? choicesFor(mapDef.targets, next, choiceCount(level)) : [];
		showAsked();
	}

	// A pulsing "?" on the place asked about. The hover blue alone sits too
	// close to the map's own blue and violet slots to be unmistakable, and a
	// town's dot is small; the marker works the same on both kinds of map.
	let askMarker: maplibregl.Marker | undefined;

	/** Lights up the place being asked about, and brings it into view if the
	 * map bar or the tray would hide it. */
	function showAsked() {
		askMarker?.remove();
		askMarker = undefined;
		if (!map || !styleLoaded || !container) return;
		const target = asking ? targetsById.get(asking) : undefined;
		setHover(target?.name);
		if (!target) return;
		const el = document.createElement('div');
		el.className = 'ask-marker';
		el.textContent = '?';
		el.setAttribute('aria-hidden', 'true');
		askMarker = new maplibregl.Marker({ element: el }).setLngLat(target.centroid).addTo(map);
		const at = map.project(target.centroid);
		const rect = container.getBoundingClientRect();
		const trayTop = rect.height - (trayHeightPx ?? trayMinPx);
		if (at.x < 0 || at.x > rect.width || at.y < 80 || at.y > trayTop)
			map.easeTo({ center: target.centroid, duration: 400 });
	}

	/** A name picked in Name-it mode. */
	function onChoice(id: string) {
		if (!asking || !mapDef || complete) return;
		const chosen = mapDef.targets.find((t) => t.id === id);
		resolveAnswer(asking, id === asking, id === asking ? undefined : chosen?.name);
	}

	/** Switches the quiz's direction; the round starts again in the new one. */
	function switchMode(next: 'place' | 'name') {
		if (next === mode || !mapDef) return;
		mode = next;
		setQuizMode(next);
		selectedId = undefined;
		asking = undefined;
		showAsked();
		clearAllVisuals();
		startRound(practice);
	}

	/** The map's level from the clean streaks of its targets; a target with no
	 * card state has never been placed right, so it counts as 0. Also counts
	 * the names a practice round would ask for (#265). */
	function refreshLevel(def: MapDefinition) {
		level = mapLevel(def.targets.map((t) => cardStatesByTargetId.get(t.id)?.cleanStreak ?? 0));
		practiseCount = notKnown(def).length;
	}

	// A practice round (#265) asks only for the names not yet known; the known
	// ones start out placed. The whole map stays the default round.
	let practice = $state(false);
	let practiseCount = $state(0);

	function notKnown(def: MapDefinition) {
		return def.targets.filter(
			(t) => (cardStatesByTargetId.get(t.id)?.cleanStreak ?? 0) < KNOWN_CLEAN_STREAK
		);
	}

	/** Whether a practice round is worth offering: some names known, some not. */
	const canPractise = $derived(
		!!mapDef && practiseCount > 0 && practiseCount < mapDef.targets.length
	);

	/** Writes the known names on the map at the start of a practice round, as
	 * if placed: they are not asked, but the map should still show them. */
	function paintKnown(def: MapDefinition) {
		if (!practice || !session) return;
		const asked = new Set(session.items.map((i) => i.target.id));
		for (const target of def.targets) {
			if (asked.has(target.id)) continue;
			markSolved(target.id, target.name, target.centroid, false, target.type === 'city');
		}
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
		trayMaxPx = Math.max(trayMinPx, window.innerHeight * TRAY_MAX_FRACTION);

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

	// Lifts the map's credit line above the tray, so it is not drawn over the
	// names (mapBottomOverlay.ts).
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

	// What a slip, a placed name and the card SHOW (#71): the name in the
	// player's language. Grading and feature state keep using the target's
	// own `name`, the key its tiles are joined on.
	const targetsById = $derived(new Map((mapDef?.targets ?? []).map((x) => [x.id, x])));
	function shownName(targetId: string, fallback: string): string {
		const target = targetsById.get(targetId);
		return target ? targetName(target) : fallback;
	}
	// A new language renames the names already placed.
	$effect(() => {
		getLanguage();
		untrack(() => {
			for (const [id, popup] of solvedPopups) {
				const shown = shownName(id, '');
				if (shown && popup.getElement()?.textContent !== shown) popup.setText(shown);
				const target = targetsById.get(id);
				if (shown && target?.spine && target.type !== 'city')
					stretched?.set(id, {
						name: shown,
						spine: target.spine,
						tier: solvedTiers.get(id) ?? 'known',
						popup
					});
			}
		});
	});
	// Counts up with every name placed, so the newest label outranks the ones
	// already on the map when they fight for the same spot.
	let labelPriority = 0;
	// The SVG labels have their own DOM, so preserve the answered vs revealed
	// distinction when a language change redraws them.
	// Plain Map: only read by an effect and clearAllVisuals, never the template.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const solvedTiers = new Map<string, 'known' | 'seen'>();

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
	// What the round changed (#259): every target's earned level as the round
	// started, and the difference once it is over. Plain, like
	// cardStatesByTargetId: only read when a round ends.
	let levelsAtStart = new Map<string, number>();
	let change = $state<RoundChange | undefined>(undefined);
	// The round before this one, read once on mount and then replaced by each
	// round as it ends; `panelLastTime` is what the open panel compares with.
	let lastTime: SessionSummary | undefined;
	let panelLastTime = $state<SessionSummary | undefined>(undefined);

	// This map's other records (best time #267, mix-ups #266), read on mount.
	let records: MapRecords = {};
	// The mix-ups of this round, for the score panel (#266), and the name just
	// answered, whose partner is dealt next.
	let roundConfusions = $state<{ targetId: string; chosenId: string }[]>([]);
	let lastAnswered: string | undefined;
	function saveRecords(next: MapRecords) {
		records = next;
		progressRepository
			.saveMapRecords(mapId, next)
			.catch((e) => console.error('Failed to save map records:', e));
	}

	// A round on a map whose every name is known is timed (#267). Only time
	// spent in the quiz counts: what a resumed round had played is carried in
	// `elapsedBefore`, and the clock restarts from `activeSince` on return.
	let timed = false;
	let elapsedBefore = 0;
	let activeSince = 0;
	let timeResult = $state<{ ms: number; bestMs?: number; newBest: boolean; clean: boolean }>();
	const elapsed = () => elapsedBefore + (performance.now() - activeSince);

	/** Every target's earned level right now. */
	function currentLevels(def: MapDefinition): Map<string, number> {
		return new Map(
			def.targets.map((t) => [t.id, cardStatesByTargetId.get(t.id)?.cleanStreak ?? 0])
		);
	}

	/** The names this round could not place, for the panel and "Study these". */
	const toWorkOn = $derived(
		session
			? session.items
					.filter((i) => i.status === 'revealed')
					.map((i) => ({ id: i.target.id, name: shownName(i.target.id, i.target.name) }))
			: []
	);

	/** Opens a name's fact card from the score panel. */
	function showFact(targetId: string) {
		const target = targetsById.get(targetId);
		if (!target) return;
		told = { id: targetId, name: target.name, ...placeFacts(mapId, targetId, facts[targetId]) };
	}

	/** "Study these": Known, with the names to work on chosen (FT-39's taps). */
	function studyMissed() {
		for (const item of toWorkOn) setNameOverride(mapId, item.id, 'shown');
		goto(resolve('/map/[mapId]', { mapId }));
	}

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
			const summary = { ...score, completedAt: new Date().toISOString() };
			progressRepository
				.saveLastSessionSummary(mapId, summary)
				.catch((e) => console.error('Failed to save quiz progress:', e));
			panelLastTime = lastTime;
			lastTime = summary;
			if (timed) {
				const ms = elapsed();
				const newBest = isNewBest(ms, score.totalErrors, records.bestTimeMs);
				if (newBest) saveRecords({ ...records, bestTimeMs: ms });
				timeResult = {
					ms,
					bestMs: records.bestTimeMs,
					newBest,
					clean: score.totalErrors === 0
				};
			}
			// The last drop's card would cover the panel; its names open it again.
			told = undefined;
			setHover(undefined);

			// What the round did to the map: how many names are known now, and
			// whether that moved the tray to a smaller hand (FT-21).
			if (mapDef) {
				knownAfterRound = knownCount(
					mapDef.targets.map((t) => cardStatesByTargetId.get(t.id)?.cleanStreak ?? 0)
				);
				const levels = currentLevels(mapDef);
				change = roundChange(
					mapDef.targets.map((t) => t.id),
					levelsAtStart,
					levels
				);
				// A pair whose names are both known now has been told apart, and
				// the start screen hears how many names slipped (#263).
				saveRecords({
					...records,
					confusions: forgetLearned(records.confusions ?? [], levels),
					slipped: change.slipped.length
				});
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
		suppressClick = false;
		dragging = {
			targetId,
			name,
			x: e.clientX,
			y: e.clientY,
			startX: e.clientX,
			startY: e.clientY,
			touch: e.pointerType !== 'mouse',
			moved: false
		};
	}

	function onSlipPointerMove(e: PointerEvent) {
		if (!dragging) return;
		const moved =
			dragging.moved || movedPastSlop(dragging.startX, dragging.startY, e.clientX, e.clientY);
		dragging = { ...dragging, x: e.clientX, y: e.clientY, moved };
		if (!moved) return;
		const at = aimPoint(e.clientX, e.clientY, dragging.touch);
		setHover(regionAtPoint(at.x, at.y));
	}

	/** A tap on a slip (or Enter on it) selects it; a second tap lets it go. */
	function onSlipClick(targetId: string) {
		if (suppressClick) {
			suppressClick = false;
			return;
		}
		selectedId = selectedId === targetId ? undefined : targetId;
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
			.setText(shownName(targetId, name))
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
		const target = mapDef?.targets.find((t) => t.id === targetId);
		const tier = revealed ? 'seen' : 'known';
		solvedTiers.set(targetId, tier);
		if (target?.spine && target.type !== 'city')
			stretched?.set(targetId, {
				name: shownName(targetId, name),
				spine: target.spine,
				tier,
				popup
			});

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
		// Measured here too: a quick flick can arrive with no move in between.
		if (!dragging.moved && !movedPastSlop(dragging.startX, dragging.startY, e.clientX, e.clientY)) {
			// A tap, not a drag: the click that follows selects the slip (#260).
			dragging = undefined;
			return;
		}
		suppressClick = true;
		const { targetId, name, touch } = dragging;
		const at = aimPoint(e.clientX, e.clientY, touch);
		setHover(undefined);
		dragging = undefined;
		if (!isOverMap(at.x, at.y) || isOverTray(at.x, at.y)) {
			// Dropped outside the map, or back over the tray - treat as
			// "changed my mind", not a wrong attempt: no error recorded, slip
			// just returns to the tray.
			return;
		}
		selectedId = undefined;
		answerAt(targetId, name, at.x, at.y);
	}

	/**
	 * Answers for one name at a point on the screen: the end of a drag, or a
	 * tap on the map with a slip selected (#260). Returns false when the point
	 * was no plausible guess (open sea, a gap), which records nothing.
	 */
	function answerAt(targetId: string, name: string, clientX: number, clientY: number): boolean {
		if (!map || !session || !mapDef) return false;
		const isPointMap = mapDef?.targets[0]?.type === 'city';
		const exactName = regionAtPoint(clientX, clientY);
		const tolerance = isPointMap ? POINT_DROP_TOLERANCE_PX : DROP_TOLERANCE_PX;
		const nearbyNames = regionsNear(clientX, clientY, tolerance);
		const closestName = isPointMap ? closestNameAmong(nearbyNames, clientX, clientY) : undefined;

		// The decision itself lives in quizDrop.ts (pure, unit-tested); this
		// component only does the hit-testing it needs.
		const { scored, correct: isCorrect } = resolveDrop({
			exactName,
			nearbyNames,
			draggedName: name,
			isPointMap,
			closestName
		});
		if (!scored) return false;
		resolveAnswer(targetId, isCorrect, exactName ?? closestName);
		return true;
	}

	/**
	 * One scored answer, from either direction: a drop or tap (`answerAt`), or
	 * a name picked in Name-it mode (#264). `wrongName` is the place the answer
	 * went to instead, if any: it flashes red and is remembered as a mix-up.
	 */
	function resolveAnswer(targetId: string, isCorrect: boolean, wrongName: string | undefined) {
		if (!session || !mapDef) return;
		// The tutorial's drop steps (FT-11) wait for a scored drop; does nothing
		// when no tutorial is running.
		tutorialDrop(isCorrect);
		answerFeedback(isCorrect);

		session = attemptMatch(session, targetId, isCorrect ? targetId : undefined);
		lastAnswered = targetId;
		if (!isCorrect) noteConfusion(targetId, wrongName);
		const item = session.items.find((i) => i.target.id === targetId)!;
		const target = mapDef.targets.find((t) => t.id === targetId)!;
		// This name is resolved either way now (one miss reveals, FT-20), so
		// the tray draws a replacement for it.
		dealHand();
		if (selectedId && !hand.includes(selectedId)) selectedId = undefined;
		// Keep the round in case the player steps out to the Overview and back
		// (quizRound.ts); the completion effect throws it away at the end.
		rememberRound(mapId, {
			session,
			hand,
			levelsAtStart: Object.fromEntries(levelsAtStart),
			practice,
			mode,
			elapsedMs: timed ? elapsed() : undefined,
			confusions: roundConfusions
		});

		if (item.status === 'correct' || item.status === 'revealed') {
			const revealed = item.status === 'revealed';
			// Since v0.6.0 one miss ends that name's turn: the region that was
			// hit still flashes red, and then the name is shown where it really
			// belongs, so a mistake teaches the answer instead of buying two
			// more guesses (FT-20).
			if (revealed) flashWrongRegion(targetId, wrongName);
			markSolved(targetId, target.name, target.centroid, revealed, target.type === 'city');
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
			flashWrongRegion(targetId, wrongName);
		}
	}

	/** Remembers that `targetId`'s name went to the place called `chosenName` (#266). */
	function noteConfusion(targetId: string, chosenName: string | undefined) {
		const chosen = chosenName && mapDef?.targets.find((t) => t.name === chosenName);
		if (!chosen || chosen.id === targetId) return;
		saveRecords({
			...records,
			confusions: recordConfusion(records.confusions ?? [], targetId, chosen.id)
		});
		if (!roundConfusions.some((c) => c.targetId === targetId && c.chosenId === chosen.id))
			roundConfusions = [...roundConfusions, { targetId, chosenId: chosen.id }];
	}

	/** A tap on the map with a slip selected answers for that slip (#260). */
	function onMapTap(e: maplibregl.MapMouseEvent) {
		if (!selectedId || !session || complete) return;
		const item = session.items.find((i) => i.target.id === selectedId && i.status === 'pending');
		if (!item) {
			selectedId = undefined;
			return;
		}
		const rect = container.getBoundingClientRect();
		if (answerAt(item.target.id, item.target.name, rect.left + e.point.x, rect.top + e.point.y)) {
			selectedId = undefined;
			setHover(undefined);
		}
	}

	/** With a slip selected, the region under the mouse lights up as in a drag. */
	function onMapHover(e: maplibregl.MapMouseEvent) {
		if (!selectedId || dragging) return;
		const rect = container.getBoundingClientRect();
		setHover(regionAtPoint(rect.left + e.point.x, rect.top + e.point.y));
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
		for (const [id, popup] of solvedPopups) {
			popup.remove();
			stretched?.delete(id);
		}
		solvedPopups.clear();
		solvedTiers.clear();
		told = undefined;
	}

	// Builds a round: the whole map by default (FT-26), or only the names not
	// yet known when the player asks for a practice round (#265). What changes
	// from one round to the next is how much the tray gives away (FT-21), which
	// is taken from the streaks the last round wrote.
	function startRound(practiceRound = false) {
		if (!mapDef || !map) return;
		knownAfterRound = undefined;
		change = undefined;
		scorePanelDismissed = false;
		summarySaved = false;
		forgetRound(mapId);
		levelsAtStart = currentLevels(mapDef);
		practice = practiceRound && canPractise;
		if (inTutorialMap()) mode = 'place';
		asking = undefined;
		timeResult = undefined;
		roundConfusions = [];
		lastAnswered = undefined;
		timed = !practice && isTimedRound([...levelsAtStart.keys()], levelsAtStart);
		elapsedBefore = 0;
		activeSince = performance.now();
		const asked = practice ? notKnown(mapDef) : mapDef.targets;
		session = createQuizSession(asked.map((t) => ({ id: t.id, name: t.name })));
		refreshLevel(mapDef);
		hand = [];
		dealHand();
		if (styleLoaded) paintKnown(mapDef);
	}

	/** Picks a round back up where it was left, if the player only stepped out
	 * to the Overview and came back (quizRound.ts). Returns false if there was
	 * nothing to resume. */
	function resumeRound(): boolean {
		if (!mapDef || !map) return false;
		const round = roundInProgress(mapId);
		if (!round || isSessionComplete(round.session)) return false;
		knownAfterRound = undefined;
		change = undefined;
		scorePanelDismissed = false;
		summarySaved = false;
		levelsAtStart = round.levelsAtStart
			? new Map(Object.entries(round.levelsAtStart))
			: currentLevels(mapDef);
		session = round.session;
		practice = round.practice ?? false;
		mode = inTutorialMap() ? 'place' : (round.mode ?? 'place');
		asking = undefined;
		timeResult = undefined;
		// A trip to the Overview keeps the round's mix-ups, as it keeps its answers (#276).
		roundConfusions = round.confusions ?? [];
		lastAnswered = undefined;
		timed = !practice && isTimedRound([...levelsAtStart.keys()], levelsAtStart);
		elapsedBefore = round.elapsedMs ?? 0;
		activeSince = performance.now();
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

	/** "Practise the N not yet known" (#265), from the quiz or its score panel. */
	function practise() {
		clearAllVisuals();
		startRound(true);
	}

	/** Whether the round has not been touched yet, so switching it costs nothing. */
	const roundFresh = $derived(!!session && session.items.every((i) => i.status === 'pending'));

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
			lastTime = await progressRepository.getLastSessionSummary(mapId).catch(() => undefined);
			records = await progressRepository.getMapRecords(mapId).catch(() => ({}));

			const { mapDef: loadedMapDef, style } = await fetchMapDefAndStyle(mapId);
			if (cancelled) return;
			mapDef = loadedMapDef;

			({ map, terrain } = createMap(container, loadedMapDef, style));
			if (loadedMapDef.targets.some((target) => target.spine && target.type !== 'city'))
				stretched = new StretchedNames(map);
			// MapLibre sends 'click' only for a tap that did not pan the map.
			map.on('click', onMapTap);
			map.on('mousemove', onMapHover);
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
				showAsked();
				if (resumed) {
					repaintResolved(loadedMapDef);
					paintKnown(loadedMapDef);
				}
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
		window.addEventListener('geoclick:appearancechange', measureTraySizing);
		return () => {
			window.removeEventListener('resize', measureTraySizing);
			window.removeEventListener('geoclick:appearancechange', measureTraySizing);
		};
	});

	onDestroy(() => {
		// A timed round left half-played keeps the time played so far (#267).
		const round = timed ? roundInProgress(mapId) : undefined;
		if (round && session && !isSessionComplete(session))
			rememberRound(mapId, { ...round, elapsedMs: elapsed() });
		// Clear pending flash resets before removing the map: a removed map is
		// still a truthy reference, so their `if (map)` guard would pass and
		// setFeatureState would throw on it.
		for (const timer of flashTimers) clearTimeout(timer);
		flashTimers.clear();
		askMarker?.remove();
		stretched?.destroy();
		map?.remove();
		map = undefined;
	});
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.target instanceof Element && e.target.closest('dialog[open]')) return;
		if (e.key === 'Escape') selectedId = undefined;
		// Name-it mode is played from the keyboard too: 1-6 pick a name (#264).
		if (mode === 'name' && /^[1-9]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
			const id = choices[Number(e.key) - 1];
			if (id) onChoice(id);
		}
	}}
/>

<div class="quiz-view" data-map-fit-root>
	{#if error}
		<p class="error">{error}</p>
	{:else}
		<MapNav {mapId} mapName={mapDisplayName(mapId) ?? mapDef?.name} active="quiz">
			{#snippet controls()}
				{#if session}
					<div class="quiz-controls" data-testid="quiz-controls">
						{#if practice}<span class="practice-label">{t('quiz.practiceLabel')} ·</span>{/if}
						{#if !inTutorialMap()}
							<span class="mode-switch" role="group" aria-label={t('quiz.modeAria')}>
								<button
									type="button"
									aria-pressed={mode === 'place'}
									data-testid="mode-place"
									onclick={() => switchMode('place')}>{t('quiz.modePlace')}</button
								><button
									type="button"
									aria-pressed={mode === 'name'}
									data-testid="mode-name"
									onclick={() => switchMode('name')}>{t('quiz.modeName')}</button
								>
							</span>
						{/if}
						{#if canPractise && !practice && roundFresh}
							<button type="button" class="practise-btn" data-testid="practise" onclick={practise}
								>{t('quiz.practise', { count: practiseCount })}</button
							>
						{/if}
					</div>
				{/if}
			{/snippet}
		</MapNav>

		{#if storageWarning}
			<p class="storage-warning" role="status">{t('quiz.storageWarning')}</p>
		{/if}

		{#if complete && score && session && !scorePanelDismissed}
			<ScorePanel
				perfect={score.perfect}
				total={score.total}
				totalErrors={score.totalErrors}
				revealedCount={toWorkOn.length}
				knownLine={knownAfterRound !== undefined && mapDef
					? t('quiz.known', { known: knownAfterRound, total: mapDef.targets.length }) +
						(level > 0
							? ` · ${tPlural('quiz.namesAtATime', handSize(level), { count: handSize(level) })}`
							: '')
					: undefined}
				lastTime={panelLastTime}
				newlyKnown={(change?.newlyKnown ?? []).map((id) => ({ id, name: shownName(id, id) }))}
				{toWorkOn}
				slippedCount={change?.slipped.length ?? 0}
				onclose={() => (scorePanelDismissed = true)}
				onfact={showFact}
				onstudy={studyMissed}
				practiseCount={canPractise ? practiseCount : 0}
				time={timeResult}
				confusions={roundConfusions.map((c) => ({
					a: shownName(c.targetId, c.targetId),
					b: shownName(c.chosenId, c.chosenId)
				}))}
				onpractise={practise}
			/>
		{/if}
	{/if}
	{#if complete && scorePanelDismissed}
		<div class="map-again" style="bottom: calc({trayHeightPx ?? trayMinPx}px + 1rem)">
			<button onclick={playAgain}>{t('quiz.playAgain')}</button>
			{#if canPractise}
				<button onclick={practise}>{t('quiz.practise', { count: practiseCount })}</button>
			{/if}
		</div>
	{/if}

	<ChartMapShell>
		<div class="container" data-tutorial="quiz-progress" bind:this={container}></div>
	</ChartMapShell>

	<!-- Above the tray, whose height the player can drag (FT-35). Two clauses
	     rather than three: the map is already sharing this screen with a tray
	     full of names, and a paragraph here would be read by nobody. -->
	{#if told}
		<FactCard
			name={shownName(told.id, told.name)}
			fact={facts[told.id]}
			origin={told.origin}
			extra={told.extra}
			bottom="calc({trayHeightPx ?? trayMinPx}px + 0.5rem)"
			onclose={() => (told = undefined)}
		/>
	{/if}

	{#if dragging?.touch && aim}
		<!-- Where a finger's drag lands (#261): a fingertip above the finger. -->
		<div class="drop-pin" style="left: {aim.x}px; top: {aim.y}px" aria-hidden="true"></div>
	{/if}
	{#if selectedId && !complete}
		<p class="tap-hint" role="status" style="bottom: calc({trayHeightPx ?? trayMinPx}px + 0.5rem)">
			{t('quiz.tapPlace')}
		</p>
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
			<!-- A tap on the tray's own background lets a selected slip go (#260);
			     Escape does the same from the keyboard. -->
			<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
			<div
				class="tray-slips"
				bind:this={traySlipsEl}
				onclick={(e) => {
					if (e.target === e.currentTarget) selectedId = undefined;
				}}
			>
				{#if mode === 'name'}
					{#each choices as id, i (id)}
						<button
							type="button"
							class="slip choice"
							data-testid="choice"
							onclick={() => onChoice(id)}
							><span class="choice-key" aria-hidden="true">{i + 1}</span>
							{shownName(id, id)}</button
						>
					{/each}
				{/if}
				{#each mode === 'name' ? [] : session.items.filter((i) => i.status === 'pending' && hand.includes(i.target.id)) as item (item.target.id)}
					{@const isDragging = dragging?.targetId === item.target.id && !!aim}
					<button
						class="slip"
						draggable="false"
						data-tutorial="slip-{item.target.id}"
						class:slip-dragging={isDragging}
						class:slip-lifted={isDragging && dragging?.touch}
						class:selected={selectedId === item.target.id}
						class:wrong={wrongFlashId === item.target.id}
						aria-pressed={selectedId === item.target.id}
						style={isDragging && aim ? `left: ${aim.x}px; top: ${aim.y}px;` : ''}
						onclick={() => onSlipClick(item.target.id)}
						onpointerdown={(e) => onSlipPointerDown(e, item.target.id, item.target.name)}
						onpointermove={onSlipPointerMove}
						onpointerup={onSlipPointerUp}
						onpointercancel={onSlipPointerCancel}
						ondragstart={(e) => e.preventDefault()}
					>
						{shownName(item.target.id, item.target.name)}
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
		background: var(--gc-surface, rgba(255, 255, 255, 0.92));
		border-top: 1px solid var(--gc-border, rgba(0, 0, 0, 0.1));
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
		background: var(--gc-hover, rgba(0, 0, 0, 0.22));
		cursor: ns-resize;
		touch-action: none;
	}
	.tray-handle-row:hover .tray-handle {
		background: var(--gc-hover, rgba(0, 0, 0, 0.35));
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
		padding: 0 8px 8px;
		overflow-y: auto;
	}
	.slip {
		min-height: 28px;
		max-width: 100%;
		overflow-wrap: anywhere;
		box-sizing: border-box;
		color: var(--gc-text, #1c2b22);
		font-family: system-ui, sans-serif;
		font-size: 0.9rem;
		font-weight: 600;
		background: var(--gc-surface, white);
		border: 1px solid var(--gc-border, rgba(0, 0, 0, 0.15));
		border-radius: 0.5rem;
		padding: 2px 0.7rem;
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
		background: var(--gc-danger-soft, #f6d7d3);
		border-color: var(--gc-danger-strong, #c0392b);
		border-width: 2px;
		color: var(--gc-danger, #a3271b);
	}
	.slip-dragging {
		position: fixed;
		transform: translate(-50%, -50%);
		z-index: 10;
		cursor: grabbing;
		pointer-events: auto;
	}
	/* A finger's drag (#261): the name sits just above the pin, which is the
	   point that counts, so neither is under the finger. */
	.slip-dragging.slip-lifted {
		transform: translate(-50%, calc(-100% - 10px));
	}
	.drop-pin {
		position: fixed;
		z-index: 11;
		width: 12px;
		height: 12px;
		box-sizing: border-box;
		border: 3px solid var(--gc-accent, #b5691f);
		border-radius: 50%;
		background: var(--gc-surface, rgba(255, 255, 255, 0.85));
		transform: translate(-50%, -50%);
		pointer-events: none;
	}
	/* Tap-to-place (#260): the slip waiting for a tap on the map. */
	.slip.selected {
		border-color: var(--gc-accent, #b5691f);
		box-shadow:
			0 0 0 2px var(--gc-accent-soft, rgba(181, 105, 31, 0.45)),
			0 3px 8px rgba(0, 0, 0, 0.15);
		transform: translateY(-2px);
	}
	.tap-hint {
		position: absolute;
		left: 50%;
		z-index: 2;
		transform: translateX(-50%);
		margin: 0;
		padding: 0.3rem 0.7rem;
		border-radius: 0.5rem;
		background: var(--gc-label-bg, rgba(31, 61, 42, 0.88));
		color: var(--gc-on-strong, #ffffff);
		font-family: system-ui, sans-serif;
		font-size: 0.85rem;
		pointer-events: none;
		max-width: calc(100% - 1rem);
		box-sizing: border-box;
		text-align: center;
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
	.map-again button {
		font-family: inherit;
		font-size: 0.9rem;
		font-weight: 600;
		padding: 0.5rem 1rem;
		border-radius: 0.5rem;
		border: none;
		background: var(--gc-success-strong, #5a9c6f);
		color: var(--gc-on-strong, white);
		text-decoration: none;
		cursor: pointer;
	}
	/* The quiz's second way to play (#265), quiet beside the progress line. */
	.practise-btn {
		margin-left: 0;
		padding: 2px 0.4rem;
		border: 1px solid var(--gc-accent, rgba(181, 105, 31, 0.45));
		border-radius: 5px;
		background: var(--gc-surface, #ffffff);
		color: var(--gc-accent, #b5691f);
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}
	/* The place Name places asks about (#264). Global: MapLibre owns the
	   marker's element, outside this component's scoped markup. */
	:global(.ask-marker) {
		display: grid;
		place-items: center;
		width: 1.6rem;
		height: 1.6rem;
		border: 2px solid var(--gc-surface, #ffffff);
		border-radius: 50%;
		background: var(--gc-accent, #b5691f);
		color: var(--gc-on-strong, #ffffff);
		font-family: system-ui, sans-serif;
		font-weight: 700;
		box-shadow: 0 0 0 0 var(--gc-accent-soft, rgba(181, 105, 31, 0.6));
		animation: ask-pulse 1.6s ease-out infinite;
		pointer-events: none;
	}
	@keyframes ask-pulse {
		to {
			box-shadow: 0 0 0 14px rgba(181, 105, 31, 0);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		:global(.ask-marker) {
			animation: none;
		}
	}
	/* Which way the quiz asks (#264): two small joined pills. */
	.quiz-controls {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 4px;
		max-width: 100%;
		font-family: system-ui, sans-serif;
		font-size: 0.75rem;
	}
	.mode-switch {
		display: inline-flex;
		margin-left: 0;
		vertical-align: middle;
	}
	.mode-switch button {
		padding: 2px 0.45rem;
		border: 1px solid var(--gc-accent, rgba(181, 105, 31, 0.45));
		background: var(--gc-surface, #ffffff);
		color: var(--gc-accent, #b5691f);
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}
	.mode-switch button:first-child {
		border-radius: 5px 0 0 5px;
	}
	.mode-switch button:last-child {
		border-left: none;
		border-radius: 0 5px 5px 0;
	}
	.mode-switch button[aria-pressed='true'] {
		background: var(--gc-accent, #b5691f);
		color: var(--gc-on-strong, #ffffff);
	}
	.slip.choice {
		cursor: pointer;
	}
	/* The number key that picks it. */
	.choice-key {
		display: inline-block;
		min-width: 1.1em;
		margin-right: 0.3rem;
		border-radius: 3px;
		background: var(--gc-hover, rgba(0, 0, 0, 0.07));
		color: var(--gc-muted, rgba(0, 0, 0, 0.5));
		font-size: 0.75rem;
		text-align: center;
	}
	.practice-label {
		margin-right: 0.3rem;
		font-weight: 600;
		color: var(--gc-accent, #b5691f);
	}
	.map-again {
		flex-wrap: wrap;
		max-width: calc(100% - 1rem);
		justify-content: center;
		position: absolute;
		left: 50%;
		transform: translateX(-50%);
		z-index: 2;
		display: flex;
		gap: 0.5rem;
	}
	.error {
		position: relative;
		z-index: 2;
		padding: 1rem;
		font-family: system-ui, sans-serif;
		color: var(--gc-danger, #a33);
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
		color: var(--gc-warning, #7a4a12);
		background: var(--gc-warning-soft, #fdf1dd);
		border: 1px solid var(--gc-accent, rgba(181, 105, 31, 0.35));
		border-radius: 0.5rem;
	}
</style>
