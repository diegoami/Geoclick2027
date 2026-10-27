import { readFileSync } from 'node:fs';
/** Snapshot providers vary; never label a census/gazetteer as Wikidata. */
export function placeSourceAttribution(file: string): string {
	const snapshot = JSON.parse(readFileSync(file, 'utf8')) as { attribution?: unknown };
	return typeof snapshot.attribution === 'string' && snapshot.attribution.trim()
		? snapshot.attribution.trim()
		: 'Wikidata (CC0), https://www.wikidata.org';
}

/** Builders pass compound credits through each other; retain each segment once. */
export function combineAttributions(...parts: string[]): string {
	return [
		...new Set(
			parts.flatMap((part) => part.split(';').map((segment) => segment.trim())).filter(Boolean)
		)
	].join('; ');
}
