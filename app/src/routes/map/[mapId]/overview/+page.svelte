<script lang="ts">
	import { page } from '$app/state';
	import OverviewView from '$lib/OverviewView.svelte';
</script>

{#key page.params.mapId}
	<OverviewView mapId={page.params.mapId as string} />
{/key}
