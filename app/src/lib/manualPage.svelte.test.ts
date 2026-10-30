import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Manual from '../routes/manual/+page.svelte';
import About from '../routes/about/+page.svelte';
import '../app.css';
import '../appearance.css';
import { setLanguage } from './i18n.svelte';
vi.mock('$app/paths', () => ({ asset: (path: string) => path, resolve: (path: string) => path }));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
afterEach(() => {
	vi.unstubAllGlobals();
	setLanguage('en');
});
describe('the localized offline manual', () => {
	it.each(['en', 'de', 'it'] as const)(
		'keeps headings, links and code within the page at 300%%: %s',
		async (language) => {
			const original = document.documentElement.style.fontSize;
			try {
				document.documentElement.style.fontSize = '300%';
				setLanguage(language);
				vi.stubGlobal(
					'fetch',
					vi.fn(
						async () =>
							new Response(
								'<h1>Geoclick — User manual</h1><p><a href="#">https://github.com/diegoami/Geoclick2027/releases/latest</a></p><pre>Geoclick-1.2.0-windows-x64-setup.exe --a-long-command-without-spaces</pre><table><tr><td>A comparison cell</td><td>Another comparison cell</td></tr></table>'
							)
					)
				);
				const screen = await render(Manual);
				screen.container.style.cssText = 'box-sizing:border-box;width:344px';
				await expect
					.element(screen.getByRole('heading', { name: 'Geoclick — User manual', exact: true }))
					.toBeVisible();
				expect(screen.container.scrollWidth).toBeLessThanOrEqual(screen.container.clientWidth);
				await screen.unmount();
			} finally {
				document.documentElement.style.fontSize = original;
			}
		}
	);
	it.each(['en', 'de', 'it'] as const)(
		'keeps About and its page-bar title inside a narrow page at 300%%: %s',
		async (language) => {
			const original = document.documentElement.style.fontSize;
			try {
				document.documentElement.style.fontSize = '300%';
				setLanguage(language);
				const screen = await render(About);
				screen.container.style.cssText = 'box-sizing:border-box;width:344px';
				await expect
					.element(screen.getByRole('heading', { name: 'Geoclick', exact: true }))
					.toBeVisible();
				expect(screen.container.scrollWidth).toBeLessThanOrEqual(screen.container.clientWidth);
				await screen.unmount();
			} finally {
				document.documentElement.style.fontSize = original;
			}
		}
	);
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
