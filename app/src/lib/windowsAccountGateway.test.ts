import { describe, expect, it, vi } from 'vitest';
import {
	createWindowsAccountGateway,
	type WindowsAccountConfiguration,
	type WindowsAccountBridge,
	type WindowsCredential,
	type WindowsRestore,
	type WindowsFirebasePort
} from './windowsAccountGateway';
import type { BrowserAccountIdentity } from './browserAccountSession';
import type { ProgressOwner } from './progressEvents';
const A: BrowserAccountIdentity = {
		projectId: 'test-project',
		uid: 'account-A',
		label: 'Player A'
	},
	B = { ...A, uid: 'account-B', label: 'Player B' };
function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((yes) => {
		resolve = yes;
	});
	return { promise, resolve };
}
const credential = (token = 'token-A', expected: string | null = null): WindowsCredential => ({
	id_token: token,
	attempt_id: 'attempt-' + token,
	expected_uid: expected
});
function fixture(cached = false) {
	const config: WindowsAccountConfiguration = {
		projectId: A.projectId,
		actorId: 'host-actor',
		cachedUid: cached ? A.uid : null,
		cachedLabel: cached ? A.label : null,
		rememberAvailable: true,
		storageWarning: false
	};
	const choices = new Map<string, boolean>();
	let user: BrowserAccountIdentity | undefined,
		counter = 0;
	const native: WindowsAccountBridge = {
		login: vi.fn(async (id, remember) => {
			choices.set(id, remember);
			return credential();
		}),
		restore: vi.fn(async (): Promise<WindowsRestore> => ({
			status: 'credential',
			credential: credential('token-A', A.uid)
		})),
		confirm: vi.fn(async (id, _attempt, uid) => {
			if (cached && uid !== A.uid) throw new Error('uid-mismatch');
			return choices.get(id) ?? true;
		}),
		cancel: vi.fn(async () => {}),
		forget: vi.fn(async () => {})
	};
	const requests: ProgressOwner[] = [];
	const firebase: WindowsFirebasePort = {
		consumeGoogle: vi.fn(async (token) => {
			user = token === 'token-B' ? B : A;
			return user;
		}),
		matches: (owner) => user?.uid === owner.uid && user.projectId === owner.projectId,
		clear: vi.fn(async () => {
			user = undefined;
		}),
		transport: (owner) => ({
			owner,
			currentOwner: () => owner,
			pull: vi.fn(async () => {
				requests.push(owner);
				return { records: [] };
			}),
			put: vi.fn(async () => {
				requests.push(owner);
			})
		})
	};
	const gateway = createWindowsAccountGateway(
		config,
		native,
		firebase,
		() => `request-${++counter}`
	);
	return {
		gateway,
		native,
		firebase,
		config,
		requests,
		setUser: (next: BrowserAccountIdentity | undefined) => {
			user = next;
		},
		user: () => user
	};
}
describe('production Windows account coordinator', () => {
	it('confirms the Firebase identity before publication, uses the selected remember choice and forgets on sign-out', async () => {
		const f = fixture(),
			seen: (string | undefined)[] = [];
		f.gateway.auth.observe((user) => {
			seen.push(user?.uid);
		});
		await f.gateway.auth.signIn(false);
		expect(seen).toEqual([undefined, A.uid]);
		expect(f.native.login).toHaveBeenCalledWith('request-1', false);
		expect(f.native.confirm).toHaveBeenCalledWith('request-1', 'attempt-token-A', A.uid, A.label);
		const transport = f.gateway.transport(A);
		await transport.pull(undefined, 100);
		expect(f.requests).toEqual([{ projectId: A.projectId, uid: A.uid }]);
		await f.gateway.auth.signOut();
		expect(f.gateway.auth.current()).toBeUndefined();
		expect(transport.currentOwner()).toBeUndefined();
		expect(f.user()).toBeUndefined();
		expect(f.native.forget).toHaveBeenCalledOnce();
	});
	it('opens a protected offline identity locally while blocking cloud until the same UID is freshly verified', async () => {
		const f = fixture(true),
			seen: (string | undefined)[] = [];
		f.gateway.auth.observe((user) => {
			seen.push(user?.uid);
		});
		vi.mocked(f.native.restore).mockResolvedValueOnce({ status: 'unavailable' });
		expect(f.gateway.auth.current()).toEqual(A);
		const transport = f.gateway.transport(A);
		await expect(transport.pull(undefined, 100)).rejects.toMatchObject({ code: 'unavailable' });
		expect(f.requests).toEqual([]);
		expect(f.gateway.auth.current()).toEqual(A);
		expect(f.native.forget).not.toHaveBeenCalled();
		await transport.pull(undefined, 100);
		expect(f.requests).toEqual([{ projectId: A.projectId, uid: A.uid }]);
		expect(seen).toEqual([A.uid]); // Same-owner refresh does not remount a quiz.
	});
	it('does not publish a changed Firebase UID or upload the previous account under it', async () => {
		const f = fixture(true);
		vi.mocked(f.native.restore).mockResolvedValue({
			status: 'credential',
			credential: credential('token-B', A.uid)
		});
		const transport = f.gateway.transport(A),
			seen: (string | undefined)[] = [];
		f.gateway.auth.observe((user) => {
			seen.push(user?.uid);
		});
		await expect(transport.pull(undefined, 100)).rejects.toMatchObject({
			code: 'identity-changed'
		});
		expect(seen).toEqual([A.uid, undefined]);
		expect(f.requests).toEqual([]);
		expect(f.user()).toBeUndefined();
	});
	it('rejects a restored credential whose binding changed before calling Firebase', async () => {
		const f = fixture(true);
		vi.mocked(f.native.restore).mockResolvedValue({
			status: 'credential',
			credential: credential('token-B', B.uid)
		});
		await expect(f.gateway.transport(A).pull(undefined, 100)).rejects.toMatchObject({
			code: 'identity-changed'
		});
		expect(f.firebase.consumeGoogle).not.toHaveBeenCalled();
		expect(f.gateway.auth.current()).toBeUndefined();
	});
	it('shares one protected restore for concurrent guarded requests', async () => {
		const f = fixture(true),
			waiting = deferred<WindowsRestore>();
		vi.mocked(f.native.restore).mockReturnValue(waiting.promise);
		const transport = f.gateway.transport(A),
			a = transport.pull(undefined, 100),
			b = transport.pull(undefined, 100);
		expect(f.native.restore).toHaveBeenCalledOnce();
		waiting.resolve({ status: 'credential', credential: credential('token-A', A.uid) });
		await Promise.all([a, b]);
		expect(f.firebase.consumeGoogle).toHaveBeenCalledOnce();
		expect(f.requests).toEqual([
			{ projectId: A.projectId, uid: A.uid },
			{ projectId: A.projectId, uid: A.uid }
		]);
	});
	it('a credential returned after cancellation cannot sign in or cancel a newer native request', async () => {
		const f = fixture(),
			oldCredential = deferred<WindowsCredential>();
		vi.mocked(f.native.login)
			.mockImplementationOnce(() => oldCredential.promise)
			.mockImplementationOnce(async () => credential('token-B'));
		// The fake native confirm mirrors the second request's selected persistence.
		vi.mocked(f.native.confirm).mockResolvedValue(true);
		const old = f.gateway.auth.signIn(true);
		void old.catch(() => {});
		await f.gateway.auth.signOut();
		await f.gateway.auth.signIn(true);
		oldCredential.resolve(credential());
		await expect(old).rejects.toMatchObject({ code: 'cancelled' });
		expect(f.gateway.auth.current()?.uid).toBe(B.uid);
		expect(f.firebase.consumeGoogle).toHaveBeenCalledTimes(1);
		expect(f.native.cancel).toHaveBeenCalledWith('request-1');
	});
	it('serializes SDK cleanup before a newer account exchange when cancellation arrives during Firebase', async () => {
		const f = fixture(),
			started = deferred<void>(),
			completion = deferred<BrowserAccountIdentity>();
		vi.mocked(f.firebase.consumeGoogle)
			.mockImplementationOnce(async () => {
				started.resolve();
				const user = await completion.promise;
				f.setUser(user);
				return user;
			})
			.mockImplementationOnce(async () => {
				f.setUser(B);
				return B;
			});
		vi.mocked(f.native.login)
			.mockResolvedValueOnce(credential())
			.mockResolvedValueOnce(credential('token-B'));
		vi.mocked(f.native.confirm).mockResolvedValue(true);
		const old = f.gateway.auth.signIn(true);
		void old.catch(() => {});
		await started.promise;
		const forgetting = f.gateway.auth.signOut(),
			next = f.gateway.auth.signIn(true);
		completion.resolve(A);
		await expect(old).rejects.toMatchObject({ code: 'cancelled' });
		await forgetting;
		await next;
		expect(f.gateway.auth.current()?.uid).toBe(B.uid);
		expect(f.user()?.uid).toBe(B.uid);
		expect(f.native.confirm).toHaveBeenCalledTimes(1);
		expect(f.native.cancel).toHaveBeenCalledWith('request-1');
	});
	it('blocks transport immediately on a failed native forget, retains a retryable identity, and prevents account switching', async () => {
		const f = fixture();
		await f.gateway.auth.signIn(true);
		const transport = f.gateway.transport(A);
		vi.mocked(f.native.forget).mockRejectedValueOnce(new Error('vault-denied'));
		await expect(f.gateway.auth.signOut()).rejects.toThrow('vault-denied');
		expect(transport.currentOwner()).toBeUndefined();
		expect(f.gateway.auth.current()?.uid).toBe(A.uid);
		await expect(transport.pull(undefined, 100)).rejects.toMatchObject({ code: 'account-changed' });
		await expect(f.gateway.auth.signIn(false)).rejects.toMatchObject({ code: 'sign-out-first' });
		await f.gateway.auth.signOut();
		expect(f.gateway.auth.current()).toBeUndefined();
	});
	it('does not offer a new login until native credential deletion has finished', async () => {
		const f = fixture(),
			deleting = deferred<void>();
		vi.mocked(f.native.forget).mockReturnValue(deleting.promise);
		const old = f.gateway.auth.signIn(true);
		await old;
		const forgetting = f.gateway.auth.signOut();
		expect(f.gateway.auth.current()?.uid).toBe(A.uid);
		expect(f.gateway.transport.bind(f.gateway, A)).toThrow('account-changed');
		deleting.resolve();
		await forgetting;
		expect(f.gateway.auth.current()).toBeUndefined();
	});
	it('clears a revoked saved identity, and a session-only SDK expiry returns to guest without restoring a grant', async () => {
		const f = fixture(true);
		vi.mocked(f.native.restore).mockResolvedValue({ status: 'revoked' });
		await expect(f.gateway.transport(A).pull(undefined, 100)).rejects.toMatchObject({
			code: 'unauthenticated'
		});
		expect(f.gateway.auth.current()).toBeUndefined();
		const memory = fixture();
		await memory.gateway.auth.signIn(false);
		await memory.firebase.clear();
		await expect(memory.gateway.transport(A).pull(undefined, 100)).rejects.toMatchObject({
			code: 'unauthenticated'
		});
		expect(memory.native.restore).not.toHaveBeenCalled();
		expect(memory.gateway.auth.current()).toBeUndefined();
	});
	it('rejects unsupported remember and project mismatches before publishing an identity', async () => {
		const f = fixture();
		const limited = createWindowsAccountGateway(
			{ ...f.config, rememberAvailable: false },
			f.native,
			f.firebase
		);
		await expect(limited.auth.signIn(true)).rejects.toMatchObject({ code: 'storage' });
		expect(f.native.login).not.toHaveBeenCalled();
		vi.mocked(f.firebase.consumeGoogle).mockResolvedValue({ ...A, projectId: 'other-project' });
		await expect(f.gateway.auth.signIn(false)).rejects.toMatchObject({ code: 'project-mismatch' });
		expect(f.gateway.auth.current()).toBeUndefined();
		expect(f.native.confirm).not.toHaveBeenCalled();
	});
});

it('waits for a pending native forget before starting another provider request', async () => {
	const f = fixture(),
		credentialA = deferred<WindowsCredential>(),
		deleting = deferred<void>();
	vi.mocked(f.native.login)
		.mockReturnValueOnce(credentialA.promise)
		.mockResolvedValueOnce(credential('token-B'));
	vi.mocked(f.native.confirm).mockResolvedValue(true);
	const old = f.gateway.auth.signIn(true);
	void old.catch(() => {});
	vi.mocked(f.native.forget).mockReturnValueOnce(deleting.promise);
	const logout = f.gateway.auth.signOut(),
		next = f.gateway.auth.signIn(true);
	expect(f.native.login).toHaveBeenCalledTimes(1);
	deleting.resolve();
	await logout;
	await next;
	credentialA.resolve(credential());
	await expect(old).rejects.toMatchObject({ code: 'cancelled' });
	expect(f.native.login).toHaveBeenCalledTimes(2);
	expect(f.gateway.auth.current()?.uid).toBe(B.uid);
});
