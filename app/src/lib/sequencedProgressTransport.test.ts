import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore/lite';
import {
	createSequencedProgressTransport,
	parseProgressDeliveryHead
} from './sequencedProgressTransport';
describe('versioned delivery head', () => {
	it('accepts only an initialized zero or an assigned safe sequence and immutable event ID', () => {
		expect(parseProgressDeliveryHead({ version: 2, sequence: 0, lastEventId: null })).toEqual({
			version: 2,
			sequence: 0,
			lastEventId: null
		});
		expect(
			parseProgressDeliveryHead({
				version: 2,
				sequence: Number.MAX_SAFE_INTEGER,
				lastEventId: 'event-1'
			}).sequence
		).toBe(Number.MAX_SAFE_INTEGER);
	});
	it.each([
		null,
		[],
		{},
		{ version: 3, sequence: 0, lastEventId: null },
		{ version: 2, sequence: -1, lastEventId: 'event' },
		{ version: 2, sequence: 1.5, lastEventId: 'event' },
		{ version: 2, sequence: Number.MAX_SAFE_INTEGER + 1, lastEventId: 'event' },
		{ version: 2, sequence: 0, lastEventId: 'event' },
		{ version: 2, sequence: 1, lastEventId: null },
		{ version: 2, sequence: 1, lastEventId: 'path/escape' },
		{ version: 2, sequence: 0, lastEventId: null, extra: true }
	])('blocks unsupported or malformed protocol metadata: %j', (head) => {
		expect(() => parseProgressDeliveryHead(head)).toThrow('unsupported-delivery-head');
	});
});

