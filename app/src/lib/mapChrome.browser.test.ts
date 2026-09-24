// The two fixes from tablet play, 2026-09-24, around the map's own chrome:
// the button under the zoom control that hides the map bar, and the credit
// line and version badge lifted above whatever covers the bottom of the map.
import { afterEach, describe, expect, it } from 'vitest';
import { flushSync } from 'svelte';
import { HideButtonsControl } from './hideButtonsControl.svelte';
import { mapNavHidden, setMapNavHidden } from './mapPrefs.svelte';
import { MAP_BOTTOM_VAR, WINDOW_BOTTOM_VAR, publishBottomOverlay } from './mapBottomOverlay';
import { setLanguage } from './i18n.svelte';

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r(undefined)));

describe('the hide-the-buttons control', () => {
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
		expect(root.style.getPropertyValue(WINDOW_BOTTOM_VAR)).toBe('120px');

		overlay.style.height = '200px'; // the player drags the tray up
		await nextFrame();
		await nextFrame();
		expect(root.style.getPropertyValue(MAP_BOTTOM_VAR)).toBe('200px');

		stop();
		expect(root.style.getPropertyValue(MAP_BOTTOM_VAR)).toBe('');
		expect(root.style.getPropertyValue(WINDOW_BOTTOM_VAR)).toBe('');
		host.remove();
	});

	it('counts the gap under controls that float above the edge', () => {
		const { host, overlay } = view('bottom: 24px; height: 40px');
		const stop = publishBottomOverlay(overlay);
		expect(root.style.getPropertyValue(MAP_BOTTOM_VAR)).toBe('64px');
		stop();
		host.remove();
	});
});
