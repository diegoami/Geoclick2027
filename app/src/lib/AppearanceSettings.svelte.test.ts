import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { userEvent } from 'vitest/browser';
import { tick } from 'svelte';
import '../app.css';
import '../appearance.css';
import AppearanceSettings from './AppearanceSettings.svelte';
import AppearanceButton from './AppearanceButton.svelte';
import { APPEARANCE_KEY, APPEARANCE_CHANGED, DEFAULT_APPEARANCE } from './appearance';
import { appearance, setAppearance, setAppearanceOpen } from './appearance.svelte';
import { setLanguage } from './i18n.svelte';

const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

describe('Appearance settings', () => {
	beforeEach(() => {
		localStorage.removeItem(APPEARANCE_KEY);
		setAppearance(DEFAULT_APPEARANCE);
		setAppearanceOpen(false);
		setLanguage('en');
	});
	afterEach(() => {
		vi.restoreAllMocks();
		setAppearanceOpen(false);
		setAppearance(DEFAULT_APPEARANCE);
		document.documentElement.style.removeProperty('font-size');
		delete document.documentElement.dataset.scheme;
		delete document.documentElement.dataset.textSize;
	});

	it('scales text live, signals map geometry, persists and resets without changing the scheme', async () => {
		const settings = await render(AppearanceSettings);
		const button = await render(AppearanceButton);
		await button.getByRole('button', { name: 'Appearance' }).click();
		const changed = vi.fn();
		window.addEventListener(APPEARANCE_CHANGED, changed);
		try {
			const root = document.documentElement;
			const base = parseFloat(getComputedStyle(root).fontSize);
			await settings.getByRole('button', { name: 'Larger text' }).click();
			await tick();
			await frame();
			expect(parseFloat(getComputedStyle(root).fontSize)).toBeCloseTo(base * 1.15);
			expect(changed).toHaveBeenCalled();
			await settings.getByRole('radio', { name: 'Ocean', exact: true }).click();
			await expect.poll(() => root.dataset.scheme).toBe('ocean');
			expect(JSON.parse(localStorage.getItem(APPEARANCE_KEY)!)).toEqual({
				scale: 115,
				scheme: 'ocean'
			});
			await settings.getByRole('button', { name: 'Reset', exact: true }).click();
			expect(appearance()).toEqual({ scale: 100, scheme: 'ocean' });
		} finally {
			window.removeEventListener(APPEARANCE_CHANGED, changed);
		}
	});

	it('loads a saved maximum size, contains shortcuts, and returns focus on Escape', async () => {
		localStorage.setItem(APPEARANCE_KEY, '{"scale":200,"scheme":"contrast"}');
		const settings = await render(AppearanceSettings);
		const button = await render(AppearanceButton);
		const trigger = button.getByRole('button', { name: 'Appearance' });
		await trigger.click();
		await expect.element(settings.getByRole('button', { name: 'Larger text' })).toBeDisabled();
		const shortcut = vi.fn();
		window.addEventListener('keydown', shortcut);
		try {
			await userEvent.keyboard('1');
			expect(shortcut).not.toHaveBeenCalled();
			await userEvent.keyboard('{Escape}');
			await expect.poll(() => settings.container.querySelector('dialog')?.open).toBe(false);
			await expect.poll(() => document.activeElement === trigger.element()).toBe(true);
			expect(appearance().scale).toBe(200);
		} finally {
			window.removeEventListener('keydown', shortcut);
		}
	});

	it('allows session-only changes when storage reads and writes fail', async () => {
		vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
			throw new Error('blocked');
		});
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new Error('full');
		});
		const settings = await render(AppearanceSettings);
		setAppearanceOpen(true);
		await settings.getByRole('button', { name: 'Smaller text' }).click();
		await expect.element(settings.getByRole('button', { name: 'Smaller text' })).toBeDisabled();
		expect(appearance().scale).toBe(90);
		await settings.getByRole('radio', { name: 'Forest', exact: true }).click();
		expect(appearance().scheme).toBe('forest');
	});
});