const sdk = vi.hoisted(() => ({ getDoc: vi.fn(), getDocs: vi.fn(), runTransaction: vi.fn() }));
vi.mock('firebase/firestore/lite', async (importOriginal) => ({
	...(await importOriginal<typeof import('firebase/firestore/lite')>()),
	collection: (...args: unknown[]) => ({ path: args.slice(1) }),
	doc: (...args: unknown[]) => ({ path: args.slice(1) }),
	query: (...args: unknown[]) => ({ args }),
	...sdk
}));
const snapshot = (data?: unknown) => ({ exists: () => data !== undefined, data: () => data });
const initial = { version: 2, sequence: 0, lastEventId: null };
const progressEvent = {
	version: 1 as const,
	id: 'event',
	projectId: 'test-project',
	uid: 'owner',
	deviceId: 'device',
	sequence: 1,
	logicalTime: 1,
	parents: [],
	operationKey: 'answer/event',
	operation: {
		kind: 'answer' as const,
		mapId: 'italy-regions',
		targetId: 'one',
		roundId: 'round',
		grade: 'good' as const,
		date: '2026-11-03'
	}
};
function fixture() {
	const app = { options: { projectId: 'test-project' } };
	const auth = { app, currentUser: { uid: 'owner' } as { uid: string } | null };
	return { auth, transport: createSequencedProgressTransport({ app } as Firestore, auth as Auth) };
}
async function opened() {
	const f = fixture();
	sdk.runTransaction.mockImplementationOnce(async (_db, callback) =>
		callback({
			get: async () => snapshot(initial),
			set: vi.fn()
		})
	);
	await f.transport.open();
	sdk.runTransaction.mockReset();
	return f;
}
beforeEach(() => {
	for (const mock of Object.values(sdk)) mock.mockReset();
});
describe('bounded delivery recovery and lifetime guards', () => {
	it('recovers a concurrent initializer only by reading a valid authorized head', async () => {
		const f = fixture();
		sdk.runTransaction.mockRejectedValue({ code: 'permission-denied' });
		sdk.getDoc.mockResolvedValue(snapshot(initial));
		expect(await f.transport.open()).toEqual(initial);
		expect(sdk.runTransaction).toHaveBeenCalledTimes(1);
		expect(sdk.getDoc).toHaveBeenCalledTimes(1);
	});
	it('does not treat a missing or unreadable head as a successful initializer', async () => {
		const f = fixture(),
			error = { code: 'permission-denied' };
		sdk.runTransaction.mockRejectedValue(error);
		sdk.getDoc.mockResolvedValue(snapshot());
		await expect(f.transport.open()).rejects.toBe(error);
		await expect(f.transport.head()).rejects.toMatchObject({ code: 'delivery-not-open' });
	});
	it('stops after five outer transactions even when every denied sequence has genuinely advanced', async () => {
		const f = await opened(),
			error = { code: 'permission-denied' };
		let current = 1;
		sdk.runTransaction.mockImplementation(async (_db, callback) => {
			await callback({
				get: async (ref: { path: string[] }) =>
					snapshot(
						ref.path.at(-1) === 'head'
							? { version: 2, sequence: current, lastEventId: 'other-' + current }
							: undefined
					),
				set: vi.fn()
			});
			throw error;
		});
		sdk.getDoc.mockImplementation(async () =>
			snapshot({ version: 2, sequence: ++current, lastEventId: 'other-' + current })
		);
		await expect(f.transport.put(progressEvent)).rejects.toBe(error);
		expect(sdk.runTransaction).toHaveBeenCalledTimes(5);
		expect(sdk.getDoc).toHaveBeenCalledTimes(4);
	});
	it.each(['permission-denied', 'resource-exhausted', 'unavailable'])(
		'does not blindly retry %s or acknowledge an unsuccessful write',
		async (code) => {
			const f = await opened(),
				error = { code };
			sdk.runTransaction.mockImplementation(async (_db, callback) => {
				await callback({
					get: async (ref: { path: string[] }) =>
						snapshot(ref.path.at(-1) === 'head' ? initial : undefined),
					set: vi.fn()
				});
				throw error;
			});
			sdk.getDoc.mockResolvedValue(snapshot(initial));
			await expect(f.transport.put(progressEvent)).rejects.toBe(error);
			expect(sdk.runTransaction).toHaveBeenCalledTimes(1);
			expect(sdk.getDoc).toHaveBeenCalledTimes(code === 'permission-denied' ? 1 : 0);
		}
	);
	it('drops a late page when identity changes before the SDK returns', async () => {
		const f = await opened();
		let release!: (value: unknown) => void;
		sdk.getDocs.mockReturnValue(
			new Promise((resolve) => {
				release = resolve;
			})
		);
		const page = f.transport.pull(0, 1, 100);
		f.auth.currentUser = null;
		release({ size: 1, docs: [] });
		await expect(page).rejects.toMatchObject({ code: 'account-changed' });
	});
	it('does not return an upload receipt completed after sign-out', async () => {
		const f = await opened();
		let release!: (value: number) => void;
		sdk.runTransaction.mockReturnValue(
			new Promise((resolve) => {
				release = resolve;
			})
		);
		const put = f.transport.put(progressEvent);
		f.auth.currentUser = null;
		release(1);
		await expect(put).rejects.toMatchObject({ code: 'account-changed' });
	});
	it('rejects malformed/gapped wrappers instead of advancing a cursor', async () => {
		const f = await opened();
		sdk.getDocs.mockResolvedValue({
			size: 1,
			docs: [{ id: 'event', data: () => ({ sequence: 2, event: {} }) }]
		});
		await expect(f.transport.pull(0, 1, 100)).rejects.toMatchObject({
			code: 'unsupported-delivery-page'
		});
		sdk.getDocs.mockResolvedValue({ size: 0, docs: [] });
		await expect(f.transport.pull(0, 1, 100)).rejects.toMatchObject({
			code: 'incomplete-delivery'
		});
	});
	it('requires no event query when the checkpoint already equals the fence', async () => {
		const f = await opened();
		expect(await f.transport.pull(17, 17, 100)).toEqual({ records: [], sequence: 17 });
		expect(sdk.getDocs).not.toHaveBeenCalled();
	});
});
