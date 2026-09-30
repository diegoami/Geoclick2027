// How a map is framed: what a fit has to leave clear for the view's own
// furniture (FT-25, docs/PLAN_V0.6.md). Its own module, away from
// geoclickMap.ts's MapLibre and PMTiles plumbing, because it is plain DOM
// measurement - and testable as such.

/** Air between the map's targets and a bare edge of the screen. */
const EDGE_MARGIN_PX = 40;
/** Air between the targets and a piece of furniture, which is already a
 * visible boundary of its own - so less of it is needed than at a bare edge,
 * and on a phone every pixel given back here is map. */
const OVERLAY_MARGIN_PX = 12;
// A fit cannot ask for more padding than the map has room for: MapLibre
// gives up ("Map cannot fit within canvas...") and leaves the camera where it
// was. The furniture legitimately takes a lot of a phone screen - a map bar
// and a quiz tray together are over half of it - so the limit is high, and
// only steps in when a view would leave the map almost nothing.
const MAX_PADDING_FRACTION = 0.85;

export interface FitPadding {
	top: number;
	right: number;
	bottom: number;
	left: number;
}

/**
 * How much of the map each view's own furniture covers, measured from the DOM
 * (FT-25). The map bar sits over the top of the map, the quiz tray and the
 * tour's controls over the bottom, so a fit that ignores them starts with the
 * northernmost regions hidden behind the bar - on a phone the first thing a
 * player had to do was pan (v0.5.0 product review, F1). Every overlay marks
 * itself with data-map-overlay="top" / "bottom"; anything new is included by
 * saying so in its markup.
 *
 * `extra` adds to a side beyond what is on screen right now - the quiz uses
 * it for the height its tray is about to have.
 */
export function mapFitPadding(container: HTMLElement, extra: Partial<FitPadding> = {}): FitPadding {
	const box = container.getBoundingClientRect();
	// The map can live inside a visual shell (the chart-art frame) while the
	// view's furniture remains outside it. Measure from the owning view, not
	// the immediate parent, so the frame cannot hide overlay bounds from fits.
	const root =
		container.closest<HTMLElement>('[data-map-fit-root]') ?? container.parentElement ?? container;
	const padding: FitPadding = {
		top: extra.top ?? 0,
		right: extra.right ?? 0,
		bottom: extra.bottom ?? 0,
		left: extra.left ?? 0
	};
	for (const overlay of root.querySelectorAll<HTMLElement>('[data-map-overlay]')) {
		const rect = overlay.getBoundingClientRect();
		if (rect.width === 0 || rect.height === 0) continue;
		const side = overlay.dataset.mapOverlay;
		if (side === 'top') padding.top = Math.max(padding.top, rect.bottom - box.top);
		else if (side === 'bottom') padding.bottom = Math.max(padding.bottom, box.bottom - rect.top);
		else if (side === 'left') padding.left = Math.max(padding.left, rect.right - box.left);
		else if (side === 'right') padding.right = Math.max(padding.right, box.right - rect.left);
	}
	for (const side of ['top', 'right', 'bottom', 'left'] as const) {
		const covered = padding[side] > 0;
		padding[side] = Math.max(0, padding[side]) + (covered ? OVERLAY_MARGIN_PX : EDGE_MARGIN_PX);
	}
	// Scale each axis back if the furniture leaves too little room to fit into.
	const fit = (a: 'top' | 'left', b: 'bottom' | 'right', size: number) => {
		const room = size * MAX_PADDING_FRACTION;
		const asked = padding[a] + padding[b];
		if (asked <= room || asked === 0) return;
		padding[a] = (padding[a] / asked) * room;
		padding[b] = (padding[b] / asked) * room;
	};
	fit('top', 'bottom', box.height);
	fit('left', 'right', box.width);
	return padding;
}
