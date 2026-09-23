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
// name must never cover its dot, so it goes beside it: any of the four sides
// or the four corners. Views say which by registering the label.
//
// "Best" is a score, not the first spot that fits (FT-63). Taking the first
// free side put Duisburg's name over Essen's dot while open space to its west
// went unused. Every free spot now adds up, in pixels:
//   + room: how far it keeps from the nearest name or dot, up to ROOM_CAP_PX
//   - REACH_WEIGHT times how far it strays from its own place (a region's
//     middle strays 0; every spot beside a dot strays the same)
//   - DOT_COST for each other town's dot it would cover
//   - OFFSCREEN_COST times the share of it off the edge of the map
//   - RANK_COST per step down the view's own order, so ties go to reading order
//   + STAY_BONUS if it is the spot the name already holds - only while the
//     map is moving
// and the highest wins. Every term but the map's edge is relative to the
// other labels and dots, so a pan moves only the names at the edge. The stay
// bonus stops names flickering side to side mid-gesture, when a zoom's
// animation or the pixel rounding of a pan makes two spots nearly equal.
// Once the map settles - and on every pass the map didn't cause, a hover or a
// new quiz name - each name takes its best spot afresh: a bonus kept for good
// left a name pushed aside by a neighbour's hover, or by the map's edge, on
// its second-best side long after the neighbour or the edge had gone.
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
/** A dot as an obstacle, in px: `targets-circle`'s radius 9 plus its outline. */
const DOT_RADIUS_PX = 10.5;
/** Room beyond this doesn't count, in px. */
const ROOM_CAP_PX = 12;
/**
 * Straying counts double. A region's one-line step strays half a line plus
 * the 3 px gap, so for any label 6 px tall or more it costs at least 12 -
 * never less than the most room it could win back. A free middle strays 0
 * and scores at least 0, so it always wins: a region's name leaves its
 * middle only when the middle is taken (or would cover a town's dot).
 */
const REACH_WEIGHT = 2;
/** A spot over another town's dot is taken only when there is no clean one. */
const DOT_COST = 100;
/** What a spot costs if it lies entirely off the map. */
const OFFSCREEN_COST = 30;
/** What each step down the view's order of spots costs: a tie-break. */
const RANK_COST = 0.5;
/** What keeps a name where it is, against a spot only a pixel or two better. */
const STAY_BONUS = 4;

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
	/** Spots to try, the view's favourite first. Always at least one. */
	candidates: LabelCandidate[];
	/** Which of them the label holds now, if it is drawn. */
	current?: number;
}

/** What the pass decided for one label. */
export interface ChosenPlacement {
	visible: boolean;
	offset: [number, number];
	/** Which candidate that offset is. */
	index: number;
}

/** A town's dot, in the same screen coordinates as the labels. */
export interface Dot {
	x: number;
	y: number;
}

