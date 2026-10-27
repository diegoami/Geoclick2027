import { createHash } from 'node:crypto';
/** WFS responses contain a volatile timestamp: pin named geometry, not that wrapper. */
export function boundaryFeatureDigest(raw: Uint8Array, nameField: string, idField: string): string {
	const data = JSON.parse(Buffer.from(raw).toString('utf8')) as {
		features: {
			properties: Record<string, unknown>;
			geometry: { type: string; coordinates: unknown };
		}[];
	};
	const features = data.features
		.map((f) => ({
			name: String(f.properties[nameField]),
			id: String(f.properties[idField]),
			geometry: { type: f.geometry.type, coordinates: f.geometry.coordinates }
		}))
		.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
	return createHash('sha256').update(JSON.stringify(features)).digest('hex');
}
