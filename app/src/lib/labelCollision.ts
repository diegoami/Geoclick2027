// Names that never overlap (FT-23, docs/PLAN_V0.6.md).
//
// Every map view writes its names as DOM popups (labelMagnify.ts explains why
// they take no pointer input). Popups know nothing about each other, so on a
// dense map - Italy's 110 provinces - they piled on top of one another until
// the map was unreadable. This module gives them the one thing a paper map
// always had: a name is either legible or it isn't drawn at all.
//
// After every map move, each label's screen rectangle is read once, and the
// most important labels are kept in turn as long as they don't touch a
// rectangle already kept. The rest get CROWDED_CLASS, which app.css hides.
// Zoom in and the same pass finds room for more names: that is the whole
// "hide what doesn't fit, zoom in to see it" behaviour, with no extra state.
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
/** Set by the views on a popup element: bigger wins a place on the map. */
export const PRIORITY_ATTR = 'data-label-priority';
/** Breathing room between two labels, in px: touching names read as one. */
const GAP_PX = 3;

export interface LabelRect {
	left: number;
	top: number;
	right: number;
	bottom: number;
}

export interface LabelPlacement {
	/** Bigger is kept first. Ties keep the order given, so labels don't swap. */
	priority: number;
	rect: LabelRect;
}

function overlaps(a: LabelRect, b: LabelRect, gap: number): boolean {
	return (
		a.left - gap < b.right &&
		b.left - gap < a.right &&
		a.top - gap < b.bottom &&
		b.top - gap < a.bottom
	);
}

/**
 * Which labels fit: the highest priority first, then each one that doesn't
 * touch a label already kept. Returns one flag per label, in the order given.
 * A label with no size yet (not laid out) is always kept - it can't hide
 * anything, and the next pass will place it properly.
 */
export function chooseVisible(labels: LabelPlacement[], gap = GAP_PX): boolean[] {
	const order = labels.map((label, index) => index);
	order.sort((a, b) => labels[b].priority - labels[a].priority || a - b);
	const visible = new Array<boolean>(labels.length).fill(false);
	const kept: LabelRect[] = [];
	for (const index of order) {
		const { rect } = labels[index];
		if (rect.right <= rect.left || rect.bottom <= rect.top) {
			visible[index] = true;
			continue;
		}
		if (kept.some((other) => overlaps(rect, other, gap))) continue;
		visible[index] = true;
		kept.push(rect);
	}
	return visible;
}

/** The labels of one map container, as the collision pass sees them. */
function readLabels(popups: HTMLElement[]): LabelPlacement[] {
	return popups.map((popup) => {
		const magnified = popup.querySelector(`.${HOVERED_CLASS}, .${MAGNIFIED_CLASS}`) !== null;
		const priority = Number(popup.getAttribute(PRIORITY_ATTR) ?? 0);
		return {
			// A name the player is pointing at, or has tapped, is the one name
			// they asked for: it always wins its place.
			priority: magnified ? Infinity : Number.isFinite(priority) ? priority : 0,
			rect: popup.getBoundingClientRect()
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
 * at most, reads every label's rectangle before writing any class (so the
 * browser lays out once, not once per label), and returns a function that
 * stops it.
 */
export function enableLabelCollision(map: CollisionMap, container: HTMLElement): () => void {
	let frame = 0;

	const pass = () => {
		frame = 0;
		const popups = [...container.querySelectorAll<HTMLElement>('.maplibregl-popup')];
		if (popups.length === 0) return;
		const visible = chooseVisible(readLabels(popups));
		popups.forEach((popup, index) => popup.classList.toggle(CROWDED_CLASS, !visible[index]));
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

/** Sets how hard a label fights for its place; the biggest number wins. */
export function setLabelPriority(
	popup: { getElement(): HTMLElement | undefined },
	priority: number
): void {
	popup.getElement()?.setAttribute(PRIORITY_ATTR, String(priority));
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
		// A bbox that wraps the antimeridian has west > east (mapDefinition.ts).
		const width = (target.crossesAntimeridian ? east + 360 : east) - west;
		// Degrees of longitude are narrower away from the equator; without this,
		// a northern region would outrank a bigger southern one.
		const area = width * Math.cos(((south + north) / 2) * (Math.PI / 180)) * (north - south);
		areas.set(target.id, area);
		largest = Math.max(largest, area);
	}
	if (largest <= 0) return new Map(targets.map((t) => [t.id, 0]));
	return new Map([...areas].map(([id, area]) => [id, area / largest]));
}
