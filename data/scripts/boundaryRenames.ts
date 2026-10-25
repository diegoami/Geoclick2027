// Keep fact-source grouping aligned with custom name-based boundary dissolves.
// Only the map's country changes; source objects can be reused by other maps.
export function applyBoundaryRenames<T extends { properties: Record<string, unknown> }>(
	rows: readonly T[],
	country: string | undefined,
	renames: Readonly<Record<string, string>>
): T[] {
	return rows.map((feature) => {
		if (!country || feature.properties.admin !== country) return feature;
		const original = feature.properties.name;
		const name = typeof original === 'string' ? renames[original] : undefined;
		return typeof name === 'string' && name
			? { ...feature, properties: { ...feature.properties, name } }
			: feature;
	});
}
