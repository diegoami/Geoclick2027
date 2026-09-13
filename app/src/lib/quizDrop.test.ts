import { describe, expect, it } from 'vitest';
import { resolveDrop, type DropInput } from './quizDrop';

const polygon = (over: Partial<DropInput>): DropInput => ({
	exactName: undefined,
	nearbyNames: [],
	draggedName: 'Bremen',
	isPointMap: false,
	closestName: undefined,
	...over
});
const point = (over: Partial<DropInput>): DropInput => ({
	exactName: undefined,
	nearbyNames: [],
	draggedName: 'Essen',
	isPointMap: true,
	closestName: undefined,
	...over
});

const SCORED_CORRECT = { scored: true, correct: true };
const SCORED_WRONG = { scored: true, correct: false };
const NOT_SCORED = { scored: false, correct: false };

describe('resolveDrop - polygon maps', () => {
	it('exact hit on the correct region is correct', () => {
		expect(resolveDrop(polygon({ exactName: 'Bremen', nearbyNames: ['Bremen'] }))).toEqual(
			SCORED_CORRECT
		);
	});

	it('exact point misses everything, correct region within tolerance: correct', () => {
		expect(resolveDrop(polygon({ exactName: undefined, nearbyNames: ['Bremen'] }))).toEqual(
			SCORED_CORRECT
		);
	});

	it('Bremen: the exact point lands on the enclosing neighbour, Bremen within tolerance - correct', () => {
		// The case the 24px tolerance exists for (DECISIONS.md, "Drop hit-testing").
		// Bremen is enclosed by Niedersachsen; a drop aimed at it lands exactly on
		// Niedersachsen. GC-021's spec listed this as "must be incorrect" - that
		// would have made Bremen practically unhittable again.
		expect(
			resolveDrop(polygon({ exactName: 'Niedersachsen', nearbyNames: ['Niedersachsen', 'Bremen'] }))
		).toEqual(SCORED_CORRECT);
	});

	it('a wrong drop is not rescued: exact hit on another region, correct one nowhere near', () => {
		expect(
			resolveDrop(polygon({ exactName: 'Bayern', nearbyNames: ['Bayern', 'Baden-Württemberg'] }))
		).toEqual(SCORED_WRONG);
	});

	it('tolerance only helps the dragged target: nearby regions do not make it count for them', () => {
		// Dragging Hamburg onto Niedersachsen next to Bremen: Bremen being nearby
		// must not matter - it is not the slip being dragged.
		expect(
			resolveDrop(
				polygon({
					draggedName: 'Hamburg',
					exactName: 'Niedersachsen',
					nearbyNames: ['Niedersachsen', 'Bremen']
				})
			)
		).toEqual(SCORED_WRONG);
	});

	it('empty sea, nothing nearby: not scored at all', () => {
		expect(resolveDrop(polygon({ exactName: undefined, nearbyNames: [] }))).toEqual(NOT_SCORED);
	});
});

describe('resolveDrop - point maps (city markers)', () => {
	it('Essen/Duisburg: both inside the radius, the dragged city is the farther one - wrong', () => {
		// ~22px apart at the default zoom, inside the 30px point tolerance. Before
		// the closest-candidate rule, dropping the Essen slip on Duisburg counted as
		// correct because Essen was merely "nearby".
		expect(
			resolveDrop(
				point({
					exactName: 'Duisburg',
					nearbyNames: ['Duisburg', 'Essen'],
					closestName: 'Duisburg'
				})
			)
		).toEqual(SCORED_WRONG);
		// Same when the drop lands between the markers rather than on one.
		expect(
			resolveDrop(
				point({ exactName: undefined, nearbyNames: ['Duisburg', 'Essen'], closestName: 'Duisburg' })
			)
		).toEqual(SCORED_WRONG);
	});

	it('the dragged city is the closest candidate - correct', () => {
		expect(
			resolveDrop(
				point({ exactName: undefined, nearbyNames: ['Duisburg', 'Essen'], closestName: 'Essen' })
			)
		).toEqual(SCORED_CORRECT);
	});

	it('an exact hit on the dragged city is correct even if another centroid is marginally closer', () => {
		expect(
			resolveDrop(
				point({ exactName: 'Essen', nearbyNames: ['Essen', 'Duisburg'], closestName: 'Duisburg' })
			)
		).toEqual(SCORED_CORRECT);
	});

	it('point maps ignore plain "nearby" membership - only closest counts', () => {
		expect(
			resolveDrop(point({ exactName: undefined, nearbyNames: ['Essen'], closestName: undefined }))
		).toEqual(SCORED_WRONG);
	});

	it('nothing nearby: not scored', () => {
		expect(resolveDrop(point({ exactName: undefined, nearbyNames: [] }))).toEqual(NOT_SCORED);
	});
});
