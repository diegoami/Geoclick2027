import type { BrowserAccountAuth, BrowserAccountIdentity } from './browserAccountSession';
import type { ProgressOwner } from './progressEvents';
import type { ProgressTransport } from './progressSync';
export interface WindowsAccountConfiguration {
	projectId: string;
	actorId: string;
	cachedUid: string | null;
	cachedLabel?: string | null;
	rememberAvailable: boolean;
	storageWarning: boolean;
}
export interface WindowsCredential {
	id_token: string;
	attempt_id: string;
	expected_uid: string | null;
}
export type WindowsRestore =
	| { status: 'credential'; credential: WindowsCredential }
	| { status: 'none' | 'unavailable' | 'revoked' | 'rejected' };
export interface WindowsAccountBridge {
	login(requestId: string, remember: boolean): Promise<WindowsCredential>;
	restore(requestId: string): Promise<WindowsRestore>;
	confirm(requestId: string, attemptId: string, uid: string, label: string): Promise<boolean>;
	cancel(requestId: string): Promise<void>;
	forget(): Promise<void>;
}
export interface WindowsFirebasePort {
	consumeGoogle(idToken: string): Promise<BrowserAccountIdentity>;
	matches(owner: ProgressOwner): boolean;
	clear(): Promise<void>;
	transport(owner: ProgressOwner): ProgressTransport;
}
export class WindowsAccountError extends Error {
	constructor(readonly code: string) {
		super(code);
		this.name = 'WindowsAccountError';
	}
}
const same = (a: ProgressOwner | undefined, b: ProgressOwner) =>
	!!a && a.projectId === b.projectId && a.uid === b.uid;
/** Logical local identity may come from the native-only protected record. It
 * never authorizes cloud calls until Firebase freshly verifies the same UID. */
