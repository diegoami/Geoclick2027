<script lang="ts">
	import { resolve } from '$app/paths';

	const demoMaps = [
		{ id: 'italy-regions', name: 'Italy — Regions' },
		{ id: 'germany-states', name: 'Germany — States' },
		{ id: 'usa-states', name: 'USA — States' }
	];
</script>

<main>
	<h1>Geoclick</h1>
	<p>Pick a demo map to explore.</p>
	<ul>
		{#each demoMaps as map (map.id)}
			<li><a href={resolve('/map/[mapId]', { mapId: map.id })}>{map.name}</a></li>
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
		display: block;
		padding: 0.75rem 1rem;
		border: 1px solid #ccc;
		border-radius: 0.5rem;
		text-decoration: none;
		color: inherit;
	}
	a:hover {
		background: #f4f4f4;
	}
</style>
