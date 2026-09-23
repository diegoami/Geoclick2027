// Adding a language to an authored country file (FT-50). Imported from
// data/scripts the way authoredHooks.test.ts is.
import { describe, expect, it } from 'vitest';
import { mergeTranslations, missingTranslations } from '../../../data/scripts/translation';

const file = () => ({
	_note: ['commentary, not a place'],
	lisboa: ['One.', 'Two.'],
	porto: { en: ['Uno.', 'Due.'], it: ['Uno.', 'Due.'] },
	jilin: { region: ['Province.'], city: ['Town.', 'Town again.'] }
});

describe('missingTranslations', () => {
	it('lists the English still waiting, by place and by kind', () => {
		expect(missingTranslations(file(), 'it')).toEqual({
			lisboa: ['One.', 'Two.'],
			jilin: { region: ['Province.'], city: ['Town.', 'Town again.'] }
		});
	});
});

describe('mergeTranslations', () => {
	it('adds the language after English, keeping every other place as it was', () => {
		const { merged, problems } = mergeTranslations(file(), 'it', {
			lisboa: ['Uno.', 'Due.'],
			jilin: { region: ['Provincia.'], city: ['Città.', 'Ancora città.'] }
		});
		expect(problems).toEqual([]);
		expect(merged.lisboa).toEqual({ en: ['One.', 'Two.'], it: ['Uno.', 'Due.'] });
		expect(merged.jilin).toEqual({
			region: { en: ['Province.'], it: ['Provincia.'] },
			city: { en: ['Town.', 'Town again.'], it: ['Città.', 'Ancora città.'] }
		});
		expect(merged.porto).toEqual(file().porto);
		expect(Object.keys(merged)).toEqual(Object.keys(file()));
		expect(missingTranslations(merged, 'it')).toEqual({});
	});

	it('refuses the whole patch over one wrong count, unknown place or overwrite', () => {
		const { merged, problems } = mergeTranslations(file(), 'it', {
			lisboa: ['Solo uno.'],
			nowhere: ['?'],
			porto: ['Di nuovo.', 'Ancora.']
		});
		expect(problems).toEqual([
			'lisboa: 1 sentences for 2 English',
			'nowhere: no such place in the country file',
			'porto: already has "it"'
		]);
		expect(merged).toEqual(file());
	});

	it('holds Italian to the house style', () => {
		const { problems } = mergeTranslations(file(), 'it', {
			lisboa: ['Uno — due.', 'Due.']
		});
		expect(problems).toEqual(['lisboa: sentence 1 keeps an em dash']);
		expect(mergeTranslations(file(), 'it', { lisboa: ["L'isola.", 'Due.'] }).problems).toEqual([
			'lisboa: sentence 1 has a straight apostrophe'
		]);
		expect(mergeTranslations(file(), 'it', { lisboa: ['Uno.', 'Two.'] }).problems).toEqual([
			'lisboa: sentence 2 is still the English'
		]);
	});

	it('wants a split patch for a place split by kind', () => {
		const { problems } = mergeTranslations(file(), 'it', { jilin: ['Provincia.'] });
		expect(problems).toEqual(['jilin: split by kind in the file, so the patch must be too']);
	});
});
