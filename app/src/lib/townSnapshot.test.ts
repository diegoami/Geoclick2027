import { describe, expect, it } from 'vitest';
import { newestTownRows, type TownBinding } from '../../../data/scripts/townSnapshot';
const row = (population: string, date?: string, name = 'Town'): TownBinding => ({
	item: { value: 'Q1' },
	population: { value: population },
	name: { value: name },
	...(date ? { date: { value: date } } : {})
});
describe('town snapshot population observations', () => {
	it('uses a newer smaller observation instead of an old larger census or undated value', () => {
		const recent = row('18000', '2025-01-01T00:00:00Z', 'Current label');
		expect(
			newestTownRows(
				[row('90000'), row('25000', '2011-01-01T00:00:00Z'), recent],
				'2026-10-25T00:00:00Z'
			)
		).toEqual([recent]);
	});
	it('does not mistake future projections for current population', () => {
		const observed = row('18000', '2025-01-01T00:00:00Z');
		expect(
			newestTownRows([observed, row('45000', '2030-01-01T00:00:00Z')], '2026-10-25T00:00:00Z')
		).toEqual([observed]);
	});
	it('rejects malformed observations instead of writing a partial snapshot', () => {
		expect(() => newestTownRows([row('not a number')], '2026-10-25')).toThrow();
		expect(() => newestTownRows([row('10', 'invalid')], '2026-10-25')).toThrow();
		expect(() => newestTownRows([{ population: { value: '10' } }], '2026-10-25')).toThrow();
	});
});
