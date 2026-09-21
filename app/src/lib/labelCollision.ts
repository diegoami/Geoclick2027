// Names that never overlap (FT-23/FT-24, docs/PLAN_V0.6.md).
//
// Every map view writes its names as DOM popups (labelMagnify.ts explains why
// they take no pointer input). Popups know nothing about each other, so on a
// dense map - Italy's 110 provinces - they piled on top of one another until
// the map was unreadable. This module gives them the one thing a paper map
// always had: a name is either legible or it isn't drawn at all.
//
// After every map move, each label's screen rectangle is read once. Then the
// most important label is placed first, each one after it in the best free
// spot it has, and whatever still has nowhere to go gets CROWDED_CLASS, which
// app.css hides. Zoom in and the same pass finds room for more names: that is
// the whole "hide what doesn't fit, zoom in to see it" behaviour.
//
// A name has more than one spot to try (FT-24). A region's name wants to sit
// on its middle, and steps one line up or down if that is taken. A town's
// name must never cover its dot, so it takes the first free side: right,
// left, above, below. Views say which by registering the label.
//
// Why not a MapLibre symbol layer, which collides labels natively: symbol
// layers render text from glyph PBFs, and the style's `glyphs` URL points at
// a public font server. Geoclick runs fully offline (ARCHITECTURE.md), and
// nothing in the app fetches that URL today, so a symbol layer would mean
// vendoring and shipping a font stack - and would give up the magnify
// (FT-02/FT-03), the retention strengths (FT-22) and the rem-based sizing
// that all live in CSS today. See DECISIONS.md, "Names never overlap".

import { CROWDED_CLASS, HOVERED_CLASS, MAGNIFIED_CLASS } from './labelMagnify';
import type { Target } from './mapDefinition';

/** Set by the views on a popup element: bigger wins a contested spot. */
export const PRIORITY_ATTR = 'data-label-priority';
/** Breathing room between two labels, in px: touching names read as one. */
const GAP_PX = 3;
/**
 * How far a town's name keeps from the middle of its dot, in px: the dot's
 * radius (9) plus its outline (1.5) plus a little air, matching
 * `targets-circle` in data/styles/base.json. The name sits beside the dot,
 * never on it - a player has to see the dot they are aiming at (FT-24).
 */
export const DOT_CLEARANCE_PX = 14;

export interface LabelRect {
	left: number;
	top: number;
	right: number;
	bottom: number;
}

/** Where a label may go, and where it would land if it went there. */
export interface LabelCandidate {
	offset: [number, number];
	rect: LabelRect;
}

export interface LabelPlacement {
	/** Bigger is placed first. Ties keep the order given, so labels don't swap. */
	priority: number;
	/** Spots to try, best first. Always at least one. */
	candidates: LabelCandidate[];
}

/** What the pass decided for one label. */
export interface ChosenPlacement {
	visible: boolean;
	offset: [number, number];
}

function overlaps(a: LabelRect, b: LabelRect, gap: number): boolean {
	return (
		a.left - gap < b.right &&
		b.left - gap < a.right &&
		a.top - gap < b.bottom &&
		b.top - gap < a.bottom
	);
}

function hasNoSize(rect: LabelRect): boolean {
	return rect.right <= rect.left || rect.bottom <= rect.top;
}

/**
 * Places the labels: the most important first, each in the first spot it has
 * that doesn't touch a label already placed. One result per label, in the
 * order given; a label with nowhere to go is not visible, and keeps its first
 * spot so it lands sensibly when the map next makes room. A label with no
 * size yet (not laid out) is always kept - it can't hide anything, and the
 * next pass will place it properly.
 */
export function choosePlacements(labels: LabelPlacement[], gap = GAP_PX): ChosenPlacement[] {
	const order = labels.map((label, index) => index);
	order.sort((a, b) => labels[b].priority - labels[a].priority || a - b);
	const chosen = labels.map((label) => ({ visible: false, offset: label.candidates[0].offset }));
	const kept: LabelRect[] = [];
	for (const index of order) {
		const candidates = labels[index].candidates;
		if (hasNoSize(candidates[0].rect)) {
			chosen[index].visible = true;
			continue;
		}
		const fits = candidates.find((candidate) =>
			kept.every((other) => !overlaps(candidate.rect, other, gap))
		);
		if (!fits) continue;
		chosen[index] = { visible: true, offset: fits.offset };
		kept.push(fits.rect);
	}
	return chosen;
}

