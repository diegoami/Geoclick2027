import { describe, expect, it } from 'vitest';
import { parseAppearance } from './appearance';

describe('appearance stored preferences', () => {
	it.each([50, 300])('accepts the supported size %s', (scale) => {
		expect(parseAppearance(JSON.stringify({ scale, scheme: 'classic' })).scale).toBe(scale);
	});
	it.each([null, '', '{', 'null', '[]', '42', '"ocean"'])('defaults safely for %s', (raw) => {
		expect(parseAppearance(raw)).toEqual({ scale: 100, scheme: 'classic' });
	});
	it('preserves valid fields independently and refuses arbitrary CSS values', () => {
		expect(parseAppearance('{"scale":150,"scheme":"ocean"}')).toEqual({
			scale: 150,
			scheme: 'ocean'
		});
		expect(parseAppearance('{"scale":-100,"scheme":"forest"}')).toEqual({
			scale: 100,
			scheme: 'forest'
		});
		expect(parseAppearance('{"scale":200,"scheme":"url(evil)"}')).toEqual({
			scale: 200,
			scheme: 'classic'
		});
		expect(parseAppearance('{"scale":"150%","scheme":"contrast"}')).toEqual({
			scale: 100,
			scheme: 'contrast'
		});
	});
});
