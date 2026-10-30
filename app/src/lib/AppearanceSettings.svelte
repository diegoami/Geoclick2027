<script lang="ts">
	import { onMount } from 'svelte';
	import { t, type TranslationKey } from './i18n.svelte';
	import { APPEARANCE_CHANGED, COLOR_SCHEMES, TEXT_SCALES, type ColorScheme } from './appearance';
	import {
		appearance,
		appearanceOpen,
		loadAppearance,
		setAppearance,
		setAppearanceOpen
	} from './appearance.svelte';

	let dialog: HTMLDialogElement;
	let mounted = $state(false);
	const schemeLabel = (scheme: ColorScheme) => t(`appearance.${scheme}` as TranslationKey);
	const index = $derived(TEXT_SCALES.indexOf(appearance().scale));
	onMount(() => {
		loadAppearance();
		mounted = true;
	});
	$effect(() => {
		if (!mounted) return;
		const { scale, scheme } = appearance();
		// Percentage keeps the browser's chosen default font size intact.
		document.documentElement.style.fontSize = `${scale}%`;
		document.documentElement.dataset.scheme = scheme;
		document.documentElement.dataset.textSize = scale > 100 ? 'large' : 'normal';
		const frame = requestAnimationFrame(() => window.dispatchEvent(new Event(APPEARANCE_CHANGED)));
		return () => cancelAnimationFrame(frame);
	});
	$effect(() => {
		if (!mounted || !dialog) return;
		if (appearanceOpen() && !dialog.open) dialog.showModal();
		else if (!appearanceOpen() && dialog.open) dialog.close();
	});
	function resize(delta: number) {
		const scale = TEXT_SCALES[index + delta];
		if (scale !== undefined) setAppearance({ ...appearance(), scale });
	}
</script>

<!-- A native modal stays above map controls, contains keyboard focus, and
     returns focus to its opener. Quiz shortcuts must not answer underneath. -->
<dialog
	bind:this={dialog}
	aria-labelledby="appearance-title"
	onclose={() => setAppearanceOpen(false)}
	onkeydown={(event) => event.stopPropagation()}
>
	<header>
		<h2 id="appearance-title">{t('appearance.title')}</h2>
		<button type="button" onclick={() => dialog.close()} aria-label={t('appearance.close')}
			>×</button
		>
	</header>
	<fieldset>
		<legend>{t('appearance.textSize')}</legend>
		<div class="size-controls">
			<button
				type="button"
				disabled={index === 0}
				onclick={() => resize(-1)}
				aria-label={t('appearance.smaller')}>A−</button
			>
			<output aria-live="polite" aria-label={t('appearance.textSize')}>{appearance().scale}%</output
			>
			<button
				type="button"
				disabled={index === TEXT_SCALES.length - 1}
				onclick={() => resize(1)}
				aria-label={t('appearance.larger')}>A+</button
			>
			<button type="button" onclick={() => setAppearance({ ...appearance(), scale: 100 })}
				>{t('appearance.reset')}</button
			>
		</div>
		<p>{t('appearance.sizeHint')}</p>
	</fieldset>
	<fieldset>
		<legend>{t('appearance.colors')}</legend>
		<div class="schemes">
			{#each COLOR_SCHEMES as scheme (scheme)}
				<label
					><input
						type="radio"
						name="appearance-scheme"
						value={scheme}
						checked={appearance().scheme === scheme}
						onchange={() => setAppearance({ ...appearance(), scheme })}
					/>
					<span
						class="swatch"
						class:classic={scheme === 'classic'}
						class:ocean={scheme === 'ocean'}
						class:forest={scheme === 'forest'}
						class:contrast={scheme === 'contrast'}
						aria-hidden="true"
					></span>
					{schemeLabel(scheme)}</label
				>
			{/each}
		</div>
		<p>{t('appearance.colorHint')}</p>
	</fieldset>
	<p class="saved">{t('appearance.saved')}</p>
</dialog>

<style>
	dialog {
		box-sizing: border-box;
		width: min(30rem, calc(100vw - 16px));
		max-width: calc(100vw - 16px);
		max-height: calc(100dvh - 16px);
		overflow-y: auto;
		padding: 12px;
		border: 2px solid var(--gc-border, #c9d3cc);
		border-radius: 12px;
		background: var(--gc-surface, white);
		color: var(--gc-text, #1c2b22);
		font-family: system-ui, sans-serif;
	}
	dialog::backdrop {
		background: rgb(0 0 0 / 55%);
	}
	header {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
	}
	h2 {
		flex: 1;
		margin: 0 0 1rem;
		font-size: 1.25rem;
		overflow-wrap: anywhere;
	}
	button {
		max-width: 100%;
		overflow-wrap: anywhere;
		min-width: 44px;
		min-height: 44px;
		padding: 0.25rem 0.6rem;
		border: 1px solid var(--gc-border, #c9d3cc);
		border-radius: 8px;
		font: inherit;
		background: var(--gc-surface, white);
		color: var(--gc-text, #1c2b22);
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.45;
		cursor: default;
	}
	fieldset {
		min-width: 0;
		padding: 12px;
		margin: 0 0 1rem;
		border: 1px solid var(--gc-border, #c9d3cc);
		border-radius: 8px;
	}
	legend {
		font-weight: 600;
	}
	.size-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
	}
	output {
		min-width: 3.5em;
		text-align: center;
		font-variant-numeric: tabular-nums;
	}
	p {
		font-size: 0.85rem;
		line-height: 1.5;
		margin: 0.6rem 0 0;
	}
	.schemes {
		display: grid;
		gap: 0.35rem;
	}
	label {
		overflow-wrap: anywhere;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-height: 44px;
		cursor: pointer;
	}
	input {
		flex: none;
		width: 1.1rem;
		height: 1.1rem;
		accent-color: var(--gc-accent, #965514);
	}
	.swatch {
		flex: none;
		width: 1.5rem;
		height: 1rem;
		border: 1px solid currentColor;
		border-radius: 4px;
	}
	.classic {
		background: linear-gradient(90deg, #fff 50%, #965514 50%);
	}
	.ocean {
		background: linear-gradient(90deg, #f0f7ff 50%, #175b98 50%);
	}
	.forest {
		background: linear-gradient(90deg, #f2f8f1 50%, #27683b 50%);
	}
	.contrast {
		background: linear-gradient(90deg, #101820 50%, #ffdf70 50%);
	}
	.saved {
		color: var(--gc-muted, #4a5650);
	}
</style>
