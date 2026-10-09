// The fact box's largest city and the towns maps share one spelling table (#227).
import { describe, expect, it } from 'vitest';
import { fixTownName } from '../../../data/scripts/townNameFixups';

describe('fixTownName', () => {
	it('fixes a name listed for its country', () => {
		expect(fixTownName('Ukraine', 'Odessa')).toBe('Odesa');
	});
	it('leaves a name of another country alone', () => {
		expect(fixTownName('United States of America', 'Odessa')).toBe('Odessa');
	});
	it('returns an unlisted name unchanged', () => {
		expect(fixTownName('Algeria', 'Alger')).toBe('Alger');
	});
});
