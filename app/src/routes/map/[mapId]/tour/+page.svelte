<script lang="ts">
	import { page } from '$app/state';
	import TourView from '$lib/TourView.svelte';
</script>

{#key page.params.mapId}
	<TourView mapId={page.params.mapId as string} />
{/key}
