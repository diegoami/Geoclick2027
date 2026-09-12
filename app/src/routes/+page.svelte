<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import {
		createProgressRepository,
		todayLocalDate,
		type SessionSummary
	} from '$lib/progressRepository';
	import { isDue } from '@geoclick/srs';

	const demoMaps = [
		{ id: 'italy-regions', name: 'Italy — Regions' },
		{ id: 'italy-provinces', name: 'Italy — Provinces' },
		{ id: 'italy-towns-100k', name: 'Italy — Towns' },
		{ id: 'germany-states', name: 'Germany — States' },
		{ id: 'germany-towns-100k', name: 'Germany — Towns' },
		{ id: 'usa-states', name: 'USA — States' }
	];

	// Last-session summaries and due state live in localStorage (Iteration
	// 5/6), which isn't available during the prerendered build - read them
	// after mount, same pattern as the rest of the app's client-only data
	// fetching.
	let lastSessions = $state<Record<string, SessionSummary | undefined>>({});

	// "Not started" (no card state at all - map never played) is a distinct
	// state from "up to date" (played, but everything's graduated past
	// today) - don't conflate the two, see ROADMAP.md's Iteration 6 design.
	type DueStatus = { kind: 'notStarted' } | { kind: 'upToDate' } | { kind: 'due'; count: number };
	let dueStatuses = $state<Record<string, DueStatus | undefined>>({});

	onMount(() => {
		(async () => {
			const repository = await createProgressRepository();
			const summaryEntries = await Promise.all(
				demoMaps.map(
					async (map) => [map.id, await repository.getLastSessionSummary(map.id)] as const
				)
			);
			lastSessions = Object.fromEntries(summaryEntries);

			const today = todayLocalDate();
			const dueEntries = await Promise.all(
				demoMaps.map(async (map) => {
					const [mapDef, cardStates] = await Promise.all([
						fetch(`/maps/${map.id}/map.json`).then((r) => r.json()),
						repository.getCardStates(map.id)
					]);
					if (cardStates.length === 0)
						return [map.id, { kind: 'notStarted' } as DueStatus] as const;
					const byId = new Map(cardStates.map((c) => [c.targetId, c]));
					const targetIds: string[] = mapDef.targets.map((t: { id: string }) => t.id);
					const dueCount = targetIds.filter((id) => isDue(byId.get(id), today)).length;
					const status: DueStatus =
						dueCount === 0 ? { kind: 'upToDate' } : { kind: 'due', count: dueCount };
					return [map.id, status] as const;
				})
			);
			dueStatuses = Object.fromEntries(dueEntries);
		})();
	});
</script>

<main>
	<h1>Geoclick</h1>
	<p>Pick a demo map to explore.</p>
	<ul>
		{#each demoMaps as map (map.id)}
			{@const summary = lastSessions[map.id]}
			{@const due = dueStatuses[map.id]}
			<li>
				<a href={resolve('/map/[mapId]', { mapId: map.id })}>
					<span class="map-name">{map.name}</span>
					{#if due && due.kind !== 'notStarted'}
						<span class="due-status" class:up-to-date={due.kind === 'upToDate'}>
							{due.kind === 'upToDate' ? 'No reviews needed' : `${due.count} to review`}
						</span>
					{/if}
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
	.due-status {
		font-size: 0.8rem;
		font-weight: 600;
		color: #b06a2f;
	}
	.due-status.up-to-date {
		color: #4a7c5c;
	}
	.last-result {
		font-size: 0.8rem;
		opacity: 0.7;
	}
</style>
