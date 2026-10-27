import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Manual from '../routes/manual/+page.svelte';
import { setLanguage } from './i18n.svelte';
vi.mock('$app/paths', () => ({ asset: (path: string) => path, resolve: (path: string) => path }));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
afterEach(() => {
	vi.unstubAllGlobals();
	setLanguage('en');
});
describe('the localized offline manual', () => {
	it('loads the selected language and follows a language change', async () => {
		const request = vi.fn(
			async (url: string) =>
				new Response(
					url.includes('/de.') ? '<h2>Deutsches Handbuch</h2>' : '<h2>Manuale italiano</h2>'
				)
		);
		vi.stubGlobal('fetch', request);
		setLanguage('de');
		const view = await render(Manual);
		await expect
			.poll(() => document.querySelector('article')?.textContent)
			.toContain('Deutsches Handbuch');
		expect(document.querySelector('article')?.lang).toBe('de');
		setLanguage('it');
		await expect
			.poll(() => document.querySelector('article')?.textContent)
			.toContain('Manuale italiano');
		expect(document.querySelector('article')?.lang).toBe('it');
		expect(request.mock.calls.map(([url]) => url)).toEqual(['/manual/de.html', '/manual/it.html']);
		await view.unmount();
	});
	it('does not let a slow previous-language response replace the current manual', async () => {
		let releaseEnglish: (response: Response) => void = () => {};
		vi.stubGlobal(
			'fetch',
			vi.fn((url: string) =>
				url.includes('/en.')
					? new Promise<Response>((resolve) => {
							releaseEnglish = resolve;
						})
					: Promise.resolve(new Response('<h2>Manuale italiano</h2>'))
			)
		);
		setLanguage('en');
		const view = await render(Manual);
		setLanguage('it');
		await expect
			.poll(() => document.querySelector('article')?.textContent)
			.toContain('Manuale italiano');
		releaseEnglish(new Response('<h2>English manual</h2>'));
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(document.querySelector('article')?.textContent).toContain('Manuale italiano');
		await view.unmount();
	});
	it('shows a localized error rather than a different-language manual', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response('', { status: 404 }))
		);
		setLanguage('de');
		const view = await render(Manual);
		await expect
			.poll(() => document.querySelector('.note')?.textContent)
			.toContain('Das Handbuch konnte nicht geladen werden.');
		expect(document.querySelector('article')).toBeNull();
		await view.unmount();
	});
});
