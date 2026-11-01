import { afterEach, describe, expect, it, vi } from 'vitest';
import { rate } from '@geoclick/srs';
import { createAccountProgressRepository } from './accountProgressRepository';
import { IndexedDbProgressJournal } from './indexedDbProgressJournal';
import {
	createInMemoryProgressRepository,
	createSandboxedProgressRepository,
	loadPlayableCardStates
} from './progressRepository';
const owner = { projectId: 'test-project', uid: 'account-A' },
	mapId = 'italy-regions';
const answer = {
	roundId: 'round-one',
	targetId: 'one',
	grade: 'good' as const,
	date: '2026-11-01'
};
const summary = { total: 2, perfect: 1, totalErrors: 1, completedAt: '2026-11-01T12:00:00.000Z' };
const opened: IndexedDbProgressJournal[] = [],
	databases: string[] = [];
function setup(uid = owner.uid, databaseName = 'account-repository-test-' + crypto.randomUUID()) {
	if (!databases.includes(databaseName)) databases.push(databaseName);
	const journal = new IndexedDbProgressJournal({ ...owner, uid }, { databaseName });
	opened.push(journal);
	const repository = createAccountProgressRepository(journal, async (id) => {
		if (id !== mapId) throw new Error('unknown map');
		return new Set(['one', 'two']);
	});
	return { journal, repository, writer: repository.quizOperations!(mapId)!, databaseName };
}
afterEach(async () => {
	for (const journal of opened.splice(0)) await journal.close();
	for (const databaseName of databases.splice(0))
		await new Promise<void>((resolve, reject) => {
			const request = indexedDB.deleteDatabase(databaseName);
			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});
});
describe('account quiz repository', () => {
	it('serializes rapid answers before completion and projects actual mistakes, summary and mix-ups', async () => {
		const { repository, writer, journal } = setup();
		const first = writer.answer(answer),
			second = writer.answer({ ...answer, targetId: 'two', grade: 'again', chosenId: 'one' }),
			completion = writer.round({ roundId: answer.roundId, summary, slipped: 1 });
		await Promise.all([first, second, completion]);
		expect((await journal.pending()).map((event) => event.operation.kind)).toEqual([
			'answer',
			'answer',
			'round'
		]);
		expect(await repository.getCardStates(mapId)).toEqual([
			{ targetId: 'one', ...rate(undefined, 'good', answer.date) },
			{ targetId: 'two', ...rate(undefined, 'again', answer.date) }
		]);
		expect(await repository.getLastSessionSummary(mapId)).toEqual(summary);
		expect(await repository.getMapRecords(mapId)).toEqual({
			slipped: 1,
			confusions: [{ targetId: 'two', chosenId: 'one', count: 1 }]
		});
	});
	it('reuses logical answer/round identities across reopen without regrading', async () => {
		const { writer, journal, databaseName } = setup();
		await writer.answer(answer);
		await writer.round({ roundId: answer.roundId, summary, slipped: 0 });
		await journal.close();
		const reopened = setup(owner.uid, databaseName);
		await reopened.writer.answer(answer);
		await reopened.writer.round({ roundId: answer.roundId, summary, slipped: 0 });
		expect(await reopened.journal.pending()).toHaveLength(2);
		expect((await reopened.repository.getCardStates(mapId))[0].cleanStreak).toBe(1);
		await expect(reopened.writer.answer({ ...answer, grade: 'again' })).rejects.toMatchObject({
			code: 'operation-conflict'
		});
	});
	it('rejects replacement snapshot writes instead of inferring fake practice or losing queue entries', async () => {
		const { repository, journal } = setup();
		await expect(
			repository.saveCardState(mapId, { targetId: 'one', ...rate(undefined, 'good', answer.date) })
		).rejects.toMatchObject({ code: 'snapshot-write-not-supported' });
		await expect(repository.saveMapRecords(mapId, {})).rejects.toMatchObject({
			code: 'snapshot-write-not-supported'
		});
		await expect(repository.saveLastSessionSummary(mapId, summary)).rejects.toMatchObject({
			code: 'snapshot-write-not-supported'
		});
		expect(await journal.pending()).toEqual([]);
	});
	it('copies queued inputs and isolates old callbacks from another account', async () => {
		const a = setup(),
			b = setup('account-B', a.databaseName);
		const input = { ...answer, grade: 'good' as 'good' | 'again' };
		const writing = a.writer.answer(input);
		input.grade = 'again';
		await writing;
		expect((await a.repository.getCardStates(mapId))[0].cleanStreak).toBe(1);
		expect(await b.repository.getCardStates(mapId)).toEqual([]);
		expect(a.repository.progressScope!(mapId)).not.toBe(b.repository.progressScope!(mapId));
	});
	it('records reset commands with their existing score-retention semantics', async () => {
		const { repository, writer } = setup();
		await writer.answer(answer);
		await writer.round({ roundId: answer.roundId, summary, slipped: 1 });
		await repository.resetKnown(mapId);
		expect(await repository.getCardStates(mapId)).toEqual([]);
		expect(await repository.getMapRecords(mapId)).toEqual({});
		expect(await repository.getLastSessionSummary(mapId)).toEqual(summary);
		await writer.answer({ ...answer, roundId: 'after-reset' });
		expect((await repository.getCardStates(mapId))[0].cleanStreak).toBe(1);
		await repository.clearMap(mapId);
		expect(await repository.getLastSessionSummary(mapId)).toBeUndefined();
		await writer.answer({ ...answer, roundId: 'after-clear' });
		await repository.clearAll();
		expect(await repository.getCardStates(mapId)).toEqual([]);
	});
	it('rejects unknown map/target/choice and malformed operations without stopping later valid writes', async () => {
		const { writer, repository, journal } = setup();
		await expect(writer.answer({ ...answer, targetId: 'removed' })).rejects.toMatchObject({
			code: 'unknown-target'
		});
		await expect(writer.answer({ ...answer, chosenId: 'removed' })).rejects.toMatchObject({
			code: 'unknown-target'
		});
		await expect(writer.answer({ ...answer, date: 'invalid' })).rejects.toMatchObject({
			code: 'invalid-quiz-operation'
		});
		await expect(repository.quizOperations!('removed-map')!.answer(answer)).rejects.toThrow(
			'unknown map'
		);
		await writer.answer(answer);
		expect(await journal.pending()).toHaveLength(1);
	});
	it('keeps clean best times and prevents an error round from setting a best', async () => {
		const { writer, repository } = setup();
		await writer.round({ roundId: 'bad', summary, slipped: 1, timedMs: 500 });
		expect((await repository.getMapRecords(mapId)).bestTimeMs).toBeUndefined();
		await writer.round({
			roundId: 'clean',
			summary: { ...summary, perfect: 2, totalErrors: 0 },
			slipped: 0,
			timedMs: 2000
		});
		expect((await repository.getMapRecords(mapId)).bestTimeMs).toBe(2000);
	});
	it('reports denied durable append and never writes to guest storage', async () => {
		const { journal } = setup();
		const append = vi.spyOn(journal, 'append').mockRejectedValue(new Error('storage denied'));
		const repository = createAccountProgressRepository(journal, async () => new Set(['one']));
		await expect(repository.quizOperations!(mapId)!.answer(answer)).rejects.toThrow(
			'storage denied'
		);
		expect(append).toHaveBeenCalledTimes(1);
		expect(await journal.pending()).toEqual([]);
	});
	it('preserves the account destination after a failed read', async () => {
		const { repository, journal } = setup();
		await journal.close();
		const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		try {
			const loaded = await loadPlayableCardStates(mapId, async () => repository);
			expect(loaded.repository).toBe(repository);
			expect(loaded.failed).toBe(true);
			expect(loaded.cardStates).toEqual([]);
			await expect(loaded.repository.quizOperations!(mapId)!.answer(answer)).rejects.toMatchObject({
				code: 'storage-closed'
			});
		} finally {
			error.mockRestore();
		}
	});
	it('keeps tutorial operations and namespace in its captured memory repository', async () => {
		const { repository, journal } = setup();
		const memory = createInMemoryProgressRepository();
		const tutorial = createSandboxedProgressRepository(repository, memory, mapId);
		expect(tutorial.quizOperations!(mapId)).toBeUndefined();
		expect(tutorial.progressScope!(mapId)).toBeUndefined();
		await tutorial.saveCardState(mapId, {
			targetId: 'one',
			...rate(undefined, 'good', answer.date)
		});
		expect(await journal.pending()).toEqual([]);
		expect(await tutorial.getCardStates(mapId)).toHaveLength(1);
		const otherMapTutorial = createSandboxedProgressRepository(repository, memory, 'other-map');
		await otherMapTutorial.quizOperations!(mapId)!.answer(answer);
		expect(await journal.pending()).toHaveLength(1);
		expect(otherMapTutorial.progressScope!(mapId)).toBe(repository.progressScope!(mapId));
	});
});
