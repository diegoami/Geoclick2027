/** Canonical coordinates stay unchanged; framing/projection can use a nearby world copy. */
export type LongitudeBox = [number, number, number, number];
export function longitudeNear(longitude: number, centre: number): number {
	return longitude + 360 * Math.round((centre - longitude) / 360);
}
export function wrappedPointBounds(points: readonly (readonly [number, number])[]): LongitudeBox {
	if (!points.length || points.some((point) => !point.every(Number.isFinite)))
		throw new Error('Finite nonempty point bounds required');
	const longitudes = points.map((point) => ((point[0] % 360) + 360) % 360).sort((a, b) => a - b);
	let largest = -1,
		cut = 0;
	for (let i = 0; i < longitudes.length; i++) {
		const gap =
			(i + 1 < longitudes.length ? longitudes[i + 1] : longitudes[0] + 360) - longitudes[i];
		if (gap > largest) {
			largest = gap;
			cut = i;
		}
	}
	let west = longitudes[(cut + 1) % longitudes.length],
		east = longitudes[cut];
	if (east < west) east += 360;
	if (west > 180) {
		west -= 360;
		east -= 360;
	}
	return [
		west,
		Math.min(...points.map((point) => point[1])),
		east,
		Math.max(...points.map((point) => point[1]))
	];
}
/** Split an unwrapped window into canonical OGR query/clip rectangles. */
export function splitLongitudeBox([west, south, east, north]: LongitudeBox): LongitudeBox[] {
	if (![west, south, east, north].every(Number.isFinite) || east < west || north < south)
		throw new Error('Invalid longitude window');
	if (east - west >= 360) return [[-180, south, 180, north]];
	const shift = 360 * Math.floor((west + 180) / 360);
	west -= shift;
	east -= shift;
	return east <= 180
		? [[west, south, east, north]]
		: [
				[west, south, 180, north],
				[-180, south, east - 360, north]
			];
}
export function longitudeInBox(longitude: number, box: LongitudeBox): boolean {
	const at = longitudeNear(longitude, (box[0] + box[2]) / 2);
	return at >= box[0] && at <= box[2];
}
