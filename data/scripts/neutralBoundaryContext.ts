import { readFileSync, writeFileSync } from 'node:fs';
export function appendNeutralBoundaryContext(landPath: string, contextFeatures: unknown[]): void {
	if (!contextFeatures.length) return;
	const land = JSON.parse(readFileSync(landPath, 'utf8')) as { features: unknown[] };
	land.features.push(...contextFeatures);
	writeFileSync(landPath, JSON.stringify(land));
}
