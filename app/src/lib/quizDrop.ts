// The drop-correctness decision for the drag-to-match quiz, extracted from
// QuizView.svelte (GC-021) so it can be unit-tested. Pure: no map, no DOM - the
// component does the hit-testing (queryRenderedFeatures, map.project) and hands
// the results in.
//
// The rules below each came from a bug found by actually playing the quiz (see
// DECISIONS.md's "Quiz mechanic" section); quizDrop.test.ts pins every one.

export interface DropInput {
	/** Region/city exactly under the drop point, if any. */
	exactName: string | undefined;
	/** Every region/city within the drop tolerance radius (includes exactName). */
	nearbyNames: string[];
	/** Name on the slip being dragged - the correct answer. */
	draggedName: string;
	/** City-marker map (point targets) rather than a polygon map. */
	isPointMap: boolean;
	/** Point maps only: which of nearbyNames is nearest the drop point in
	 * screen space. Precomputed by the caller (it needs map.project()). */
	closestName: string | undefined;
}

export interface DropResult {
	/** false = not a plausible guess (open sea, gaps, map padding): record no
	 * attempt at all, the slip just goes back to the tray. */
	scored: boolean;
	correct: boolean;
}

export function resolveDrop({
	exactName,
	nearbyNames,
	draggedName,
	isPointMap,
	closestName
}: DropInput): DropResult {
	// Nothing on or near the drop point: "changed my mind", not a wrong guess.
	if (!exactName && nearbyNames.length === 0) return { scored: false, correct: false };

	// An exact hit on the right target is always correct. Otherwise the
	// tolerance may rescue the drop, but only toward the DRAGGED target - it never
	// makes a drop count for some other region.
	//
	// Polygon maps: the dragged region being anywhere within tolerance is enough,
	// even when the exact point landed on a neighbour. That is the whole point of
	// the tolerance: a tiny region like Bremen is enclosed by Niedersachsen, and
	// even its own centroid sits outside its simplified polygon at normal zoom,
	// so a drop aimed at Bremen practically always lands exactly on Niedersachsen.
	//
	// Point maps: two city markers can sit closer together than the tolerance
	// radius (Essen/Duisburg, ~22px apart inside a 30px radius), so "present
	// nearby" would let a drop squarely on Duisburg count for Essen. There the
	// dragged city must be the CLOSEST candidate.
	const correct =
		exactName === draggedName ||
		(isPointMap ? closestName === draggedName : nearbyNames.includes(draggedName));
	return { scored: true, correct };
}
