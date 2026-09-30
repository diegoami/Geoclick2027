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
				render: () =>
					'<div><div class="container" data-testid="map-viewport"></div><div class="map" data-testid="picker-viewport"></div></div>'
			}))
		});
		const shell = document.querySelector<HTMLElement>('.chart-map-shell')!;
		const viewport = document.querySelector<HTMLElement>('[data-testid="map-viewport"]')!;
		const pickerViewport = document.querySelector<HTMLElement>('[data-testid="picker-viewport"]')!;

		expect(getComputedStyle(shell).backgroundImage).toContain('data:image/svg+xml');
		const inset = `${parseFloat(getComputedStyle(document.documentElement).fontSize) / 2}px`;
		for (const mapViewport of [viewport, pickerViewport]) {
			expect(getComputedStyle(mapViewport).position).toBe('absolute');
			expect(getComputedStyle(mapViewport).inset).toBe(inset);
			expect(getComputedStyle(mapViewport).overflow).toBe('hidden');
		}

		setLanguage('de');
		await expect.poll(() => shell.getAttribute('style')).toContain('Hier%20sind%20Drachen');
		setLanguage('en');
	});
});
