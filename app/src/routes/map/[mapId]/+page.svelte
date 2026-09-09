<script lang="ts">
	import { page } from '$app/state';
	import MapView from '$lib/MapView.svelte';
</script>

{#key page.params.mapId}
	<MapView mapId={page.params.mapId as string} />
{/key}
