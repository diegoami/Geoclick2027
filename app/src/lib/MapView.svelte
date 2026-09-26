<script lang="ts">
	import { onMount, onDestroy, untrack } from 'svelte';
	import * as maplibregl from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import { fetchMapDefAndStyle, createMap } from './geoclickMap';
	import type { TerrainLayer } from './terrainLayer';
	import { followTerrainLanguage } from './terrainLanguage.svelte';
	import { terrainShown } from './mapPrefs.svelte';
	import MapNav from './MapNav.svelte';
	import type { MapDefinition } from './mapDefinition';
	import { mapDisplayName } from './mapCatalog';
	import { getLanguage, t } from './i18n.svelte';
	import { targetName } from './targetName';
	import { createProgressRepository } from './progressRepository';
	import { tapOverride, visibleTier } from './shownNames';
	import {
		clearNameOverrides,
		hasNameOverrides,
		nameOverride,
		setNameOverride
	} from './mapPrefs.svelte';
	import { tutorialExploreReveal } from './tutorial.svelte';
	import { DOT_CLEARANCE_PX, FOCUSED_CLASS, areaShares, registerLabel } from './labelCollision';
	import FactCard from './FactCard.svelte';
	import { fetchFacts, placeFacts, type Facts } from './facts';
	import { StretchedNames } from './stretchedNames';
	import { publishBottomOverlay } from './mapBottomOverlay';

	let { mapId }: { mapId: string } = $props();

	let container: HTMLDivElement;
	let map: maplibregl.Map | undefined;
	// Region names drawn along the region where they fit (FT-66).
	let stretched: StretchedNames | undefined;
	// Sea, rivers and named terrain (FT-33). The $effect below follows the
	// map bar's Terrain button, which only writes the preference.
	let terrain = $state<TerrainLayer | undefined>(undefined);
	let mapDef = $state<MapDefinition | undefined>(undefined);
	let error = $state<string | undefined>(undefined);
	let selectedFeatureId: number | string | undefined;
	// The fact box (FT-35), on the click that already reveals the name.
	let facts = $state<Facts>({});
	let asked = $state<{ id: string; name: string; origin?: string; extra?: string } | undefined>(
		undefined
	);

	// This is the map the player builds (FT-39, docs/PLAN_V0.9.md), and the
	// screen a map now opens on. Two things put a name on it: the clean
	// streak the quiz keeps (FT-22 - a name placed right at least once, drawn
	// as strongly as it is known), and a tap, which overrides that either way
	// and sticks for the session (#11). shownNames.ts holds the whole
	// rule; this component only draws what it is told.
	//
	// Plain Map, not SvelteMap: imperative bookkeeping for popup cleanup,
	// never read in the template (same reasoning as QuizView's solvedPopups).
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const shownPopups = new Map<string, maplibregl.Popup>();
	/** Clean streak per target, read once when the view opens. */
	let streaks = $state<Record<string, number>>({});
	/** Whether anything is drawn, i.e. whether the legend has work to do. */
	let anyShown = $state(false);

	// How the strengths rank when two names want the same spot (FT-23): a
	// name you know beats one you half know, and one you asked for outright
	// beats both - you asked for it. Between equals the bigger region wins
	// (its area share is below 1, so it only breaks ties).
	const TIER_RANK = { asked: 3, known: 2, nearly: 1, seen: 0 } as const;

	/** Draws every name that should be on the map, and removes the rest. */
	function redrawNames(def: MapDefinition) {
		if (!map) return;
		const shares = areaShares(def.targets);
		let drawn = false;
		for (const target of def.targets) {
			const tier = visibleTier(streaks[target.id] ?? 0, nameOverride(mapId, target.id));
			const existing = shownPopups.get(target.id);
			if (!tier) {
				stretched?.delete(target.id);
				existing?.remove();
				shownPopups.delete(target.id);
				continue;
			}
			drawn = true;
			// Reuse the popup if it is already there: removing and recreating
			// it on every redraw would make the collision pass re-measure the
			// whole map for one tap.
			const popup =
				existing ??
				new maplibregl.Popup({
					closeButton: false,
					closeOnClick: false,
					anchor: 'center'
				})
					.setLngLat(target.centroid)
					.setText(targetName(target))
					.addTo(map);
			// The language changed since it was drawn (#71): setText replaces the
			// content element, so its focus mark is set again.
			const shown = targetName(target);
			if (existing && existing.getElement()?.textContent !== shown) {
				existing.setText(shown);
				markFocused(existing, target.id === untrack(() => asked?.id));
			}
			popup.addClassName('geoclick-solved-popup');
			popup.addClassName('geoclick-retention');
			// A region's name is set like its stretched one, in the atlas's
			// type (#34); a town keeps the pill beside its dot (FT-24).
			if (target.type !== 'city') popup.addClassName('geoclick-region-name');
			for (const t of ['known', 'nearly', 'seen', 'asked']) {
				if (t === tier) popup.addClassName(`retention-${t}`);
				else popup.removeClassName(`retention-${t}`);
			}
			registerLabel(popup, {
				priority: TIER_RANK[tier] + (shares.get(target.id) ?? 0),
				beside: target.type === 'city' ? DOT_CLEARANCE_PX : undefined
			});
			shownPopups.set(target.id, popup);
			// Along the region where it fits; the popup is its fallback (FT-66).
			if (target.spine)
				stretched?.set(target.id, { name: shown, spine: target.spine, tier, popup });
		}
		anyShown = drawn;
	}

	// The name whose fact card is open always shows: a tap asked for it,
	// so the collision pass may not hide it behind a stretched neighbour. When
	// the card closes, it competes like any other name again.
	$effect(() => {
		const focused = asked?.id;
		for (const [id, popup] of shownPopups) markFocused(popup, id === focused);
	});

	/**
	 * Whether this map has any choice worth undoing. Read reactively so the
	 * button appears on the first tap and goes again when it is used.
	 */
	const showsClear = $derived(hasNameOverrides(mapId));

	// The legend sits in the bottom-left corner, where the version badge is:
	// it lifts the badge and the credit line above it, as the Quiz's tray
	// does (mapBottomOverlay.ts).
	let legendEl = $state<HTMLDivElement>();
	$effect(() => {
		if (legendEl) return publishBottomOverlay(legendEl);
	});

	function markFocused(popup: maplibregl.Popup, focused: boolean) {
		popup
			.getElement()
			?.querySelector('.maplibregl-popup-content')
			?.classList.toggle(FOCUSED_CLASS, focused);
	}

	// A new language renames what is on the map (#71).
	$effect(() => {
		getLanguage();
		untrack(() => {
			if (mapDef) redrawNames(mapDef);
		});
	});

	// The open card's name follows the language too.
	const askedName = $derived.by(() => {
		const target = asked && mapDef?.targets.find((x) => x.id === asked?.id);
		return target ? targetName(target) : asked?.name;
	});

	/** Back to plain: the map shows what is known and nothing else. */
	function clearChosen() {
		clearNameOverrides(mapId);
		if (mapDef) redrawNames(mapDef);
		asked = undefined;
	}

	/** Reads what the player has earned, then draws the map. */
	async function loadStreaks(def: MapDefinition) {
		const repository = await createProgressRepository();
		const states = await repository.getCardStates(mapId);
		streaks = Object.fromEntries(states.map((c) => [c.targetId, c.cleanStreak]));
		redrawNames(def);
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
			const { mapDef: loadedMapDef, style } = await fetchMapDefAndStyle(mapId);
			if (cancelled) return;
			mapDef = loadedMapDef;

			({ map, terrain } = createMap(container, loadedMapDef, style));
			stretched = new StretchedNames(map);
			loadStreaks(loadedMapDef).catch((e) =>
				console.error('Failed to read progress for the Known map:', e)
			);
			fetchFacts(mapId).then((loaded) => {
				if (!cancelled) facts = loaded;
			});

			// Bound to the polygon layer (targets-fill) and to the point
			// maps' invisible HIT layer (targets-hit), not to the dot itself -
			// the dot is 9 px in radius and a finger needs about 22 (FT-46).
			// A given map's tileset only ever has features for one of the two,
			// so binding both is a harmless no-op for whichever does not
			// apply. Never bind targets-circle as well: targets-hit covers it
			// completely, so a tap would fire twice and undo itself. See
			// MAPS.md's "Point-target design" section.
			for (const layerId of ['targets-fill', 'targets-hit']) {
				// A tap turns a name on, or off if it is already there (FT-39).
				// The name stays until it is tapped again, so what is on the
				// map is the set the player has chosen to study.
				map.on('click', layerId, (e: maplibregl.MapLayerMouseEvent) => {
					const feature = e.features?.[0];
					if (!feature) return;
					const name = feature.properties?.name as string;
					const target = loadedMapDef.targets.find((t) => t.name === name);
					if (!target) return;

					const streak = streaks[target.id] ?? 0;
					const next = tapOverride(streak, nameOverride(mapId, target.id));
					setNameOverride(mapId, target.id, next);
					redrawNames(loadedMapDef);

					// Which place the map is pointing at, so a tap has an answer
					// even when it hid the name.
					if (selectedFeatureId !== undefined) {
						map!.setFeatureState(
							{ source: 'targets', sourceLayer: 'targets', id: selectedFeatureId },
							{ highlighted: false }
						);
					}
					selectedFeatureId = next === 'shown' ? feature.id : undefined;
					if (selectedFeatureId !== undefined) {
						map!.setFeatureState(
							{ source: 'targets', sourceLayer: 'targets', id: feature.id! },
							{ highlighted: true }
						);
					}

					// The fact card opens when a tap REVEALS a name and not when
					// it puts one away (decision 4): you are not asking about a
					// place you are hiding.
					asked =
						next === 'shown'
							? {
									id: target.id,
									name: target.name,
									...placeFacts(mapId, target.id, facts[target.id])
								}
							: undefined;
					// The tutorial's step (FT-11) moves on once a name shows.
					if (next === 'shown') tutorialExploreReveal();
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
		stretched?.destroy();
		for (const p of shownPopups.values()) p.remove();
		shownPopups.clear();
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
	{#if asked}
		<FactCard
			name={askedName ?? asked.name}
			fact={facts[asked.id]}
			origin={asked.origin}
			extra={asked.extra}
			bottom={anyShown ? '3.5rem' : '0.75rem'}
			onclose={() => (asked = undefined)}
		/>
	{/if}
	<!-- What the strengths mean, and a way back to plain (FT-39). The Clear
	     button only appears once there is something to clear. -->
	{#if anyShown || showsClear}
		<div class="legend" bind:this={legendEl}>
			{#if anyShown}
				<span class="swatch retention-asked">{t('known.chosen')}</span>
				<span class="swatch retention-known">{t('retention.known')}</span>
				<span class="swatch retention-nearly">{t('retention.nearly')}</span>
				<span class="swatch retention-seen">{t('retention.seen')}</span>
			{/if}
			{#if showsClear}
				<button type="button" class="clear-btn" data-testid="clear-names" onclick={clearChosen}>
					{t('known.clear')}
				</button>
			{/if}
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
	.swatch.retention-asked {
		background: rgba(181, 105, 31, 0.9);
	}
	.swatch.retention-nearly {
		font-size: 0.75rem;
		opacity: 0.72;
	}
	/* Back to plain (FT-39). Sits in the legend because that is where the
	   map explains itself, and it only renders when there is something to
	   undo. */
	.clear-btn {
		padding: 1px 8px;
		border: 1px solid rgba(181, 105, 31, 0.45);
		border-radius: 5px;
		background: #ffffff;
		color: #b5691f;
		font-family: inherit;
		font-size: 0.75rem;
		font-weight: 600;
		white-space: nowrap;
		cursor: pointer;
	}
	.clear-btn:hover {
		background: #fbf4ec;
	}
	.clear-btn:focus-visible {
		outline: 2px solid #b5691f;
		outline-offset: 1px;
	}
	.swatch.retention-seen {
		font-size: 0.7rem;
		opacity: 0.45;
	}
</style>
