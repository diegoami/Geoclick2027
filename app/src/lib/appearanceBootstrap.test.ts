import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { TEXT_SCALES, COLOR_SCHEMES, APPEARANCE_KEY } from './appearance';

const html = readFileSync(new URL('../app.html', import.meta.url), 'utf8');
const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? '';
function bootstrap(raw: string | null, blocked = false) {
	const root = { style: {} as Record<string, string>, dataset: {} as Record<string, string> };
	runInNewContext(script, {
		document: { documentElement: root },
		localStorage: {
			getItem: (key: string) => {
				if (key !== APPEARANCE_KEY) throw new Error('Unexpected preference key');
				if (blocked) throw new Error('blocked');
				return raw;
			}
		}
	});
	return root;
}
describe('appearance before first paint (#290)', () => {
	it('runs synchronously in the head before SvelteKit styles and hydration', () => {
		expect(script).not.toBe('');
		expect(html.indexOf('<script>')).toBeLessThan(html.indexOf('%sveltekit.head%'));
		expect(html.indexOf('</script>')).toBeLessThan(html.indexOf('<body'));
	});
	// The head script cannot import the deferred module. This contract catches
	// drift between its small literal allowlists and the canonical definitions.
	it.each(TEXT_SCALES)('applies supported size %s before hydration', (scale) => {
		const root = bootstrap(JSON.stringify({ scale, scheme: 'contrast' }));
		expect(root.style.fontSize).toBe(`${scale}%`);
		expect(root.dataset.scheme).toBe('contrast');
		expect(root.dataset.textSize).toBe(scale > 100 ? 'large' : 'normal');
	});
	it.each(COLOR_SCHEMES)('applies scheme %s', (scheme) => {
		expect(bootstrap(JSON.stringify({ scale: 150, scheme })).dataset.scheme).toBe(scheme);
	});
	it('validates fields independently and rejects CSS-like values', () => {
		expect(bootstrap('{"scale":300,"scheme":"url(evil)"}').dataset.scheme).toBe('classic');
		expect(bootstrap('{"scale":300,"scheme":"url(evil)"}').style.fontSize).toBe('300%');
		expect(bootstrap('{"scale":"300%","scheme":"ocean"}').style.fontSize).toBe('100%');
		expect(bootstrap('{"scale":"300%","scheme":"ocean"}').dataset.scheme).toBe('ocean');
	});
	it.each([null, '{', 'null', '42', '[]'])('defaults safely for %s', (raw) => {
		const root = bootstrap(raw);
		expect(root.style.fontSize ?? '100%').toBe('100%');
		expect(root.dataset.scheme ?? 'classic').toBe('classic');
	});
	it('leaves browser defaults usable when storage is blocked', () => {
		const root = bootstrap(null, true);
		expect(root.style.fontSize).toBeUndefined();
		expect(root.dataset.scheme).toBeUndefined();
	});
});
