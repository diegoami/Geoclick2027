<script lang="ts">
	import { onMount } from 'svelte';
	// One row per country or continent (FT-78, #58): its name, how well its
	// maps are known, a listbox to choose a map type, and a button that opens it.
	// The same rows in the start screen's panel and in the list, so both read
	// alike. Germany's fourteen maps are one row.
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { rowNameOf } from './catalogSections';
	import { groupProgress, type Mastery } from './homeProgress';
	import KnownProgress from './KnownProgress.svelte';
	import { pickerIdOf } from './mapCatalog';
	import { mapTypeSelectionOf, rememberMapTypeSelection } from './mapPrefs.svelte';
	import { t } from './i18n.svelte';

	interface Row {
		country: string;
		pickerId?: string;
		maps: { id: string; label: string }[];
	}

	let {
		groups,
		masteries,
		targetCount,
		highlight,
		tutorialMapId
	}: {
		groups: Row[];
		masteries: Record<string, Mastery | undefined>;
		targetCount: (mapId: string) => number;
		/** The country or continent to mark, by its picker id. */
		highlight?: string;
		/** The tutorial's map: its row carries the tutorial's anchor. */
		tutorialMapId?: string;
	} = $props();

	// A continent's row, and a country's, read in the player's language
	// (FT-84): the picker's `names` for a country, the catalog's English
	// where it has none.
	const nameOf = rowNameOf;

	let selections = $state<Record<string, string>>({});

	function selectedMap(group: Row): string {
		const key = pickerIdOf(group);
		return selections[key] ?? group.maps[0]?.id ?? '';
	}

	function chooseMapType(group: Row, mapId: string) {
		const key = pickerIdOf(group);
		selections = { ...selections, [key]: mapId };
		rememberMapTypeSelection(key, mapId);
	}

	function openSelectedMap(group: Row) {
		const mapId = selectedMap(group);
		if (mapId) goto(resolve('/map/[mapId]', { mapId }));
	}

	onMount(() => {
		selections = Object.fromEntries(
			groups
				.map((group) => {
					const key = pickerIdOf(group);
					return [
						key,
						mapTypeSelectionOf(
							key,
							group.maps.map((map) => map.id)
						)
					];
				})
				.filter((entry): entry is [string, string] => typeof entry[1] === 'string')
		);
	});
</script>

<ul class="rows">
	{#each groups as group (group.country)}
		{@const selectId = `maps-${group.maps[0].id}`}
		{@const progress = groupProgress(
			group.maps.map((m) => m.id),
			masteries,
			targetCount
		)}
		<!-- The tutorial's first step points at its map's row (docs/TUTORIAL.md). -->
		<li
			class="row"
			class:highlight={highlight === pickerIdOf(group)}
			data-picker-id={pickerIdOf(group)}
			data-tutorial={tutorialMapId && group.maps.some((m) => m.id === tutorialMapId)
				? 'home-map-card'
				: undefined}
		>
			<button class="name" type="button" onclick={() => openSelectedMap(group)}>
				{nameOf(group)}
			</button>
			{#if progress}
				<span class="progress">
					<KnownProgress
						known={progress.known}
						total={progress.total}
						allKnown={progress.known === progress.total}
					/>
				</span>
			{/if}
			<select
				id={selectId}
				value={selectedMap(group)}
				aria-label={t('home.mapTypeFor', { name: nameOf(group) })}
				onchange={(e) => {
					chooseMapType(group, e.currentTarget.value);
				}}
			>
				{#each group.maps as map (map.id)}
					<option value={map.id}>{map.label}</option>
				{/each}
			</select>
		</li>
	{/each}
</ul>

<style>
	.rows {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		text-align: left;
	}
	.row {
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: center;
		gap: 0.25rem 0.75rem;
		padding: 0.55rem 0.75rem;
		border: 1px solid #ccc;
		border-radius: 0.5rem;
		background: rgba(255, 255, 255, 0.7);
		scroll-margin: 0.5rem;
	}
	.row.highlight {
		border-color: #b06a2f;
		box-shadow: 0 0 0 2px rgba(176, 106, 47, 0.35);
		background: #fff8f0;
	}
	.name {
		padding: 0;
		border: 0;
		background: transparent;
		font: inherit;
		text-align: left;
		font-weight: 700;
		color: #2c3a33;
		cursor: pointer;
	}
	.name:hover {
		text-decoration: underline;
	}
	.progress {
		grid-column: 1 / -1;
		grid-row: 2;
	}
	select {
		font: inherit;
		font-size: 0.9rem;
		max-width: 12rem;
		padding: 0.3rem 0.4rem;
		border: 1px solid #bbb;
		border-radius: 0.4rem;
		background: #fff;
	}
</style>
