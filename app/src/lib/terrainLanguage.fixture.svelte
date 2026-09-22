<script lang="ts">
	// Test-only: mounts the shared language wiring (FT-53) around a terrain
	// layer the test supplies, so the effect can be exercised without a real
	// MapLibre map. Not imported by the app.
	import type { TerrainLayer } from './terrainLayer';
	import { followTerrainLanguage } from './terrainLanguage.svelte';

	let { terrain }: { terrain: () => TerrainLayer | undefined } = $props();

	followTerrainLanguage(() => terrain());
</script>
