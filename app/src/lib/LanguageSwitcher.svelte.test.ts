import { beforeEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { userEvent } from 'vitest/browser';
import LanguageSwitcher from './LanguageSwitcher.svelte';
import { getLanguage, setLanguage } from './i18n.svelte';

// Canary for the browser test project (GC-003): no MapLibre dependency, so a
// failure here means the component harness itself is broken, not a map.
//
// Rewritten for FT-43: the three pills became one button and a popup list.
describe('LanguageSwitcher', () => {
	// The language is module-scope state persisted to localStorage - pin it so
	// the test does not depend on whatever an earlier run left behind.
	beforeEach(() => setLanguage('en'));

	it('shows one button, not one per language', async () => {
		// The whole point of the change: adding a language must not add
		// anything to the bar.
		const screen = await render(LanguageSwitcher);
		expect(screen.getByRole('button').elements()).toHaveLength(1);
		await expect.element(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false');
	});

	it('opens a list of every language and picks one', async () => {
		const screen = await render(LanguageSwitcher);
		const trigger = screen.getByRole('button');

		await trigger.click();
		await expect.element(trigger).toHaveAttribute('aria-expanded', 'true');

		const options = screen.getByRole('option');
		expect(options.elements()).toHaveLength(3);

		// Names are in their own language, so one you cannot read is still
		// recognisable.
		const deutsch = screen.getByRole('option', { name: /Deutsch/ });
		await expect
			.element(screen.getByRole('option', { name: /English/ }))
			.toHaveAttribute('aria-selected', 'true');
		await expect.element(deutsch).toHaveAttribute('aria-selected', 'false');

		await deutsch.click();

		expect(getLanguage()).toBe('de');
		// Choosing closes the popup and puts focus back where it started.
		await expect.element(trigger).toHaveAttribute('aria-expanded', 'false');
	});

	it('closes on Escape without changing the language', async () => {
		const screen = await render(LanguageSwitcher);
		const trigger = screen.getByRole('button');
		await trigger.click();
		await expect.element(trigger).toHaveAttribute('aria-expanded', 'true');

		await userEvent.keyboard('{Escape}');

		await expect.element(trigger).toHaveAttribute('aria-expanded', 'false');
		expect(getLanguage()).toBe('en');
	});

	it('moves through the list with the arrow keys and commits on Enter', async () => {
		const screen = await render(LanguageSwitcher);
		const trigger = screen.getByRole('button');
		await trigger.click();

		// Opens on the current language (English, index 0); one step down is
		// German. Arrowing must NOT change the language on its own.
		await userEvent.keyboard('{ArrowDown}');
		expect(getLanguage()).toBe('en');

		await userEvent.keyboard('{Enter}');
		expect(getLanguage()).toBe('de');
		await expect.element(trigger).toHaveAttribute('aria-expanded', 'false');
	});
});
