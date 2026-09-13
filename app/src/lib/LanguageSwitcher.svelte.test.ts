import { beforeEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import LanguageSwitcher from './LanguageSwitcher.svelte';
import { getLanguage, setLanguage } from './i18n.svelte';

// Canary for the browser test project (GC-003): no MapLibre dependency, so a
// failure here means the component harness itself is broken, not a map.
describe('LanguageSwitcher', () => {
	// The language is module-scope state persisted to localStorage - pin it so
	// the test does not depend on whatever an earlier run left behind.
	beforeEach(() => setLanguage('en'));

	it('renders one button per language and moves aria-pressed on click', async () => {
		const screen = await render(LanguageSwitcher);

		expect(screen.getByRole('button').elements()).toHaveLength(3);

		const en = screen.getByRole('button', { name: 'EN' });
		const de = screen.getByRole('button', { name: 'DE' });
		const it_ = screen.getByRole('button', { name: 'IT' });
		await expect.element(en).toHaveAttribute('aria-pressed', 'true');
		await expect.element(de).toHaveAttribute('aria-pressed', 'false');
		await expect.element(it_).toHaveAttribute('aria-pressed', 'false');

		await de.click();

		await expect.element(de).toHaveAttribute('aria-pressed', 'true');
		await expect.element(en).toHaveAttribute('aria-pressed', 'false');
		expect(getLanguage()).toBe('de');
	});
});
