import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { userEvent } from 'vitest/browser';
import { tick } from 'svelte';
import '../app.css';
import '../appearance.css';
vi.mock('./account.svelte', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./account.svelte')>();
	return { ...actual, accountAvailable: () => true, initializeBrowserAccount: async () => {} };
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
import MapNav from './MapNav.svelte';
import { accountOpen, setAccountOpen } from './accountDialogState.svelte';
import { setLanguage } from './i18n.svelte';
afterEach(() => {
	setAccountOpen(false);
	setLanguage('en');
	document.documentElement.style.removeProperty('font-size');
});
describe('visible account entry and independent dialog', () => {
	it('opens sign-in directly from the home toolbar and returns focus on close', async () => {
		const toolbar = await render(StartBar, {
			showMap: true,
			switchDisabled: false,
			onView: () => {},
			isApp: false,
			myMapsCount: 0
		});
		const screen = await render(AccountDialog);
		const opener = toolbar.getByRole('button', { name: 'Account', exact: true });
		await expect.element(opener).toBeVisible();
		await opener.click();
		await expect.element(screen.getByRole('dialog', { name: 'Account' })).toBeVisible();
		await expect.element(screen.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
		expect(accountOpen()).toBe(true);
		await screen.getByRole('button', { name: 'Close account panel' }).click();
		await expect.poll(() => accountOpen()).toBe(false);
		expect(document.activeElement).toBe(opener.element());
	});
	it('keeps Account visible outside the collapsed map settings', async () => {
		const toolbar = await render(MapNav, {
			mapId: 'italy-regions',
			mapName: 'Italy',
			active: 'quiz'
		});
		const screen = await render(AccountDialog),
			opener = toolbar.getByRole('button', { name: 'Account', exact: true });
		expect(toolbar.container.querySelector<HTMLDetailsElement>('.settings-panel')!.open).toBe(
			false
		);
		expect(opener.element().closest('.settings-panel')).toBeNull();
		await expect.element(opener).toBeVisible();
		await opener.click();
		await expect.element(screen.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
	});
	it('closes with Escape without sending a quiz/navigation key to the window', async () => {
		const screen = await render(AccountDialog),
			toolbar = await render(AccountButton);
		await toolbar.getByRole('button', { name: 'Account', exact: true }).click();
		await expect.element(screen.getByRole('dialog', { name: 'Account' })).toBeVisible();
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
			['en', 'Account'],
			['de', 'Konto'],
			['it', 'Account']
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