/** What else the labels share the screen with. */
export interface PlacementContext {
	/** Breathing room between two labels, in px. */
	gap?: number;
	/** Every town's dot, named or not: a name should not cover one. */
	dots?: Dot[];
	/** The map's own rectangle: a name off its edge can't be read. */
	bounds?: LabelRect;
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

/** How far apart two rectangles are, in px: 0 if they touch. */
function rectDistance(a: LabelRect, b: LabelRect): number {
	const dx = Math.max(0, a.left - b.right, b.left - a.right);
	const dy = Math.max(0, a.top - b.bottom, b.top - a.bottom);
	// Not Math.hypot: this runs ~100 000 times a frame, and hypot's overflow
	// care, which screen distances never need, doubles the pass's cost.
	return Math.sqrt(dx * dx + dy * dy);
}

/** How far a point is from a rectangle, in px: 0 if it is inside. */
function pointDistance(rect: LabelRect, x: number, y: number): number {
	const dx = Math.max(0, rect.left - x, x - rect.right);
	const dy = Math.max(0, rect.top - y, y - rect.bottom);
	return Math.sqrt(dx * dx + dy * dy);
}

/** The share of a rectangle (0 to 1) that lies outside another. */
function outsideShare(rect: LabelRect, bounds: LabelRect): number {
	const width = Math.max(0, Math.min(rect.right, bounds.right) - Math.max(rect.left, bounds.left));
	const height = Math.max(0, Math.min(rect.bottom, bounds.bottom) - Math.max(rect.top, bounds.top));
	return 1 - (width * height) / ((rect.right - rect.left) * (rect.bottom - rect.top));
}

/** What a free spot is worth: the sum the top of this file explains. */
function scoreOf(
	candidate: LabelCandidate,
	rank: number,
	current: number | undefined,
	kept: LabelRect[],
	{ dots = [], bounds }: PlacementContext
): number {
	const { rect, offset } = candidate;
	// The place the label names: where it would sit with no offset at all.
	const x = (rect.left + rect.right) / 2 - offset[0];
	const y = (rect.top + rect.bottom) / 2 - offset[1];
	let room = ROOM_CAP_PX;
	for (const other of kept) room = Math.min(room, rectDistance(rect, other));
	let covered = 0;
	const near = ROOM_CAP_PX + DOT_RADIUS_PX;
	for (const dot of dots) {
		// Too far to matter either way: skipped before the square root.
		if (
			dot.x < rect.left - near ||
			dot.x > rect.right + near ||
			dot.y < rect.top - near ||
			dot.y > rect.bottom + near
		)
			continue;
		// Its own dot: the offset already keeps clear of that one.
		if (Math.abs(dot.x - x) < 1 && Math.abs(dot.y - y) < 1) continue;
		const clear = pointDistance(rect, dot.x, dot.y) - DOT_RADIUS_PX;
		if (clear < 0) covered++;
		room = Math.min(room, Math.max(0, clear));
	}
	return (
		room -
		REACH_WEIGHT * pointDistance(rect, x, y) -
		covered * DOT_COST -
		(bounds ? outsideShare(rect, bounds) * OFFSCREEN_COST : 0) -
		rank * RANK_COST +
		(rank === current ? STAY_BONUS : 0)
	);
}

/**
 * Places the labels: the most important first, each in the best-scoring spot
 * it has that doesn't touch a label already placed. One result per label, in
 * the order given; a label with nowhere to go is not visible, and keeps its
 * first spot so it lands sensibly when the map next makes room. A label with
 * no size yet (not laid out) is always kept - it can't hide anything, and the
 * next pass will place it properly.
 */
export function choosePlacements(
	labels: LabelPlacement[],
	context: PlacementContext = {}
): ChosenPlacement[] {
	const gap = context.gap ?? GAP_PX;
	const order = labels.map((label, index) => index);
	order.sort((a, b) => labels[b].priority - labels[a].priority || a - b);
	const chosen: ChosenPlacement[] = labels.map((label) => ({
		visible: false,
		offset: label.candidates[0].offset,
		index: 0
	}));
	const kept: LabelRect[] = [];
	for (const index of order) {
		const { candidates, current } = labels[index];
		if (hasNoSize(candidates[0].rect)) {
			chosen[index].visible = true;
			continue;
		}
		let best = -1;
		let bestScore = -Infinity;
		candidates.forEach((candidate, rank) => {
			if (kept.some((other) => overlaps(candidate.rect, other, gap))) return;
			const score = scoreOf(candidate, rank, current, kept, context);
			if (score > bestScore) {
				best = rank;
				bestScore = score;
			}
		});
		if (best < 0) continue;
		chosen[index] = { visible: true, offset: candidates[best].offset, index: best };
		kept.push(candidates[best].rect);
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
		{ gap }
	).map((placement) => placement.visible);
}

/** A popup the pass can move: `maplibregl.Popup`, or a stand-in in tests. */
export interface MovableLabel {
	getElement(): HTMLElement | undefined;
	setOffset(offset: [number, number]): unknown;
	/** The place the label names - a Popup has it; a test stand-in may not. */
	getLngLat?(): { lng: number; lat: number };
}

interface RegisteredLabel {
	label: MovableLabel;
	/** The offset the pass last applied, so it can work back to the anchor. */
	applied: [number, number];
	/** Which candidate that was, while the label is drawn (the stay bonus). */
	current?: number;
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

/** The spots one label may take, the view's favourite first. */
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
		// Beside the dot: the four sides in reading order, then the four
		// corners, right-hand ones first. A corner's nearest point keeps the
		// same distance from the dot as a side's does.
		const x = beside + width / 2;
		const y = beside + height / 2;
		const d = beside * Math.SQRT1_2;
		const cx = d + width / 2;
		const cy = d + height / 2;
		return [
			at(x, 0),
			at(-x, 0),
			at(0, -y),
			at(0, y),
			at(cx, -cy),
			at(cx, cy),
			at(-cx, -cy),
			at(-cx, cy)
		];
	}
	// On the place itself, or one line off it if that is taken. Any further
	// and the name would start to look like it belongs to the neighbour.
	const line = height + GAP_PX;
	return [at(0, 0), at(0, -line), at(0, line)];
}