/** Placement for labels that have only one spot to be in. */
export function chooseVisible(labels: { priority: number; rect: LabelRect }[], gap = GAP_PX) {
	return choosePlacements(
		labels.map(({ priority, rect }) => ({
			priority,
			candidates: [{ offset: [0, 0] as [number, number], rect }]
		})),
		gap
	).map((placement) => placement.visible);
}

/** A popup the pass can move: `maplibregl.Popup`, or a stand-in in tests. */
export interface MovableLabel {
	getElement(): HTMLElement | undefined;
	setOffset(offset: [number, number]): unknown;
}

interface RegisteredLabel {
	label: MovableLabel;
	/** The offset the pass last applied, so it can work back to the anchor. */
	applied: [number, number];
	/** Set for a point target: how far to keep off the dot. */
	beside?: number;
}

// Keyed by the popup's element, which is what the pass walks over. A WeakMap,
// so a popup the view removed is forgotten with its element.
const registry = new WeakMap<HTMLElement, RegisteredLabel>();

export interface LabelOptions {
	/** Bigger wins a contested spot. Unregistered labels rank 0. */
	priority?: number;
	/**
	 * For a town (a point target): how far the name keeps from the middle of
	 * the dot, in px - usually DOT_CLEARANCE_PX. Without it the name sits on
	 * the middle of its region, which is what a region wants.
	 */
	beside?: number;
}

/**
 * Tells the collision pass about a label, right after `addTo(map)`. The popup
 * must have been created with `anchor: 'center'`, so that an offset means
 * "this far from the place itself" in either direction. A label never
 * registered still takes part - it just ranks 0 and stays where the view put
 * it.
 */
export function registerLabel(label: MovableLabel, options: LabelOptions = {}): void {
	const element = label.getElement();
	if (!element) return;
	element.setAttribute(PRIORITY_ATTR, String(options.priority ?? 0));
	// A reused popup (the tour rewrites one) can still carry the offset from
	// its last place; start from the place itself and let the pass move it.
	label.setOffset([0, 0]);
	registry.set(element, { label, applied: [0, 0], beside: options.beside });
}

/** The spots one label may take, best first. */
function candidatesFor(
	anchor: { x: number; y: number },
	width: number,
	height: number,
	beside: number | undefined
): LabelCandidate[] {
	const at = (dx: number, dy: number): LabelCandidate => ({
		offset: [dx, dy],
		rect: {
			left: anchor.x + dx - width / 2,
			right: anchor.x + dx + width / 2,
			top: anchor.y + dy - height / 2,
			bottom: anchor.y + dy + height / 2
		}
	});
	if (beside !== undefined) {
		// Beside the dot: the first free side, reading order first.
		const x = beside + width / 2;
		const y = beside + height / 2;
		return [at(x, 0), at(-x, 0), at(0, -y), at(0, y)];
	}
	// On the place itself, or one line off it if that is taken. Any further
	// and the name would start to look like it belongs to the neighbour.
	const line = height + GAP_PX;
	return [at(0, 0), at(0, -line), at(0, line)];
}

/** The labels of one map container, as the collision pass sees them. */
function readLabels(popups: HTMLElement[]): (LabelPlacement & { registered?: RegisteredLabel })[] {
	return popups.map((popup) => {
		const registered = registry.get(popup);
		const magnified = popup.querySelector(`.${HOVERED_CLASS}, .${MAGNIFIED_CLASS}`) !== null;
		const priority = Number(popup.getAttribute(PRIORITY_ATTR) ?? 0);
		const rect = popup.getBoundingClientRect();
		const [dx, dy] = registered?.applied ?? [0, 0];
		// Where the place itself is on screen: the label sits at its middle
		// plus whatever offset the pass gave it last time.
		const anchor = { x: (rect.left + rect.right) / 2 - dx, y: (rect.top + rect.bottom) / 2 - dy };
		const width = rect.right - rect.left;
		const height = rect.bottom - rect.top;
		return {
			// A name the player is pointing at, or has tapped, is the one name
			// they asked for: it always wins its place.
			priority: magnified ? Infinity : Number.isFinite(priority) ? priority : 0,
			candidates: registered
				? candidatesFor(anchor, width, height, registered.beside)
				: [{ offset: [0, 0] as [number, number], rect }],
			registered
		};
	});
}

