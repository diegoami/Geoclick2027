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

it('uses coordinate precision only after choosing the newest population observation', () => {
	const dated = row('18000', '2025-01-01T00:00:00Z');
	const rough = { ...dated, coord: { value: 'Point(1 1)' }, precision: { value: '0.0166667' } };
	const precise = {
		...dated,
		coord: { value: 'Point(1.001 1.001)' },
		precision: { value: '0.00001' }
	};
	expect(newestTownRows([rough, precise], '2026-10-26')).toEqual([precise]);
	const old = {
		...precise,
		date: { value: '2011-01-01T00:00:00Z' },
		precision: { value: '0.000001' }
	};
	expect(newestTownRows([rough, old], '2026-10-26')).toEqual([rough]);
});

it('chooses a supported city coordinate without preferring an older population observation', () => {
	const observation = row('18000', '2025-01-01T00:00:00Z');
	const outside = { ...observation, coord: { value: 'outside' }, precision: { value: '0.000001' } };
	const inside = { ...observation, coord: { value: 'inside' }, precision: { value: '0.00027778' } };
	const supports = (r: TownBinding) => r.coord?.value === 'inside';
	expect(newestTownRows([outside, inside], '2026-10-26', supports)).toEqual([inside]);
	const old = { ...inside, date: { value: '2011-01-01T00:00:00Z' } };
	expect(newestTownRows([outside, old], '2026-10-26', supports)).toEqual([outside]);
});
