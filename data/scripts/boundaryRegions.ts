// Resolve a town to the canonical names taught by its administrative map.
import { pointInPolygon, type AnyGeometry, type Position } from './factGeometry.js';
export interface NamedRegion {
	properties: Record<string, unknown>;
	geometry: AnyGeometry;
}
export function canonicalRegionAtPoint(
	point: Position,
	regions: readonly NamedRegion[],
	country: string,
	targetNames: ReadonlySet<string>,
	coordinatePrecision = 0
): string | undefined {
	const namesAt = (position: Position) =>
		new Set(
			regions
				.filter(
					(r) =>
						r.properties.admin === country &&
						typeof r.properties.name === 'string' &&
						targetNames.has(r.properties.name) &&
						pointInPolygon(position, r.geometry)
				)
				.map((r) => String(r.properties.name))
		);
	const names = namesAt(point);
	if (names.size > 0 || !Number.isFinite(coordinatePrecision) || coordinatePrecision <= 0)
		return names.size === 1 ? [...names][0] : undefined;
	// A rounded coastal coordinate can fall just outside land. Only infer an
	// association inside its stated precision, capped at 0.01 degree (~1 km),
	// plus the prepared geometry’s 0.000001-degree rounding, and only when
	// the sampled uncertainty box finds one region.
	const offset = Math.min(coordinatePrecision, 0.01) + 0.000001;
	for (const dx of [-offset, 0, offset])
		for (const dy of [-offset, 0, offset])
			for (const name of namesAt([point[0] + dx, point[1] + dy])) names.add(name);

	return names.size === 1 ? [...names][0] : undefined;
}
