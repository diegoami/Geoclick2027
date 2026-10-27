import { expect, it } from 'vitest';
import { boundaryFeatureDigest } from '../../../data/scripts/boundaryContentHash';
it('pins WFS named geometry while ignoring response timestamps and feature order', () => {
	const a = { properties: { NAME: 'A', ID: 1 }, geometry: { type: 'Point', coordinates: [1, 2] } };
	const b = { properties: { NAME: 'B', ID: 2 }, geometry: { type: 'Point', coordinates: [3, 4] } };
	const raw = (features: unknown[], timeStamp: string) =>
		Buffer.from(JSON.stringify({ type: 'FeatureCollection', features, timeStamp }));
	expect(boundaryFeatureDigest(raw([a, b], 'old'), 'NAME', 'ID')).toBe(
		boundaryFeatureDigest(raw([b, a], 'new'), 'NAME', 'ID')
	);
	expect(boundaryFeatureDigest(raw([a, b], 'old'), 'NAME', 'ID')).not.toBe(
		boundaryFeatureDigest(
			raw([{ ...a, geometry: { type: 'Point', coordinates: [2, 2] } }, b], 'old'),
			'NAME',
			'ID'
		)
	);
});
