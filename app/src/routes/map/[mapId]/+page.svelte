<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import MapView from '$lib/MapView.svelte';
</script>

<a class="back" href={resolve('/')}>← Maps</a>

{#key page.params.mapId}
	<MapView mapId={page.params.mapId as string} />
{/key}

<style>
	.back {
		position: absolute;
		top: 0.75rem;
		right: 0.75rem;
		z-index: 1;
		background: rgba(255, 255, 255, 0.9);
		padding: 0.5rem 0.75rem;
		border-radius: 0.5rem;
		font-family: system-ui, sans-serif;
		font-size: 0.9rem;
		text-decoration: none;
		color: inherit;
	}
</style>
