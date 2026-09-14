<script lang="ts">
	import { page } from '$app/state';
	import QuizView from '$lib/QuizView.svelte';
	import { isTutorialSandboxActive } from '$lib/tutorialSandbox.svelte';
</script>

<!-- Remounted when the tutorial's sandbox starts or ends (FT-10/FT-11): the quiz
     keeps the progress store it was mounted with, and after the tutorial it must
     show real progress, never the sandbox's. -->
{#key `${page.params.mapId}:${isTutorialSandboxActive()}`}
	<QuizView mapId={page.params.mapId as string} />
{/key}
