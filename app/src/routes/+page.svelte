<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import {
		createLocalStorageProgressRepository,
		type SessionSummary
	} from '$lib/progressRepository';

	const demoMaps = [
		{ id: 'italy-regions', name: 'Italy — Regions' },
		{ id: 'germany-states', name: 'Germany — States' },
		{ id: 'usa-states', name: 'USA — States' }
	];

	// Last-session summaries live in localStorage (Iteration 5), which
	// isn't available during the prerendered build - read it after mount,
	// same pattern as the rest of the app's client-only data fetching.
	let lastSessions = $state<Record<string, SessionSummary | undefined>>({});

	onMount(() => {
		const repository = createLocalStorageProgressRepository();
		(async () => {
			const entries = await Promise.all(
				demoMaps.map(
					async (map) => [map.id, await repository.getLastSessionSummary(map.id)] as const
				)
			);
			lastSessions = Object.fromEntries(entries);
		})();
	});
</script>

<main>
	<h1>Geoclick</h1>
	<p>Pick a demo map to explore.</p>
	<ul>
		{#each demoMaps as map (map.id)}
			{@const summary = lastSessions[map.id]}
			<li>
				<a href={resolve('/map/[mapId]', { mapId: map.id })}>
					<span class="map-name">{map.name}</span>
					{#if summary}
						<span class="last-result">
							Last: {summary.perfect}/{summary.total}
							{#if summary.totalErrors > 0}
								({summary.totalErrors} mistake{summary.totalErrors === 1 ? '' : 's'})
							{/if}
						</span>
					{/if}
				</a>
			</li>
		{/each}
	</ul>
</main>

<style>
	main {
		max-width: 32rem;
		margin: 4rem auto;
		font-family: system-ui, sans-serif;
		text-align: center;
	}
	ul {
		list-style: none;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	a {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		padding: 0.75rem 1rem;
		border: 1px solid #ccc;
		border-radius: 0.5rem;
		text-decoration: none;
		color: inherit;
	}
	a:hover {
		background: #f4f4f4;
	}
	.last-result {
		font-size: 0.8rem;
		opacity: 0.7;
	}
</style>