/** Everything that can move, add or resize a label, coalesced into one pass. */
type CollisionMap = {
	on(type: 'move' | 'moveend' | 'resize', listener: () => void): unknown;
	off(type: 'move' | 'moveend' | 'resize', listener: () => void): unknown;
};

/**
 * Keeps the labels in a map container from overlapping. Runs once per frame
 * at most, reads every label's rectangle before writing anything (so the
 * browser lays out once, not once per label), and returns a function that
 * stops it.
 */
export function enableLabelCollision(map: CollisionMap, container: HTMLElement): () => void {
	let frame = 0;

	const pass = () => {
		frame = 0;
		const popups = [...container.querySelectorAll<HTMLElement>('.maplibregl-popup')];
		if (popups.length === 0) return;
		const labels = readLabels(popups);
		const placements = choosePlacements(labels);
		popups.forEach((popup, index) => {
			const { visible, offset } = placements[index];
			popup.classList.toggle(CROWDED_CLASS, !visible);
			const registered = labels[index].registered;
			if (!registered) return;
			if (registered.applied[0] === offset[0] && registered.applied[1] === offset[1]) return;
			registered.applied = offset;
			registered.label.setOffset(offset);
		});
	};
	const schedule = () => {
		if (!frame) frame = requestAnimationFrame(pass);
	};

	map.on('move', schedule);
	map.on('moveend', schedule);
	map.on('resize', schedule);
	// Labels are added as the game goes on - each solved quiz target is a new
	// popup, the tour rewrites one, magnifying grows one (FT-02/FT-03) - so the
	// pass follows the DOM too. Class changes on the popup elements themselves
	// are ignored: those are this pass's own writes, and reacting to them would
	// schedule another pass forever.
	const observer = new MutationObserver((records) => {
		const ours = records.every(
			(record) =>
				record.type === 'attributes' &&
				(record.target as HTMLElement).classList?.contains('maplibregl-popup')
		);
		if (!ours) schedule();
	});
	observer.observe(container, {
		childList: true,
		subtree: true,
		characterData: true,
		attributes: true,
		attributeFilter: ['class']
	});

	// A magnified name grows into its place over 120ms (app.css), so the pass
	// above measures it mid-grow; this one catches its final size.
	container.addEventListener('transitionend', schedule);
	schedule();

	return () => {
		cancelAnimationFrame(frame);
		observer.disconnect();
		container.removeEventListener('transitionend', schedule);
		map.off('move', schedule);
		map.off('moveend', schedule);
		map.off('resize', schedule);
	};
}

/**
 * How much of the map each target covers, as a share (0 to 1) of the biggest
 * one - the natural way to decide which of two names that want the same spot
 * gets it. An atlas keeps the big region's name and lets the small one wait
 * for the zoom, so Geoclick does the same. Point targets (towns) have no
 * extent at all and all score 0, leaving their order to the view.
 */
export function areaShares(targets: Target[]): Map<string, number> {
	const areas = new Map<string, number>();
	let largest = 0;
	for (const target of targets) {
		const [west, south, east, north] = target.bbox;
		// A bbox that wraps the antimeridian has west > east. Read wrapping
		// from the bbox itself, not the optional `crossesAntimeridian` flag:
		// the bbox is the authoritative geometry, and a map can arrive
		// without the flag (FT-52, mapDefinition.ts).
		const width = east - west + (west > east ? 360 : 0);
		// Degrees of longitude are narrower away from the equator; without this,
		// a northern region would outrank a bigger southern one.
		const area = width * Math.cos(((south + north) / 2) * (Math.PI / 180)) * (north - south);
		areas.set(target.id, area);
		largest = Math.max(largest, area);
	}
	if (largest <= 0) return new Map(targets.map((t) => [t.id, 0]));
	return new Map([...areas].map(([id, area]) => [id, area / largest]));
}
