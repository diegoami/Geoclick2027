// The home page's per-map progress (FT-57): every map's last-session summary
// and mastery, read so that one map's storage failing costs that one card
// rather than the whole page. Apart from the repository it is handed, this is
// pure - no DOM, no Svelte - so it is unit-tested directly.
import { knownCount, mapLevel, type Level } from './difficulty';
import type { ProgressRepository, SessionSummary } from './progressRepository';

export type Mastery = { known: number; total: number; level: Level };

export interface HomeProgress {
	summaries: Record<string, SessionSummary | undefined>;
	masteries: Record<string, Mastery | undefined>;
}

/** How well one map is known (FT-26), or undefined if it was never played. */
async function readMastery(
	repository: ProgressRepository,
	mapId: string,
	targetIds: string[]
): Promise<Mastery | undefined> {
	const cardStates = await repository.getCardStates(mapId);
	if (cardStates.length === 0) return undefined;
	const byId = new Map(cardStates.map((c) => [c.targetId, c]));
	// Over the map's CURRENT target ids: a name with no card state counts as
	// unknown, and progress for a since-renamed or removed target is ignored -
	// the same semantics the due counts had.
	const streaks = targetIds.map((id) => byId.get(id)?.cleanStreak ?? 0);
	return { known: knownCount(streaks), total: targetIds.length, level: mapLevel(streaks) };
}

/**
 * Reads every map's progress for the home page. Each map is read on its own:
 * a read that throws leaves that map without data and the rest untouched
 * (FT-57).
 */
export async function loadHomeProgress(
	repository: ProgressRepository,
	mapIds: string[],
	targetIdsByMap: Map<string, string[]>
): Promise<HomeProgress> {
	const summaries: Record<string, SessionSummary | undefined> = {};
	const masteries: Record<string, Mastery | undefined> = {};

	await Promise.all(
		mapIds.map(async (mapId) => {
			try {
				summaries[mapId] = await repository.getLastSessionSummary(mapId);
			} catch (e) {
				console.error(`Could not read the last session for ${mapId}:`, e);
				summaries[mapId] = undefined;
			}
			try {
				masteries[mapId] = await readMastery(repository, mapId, targetIdsByMap.get(mapId) ?? []);
			} catch (e) {
				console.error(`Could not read progress for ${mapId}:`, e);
				masteries[mapId] = undefined;
			}
		})
	);

	return { summaries, masteries };
}

/**
 * How well a whole country (or continent) is known, for its row in the list
 * (FT-78): the names known across its maps, over the names on them. Nothing
 * until one name is known, like a map's own bar (FT-65).
 */
export function groupProgress(
	mapIds: string[],
	masteries: Record<string, Mastery | undefined>,
	targetCount: (mapId: string) => number
): { known: number; total: number } | undefined {
	let known = 0;
	let total = 0;
	for (const id of mapIds) {
		known += masteries[id]?.known ?? 0;
		total += targetCount(id);
	}
	return known > 0 ? { known, total } : undefined;
}
