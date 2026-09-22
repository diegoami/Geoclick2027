// The authored name-facts' file shape (FT-49, docs/PLAN_V0.10.md). Imported
// from data/scripts the way factGeometry.test.ts does - the build script
// needs ogr2ogr, this parser does not.
import { describe, expect, it } from 'vitest';
import { parseAuthoredFile, parseAuthoredHooks } from '../../../data/scripts/authoredHooks';

describe('parseAuthoredHooks', () => {
	it('reads a plain list as English for any kind', () => {
		expect(parseAuthoredHooks(['a', 'b'])).toEqual({ any: { en: ['a', 'b'] } });
	});

	it('reads a per-language object', () => {
		expect(parseAuthoredHooks({ en: ['a'], it: ['A'] })).toEqual({
			any: { en: ['a'], it: ['A'] }
		});
	});

	it('reads the per-kind form', () => {
		expect(parseAuthoredHooks({ region: ['r'], city: ['c'] })).toEqual({
			region: { en: ['r'] },
			city: { en: ['c'] }
		});
	});

	it('reads a per-kind form whose parts are per-language', () => {
		expect(parseAuthoredHooks({ region: { en: ['r'], it: ['R'] }, city: ['c'] })).toEqual({
			region: { en: ['r'], it: ['R'] },
			city: { en: ['c'] }
		});
	});

	it('keeps a per-kind form with an explicit any', () => {
		expect(parseAuthoredHooks({ any: ['a'], city: ['c'] })).toEqual({
			any: { en: ['a'] },
			city: { en: ['c'] }
		});
	});

	// Either reading of a mixed object would silently discard the other
	// branch, so the shape is rejected outright - a loud file error beats a
	// quiet data loss.
	it('rejects a value that mixes a language key with a kind key', () => {
		expect(() => parseAuthoredHooks({ en: ['general'], city: ['city fact'] })).toThrow(
			/cannot mix/
		);
		expect(() => parseAuthoredHooks({ any: ['a'], en: ['b'], city: ['c'] })).toThrow(/cannot mix/);
	});

	it('has nothing for an empty or nonsense value', () => {
		expect(parseAuthoredHooks([])).toBeUndefined();
		expect(parseAuthoredHooks({})).toBeUndefined();
		expect(parseAuthoredHooks({ en: [] })).toBeUndefined();
		expect(parseAuthoredHooks('nope')).toBeUndefined();
	});
});

describe('parseAuthoredFile', () => {
	it('skips the commentary key and keeps the places', () => {
		expect(
			parseAuthoredFile({
				_note: ['explaining the file'],
				lombardia: ['a'],
				jilin: { region: ['r'], city: ['c'] }
			})
		).toEqual({
			lombardia: { any: { en: ['a'] } },
			jilin: { region: { en: ['r'] }, city: { en: ['c'] } }
		});
	});
});