export function createWindowsAccountGateway(
	configuration: WindowsAccountConfiguration,
	native: WindowsAccountBridge,
	firebase: WindowsFirebasePort,
	idFactory: () => string = () => crypto.randomUUID()
) {
	configuration = Object.freeze({ ...configuration });
	if (
		typeof configuration.projectId !== 'string' ||
		!configuration.projectId ||
		configuration.projectId.length > 128 ||
		typeof configuration.actorId !== 'string' ||
		!/^[A-Za-z0-9_-]{1,128}$/.test(configuration.actorId) ||
		(configuration.cachedUid !== null && !/^[A-Za-z0-9_-]{1,128}$/.test(configuration.cachedUid))
	)
		throw new WindowsAccountError('configuration');
	let identity: Readonly<BrowserAccountIdentity> | undefined = configuration.cachedUid
		? Object.freeze({
				projectId: configuration.projectId,
				uid: configuration.cachedUid,
				label: configuration.cachedLabel ?? ''
			})
		: undefined;
	let blocked = false;
	let savedUid = configuration.cachedUid ?? undefined,
		epoch = 0,
		currentRequest: string | undefined;
	let forgetting: Promise<void> | undefined;
	let restoring: Promise<void> | undefined,
		sdkTail: Promise<unknown> = Promise.resolve();
	const listeners = new Set<(identity: BrowserAccountIdentity | undefined) => void>();
	function publish(next: BrowserAccountIdentity | undefined) {
		const changed = next ? !same(identity, next) : !!identity;
		identity = next ? Object.freeze({ ...next }) : undefined;
		if (changed) for (const listener of listeners) listener(identity);
	}
	function sdk<T>(action: () => Promise<T>): Promise<T> {
		const task = sdkTail.then(action);
		sdkTail = task.catch(() => undefined);
		return task;
	}
	const active = (generation: number) => epoch === generation;
	function requireOwner(owner: ProgressOwner) {
		if (blocked || !same(identity, owner)) throw new WindowsAccountError('account-changed');
	}
	async function loseIdentity(generation: number) {
		if (!active(generation)) return;
		savedUid = undefined;
		blocked = true;
		// Enqueue before emitting guest: a later login's SDK exchange goes behind it.
		const clearing = sdk(() => firebase.clear());
		publish(undefined);
		await clearing;
	}
	async function perform(
		restore: boolean,
		remember: boolean,
		generation: number,
		requestId: string
	) {
		try {
			const restoreUid = savedUid;
			let credential: WindowsCredential;
			if (restore) {
				const result = await native.restore(requestId);
				if (!active(generation)) throw new WindowsAccountError('cancelled');
				if (result.status === 'none' || result.status === 'revoked') {
					await loseIdentity(generation);
					throw new WindowsAccountError('unauthenticated');
				}
				if (result.status === 'unavailable') throw new WindowsAccountError('unavailable');
				if (result.status !== 'credential') throw new WindowsAccountError('credential-rejected');
				credential = result.credential;
				if (!restoreUid || credential.expected_uid !== restoreUid)
					throw new WindowsAccountError('identity-changed');
			} else credential = await native.login(requestId, remember);
			if (!active(generation)) throw new WindowsAccountError('cancelled');
			const verified = await sdk(async () => {
				if (!active(generation)) throw new WindowsAccountError('cancelled');
				try {
					const user = await firebase.consumeGoogle(credential.id_token);
					if (!active(generation)) throw new WindowsAccountError('cancelled');
					if (user.projectId !== configuration.projectId)
						throw new WindowsAccountError('project-mismatch');
					if (credential.expected_uid && user.uid !== credential.expected_uid) {
						// Native finalization checks the original UID and forgets the mismatched
						// saved grant under the same request binding. Never publish the new UID.
						await native
							.confirm(requestId, credential.attempt_id, user.uid, user.label)
							.catch(() => false);
						throw new WindowsAccountError('identity-changed');
					}
					const remembered = await native.confirm(
						requestId,
						credential.attempt_id,
						user.uid,
						user.label
					);
					if (!active(generation)) throw new WindowsAccountError('cancelled');
					if (remembered !== remember) throw new WindowsAccountError('storage');
					return user;
				} catch (error) {
					await firebase.clear();
					throw error;
				}
			});
			if (!active(generation)) throw new WindowsAccountError('cancelled');
			savedUid = remember ? verified.uid : undefined;
			blocked = false;
			publish(verified);
		} catch (error) {
			await native.cancel(requestId).catch(() => {}); // Request-scoped: cannot cancel a newer login.
			if (
				active(generation) &&
				error instanceof WindowsAccountError &&
				error.code === 'identity-changed'
			)
				await loseIdentity(generation);
			throw error;
		}
	}
	async function ensure(owner: ProgressOwner) {
		requireOwner(owner);
		if (firebase.matches(owner)) return;
		if (!savedUid || savedUid !== owner.uid) {
			await loseIdentity(epoch);
			throw new WindowsAccountError('unauthenticated');
		}
		if (!restoring) {
			const generation = epoch,
				requestId = idFactory();
			currentRequest = requestId;
			const task = perform(true, true, generation, requestId);
			restoring = task;
			void task
				.finally(() => {
					if (restoring === task) restoring = undefined;
				})
				.catch(() => {});
		}
		await restoring;
		requireOwner(owner);
		if (!firebase.matches(owner)) throw new WindowsAccountError('unauthenticated');
	}
	const auth: BrowserAccountAuth = {
		current: () => identity,
		observe(listener) {
			listeners.add(listener);
			listener(identity);
			return () => {
				listeners.delete(listener);
			};
		},
		async signIn(remember) {
			if (identity) throw new WindowsAccountError('sign-out-first');
			if (remember && !configuration.rememberAvailable) throw new WindowsAccountError('storage');
			const previous = currentRequest,
				generation = ++epoch,
				requestId = idFactory();
			currentRequest = requestId;
			restoring = undefined;
			if (forgetting) await forgetting;
			if (!active(generation)) throw new WindowsAccountError('cancelled');
			if (previous) await native.cancel(previous);
			await perform(false, remember, generation, requestId);
		},
		async signOut() {
			const generation = ++epoch;
			blocked = true;
			currentRequest = undefined;
			restoring = undefined;
			const clearing = sdk(() => firebase.clear());
			// Do not emit guest/sign-in availability until native forget has completed:
			// an old forget command must never arrive after a new native login begins.
			let failure: unknown;
			const deleting = native.forget();
			forgetting = deleting;
			try {
				await deleting;
				if (active(generation)) {
					savedUid = undefined;
					publish(undefined);
				}
			} catch (error) {
				failure = error;
			} finally {
				if (forgetting === deleting) forgetting = undefined;
			}
			try {
				await clearing;
			} catch (error) {
				failure ??= error;
			}
			if (failure) throw failure;
		}
	};
	return {
		auth,
		rememberAvailable: configuration.rememberAvailable,
		transport(owner: ProgressOwner): ProgressTransport {
			const fixed = Object.freeze({ projectId: owner.projectId, uid: owner.uid });
			requireOwner(fixed);
			return {
				owner: fixed,
				currentOwner: () => (!blocked && same(identity, fixed) ? fixed : undefined),
				async pull(after, limit) {
					await ensure(fixed);
					requireOwner(fixed);
					return firebase.transport(fixed).pull(after, limit);
				},
				async put(event) {
					await ensure(fixed);
					requireOwner(fixed);
					await firebase.transport(fixed).put(event);
				}
			};
		}
	};
}
