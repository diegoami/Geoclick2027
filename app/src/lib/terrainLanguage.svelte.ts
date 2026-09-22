// Keeps the Terrain layer's labels in the player's language (FT-53,
// docs/PLAN_V0.9.4.md).
//
// A map's first open draws the labels after `await this.add()` inside
// `setVisible`, so an effect that only follows the Terrain preference never
// tracks `getLanguage()`: the labels keep the old language while everything
// around them changes. Reading the language here, before anything else, is
// what establishes the subscription; `refreshLabels()` then redraws the
// names. All four map views call this, so the dependency lives in one place
// rather than being restated - and re-derived, or forgotten - four times.
import { getLanguage } from './i18n.svelte';
import type { TerrainLayer } from './terrainLayer';

/**
 * Follows the language for the given terrain layer. Call it from a view's
 * script, during component initialisation, like any effect.
 */
export function followTerrainLanguage(terrain: () => TerrainLayer | undefined): void {
	$effect(() => {
		const language = getLanguage();
		terrain()?.refreshLabels(language);
	});
}
