// A place's name as the player reads it (#71). A map's target has one
// `name`, which is also the key its tiles are joined on and so never
// changes; a country, or a town on a map of several countries, may add the
// name in the player's language. Everything that SHOWS a name reads it
// here, and everything that looks a target up keeps using `name`.
import { getLanguage, type Language } from './i18n.svelte';
import type { Target } from './mapDefinition';

export function targetName(
	target: Pick<Target, 'name' | 'names'>,
	language: Language = getLanguage()
): string {
	return target.names?.[language] ?? target.name;
}
