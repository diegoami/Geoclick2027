<script lang="ts">
	// Small, unobtrusive language picker - three text pills (EN/DE/IT), no
	// flags, no dropdown/settings page. Matches the muted, small-pill visual
	// language already established by MapNav's map-name/subtitle tags (see
	// DECISIONS.md's "GUI/UX round 1"). Shown on every view: MapNav (present
	// on every map-scoped view) and the home page header, since the home
	// page doesn't render MapNav.
	import { getLanguage, setLanguage, LANGUAGES, type Language } from './i18n.svelte';

	// Language names are shown in their own language/code, not translated -
	// the same convention used by virtually every real language switcher, so
	// a language you can't yet read is still recognizable.
	const LABELS: Record<Language, string> = { en: 'EN', de: 'DE', it: 'IT' };
</script>

<div class="lang-switcher" role="group" aria-label="Language">
	{#each LANGUAGES as lang (lang)}
		<button
			type="button"
			class="lang-btn"
			class:lang-btn--active={getLanguage() === lang}
			aria-pressed={getLanguage() === lang}
			onclick={() => setLanguage(lang)}
		>
			{LABELS[lang]}
		</button>
	{/each}
</div>

<style>
	.lang-switcher {
		display: flex;
		/* Wide enough that each pill's touch area (below) stops where its
		   neighbour's begins, rather than overlapping it. */
		gap: 0.5rem;
		font-family: system-ui, sans-serif;
	}
	.lang-btn {
		position: relative;
		font-family: inherit;
		font-size: 0.7rem;
		font-weight: 600;
		line-height: 1.2;
		padding: 0.2rem 0.5rem;
		border-radius: 999px;
		border: 1px solid rgba(30, 40, 36, 0.2);
		background: #ffffff; /* opaque over map labels, like the map bar (FT-14) */
		color: rgba(30, 40, 36, 0.65);
		cursor: pointer;
	}
	/* The pill stays small; what a finger has to hit does not (review F8:
	   these were 32x22). An invisible area centred on the pill, 44px tall and
	   half the gap wider on each side, so neighbours touch but never overlap
	   - an overlap would mean the pill on top silently stealing the edge of
	   the one beside it. */
	.lang-btn::after {
		content: '';
		position: absolute;
		top: 50%;
		left: 50%;
		width: calc(100% + 0.5rem);
		height: max(100%, 44px);
		transform: translate(-50%, -50%);
	}
	.lang-btn:hover {
		background: rgba(255, 255, 255, 1);
	}
	.lang-btn--active {
		background: #4a5650;
		border-color: #4a5650;
		color: #ffffff;
	}
</style>
