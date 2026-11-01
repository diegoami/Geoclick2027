import { describe, expect, it } from 'vitest';
import { rate } from '@geoclick/srs';
import {
	analyzeProgressEvents,
	parseProgressEvent,
	projectProgress,
	type ProgressEvent,
	type ProgressOperation,
	type ProgressOwner
} from './progressEvents';
const owner: ProgressOwner = { projectId: 'test-project', uid: 'account-A' };
const map = 'italy-regions',
	targets = new Set(['one', 'two']);
const answer = (
	grade: 'good' | 'again' | 'hard' = 'good',
	targetId = 'one'
): Extract<ProgressOperation, { kind: 'answer' }> => ({
	kind: 'answer',
	mapId: map,
	targetId,
	roundId: 'round-1',
	grade,
	date: '2026-11-01'
});
const event = (
	id: string,
	actor: string,
	sequence: number,
	logicalTime: number,
	parents: string[],
	operation: ProgressOperation,
	key = id
): ProgressEvent => ({
	version: 1,
	id,
	...owner,
	deviceId: actor,
	sequence,
	logicalTime,
	parents,
	operationKey: key,
	operation
});
const project = (events: unknown[]) =>
	projectProgress(analyzeProgressEvents(events, owner), map, targets);
function permutations<T>(items: T[]): T[][] {
	return items.length
		? items.flatMap((item, i) =>
				permutations(items.filter((_, j) => i !== j)).map((rest) => [item, ...rest])
			)
		: [[]];
}
const summary = { total: 2, perfect: 2, totalErrors: 0, completedAt: '2026-11-01T12:00:00.000Z' };
const round = (
	id = 'round-1',
	errors = 0,
	ms = 2000
): Extract<ProgressOperation, { kind: 'round' }> => ({
	kind: 'round',
	mapId: map,
	roundId: id,
	summary: { ...summary, totalErrors: errors },
	slipped: errors ? 1 : 0,
	timedMs: ms
});

