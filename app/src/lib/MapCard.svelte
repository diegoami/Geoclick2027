<script lang="ts">
	// One map as a card: its name, how well it is known and the last round,
	// with its favourite star. Favourites (FT-16) and Recent (FT-15) list
	// them, on My maps since the start screen's toolbar (FT-82).
	import { resolve } from '$app/paths';
	import { handSize } from './difficulty';
	import FavouriteStar from './FavouriteStar.svelte';
	import type { Mastery } from './homeProgress';
	import { t, tPlural } from './i18n.svelte';
	import KnownProgress from './KnownProgress.svelte';
	import type { SessionSummary } from './progressRepository';

	let {
		mapId,
		label,
		summary,
		mastery
	}: {
		mapId: string;
		label: string;
		summary?: SessionSummary;
		mastery?: Mastery;
	} = $props();
</script>

<li class="map-card">
	<!-- A map opens on Known (FT-39): the map you build by tapping names
	     onto it. Overview, which labels everything at once, is a tab away. -->
	<a href={resolve('/map/[mapId]', { mapId })}>
		<span class="map-name">{label}</span>
		{#if mastery}
			<span class="mastery" class:all-known={mastery.known === mastery.total}>
				<!-- A bar, not the number (FT-65); it renders nothing until the
				     first name is known. -->
				<KnownProgress
					known={mastery.known}
					total={mastery.total}
					allKnown={mastery.known === mastery.total}
				/>
				<!-- The ladder, but only once the hand has started shrinking
				     (FT-21): level 0's hand of ten is the default and there is
				     nothing to explain (FT-60). -->
				{#if mastery.level > 0}
					· {tPlural('quiz.namesAtATime', handSize(mastery.level), {
						count: handSize(mastery.level)
					})}
				{/if}
			</span>
		{/if}
		{#if summary}
			<span class="last-result">
				{t('home.lastResult', { perfect: summary.perfect, total: summary.total })}
				{#if summary.totalErrors > 0}
					{tPlural('home.mistakeCount', summary.totalErrors, {
						count: summary.totalErrors
					})}
				{/if}
			</span>
		{/if}
	</a>
	<!-- A sibling of the link, not inside it: two separate controls for
	     keyboard and screen readers (FT-16). -->
	<span class="card-star"><FavouriteStar {mapId} /></span>
</li>

<style>
	.map-card {
		position: relative;
		list-style: none;
	}
	a {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		/* Room on the right for the favourite star. */
		padding: 0.6rem 3rem 0.6rem 1rem;
		border: 1px solid #ccc;
		border-radius: 0.5rem;
		background: #ffffff;
		text-decoration: none;
		color: inherit;
	}
	a:hover {
		background: #fbf4ec;
	}
	.card-star {
		position: absolute;
		top: 0.3rem;
		right: 0.35rem;
	}
	.mastery {
		font-size: 0.8rem;
		font-weight: 600;
		color: #b06a2f;
	}
	/* A map with nothing left to learn reads as done, not as work to do. */
	.mastery.all-known {
		color: #4a7c5c;
	}
	.last-result {
		font-size: 0.8rem;
		opacity: 0.7;
	}
</style>
