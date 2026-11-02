import mapIndex from '../../../data/maps/index.json';
import type { ImportMap } from './guestProgressImport';
/** The same generated stable target catalogue used by home progress. No map fetches. */
export const browserImportMaps: readonly ImportMap[] = mapIndex
	.filter((map) => map.targetIds.length)
	.map((map) => ({ mapId: map.id, targetIds: new Set(map.targetIds) }));
