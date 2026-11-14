import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { userEvent } from 'vitest/browser';
import { tick } from 'svelte';
import '../app.css';
import '../appearance.css';
vi.mock('./account.svelte', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./account.svelte')>();
	return {
		...actual,
		accountAvailable: () => true,
		initializeBrowserAccount: async () => {},
		accountState: vi.fn(actual.accountState)
	};
});
vi.mock('$app/navigation', () => ({ goto: vi.fn(), afterNavigate: vi.fn() }));
vi.mock('$app/paths', () => ({
	asset: (file: string) => file,
	resolve: (route: string, params: Record<string, string> = {}) =>
		Object.entries(params).reduce((path, [key, value]) => path.replace(`[${key}]`, value), route)
}));
import AccountDialog from './AccountDialog.svelte';
import AccountButton from './AccountButton.svelte';
import StartBar from './StartBar.svelte';
import PageBar from './PageBar.svelte';
import MapNav from './MapNav.svelte';
import { accountState } from './account.svelte';
import AccountSyncStatus from './AccountSyncStatus.svelte';
import { accountOpen, setAccountOpen } from './accountDialogState.svelte';
import { setLanguage } from './i18n.svelte';
beforeEach(() => setLanguage('en'));
afterEach(() => {
	vi.mocked(accountState).mockReturnValue({ usingAccount: false, busy: false, sync: 'idle' });
	setAccountOpen(false);
	setLanguage('en');
	document.documentElement.style.removeProperty('font-size');
});
describe('visible account entry and independent dialog', () => {
	it('opens the experimental panel and returns focus on close', async () => {
		const entry = await render(AccountButton);
		const screen = await render(AccountDialog);
		const opener = entry.getByRole('button', { name: 'Login & sync (experimental)', exact: true });
		await opener.click();
		await expect
			.element(screen.getByRole('dialog', { name: 'Login & sync (experimental)' }))
			.toBeVisible();
		await expect
			.element(screen.getByText(/Experimental: Google login, cloud saving/))
			.toBeVisible();
		await expect.element(screen.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
		await screen.getByRole('button', { name: 'Close account panel' }).click();
		await expect.poll(() => accountOpen()).toBe(false);
		expect(document.activeElement).toBe(opener.element());
	});
	it('offers no account controls or sync status in guest toolbars', async () => {
		const home = await render(StartBar, {
			showMap: true,
			switchDisabled: false,
			onView: () => {},
			isApp: false,
			myMapsCount: 0
		});
		const map = await render(MapNav, { mapId: 'italy-regions', mapName: 'Italy', active: 'quiz' });
		const page = await render(PageBar, { title: 'About' });
		for (const view of [home, map, page]) {
			expect(view.container.querySelector('.account-button')).toBeNull();
			expect(view.container.querySelector('.sync-status')).toBeNull();
		}
	});
	it('shows read-only sync status only for signed-in progress', async () => {
		vi.mocked(accountState).mockReturnValue({ usingAccount: true, busy: false, sync: 'syncing' });
		const screen = await render(AccountSyncStatus);
		await expect.element(screen.getByRole('status')).toHaveTextContent('Syncing…');
		expect(screen.container.querySelector('button')).toBeNull();
	});
	it('closes with Escape without sending a quiz/navigation key to the window', async () => {
		const screen = await render(AccountDialog),
			toolbar = await render(AccountButton);
		await toolbar.getByRole('button', { name: 'Login & sync (experimental)', exact: true }).click();
		await expect
			.element(screen.getByRole('dialog', { name: 'Login & sync (experimental)' }))
			.toBeVisible();
		const leaked = vi.fn();
		window.addEventListener('keydown', leaked);
		try {
			await userEvent.keyboard('{Escape}');
			await expect.poll(() => accountOpen()).toBe(false);
			expect(leaked).not.toHaveBeenCalled();
		} finally {
			window.removeEventListener('keydown', leaked);
		}
	});
	it('keeps the labeled toolbar target usable at large text in EN/DE/IT', async () => {
		document.documentElement.style.fontSize = '300%';
		const screen = await render(AccountButton);
		screen.container.style.width = '180px';
		for (const [language, label] of [
			['en', 'Login & sync (experimental)'],
			['de', 'Anmeldung & Sync (experimentell)'],
			['it', 'Accesso e sync (sperimentale)']
		] as const) {
			setLanguage(language);
			await tick();
			const button = screen
				.getByRole('button', { name: label, exact: true })
				.element() as HTMLElement;
			expect(button.textContent).toContain(label);
			const box = button.getBoundingClientRect();
			expect(box.width).toBeGreaterThanOrEqual(44);
			expect(box.height).toBeGreaterThanOrEqual(44);
			expect(box.width).toBeLessThanOrEqual(180);
			expect(button.scrollWidth).toBeLessThanOrEqual(button.clientWidth + 1);
		}
	});
});
