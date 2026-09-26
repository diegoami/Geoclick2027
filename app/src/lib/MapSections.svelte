<script lang="ts">
	// The catalog in sections (#58, amended 2026-09-26). The whole of it: a
	// Continents section with each continent's own maps, then a section per
	// continent with its countries. Or one continent: its own row first, then
	// its countries. The start screen's panel shows one or the other as the
	// map drills down, and the list shows the whole.
	import { CONTINENT_IDS, continentGroups, countryGroupsOf } from './catalogSections';
	import type { Mastery } from './homeProgress';
	import { t, type TranslationKey } from './i18n.svelte';
	import { pickerIdOf } from './mapCatalog';
	import MapRows from './MapRows.svelte';

	interface Row {
		country: string;
		pickerId?: string;
		maps: { id: string; label: string }[];
	}

	let {
		groups,
		masteries,
		targetCount,
		only,
		highlight,
		tutorialMapId,
		onContinent
	}: {
		groups: Row[];
		masteries: Record<string, Mastery | undefined>;
		targetCount: (mapId: string) => number;
		/** Show this continent's section alone. */
		only?: string;
		highlight?: string;
		tutorialMapId?: string;
		/** A continent's heading drills down to it, where the map is beside. */
		onContinent?: (continent: string) => void;
	} = $props();

	const continentName = (id: string) => t(`continent.${id}` as TranslationKey);
	const continents = $derived(continentGroups(groups));
</script>

<div class="sections">
	{#if only}
		{@const own = continents.filter((g) => pickerIdOf(g) === only)}
		<section>
			<h3>{continentName(only)}</h3>
			<MapRows
				groups={[...own, ...countryGroupsOf(only, groups)]}
				{masteries}
				{targetCount}
				{highlight}
				{tutorialMapId}
			/>
		</section>
	{:else}
		{#if continents.length > 0}
			<section>
				<h3>{t('picker.continents')}</h3>
				<MapRows groups={continents} {masteries} {targetCount} {highlight} {tutorialMapId} />
			</section>
		{/if}
		{#each CONTINENT_IDS as id (id)}
			{@const countries = countryGroupsOf(id, groups)}
			{#if countries.length > 0}
				<section>
					<h3>
						{#if onContinent}
							<button type="button" class="drill" onclick={() => onContinent(id)}>
								{continentName(id)} →
							</button>
						{:else}
							{continentName(id)}
						{/if}
					</h3>
					<MapRows groups={countries} {masteries} {targetCount} {highlight} {tutorialMapId} />
				</section>
			{/if}
		{/each}
	{/if}
</div>

<style>
	.sections {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		text-align: left;
	}
	h3 {
		margin: 0 0 0.5rem;
		padding-bottom: 0.25rem;
		font-size: 0.95rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: #2c3a33;
		border-bottom: 1px solid rgba(44, 58, 51, 0.2);
	}
	.drill {
		font: inherit;
		letter-spacing: inherit;
		text-transform: inherit;
		color: inherit;
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
	}
	.drill:hover {
		color: #b06a2f;
	}
</style>