/** The labels of one map container, as the collision pass sees them. */
function readLabels(
	popups: HTMLElement[],
	placeOf: (label: MovableLabel) => Dot | undefined
): (LabelPlacement & { registered?: RegisteredLabel })[] {
	return popups.map((popup) => {
		const registered = registry.get(popup);
		const magnified = popup.querySelector(`.${HOVERED_CLASS}, .${MAGNIFIED_CLASS}`) !== null;
		const priority = Number(popup.getAttribute(PRIORITY_ATTR) ?? 0);
		const rect = popup.getBoundingClientRect();
		const [dx, dy] = registered?.applied ?? [0, 0];
		// Where the place itself is on screen. From the map's projection when
		// there is one: the DOM has it rounded to a whole pixel (MapLibre
		// positions popups that way), and against unrounded dots that rounding
		// was enough to flip a near-tied name across its dot on a half-pixel
		// pan. Otherwise the label's middle, less the offset last applied.
		const anchor = (registered && placeOf(registered.label)) ?? {
			x: (rect.left + rect.right) / 2 - dx,
			y: (rect.top + rect.bottom) / 2 - dy
		};
		const width = rect.right - rect.left;
		const height = rect.bottom - rect.top;
		return {
			// A name the player is pointing at, or has tapped, is the one name
			// they asked for: it always wins its place.
			priority: magnified ? Infinity : Number.isFinite(priority) ? priority : 0,
			candidates: registered
				? candidatesFor(anchor, width, height, registered.beside)
				: [{ offset: [0, 0] as [number, number], rect }],
			current: registered?.current,
			registered
		};
	});
}

/**
 * What the pass is told about the map beyond its labels, in px relative to
 * the container - what `map.project` returns.
 */
export interface CollisionGeometry {
	/** Every town's dot on screen, so names keep off them. */
	dots?: () => Dot[];
	/** Where a place is on screen, so a label's anchor needn't come from the DOM. */
	project?: (lngLat: [number, number]) => Dot;
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
export function enableLabelCollision(
	map: CollisionMap,
	container: HTMLElement,
	{ dots = () => [], project }: CollisionGeometry = {}
): () => void {
	let frame = 0;
	// Between a 'move' and its 'moveend'. Only then does a name get the stay
	// bonus; a pass on a still map places every name afresh.
	let moving = false;

	const pass = () => {
		frame = 0;
		const popups = [...container.querySelectorAll<HTMLElement>('.maplibregl-popup')];
		if (popups.length === 0) return;
		const bounds = container.getBoundingClientRect();
		const onPage = ({ x, y }: Dot) => ({ x: x + bounds.left, y: y + bounds.top });
		const labels = readLabels(popups, (label) => {
			const place = project && label.getLngLat?.();
			return place ? onPage(project([place.lng, place.lat])) : undefined;
		});
		if (!moving) for (const label of labels) label.current = undefined;
		const placements = choosePlacements(labels, { bounds, dots: dots().map(onPage) });
		popups.forEach((popup, index) => {
			const { visible, offset, index: chosen } = placements[index];
			popup.classList.toggle(CROWDED_CLASS, !visible);
			const registered = labels[index].registered;
			if (!registered) return;
			registered.current = visible ? chosen : undefined;
			if (registered.applied[0] === offset[0] && registered.applied[1] === offset[1]) return;
			registered.applied = offset;
			registered.label.setOffset(offset);
		});
	};
	const schedule = () => {
		if (!frame) frame = requestAnimationFrame(pass);
	};
	const move = () => {
		moving = true;
		schedule();
	};
	const settle = () => {
		moving = false;
		schedule();
	};

	map.on('move', move);
	map.on('moveend', settle);
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
		map.off('move', move);
		map.off('moveend', settle);
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
