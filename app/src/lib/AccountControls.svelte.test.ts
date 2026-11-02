import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { userEvent } from 'vitest/browser';
import { setLanguage, type Language } from './i18n.svelte';
import AccountControls from './AccountControls.svelte';
import type { BrowserAccountState } from './browserAccountSession';
import '../appearance.css';
const identity = { projectId: 'test-project', uid: 'owner', label: 'Player' };
function props(model: BrowserAccountState = { usingAccount: false, busy: false, sync: 'idle' }) {
	return {
		model,
		onSignIn: vi.fn(),
		onSignOut: vi.fn(),
		onSync: vi.fn(),
		onPreview: vi.fn(),
		onConfirm: vi.fn(),
		onDismiss: vi.fn()
	};
}
afterEach(() => {
	setLanguage('en');
	document.documentElement.style.removeProperty('font-size');
	delete document.documentElement.dataset.scheme;
});
describe('optional account controls', () => {
	for (const [language, label] of [
		['en', 'Sign in with Google'],
		['de', 'Mit Google anmelden'],
		['it', 'Accedi con Google']
	] as [Language, string][]) {
		it('offers optional, unchecked remembered sign-in in ' + language, async () => {
			setLanguage(language);
			const actions = props(),
				screen = await render(AccountControls, actions);
			const remember = screen.getByRole('checkbox');
			expect((remember.element() as HTMLInputElement).checked).toBe(false);
			await screen.getByRole('button', { name: label }).click();
			expect(actions.onSignIn).toHaveBeenLastCalledWith(false);
			await remember.click();
			await screen.getByRole('button', { name: label }).click();
			expect(actions.onSignIn).toHaveBeenLastCalledWith(true);
			expect(actions.onConfirm).not.toHaveBeenCalled();
		});
	}
	it('previews conflicts/unsupported rows without importing and requires a separate confirmation', async () => {
		const actions = props({
			identity,
			usingAccount: true,
			busy: false,
			sync: 'synced',
			preview: {
				owner: identity,
				rows: [
					{ mapId: 'italy-regions', targetId: 'one', kind: 'card', disposition: 'add' },
					{ mapId: 'italy-regions', targetId: 'two', kind: 'card', disposition: 'account-wins' },
					{ mapId: 'italy-regions', targetId: 'old', kind: 'card', disposition: 'unsupported' }
				]
			}
		});
		const screen = await render(AccountControls, actions);
		await expect
			.element(
				screen.getByText('Add: 1. Keep account: 1. Unsupported: 1.', { exact: true }).first()
			)
			.toBeVisible();
		expect(actions.onConfirm).not.toHaveBeenCalled();
		await screen.getByRole('button', { name: 'Keep account progress', exact: true }).click();
		expect(actions.onDismiss).toHaveBeenCalledOnce();
		await screen.getByRole('button', { name: 'Import the available progress' }).click();
		expect(actions.onConfirm).toHaveBeenCalledOnce();
	});
	it('leaves sign-out usable during an outstanding operation and announces failures without provider details', async () => {
		const actions = props({
				identity,
				usingAccount: true,
				busy: true,
				sync: 'syncing',
				error: 'sync'
			}),
			screen = await render(AccountControls, actions);
		await expect
			.element(screen.getByRole('alert'))
			.toHaveTextContent('Saved account progress remains on this device');
		await expect.element(screen.getByRole('button', { name: 'Sync now' })).toBeDisabled();
		await screen.getByRole('button', { name: 'Sign out', exact: true }).click();
		expect(actions.onSignOut).toHaveBeenCalledOnce();
	});
	it('supports keyboard action and wrapping at 300% across every color scheme', async () => {
		document.documentElement.style.fontSize = '300%';
		const actions = props(),
			screen = await render(AccountControls, actions);
		for (const scheme of ['classic', 'ocean', 'forest', 'contrast']) {
			document.documentElement.dataset.scheme = scheme;
			const fieldset = screen.getByRole('group', { name: 'Account' }).element() as HTMLElement;
			fieldset.style.width = '240px';
			fieldset.style.boxSizing = 'border-box';
			expect(fieldset.scrollWidth).toBeLessThanOrEqual(fieldset.clientWidth + 1);
		}
		(
			screen.getByRole('button', { name: 'Sign in with Google' }).element() as HTMLButtonElement
		).focus();
		await userEvent.keyboard('{Enter}');
		expect(actions.onSignIn).toHaveBeenCalledWith(false);
	});
});

it('offers explicit cancellation while native sign-in is outstanding', async () => {
	const actions = props({ usingAccount: false, busy: true, sync: 'idle' }),
		screen = await render(AccountControls, actions);
	await screen.getByRole('button', { name: 'Cancel sign-in' }).click();
	expect(actions.onSignOut).toHaveBeenCalledOnce();
});
it('disables an unavailable native remember choice without blocking guest play', async () => {
	const actions = props({
			usingAccount: false,
			busy: false,
			sync: 'idle',
			rememberAvailable: false
		}),
		screen = await render(AccountControls, actions);
	await expect.element(screen.getByRole('checkbox')).toBeDisabled();
	await expect.element(screen.getByRole('button', { name: 'Sign in with Google' })).toBeEnabled();
});

it('resets the remember choice after a completed sign-out', async () => {
	const actions = props(),
		screen = await render(AccountControls, actions);
	await screen.getByRole('checkbox').click();
	await screen.rerender({ model: { identity, usingAccount: true, busy: false, sync: 'synced' } });
	await screen.rerender({ model: { usingAccount: false, busy: false, sync: 'idle' } });
	await expect.element(screen.getByRole('checkbox')).not.toBeChecked();
});
