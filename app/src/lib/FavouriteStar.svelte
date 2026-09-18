<script lang="ts">
	// Star toggle for a favourite map (FT-16), on every home page card and in the
	// map bar. The accessible name stays the same ("Favourite: Italy — Regions")
	// and aria-pressed carries the state, which is the pattern for toggle buttons;
	// the tooltip says what a click will do. The saved state shows only after
	// mount: the home page is prerendered without device storage, and a filled
	// star in the first client render wouldn't match that HTML.
	import { onMount } from 'svelte';
	import { t } from './i18n.svelte';
	import { mapDisplayName } from './mapCatalog';
	import { isFavourite, toggleFavourite } from './mapPrefs.svelte';

	let { mapId, size = 'card' }: { mapId: string; size?: 'card' | 'bar' } = $props();

	let ready = $state(false);
	onMount(() => (ready = true));
	const on = $derived(ready && isFavourite(mapId));
	const name = $derived(mapDisplayName(mapId) ?? mapId);
</script>

<button
	type="button"
	class="star star--{size}"
	class:star--on={on}
	aria-pressed={on}
	aria-label={t('fav.label', { name })}
	title={t(on ? 'fav.remove' : 'fav.add')}
	onclick={() => toggleFavourite(mapId)}
>
	<svg viewBox="0 0 24 24" aria-hidden="true">
		<path
			d="M12 3.6l2.55 5.2 5.75.84-4.16 4.05.98 5.72L12 16.72l-5.12 2.69.98-5.72L3.7 9.64l5.75-.84z"
			fill={on ? 'currentColor' : 'none'}
			stroke="currentColor"
			stroke-width="1.7"
			stroke-linejoin="round"
		/>
	</svg>
</button>

<style>
	.star {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		border: 1px solid transparent;
		border-radius: 999px;
		background: transparent;
		color: #7d8a83;
		cursor: pointer;
	}
	.star svg {
		width: 62%;
		height: 62%;
	}
	/* 36px on a card and 28px in the map bar, both under the 44px a finger
	   wants (review F8). The star keeps its size; the area around it counts
	   as the star. On a card that area reaches a few px into the card's own
	   link, which is the right way round: a tap that close to the star meant
	   the star. */
	.star::after {
		content: '';
		position: absolute;
		top: 50%;
		left: 50%;
		width: max(100%, 44px);
		height: max(100%, 44px);
		transform: translate(-50%, -50%);
	}
	.star:hover {
		color: #b5691f;
		background: rgba(181, 105, 31, 0.08);
	}
	.star:focus-visible {
		outline: 2px solid #b5691f;
		outline-offset: 2px;
	}
	.star--on {
		color: #b5691f;
	}
	.star--card {
		width: 2.25rem;
		height: 2.25rem;
	}
	/* In the map bar it sits on the map, so it gets the same opaque white chip
	   as the tabs (FT-14). */
	.star--bar {
		width: 1.75rem;
		height: 1.75rem;
		background: #ffffff;
		border-color: rgba(17, 24, 21, 0.12);
		box-shadow: 0 1px 3px rgba(17, 24, 21, 0.12);
	}
	.star--bar:hover {
		background: #fbf4ec;
	}
</style>
