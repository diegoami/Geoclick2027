import { createRawSnippet } from 'svelte';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ChartMapShell from './ChartMapShell.svelte';
import { setLanguage } from './i18n.svelte';

describe('ChartMapShell', () => {
	it('keeps the localized chart texture outside the inset, interactive map viewport', async () => {
		setLanguage('en');
		await render(ChartMapShell, {
			children: createRawSnippet(() => ({
				render: () => '<div class="container" data-testid="map-viewport"></div>'
			}))
		});
		const shell = document.querySelector<HTMLElement>('.chart-map-shell')!;
		const viewport = document.querySelector<HTMLElement>('[data-testid="map-viewport"]')!;

		expect(getComputedStyle(shell).backgroundImage).toContain('data:image/svg+xml');
		expect(getComputedStyle(viewport).position).toBe('absolute');
		expect(getComputedStyle(viewport).inset).toBe('8px');
		expect(getComputedStyle(viewport).overflow).toBe('hidden');

		setLanguage('de');
		await expect.poll(() => shell.getAttribute('style')).toContain('Hier%20sind%20Drachen');
		setLanguage('en');
	});
});
