// The two fixes from tablet play, 2026-09-24, around the map's own chrome:
// the button under the zoom control that hides the map bar, and the credit
// line lifted above whatever covers the bottom of the map.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { flushSync } from 'svelte';
import { render } from 'vitest-browser-svelte';
import { HideButtonsControl } from './hideButtonsControl.svelte';
import { mapNavHidden, setMapNavHidden } from './mapPrefs.svelte';
import { MAP_BOTTOM_VAR, publishBottomOverlay } from './mapBottomOverlay';
import VersionBadge from './VersionBadge.svelte';
import { setLanguage } from './i18n.svelte';

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r(undefined)));

describe('the hide-the-buttons control', () => {
	beforeEach(() => {
		// Other browser files can persist their chosen language on this origin.
		setLanguage('en');
		setMapNavHidden(false);
	});
	afterEach(() => {
		setMapNavHidden(false);
		setLanguage('en');
	});

	it('toggles the map bar and says what the next press does', () => {
		const control = new HideButtonsControl();
		const el = control.onAdd();
		flushSync();
		const button = el.querySelector('button')!;
		expect(button.getAttribute('aria-label')).toBe('Hide the buttons');
		expect(button.getAttribute('aria-pressed')).toBe('false');

		button.click();
		flushSync();
		expect(mapNavHidden()).toBe(true);
		expect(button.getAttribute('aria-label')).toBe('Show the buttons');
		expect(button.getAttribute('aria-pressed')).toBe('true');

		button.click();
		flushSync();
		expect(mapNavHidden()).toBe(false);
		control.onRemove();
	});

	it('follows the language', () => {
		const control = new HideButtonsControl();
		const button = control.onAdd().querySelector('button')!;
		setLanguage('it');
		flushSync();
		expect(button.getAttribute('aria-label')).toBe('Nascondi i pulsanti');
		control.onRemove();
	});

	it('stops following the state once removed from the map', () => {
		const control = new HideButtonsControl();
		const button = control.onAdd().querySelector('button')!;
		flushSync();
		control.onRemove();
		setMapNavHidden(true);
		flushSync();
		expect(button.getAttribute('aria-pressed')).toBe('false');
	});
});

describe('the bottom overlay', () => {
	const root = document.documentElement;

	function view(overlayStyle: string) {
		const host = document.createElement('div');
		host.style.cssText = 'position: fixed; left: 0; right: 0; top: 0; bottom: 0';
		const overlay = document.createElement('div');
		overlay.style.cssText = `position: absolute; left: 0; right: 0; ${overlayStyle}`;
		host.append(overlay);
		document.body.append(host);
		return { host, overlay };
	}

	it('publishes the tray’s height, follows a resize, and clears on teardown', async () => {
		const { host, overlay } = view('bottom: 0; height: 120px');
		const stop = publishBottomOverlay(overlay);
		expect(root.style.getPropertyValue(MAP_BOTTOM_VAR)).toBe('120px');

		overlay.style.height = '200px'; // the player drags the tray up
		await nextFrame();
		await nextFrame();
		expect(root.style.getPropertyValue(MAP_BOTTOM_VAR)).toBe('200px');

		stop();
		expect(root.style.getPropertyValue(MAP_BOTTOM_VAR)).toBe('');
		host.remove();
	});

	it('counts the gap under controls that float above the edge', () => {
		const { host, overlay } = view('bottom: 24px; height: 40px');
		const stop = publishBottomOverlay(overlay);
		expect(root.style.getPropertyValue(MAP_BOTTOM_VAR)).toBe('64px');
		stop();
		host.remove();
	});

	it('keeps one panel’s lift when another goes, and clears when both have (#68)', () => {
		const a = view('bottom: 0; height: 120px');
		const b = view('bottom: 0; height: 80px');
		const stopA = publishBottomOverlay(a.overlay);
		const stopB = publishBottomOverlay(b.overlay);
		expect(root.style.getPropertyValue(MAP_BOTTOM_VAR)).toBe('120px');

		stopA();
		expect(root.style.getPropertyValue(MAP_BOTTOM_VAR)).toBe('80px');
		stopA(); // a second call is harmless
		expect(root.style.getPropertyValue(MAP_BOTTOM_VAR)).toBe('80px');

		stopB();
		expect(root.style.getPropertyValue(MAP_BOTTOM_VAR)).toBe('');
		a.host.remove();
		b.host.remove();
	});
});

describe('the version badge', () => {
	it('stays at the top right when toolbar height changes', async () => {
		const toolbar = document.createElement('header');
		toolbar.className = 'gc-bar';
		toolbar.style.cssText = 'position: fixed; top: 20px; height: 50px';
		document.body.append(toolbar);
		const { unmount } = await render(VersionBadge);
		const badge = document.querySelector<HTMLElement>('.version-badge')!;

		await expect.poll(() => Number.parseFloat(getComputedStyle(badge).top)).toBe(2);
		expect(Number.parseFloat(getComputedStyle(badge).right)).toBeGreaterThan(0);
		expect(getComputedStyle(badge).pointerEvents).toBe('none');

		toolbar.style.height = '80px';
		await expect.poll(() => Number.parseFloat(getComputedStyle(badge).top)).toBe(2);

		unmount();
		toolbar.remove();
	});
	it('keeps zoom controls below the version at normal and enlarged text', async () => {
		const controls = document.createElement('div');
		controls.className = 'maplibregl-ctrl-top-right';
		controls.style.cssText = 'position:fixed;right:0;width:44px;height:88px';
		const host = document.createElement('div');
		host.className = 'maplibregl-control-container';
		host.append(controls);
		document.body.append(host);
		// Lazy map CSS may load after the layout badge in portable production builds.
		const laterMapCss = document.createElement('style');
		laterMapCss.textContent = '.maplibregl-ctrl-top-right { top: 0px; }';
		document.head.append(laterMapCss);
		const screen = await render(VersionBadge);
		try {
			for (const size of ['100%', '300%']) {
				document.documentElement.style.fontSize = size;
				const badge = screen.container.querySelector<HTMLElement>('.version-badge')!;
				expect(badge.getBoundingClientRect().bottom).toBeLessThanOrEqual(
					controls.getBoundingClientRect().top
				);
			}
		} finally {
			document.documentElement.style.removeProperty('font-size');
			host.remove();
			laterMapCss.remove();
			screen.unmount();
		}
	});
});
