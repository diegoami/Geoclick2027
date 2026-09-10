// Mirrors the tour.json shape produced by data/scripts/build-map.ts.

import { base } from '$app/paths';

export interface TourStep {
	targetId: string;
	dwellMs: number;
	narration?: string;
}

export interface Tour {
	mapId: string;
	steps: TourStep[];
}

export async function fetchTour(mapId: string): Promise<Tour> {
	const res = await fetch(`${base}/maps/${mapId}/tour.json`);
	if (!res.ok) throw new Error(`Could not load tour for "${mapId}".`);
	return res.json();
}
