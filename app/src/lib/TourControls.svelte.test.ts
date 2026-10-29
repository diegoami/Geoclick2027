import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import TourControls from './TourControls.svelte';
import { setLanguage } from './i18n.svelte';

describe('TourControls', () => {
	beforeEach(() => setLanguage('en'));
	afterEach(() => setLanguage('en'));

	it('keeps navigation, progress, and speed accessible while drawing icon actions', async () => {
		const onback = vi.fn();
		const ontoggleplay = vi.fn();
		const onadvance = vi.fn();
		const onsetSpeed = vi.fn();
		const screen = await render(TourControls, {
			stepIndex: 0,
			stepCount: 12,
			playing: false,
			finished: false,
			speed: 1,
			onback,
			ontoggleplay,
			onadvance,
			onsetspeed: onsetSpeed,
			mapId: 'italy-regions'
		});

		const previous = screen.getByRole('button', { name: '‹ Prev' });
		const play = screen.getByRole('button', { name: '▶ Play' });
		const next = screen.getByRole('button', { name: 'Next ›' });
		expect(previous).toBeDisabled();
		expect(next).toBeEnabled();
		expect(screen.getByRole('status', { name: 'Step 1 of 12' })).toBeVisible();
		expect(screen.getByRole('combobox', { name: 'Tour speed' })).toBeVisible();

		await play.click();
		await next.click();
		expect(ontoggleplay).toHaveBeenCalledTimes(1);
		expect(onadvance).toHaveBeenCalledTimes(1);
		expect(onback).not.toHaveBeenCalled();

		const speed = document.querySelector<HTMLSelectElement>('.speed')!;
		speed.value = '1.5';
		speed.dispatchEvent(new Event('change', { bubbles: true }));
		expect(onsetSpeed).toHaveBeenCalledWith(1.5);
	});

	it('uses pause and replay actions according to tour state', async () => {
		const callback = vi.fn();
		const playing = await render(TourControls, {
			stepIndex: 2,
			stepCount: 12,
			playing: true,
			finished: false,
			speed: 1,
			onback: callback,
			ontoggleplay: callback,
			onadvance: callback,
			onsetspeed: callback,
			mapId: 'italy-regions'
		});
		expect(playing.getByRole('button', { name: 'Pause' })).toBeVisible();
		playing.unmount();

		const finished = await render(TourControls, {
			stepIndex: 11,
			stepCount: 12,
			playing: false,
			finished: true,
			speed: 1,
			onback: callback,
			ontoggleplay: callback,
			onadvance: callback,
			onsetspeed: callback,
			mapId: 'italy-regions'
		});
		expect(finished.getByRole('button', { name: 'Replay' })).toBeVisible();
		expect(finished.getByRole('button', { name: 'Next ›' })).toBeDisabled();
		// The end of the tour offers the quiz (#269).
		expect(finished.getByRole('link', { name: 'Try the quiz' })).toHaveAttribute(
			'href',
			expect.stringContaining('/map/italy-regions/quiz')
		);
	});
});
