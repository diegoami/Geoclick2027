<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import {
		createProgressRepository,
		todayLocalDate,
		type SessionSummary
	} from '$lib/progressRepository';
	import { isDue } from '@geoclick/srs';

	// Grouped by country (authored alphabetically below), and each
	// country's own maps sorted alphabetically by label - every country
	// already ships as a regions/provinces/towns-style pair (a trio for
	// Italy, which also has a provinces map), so grouping keeps that
	// pairing visible instead of flattening 28 maps across 14 countries
	// into one unsorted, chronological list. See DECISIONS.md for why
	// grouping was chosen over a flat alphabetical list.
	const mapGroups = [
		{
			country: 'Australia',
			maps: [
				{ id: 'australia-regions', label: 'States' },
				{ id: 'australia-towns-100k', label: 'Towns' }
			]
		},
		{
			country: 'Canada',
			maps: [
				{ id: 'canada-regions', label: 'Provinces' },
				{ id: 'canada-towns-100k', label: 'Towns' }
			]
		},
		{
			country: 'France',
			maps: [
				{ id: 'france-regions', label: 'Regions' },
				{ id: 'france-towns-100k', label: 'Towns' }
			]
		},
		{
			country: 'Germany',
			maps: [
				{ id: 'germany-states', label: 'States' },
				{ id: 'germany-towns-100k', label: 'Towns' }
			]
		},
		{
			country: 'Great Britain',
			maps: [
				{ id: 'great-britain-regions', label: 'Regions' },
				{ id: 'great-britain-towns-100k', label: 'Towns' }
			]
		},
		{
			country: 'Italy',
			maps: [
				{ id: 'italy-provinces', label: 'Provinces' },
				{ id: 'italy-regions', label: 'Regions' },
				{ id: 'italy-towns-100k', label: 'Towns' }
			]
		},
		{
			country: 'Japan',
			maps: [
				{ id: 'japan-regions', label: 'Prefectures' },
				{ id: 'japan-towns-100k', label: 'Towns' }
			]
		},
		{
			country: 'Netherlands',
			maps: [
				{ id: 'netherlands-regions', label: 'Provinces' },
				{ id: 'netherlands-towns-100k', label: 'Towns' }
			]
		},
		{
			country: 'Poland',
			maps: [
				{ id: 'poland-regions', label: 'Regions' },
				{ id: 'poland-towns-100k', label: 'Towns' }
			]
		},
		{
			country: 'Portugal',
			maps: [
				{ id: 'portugal-regions', label: 'Districts' },
				{ id: 'portugal-towns-100k', label: 'Towns' }
			]
		},
		{
			country: 'Spain',
			maps: [
				{ id: 'spain-regions', label: 'Regions' },
				{ id: 'spain-towns-100k', label: 'Towns' }
			]
		},
		{
			country: 'Sweden',
			maps: [
				{ id: 'sweden-regions', label: 'Regions' },
				{ id: 'sweden-towns-100k', label: 'Towns' }
			]
		},
		{
			country: 'Ukraine',
			maps: [
				{ id: 'ukraine-regions', label: 'Regions' },
				{ id: 'ukraine-towns-100k', label: 'Towns' }
			]
		},
		{
			country: 'USA',
			maps: [{ id: 'usa-states', label: 'States' }]
		}
	];

	// Flat view of every map - onMount's data-loading loop below doesn't
	// care about grouping, only about (id) -> per-map progress data, so it
	// works off this instead of duplicating the id list a second time.
	const demoMaps = mapGroups.flatMap((group) => group.maps);

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
	<div class="groups">
		{#each mapGroups as group (group.country)}
			<section class="country-group">
				<h2>{group.country}</h2>
				<ul>
					{#each group.maps as map (map.id)}
						{@const summary = lastSessions[map.id]}
						{@const due = dueStatuses[map.id]}
						<li>
							<a href={resolve('/map/[mapId]', { mapId: map.id })}>
								<span class="map-name">{map.label}</span>
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
			</section>
		{/each}
	</div>
</main>

<style>
	main {
		max-width: 32rem;
		margin: 4rem auto;
		font-family: system-ui, sans-serif;
		text-align: center;
	}
	.groups {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		text-align: left;
	}
	.country-group h2 {
		margin: 0 0 0.5rem;
		font-size: 1rem;
		font-weight: 700;
		color: #2c3a33;
		border-bottom: 1px solid #e0e0e0;
		padding-bottom: 0.25rem;
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	a {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		padding: 0.6rem 1rem;
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
	@media (min-width: 640px) {
		main {
			max-width: 46rem;
		}
		.groups {
			display: grid;
			grid-template-columns: repeat(2, 1fr);
			column-gap: 2rem;
			row-gap: 1.5rem;
			align-items: start;
		}
	}
</style>
