<script lang="ts">
	import { t } from './i18n.svelte';
	import { TOUR_SPEEDS } from './tourSpeed';

	let {
		stepIndex,
		stepCount,
		playing,
		finished,
		speed,
		onback,
		ontoggleplay,
		onadvance,
		onsetspeed
	}: {
		stepIndex: number;
		stepCount: number;
		playing: boolean;
		finished: boolean;
		speed: number;
		onback: () => void;
		ontoggleplay: () => void;
		onadvance: () => void;
		onsetspeed: (speed: number) => void;
	} = $props();

	let playLabel = $derived(
		finished ? t('tour.replay') : playing ? t('tour.pause') : t('tour.play')
	);
</script>

<div class="controls-inner">
	<button
		type="button"
		class="control-button"
		aria-label={t('tour.prev')}
		title={t('tour.prev')}
		disabled={stepIndex === 0}
		onclick={onback}
	>
		<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
			<path d="M15 18 9 12l6-6" />
		</svg>
	</button>
	<button
		type="button"
		class="control-button"
		aria-label={playLabel}
		title={playLabel}
		onclick={ontoggleplay}
	>
		{#if finished}
			<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
				<path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
				<path d="M3 3v5h5" />
			</svg>
		{:else if playing}
			<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
				<path d="M7 5h4v14H7zM15 5h4v14h-4z" />
			</svg>
		{:else}
			<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
				<path d="M8 5v14l11-7z" />
			</svg>
		{/if}
	</button>
	<button
		type="button"
		class="control-button"
		aria-label={t('tour.next')}
		title={t('tour.next')}
		disabled={finished}
		onclick={onadvance}
	>
		<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
			<path d="m9 18 6-6-6-6" />
		</svg>
	</button>
	<span
		class="progress"
		role="status"
		aria-label={t('tour.progress', {
			current: stepIndex + 1,
			total: stepCount
		})}>{stepIndex + 1} / {stepCount}</span
	>
	<select
		class="speed"
		aria-label={t('tour.speed')}
		title={t('tour.speed')}
		value={speed}
		onchange={(e) => onsetspeed(Number(e.currentTarget.value))}
	>
		{#each TOUR_SPEEDS as s (s)}
			<option value={s}>{s}×</option>
		{/each}
	</select>
</div>

<style>
	.controls-inner {
		box-sizing: border-box;
		max-width: calc(100vw - 1rem);
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
		padding: 0.35rem 0.5rem;
		border-radius: 1rem;
		background: rgba(255, 255, 255, 0.94);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
		font-family: system-ui, sans-serif;
	}
	.control-button {
		flex: none;
		width: 2.75rem;
		height: 2.75rem;
		display: grid;
		place-items: center;
		padding: 0;
		border: none;
		border-radius: 0.65rem;
		background: transparent;
		color: #304239;
		cursor: pointer;
	}
	.control-button:hover:not(:disabled) {
		background: rgba(0, 0, 0, 0.07);
	}
	.control-button:focus-visible,
	.speed:focus-visible {
		outline: 2px solid #b5691f;
		outline-offset: 2px;
	}
	.control-button:disabled {
		opacity: 0.35;
		cursor: default;
	}
	.control-button svg {
		width: 1.25rem;
		height: 1.25rem;
		fill: currentColor;
		stroke: currentColor;
		stroke-width: 1.8;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.progress {
		min-width: 3.5rem;
		text-align: center;
		font-size: 0.85rem;
		opacity: 0.8;
		white-space: nowrap;
	}
	.speed {
		min-height: 2.75rem;
		font: inherit;
		font-size: 0.85rem;
		border: none;
		background: rgba(0, 0, 0, 0.06);
		border-radius: 0.5rem;
		padding: 0.25rem 0.4rem;
		cursor: pointer;
	}
</style>