describe('immutable causal progress', () => {
	it('deduplicates delivery and replays actual scheduler mistakes rather than max levels', () => {
		const a = event('a', 'device-a', 1, 1, [], answer());
		const b = event('b', 'device-a', 2, 2, ['a'], answer());
		const c = event('c', 'device-a', 3, 3, ['b'], answer('again'));
		const result = project([c, a, b, a, c]);
		expect(result.cards[0].cleanStreak).toBe(1);
		expect(result.cards[0]).toEqual({
			targetId: 'one',
			...rate(
				rate(rate(undefined, 'good', '2026-11-01'), 'good', '2026-11-01'),
				'again',
				'2026-11-01'
			)
		});
	});
	it('converges for every input order with concurrent correct/wrong practice and clock skew', () => {
		const a = event('a', 'device-a', 1, 1, [], answer());
		const b = event('b', 'device-b', 1, 1, [], { ...answer('again'), date: '2099-01-01' });
		const c = event('c', 'device-a', 2, 2, ['a', 'b'], answer());
		const d = event('d', 'device-b', 2, 3, ['c'], round());
		const expected = project([a, b, c, d]);
		for (const order of permutations([a, b, c, d])) expect(project(order)).toEqual(expected);
		expect(expected.cards[0].cleanStreak).toBe(1);
		expect(expected.lastSession).toEqual(summary);
	});
	it('reset wins over old/concurrent practice regardless of arrival and later observed practice survives', () => {
		const a = event('a', 'device-a', 1, 1, [], answer());
		const reset = event('reset', 'device-b', 1, 2, ['a'], {
			kind: 'reset',
			scope: 'known',
			mapId: map
		});
		const stale = event('stale', 'device-a', 2, 3, ['a'], answer());
		const fresh = event('fresh', 'device-b', 2, 4, ['reset', 'stale'], answer());
		for (const order of permutations([a, reset, stale, fresh])) {
			const result = project(order);
			expect(result.cards.map((c) => c.cleanStreak)).toEqual([1]);
			expect(result.ignored.map((i) => i.id).sort()).toEqual(['a', 'stale']);
		}
	});
	it('concurrent resets require observing both and retain their causal history', () => {
		const ra = event('ra', 'a', 1, 1, [], { kind: 'reset', scope: 'known', mapId: map });
		const rb = event('rb', 'b', 1, 1, [], { kind: 'reset', scope: 'known', mapId: map });
		const pa = event('pa', 'a', 2, 2, ['ra'], answer());
		const pb = event('pb', 'b', 2, 2, ['rb'], answer());
		const both = event('both', 'a', 3, 3, ['pa', 'pb'], answer());
		expect(project([ra, rb, pa, pb]).cards).toEqual([]);
		expect(project([both, pb, pa, rb, ra]).cards.map((c) => c.cleanStreak)).toEqual([1]);
	});
	it('known reset keeps the last score but clears learning records; map/all clears remove scores', () => {
		const a = event('a', 'a', 1, 1, [], answer());
		const r = event('r', 'a', 2, 2, ['a'], round());
		const k = event('k', 'a', 3, 3, ['r'], { kind: 'reset', scope: 'known', mapId: map });
		const known = project([k, r, a]);
		expect(known.cards).toEqual([]);
		expect(known.lastSession).toEqual(summary);
		expect(known.records).toEqual({});
		const clear = event('clear', 'a', 4, 4, ['k'], { kind: 'reset', scope: 'map', mapId: map });
		expect(project([a, r, k, clear]).lastSession).toBeUndefined();
		const all = event('all', 'b', 1, 5, ['clear'], { kind: 'reset', scope: 'all' });
		expect(project([all, clear, k, r, a]).cards).toEqual([]);
		expect(project([all, clear, k, r, a]).lastSession).toBeUndefined();
	});
	it('does not clear another map and uses minimum clean best time', () => {
		const a = event('a', 'a', 1, 1, [], round('one', 0, 3000));
		const b = event('b', 'a', 2, 2, ['a'], round('two', 1, 1000));
		const c = event('c', 'a', 3, 3, ['b'], round('three', 0, 2000));
		const reset = event('reset', 'a', 4, 4, ['c'], {
			kind: 'reset',
			scope: 'known',
			mapId: 'another-map'
		});
		expect(project([reset, c, b, a]).records.bestTimeMs).toBe(2000);
		expect(project([reset, c, b, a]).lastSession).toEqual(summary);
	});
	it('counts wrong-target deltas and forgets a learned pair at round completion', () => {
		const events: ProgressEvent[] = [];
		let previous: string[] = [];
		let sequence = 0;
		const add = (op: ProgressOperation) => {
			const id = 'e' + ++sequence;
			events.push(event(id, 'a', sequence, sequence, previous, op));
			previous = [id];
		};
		add({ ...answer('again'), chosenId: 'two' });
		add({ ...answer('again'), chosenId: 'two' });
		expect(project(events).records.confusions).toEqual([
			{ targetId: 'one', chosenId: 'two', count: 2 }
		]);
		for (const target of ['one', 'two']) for (let i = 0; i < 3; i++) add(answer('good', target));
		add(round());
		expect(project(events).records.confusions).toEqual([]);
	});
	it('separates account/project ownership and never exposes foreign IDs in diagnostics', () => {
		const foreign = { ...event('secret-id', 'a', 1, 1, [], answer()), uid: 'account-B' };
		const result = project([foreign]);
		expect(result.cards).toEqual([]);
		expect(result.quarantined).toEqual([{ reason: 'wrong-owner' }]);
		expect(
			analyzeProgressEvents([{ ...foreign, uid: owner.uid, projectId: 'other-project' }], owner)
				.events
		).toEqual([]);
	});
	it('defers missing parents, rejects cycles/sequence gaps and replays when ancestors arrive', () => {
		const a = event('a', 'a', 1, 1, [], answer());
		const b = event('b', 'a', 2, 2, ['a'], answer());
		expect(project([b]).deferred).toEqual(['b']);
		expect(project([b, a]).cards[0].cleanStreak).toBe(2);
		expect(
			analyzeProgressEvents([event('gap', 'a', 2, 1, [], answer())], owner).quarantined[0].reason
		).toBe('invalid-sequence');
		const cycleA = event('ca', 'a', 1, 1, ['cb'], answer()),
			cycleB = event('cb', 'b', 1, 2, ['ca'], answer());
		expect(project([cycleA, cycleB]).cards).toEqual([]);
		expect(
			project([cycleA, cycleB]).quarantined.some((q) => q.reason === 'invalid-causality')
		).toBe(true);
	});
	it('quarantines malformed/unsupported records and unknown targets without mutating valid state', () => {
		const a = event('a', 'a', 1, 1, [], answer());
		const bad = { ...event('bad', 'b', 1, 1, [], answer()), version: 2 };
		const target = event('unknown', 'c', 1, 1, [], answer('good', 'not-a-target'));
		const invalid = {
			...event('invalid', 'd', 1, 1, [], answer()),
			operation: { ...answer(), date: '2026-02-30' }
		};
		const result = project([target, invalid, bad, a]);
		expect(result.cards[0].cleanStreak).toBe(1);
		expect(result.quarantined.map((q) => q.reason).sort()).toEqual([
			'malformed-operation',
			'unknown-target',
			'unsupported-version'
		]);
		expect(parseProgressEvent({ ...a, extra: 'field' }, owner).reason).toBe('malformed-event');
		expect(
			parseProgressEvent({ ...a, operation: { ...answer(), grade: 'maximum' } }, owner).reason
		).toBe('malformed-operation');
		expect(
			parseProgressEvent({ ...a, operation: { ...answer(), grade: ['good'] } }, owner).reason
		).toBe('malformed-operation');
		expect(
			parseProgressEvent(
				{
					...a,
					operation: { ...round(), summary: { ...summary, completedAt: '2026-02-30T12:00:00Z' } }
				},
				owner
			).reason
		).toBe('malformed-operation');
	});
	it('handles conflicting IDs/operation keys identically in every order', () => {
		const a = event('same', 'a', 1, 1, [], answer());
		const conflict = { ...a, operationKey: 'unrelated-key', operation: answer('again') };
		const unrelated = event('unrelated', 'b', 1, 1, [], answer('good', 'two'), 'unrelated-key');
		for (const order of permutations([a, conflict, unrelated]))
			expect(project(order).cards.map((c) => c.targetId)).toEqual(['two']);
		const duplicateKey = event('different-id', 'c', 1, 1, [], answer(), 'unrelated-key');
		expect(project([unrelated, duplicateKey]).cards).toEqual([]);
	});
});

