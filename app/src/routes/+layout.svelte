<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import VersionBadge from '$lib/VersionBadge.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
<VersionBadge />
