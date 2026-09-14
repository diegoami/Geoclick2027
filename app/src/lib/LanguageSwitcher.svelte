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
		gap: 0.25rem;
		font-family: system-ui, sans-serif;
	}
	.lang-btn {
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
	.lang-btn:hover {
		background: rgba(255, 255, 255, 1);
	}
	.lang-btn--active {
		background: #4a5650;
		border-color: #4a5650;
		color: #ffffff;
	}
</style>
