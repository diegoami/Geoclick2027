<script lang="ts">
	// The language picker: one small button showing the current language,
	// opening a popup list of all of them.
	//
	// It was three pills side by side (EN DE IT) until v0.9.1. That does not
	// scale - the product owner's point, 2026-09-19: every language added
	// takes another pill's width out of a map bar that is already tight on a
	// phone, and a fourth or fifth would have to wrap or push something off.
	// One button costs the same space whatever the list holds.
	//
	// Implemented as a listbox rather than a native <select> because the
	// closed state should stay terse ("EN") while the open list is readable
	// ("English"), and a <select> can only show one string for both.
	import { getLanguage, setLanguage, LANGUAGES, type Language } from './i18n.svelte';
	import { t } from './i18n.svelte';

	// Shown in their own language, never translated - the convention every
	// real language switcher uses, so a language you cannot yet read is still
	// recognisable. The short form is what the closed button shows.
	const SHORT: Record<Language, string> = { en: 'EN', de: 'DE', it: 'IT' };
	const NATIVE: Record<Language, string> = { en: 'English', de: 'Deutsch', it: 'Italiano' };

	let open = $state(false);
	// Which option the keyboard is on. Kept separate from the CHOSEN language:
	// arrowing through the list must not change the app's language until the
	// player commits, or every keystroke would re-render the whole UI.
	let cursor = $state(0);

	let button = $state<HTMLButtonElement | undefined>(undefined);
	let list = $state<HTMLDivElement | undefined>(undefined);

	function openList() {
		cursor = Math.max(0, LANGUAGES.indexOf(getLanguage()));
		open = true;
	}

	function closeList(refocus = true) {
		open = false;
		if (refocus) button?.focus();
	}

	function choose(lang: Language) {
		setLanguage(lang);
		closeList();
	}

	function onButtonKey(event: KeyboardEvent) {
		if (
			event.key === 'ArrowDown' ||
			event.key === 'ArrowUp' ||
			event.key === 'Enter' ||
			event.key === ' '
		) {
			event.preventDefault();
			openList();
		}
	}

	function onListKey(event: KeyboardEvent) {
		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault();
				cursor = (cursor + 1) % LANGUAGES.length;
				break;
			case 'ArrowUp':
				event.preventDefault();
				cursor = (cursor - 1 + LANGUAGES.length) % LANGUAGES.length;
				break;
			case 'Home':
				event.preventDefault();
				cursor = 0;
				break;
			case 'End':
				event.preventDefault();
				cursor = LANGUAGES.length - 1;
				break;
			case 'Enter':
			case ' ':
				event.preventDefault();
				choose(LANGUAGES[cursor]);
				break;
			case 'Escape':
				event.preventDefault();
				closeList();
				break;
			case 'Tab':
				// Let focus leave, but do not leave a popup hanging over the map.
				closeList(false);
				break;
		}
	}

	// Move real focus onto the cursor option, so a screen reader announces it
	// and Escape has somewhere to return from.
	$effect(() => {
		if (!open) return;
		const option = list?.querySelector<HTMLElement>(`[data-index="${cursor}"]`);
		option?.focus();
	});

	// A click anywhere else closes it. Pointerdown rather than click so the
	// list is gone before the thing underneath reacts.
	$effect(() => {
		if (!open) return;
		const onPointerDown = (event: PointerEvent) => {
			const target = event.target as Node | null;
			if (button?.contains(target ?? null) || list?.contains(target ?? null)) return;
			closeList(false);
		};
		document.addEventListener('pointerdown', onPointerDown, true);
		return () => document.removeEventListener('pointerdown', onPointerDown, true);
	});
</script>

<div class="lang">
	<button
		bind:this={button}
		type="button"
		class="lang-button"
		aria-haspopup="listbox"
		aria-expanded={open}
		aria-label="{t('lang.label')}: {NATIVE[getLanguage()]}"
		onclick={() => (open ? closeList(false) : openList())}
		onkeydown={onButtonKey}
	>
		<span class="lang-code">{SHORT[getLanguage()]}</span>
		<svg class="lang-caret" viewBox="0 0 24 24" width="10" height="10" aria-hidden="true">
			<path
				d="M6 9l6 6 6-6"
				fill="none"
				stroke="currentColor"
				stroke-width="3"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
		</svg>
	</button>

	{#if open}
		<div
			bind:this={list}
			class="lang-list"
			role="listbox"
			aria-label={t('lang.label')}
			tabindex="-1"
			onkeydown={onListKey}
		>
			{#each LANGUAGES as lang, i (lang)}
				<button
					type="button"
					class="lang-option"
					class:is-cursor={i === cursor}
					role="option"
					aria-selected={getLanguage() === lang}
					data-index={i}
					tabindex="-1"
					onclick={() => choose(lang)}
				>
					<span class="lang-option-code">{SHORT[lang]}</span>
					<span class="lang-option-name">{NATIVE[lang]}</span>
					{#if getLanguage() === lang}
						<svg class="lang-tick" viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
							<path
								d="M5 13l4 4L19 7"
								fill="none"
								stroke="currentColor"
								stroke-width="3"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
						</svg>
					{/if}
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.lang {
		position: relative;
		font-family: system-ui, sans-serif;
	}
	.lang-button {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.2rem;
		font-family: inherit;
		font-size: 0.7rem;
		font-weight: 600;
		line-height: 1.2;
		padding: 0.2rem 0.4rem 0.2rem 0.5rem;
		border-radius: 999px;
		border: 1px solid rgba(30, 40, 36, 0.2);
		background: #ffffff; /* opaque over map labels, like the map bar (FT-14) */
		color: rgba(30, 40, 36, 0.75);
		cursor: pointer;
	}
	/* The pill stays small; what a finger has to hit does not (review F8). */
	.lang-button::after {
		content: '';
		position: absolute;
		top: 50%;
		left: 50%;
		width: calc(100% + 0.5rem);
		height: max(100%, 44px);
		transform: translate(-50%, -50%);
	}
	.lang-button:hover {
		background: #ffffff;
		border-color: rgba(30, 40, 36, 0.35);
	}
	.lang-button:focus-visible {
		outline: 2px solid #b5691f;
		outline-offset: 1px;
	}
	.lang-caret {
		flex: none;
		opacity: 0.55;
	}
	.lang-list {
		position: absolute;
		top: calc(100% + 0.3rem);
		left: 0;
		z-index: 30;
		display: flex;
		flex-direction: column;
		min-width: 9rem;
		padding: 0.25rem;
		background: #ffffff;
		border: 1px solid rgba(17, 24, 21, 0.14);
		border-radius: 0.55rem;
		box-shadow: 0 6px 20px rgba(17, 24, 21, 0.18);
	}
	.lang-option {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		min-height: 2.35rem;
		padding: 0.35rem 0.5rem;
		font-family: inherit;
		font-size: 0.8rem;
		text-align: left;
		background: none;
		border: none;
		border-radius: 0.4rem;
		color: #2b332e;
		cursor: pointer;
	}
	.lang-option:hover,
	.lang-option.is-cursor {
		background: rgba(17, 24, 21, 0.06);
	}
	.lang-option:focus-visible {
		outline: 2px solid #b5691f;
		outline-offset: -2px;
	}
	.lang-option-code {
		flex: none;
		width: 1.6rem;
		font-size: 0.68rem;
		font-weight: 700;
		color: rgba(30, 40, 36, 0.55);
	}
	.lang-option-name {
		flex: 1;
	}
	.lang-tick {
		flex: none;
		color: #b5691f;
	}
</style>
