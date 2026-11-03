import { afterEach, describe, expect, it } from 'vitest';
import { IndexedDbProgressJournal } from './indexedDbProgressJournal';
import { projectProgress, type ProgressEvent, type ProgressOwner } from './progressEvents';
import { ProgressSync, type ProgressTransport } from './progressSync';
import { decodeCloudProgressEvent, encodeCloudProgressEvent } from './firestoreProgressTransport';
const owner = { projectId: 'test-project', uid: 'account-A' };
const answer = {
	kind: 'answer' as const,
	mapId: 'italy-regions',
	targetId: 'one',
	roundId: 'round-one',
	grade: 'good' as const,
	date: '2026-11-02'
};
const databases = new Set<string>(),
	journals: IndexedDbProgressJournal[] = [];
function journal(databaseName = 'sync-test-' + crypto.randomUUID()) {
	databases.add(databaseName);
	const result = new IndexedDbProgressJournal(owner, { databaseName });
	journals.push(result);
	return result;
}
function cloud() {
	const events = new Map<string, ProgressEvent>();
	let current: ProgressOwner | undefined = owner;
	let error = false,
		puts = 0,
		pulls = 0;
	const transport: ProgressTransport = {
		owner,
		currentOwner: () => current,
		async pull(after, limit) {
			pulls++;
			if (error) throw new Error('offline');
			const rows = [...events.values()]
				.sort((a, b) => a.id.localeCompare(b.id))
				.filter((e) => after === undefined || e.id.localeCompare(after) > 0)
				.slice(0, limit);
			return {
				records: structuredClone(rows),
				...(rows.length === limit ? { next: rows[rows.length - 1].id } : {})
			};
		},
		async put(event) {
			puts++;
			if (error) throw new Error('offline');
			const previous = events.get(event.id);
			if (previous && JSON.stringify(previous) !== JSON.stringify(event))
				throw new Error('immutable');
			events.set(event.id, structuredClone(event));
		}
	};
	return {
		transport,
		events,
		offline: (value: boolean) => {
			error = value;
		},
		switch: (value?: ProgressOwner) => {
			current = value;
		},
		counts: () => ({ puts, pulls })
	};
}
async function cards(j: IndexedDbProgressJournal) {
	return projectProgress(await j.snapshot(), answer.mapId, new Set(['one'])).cards;
}
afterEach(async () => {
	for (const j of journals.splice(0)) await j.close().catch(() => undefined);
	for (const name of databases)
		await new Promise<void>((resolve, reject) => {
			const request = indexedDB.deleteDatabase(name);
			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});
	databases.clear();
});
describe('account journal synchronization', () => {
	it('keeps offline work after restart and shares it once, without a cloud cache', async () => {
		const a = journal(),
			b = journal(),
			c = cloud();
		const event = await a.append(answer, 'answer/one');
		c.offline(true);
		const failed = new ProgressSync(a, c.transport);
		await expect(failed.sync()).rejects.toThrow('offline');
		expect(failed.state).toBe('error');
		expect((await a.pending())[0]).toEqual(event);
		const databaseName = [...databases][0];
		await a.close();
		const reopened = journal(databaseName);
		c.offline(false);
		const sync = new ProgressSync(reopened, c.transport);
		expect(await sync.sync()).toMatchObject({ uploaded: 1, pending: 0 });
		expect(sync.state).toBe('synced');
		await new ProgressSync(b, c.transport).sync();
		await new ProgressSync(b, c.transport).sync();
		expect(await cards(b)).toEqual(await cards(reopened));
		expect((await b.snapshot()).events).toHaveLength(1);
		expect(await b.pending()).toEqual([]);
	});
	it('converges stale offline practice with reset-wins, then accepts practice observing the reset', async () => {
		const a = journal(),
			b = journal(),
			c = cloud(),
			sa = new ProgressSync(a, c.transport),
			sb = new ProgressSync(b, c.transport);
		await a.append(answer, 'first');
		await sa.sync();
		await sb.sync();
		await a.append(answer, 'offline-second');
		await b.append({ kind: 'reset', scope: 'known', mapId: answer.mapId }, 'reset');
		await sb.sync();
		await sa.sync();
		await sb.sync();
		expect(await cards(a)).toEqual(await cards(b));
		expect(await cards(a)).toEqual([]);
		await a.append({ ...answer, roundId: 'after-reset' }, 'third');
		await sa.sync();
		await sb.sync();
		expect(await cards(b)).toEqual(await cards(a));
		expect((await cards(b))[0].cleanStreak).toBe(1);
	});
	it('retries a server commit interrupted before local acknowledgement without double grading', async () => {
		const a = journal(),
			c = cloud();
		await a.append(answer, 'first');
		const sync = new ProgressSync(
			{
				owner,
				snapshot: () => a.snapshot(),
				append: (op, key) => a.append(op, key),
				ingest: (rows) => a.ingest(rows),
				pending: () => a.pending(),
				acknowledge: async () => {
					throw new Error('disk');
				}
			},
			c.transport
		);
		await expect(sync.sync()).rejects.toThrow('disk');
		expect(c.events.size).toBe(1);
		expect(await a.pending()).toHaveLength(1);
		await new ProgressSync(a, c.transport).sync();
		expect(c.events.size).toBe(1);
		expect(await a.pending()).toEqual([]);
		expect((await cards(a))[0].cleanStreak).toBe(1);
	});
	it('shares one running cycle and permits retry after network/quota failure', async () => {
		const a = journal(),
			c = cloud();
		await a.append(answer, 'first');
		c.offline(true);
		const sync = new ProgressSync(a, c.transport),
			first = sync.sync();
		expect(sync.sync()).toBe(first);
		await expect(first).rejects.toThrow('offline');
		c.offline(false);
		expect(await sync.sync()).toMatchObject({ uploaded: 1, pending: 0 });
		expect(c.counts().puts).toBe(1);
	});
	it('keeps the exact unacknowledged suffix after quota exhaustion midway through upload', async () => {
		const a = journal(),
			c = cloud();
		const first = await a.append(answer, 'quota-first');
		const second = await a.append(answer, 'quota-second');
		const third = await a.append(answer, 'quota-third');
		const put = c.transport.put;
		c.transport.put = async (event) => {
			if (event.id === second.id)
				throw Object.assign(new Error('quota'), { code: 'resource-exhausted' });
			await put(event);
		};
		const sync = new ProgressSync(a, c.transport);
		await expect(sync.sync()).rejects.toMatchObject({ code: 'resource-exhausted' });
		expect(sync.state).toBe('error');
		expect([...c.events.keys()]).toEqual([first.id]);
		expect((await a.pending()).map((event) => event.id)).toEqual([second.id, third.id]);
		const databaseName = [...databases][0];
		await a.close();
		const reopened = journal(databaseName);
		c.transport.put = put;
		expect(await new ProgressSync(reopened, c.transport).sync()).toEqual({
			downloaded: 1,
			uploaded: 2,
			pending: 0
		});
		expect(c.events.size).toBe(3);
		expect((await reopened.snapshot()).events.map((event) => event.id)).toEqual([
			first.id,
			second.id,
			third.id
		]);
		expect((await cards(reopened))[0].cleanStreak).toBe(3);
	});
	it('checks the 10000-event boundary and preserves local progress when cloud history grows beyond it', async () => {
		const a = journal(),
			c = cloud();
		// A real causal chain, not repeated copies of one ID. Lexical IDs make pagination deterministic.
		for (let i = 1; i <= 10000; i++) {
			const id = `history-${String(i).padStart(5, '0')}`;
			c.events.set(id, {
				version: 1,
				id,
				...owner,
				deviceId: 'history-device',
				sequence: i,
				logicalTime: i,
				parents: i === 1 ? [] : [`history-${String(i - 1).padStart(5, '0')}`],
				operationKey: `history/${i}`,
				operation: { ...answer, roundId: `history-${i}` }
			});
		}
		const sync = new ProgressSync(a, c.transport);
		expect(await sync.sync()).toEqual({ downloaded: 10000, uploaded: 0, pending: 0 });
		expect(sync.state).toBe('synced');
		expect(c.counts()).toEqual({ pulls: 101, puts: 0 });
		const graph = await a.snapshot();
		expect(graph.events).toHaveLength(10000);
		expect(graph.deferred).toEqual([]);
		expect(graph.quarantined).toEqual([]);
		const extra = await a.append({ ...answer, targetId: 'local' }, 'cross-boundary');
		expect(await sync.sync()).toEqual({ downloaded: 10000, uploaded: 1, pending: 0 });
		expect(c.events.size).toBe(10001);
		const pending = await a.append(
			{ ...answer, targetId: 'local', grade: 'again' },
			'after-boundary'
		);
		await expect(sync.sync()).rejects.toMatchObject({ code: 'history-limit' });
		expect(sync.state).toBe('error');
		expect(c.counts()).toEqual({ pulls: 303, puts: 1 });
		expect(await a.pending()).toEqual([pending]);
		const before = projectProgress(await a.snapshot(), answer.mapId, new Set(['one', 'local']));
		const databaseName = [...databases][0];
		await a.close();
		const reopened = journal(databaseName);
		expect(await reopened.pending()).toEqual([pending]);
		expect((await reopened.snapshot()).events).toHaveLength(10002);
		expect(
			projectProgress(await reopened.snapshot(), answer.mapId, new Set(['one', 'local']))
		).toEqual(before);
		expect((await reopened.snapshot()).events.some((event) => event.id === extra.id)).toBe(true);
	});
	it('drops a late pull after an account switch instead of ingesting or uploading it', async () => {
		const a = journal(),
			c = cloud();
		await a.append(answer, 'local');
		let release!: (page: { records: unknown[] }) => void;
		c.transport.pull = () =>
			new Promise((resolve) => {
				release = resolve;
			});
		const sync = new ProgressSync(a, c.transport),
			running = sync.sync();
		c.switch({ ...owner, uid: 'account-B' });
		release({ records: [] });
		await expect(running).rejects.toMatchObject({ code: 'account-changed' });
		expect(sync.state).toBe('stopped');
		expect(c.counts().puts).toBe(0);
		expect(await a.pending()).toHaveLength(1);
		c.switch(owner);
		await expect(sync.sync()).rejects.toMatchObject({ code: 'sync-stopped' });
	});
	it('does not acknowledge an old-account upload that finishes after stop', async () => {
		const a = journal(),
			c = cloud();
		await a.append(answer, 'local');
		let started!: () => void, finish!: () => void;
		const ready = new Promise<void>((resolve) => {
			started = resolve;
		});
		c.transport.put = () => {
			started();
			return new Promise<void>((resolve) => {
				finish = resolve;
			});
		};
		const sync = new ProgressSync(a, c.transport),
			running = sync.sync();
		await ready;
		sync.stop();
		finish();
		await expect(running).rejects.toMatchObject({ code: 'sync-stopped' });
		expect(await a.pending()).toHaveLength(1);
		expect(sync.state).toBe('stopped');
	});
	it('bounds uploads, paginates all history and rescans rather than persisting a random-ID cursor', async () => {
		const a = journal(),
			b = journal(),
			c = cloud(),
			sync = new ProgressSync(a, c.transport);
		for (let i = 0; i < 105; i++)
			await a.append({ ...answer, roundId: 'round-' + i }, 'answer/' + i);
		expect(await sync.sync()).toMatchObject({ uploaded: 100, pending: 5 });
		expect(sync.state).toBe('pending');
		expect(await sync.sync()).toMatchObject({ uploaded: 5, pending: 0 });
		const sb = new ProgressSync(b, c.transport);
		expect(await sb.sync()).toMatchObject({ downloaded: 105 });
		expect((await b.snapshot()).events).toHaveLength(105);
		// The next event sorts before the prior last page. A durable high-water ID would lose it.
		const event = structuredClone([...c.events.values()][0]);
		event.id = '000-late';
		event.deviceId = 'new-device';
		event.sequence = 1;
		event.logicalTime = 1;
		event.parents = [];
		event.operationKey = 'late';
		c.events.set(event.id, event);
		await sb.sync();
		expect((await b.snapshot()).events).toHaveLength(106);
	});
	it('preserves and blocks unsupported or incomplete remote history instead of treating it as empty', async () => {
		const a = journal(),
			c = cloud();
		await a.append(answer, 'local');
		c.transport.pull = async () => ({ records: [{ ...owner, version: 7, id: 'future' }] });
		const sync = new ProgressSync(a, c.transport);
		await expect(sync.sync()).rejects.toMatchObject({ code: 'unsupported-remote-history' });
		expect(await a.quarantined()).toHaveLength(1);
		expect(c.counts().puts).toBe(0);
		const remote = {
			...(await a.pending())[0],
			id: 'remote',
			deviceId: 'remote-device',
			parents: ['missing'],
			logicalTime: 2,
			operationKey: 'remote'
		};
		c.transport.pull = async () => ({ records: [remote] });
		await expect(sync.sync()).rejects.toMatchObject({ code: 'incomplete-history' });
		expect(c.counts().puts).toBe(0);
	});
	it('blocks mismatched owners and malformed pagination', async () => {
		const a = journal(),
			c = cloud();
		expect(
			() => new ProgressSync(a, { ...c.transport, owner: { ...owner, uid: 'other' } })
		).toThrow('owner-mismatch');
		c.transport.pull = async () => ({ records: [], next: '' });
		await expect(new ProgressSync(a, c.transport).sync()).rejects.toMatchObject({
			code: 'invalid-page'
		});
	});
	it('round trips the bounded cloud frontier and rejects document-ID substitution', async () => {
		const a = journal();
		const first = await a.append(answer, 'first'),
			second = await a.append(answer, 'second');
		expect(decodeCloudProgressEvent(first.id, encodeCloudProgressEvent(first, owner))).toEqual(
			first
		);
		expect(decodeCloudProgressEvent(second.id, encodeCloudProgressEvent(second, owner))).toEqual(
			second
		);
		expect(
			decodeCloudProgressEvent('wrong-id', encodeCloudProgressEvent(first, owner))
		).toMatchObject({ version: -1 });
		expect(() => encodeCloudProgressEvent(first, { ...owner, uid: 'other' })).toThrow(
			'invalid-event'
		);
	});
});
