<script lang="ts">
	import { page } from '$app/state';
	import QuizView from '$lib/QuizView.svelte';
</script>

{#key page.params.mapId}
	<QuizView mapId={page.params.mapId as string} />
{/key}