describe('non-JSON input defenses', () => {
	it('rejects sparse causal references and does not execute inherited JSON transforms', () => {
		const a = event('a', 'a', 1, 1, [], answer());
		expect(parseProgressEvent({ ...a, parents: new Array(1) }, owner).reason).toBe(
			'malformed-event'
		);
		let transformed = false;
		const operation = Object.assign(
			Object.create({
				toJSON() {
					transformed = true;
					return { ...answer(), grade: 'again' };
				}
			}),
			answer()
		);
		const parsed = parseProgressEvent({ ...a, operation }, owner);
		expect(parsed.event?.operation).toEqual(answer());
		expect(transformed).toBe(false);
	});
});

describe('explicit legacy import', () => {
	const baseline = rate(rate(undefined, 'good', '2026-10-31'), 'good', '2026-10-31');
	it('seeds once before causally later practice and preserves the original input', () => {
		const imported = event('import', 'a', 1, 1, [], {
			kind: 'import-card',
			mapId: map,
			targetId: 'one',
			state: baseline
		});
		const grade = event('grade', 'a', 2, 2, ['import'], answer('again'));
		const copy = structuredClone(imported);
		expect(project([grade, imported, imported]).cards[0].cleanStreak).toBe(1);
		expect(imported).toEqual(copy);
	});
	it('account history wins concurrent/import overlaps and a reset is not an empty account', () => {
		const imported = event('import', 'a', 1, 1, [], {
			kind: 'import-card',
			mapId: map,
			targetId: 'one',
			state: baseline
		});
		const account = event('account', 'b', 1, 1, [], answer('again'));
		expect(project([imported, account]).cards[0].cleanStreak).toBe(0);
		const reset = event('reset', 'b', 1, 1, [], { kind: 'reset', scope: 'known', mapId: map });
		const later = { ...imported, logicalTime: 2, parents: ['reset'] };
		expect(project([reset, later]).cards).toEqual([]);
	});
	it('known reset retains an imported summary but removes imported cards/records', () => {
		const imported = event('import', 'a', 1, 1, [], {
			kind: 'import-map',
			mapId: map,
			summary,
			records: { bestTimeMs: 1200, slipped: 1 }
		});
		const reset = event('reset', 'a', 2, 2, ['import'], {
			kind: 'reset',
			scope: 'known',
			mapId: map
		});
		const result = project([reset, imported]);
		expect(result.lastSession).toEqual(summary);
		expect(result.records).toEqual({});
	});
});
