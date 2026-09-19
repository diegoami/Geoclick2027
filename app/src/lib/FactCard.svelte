<script lang="ts">
	// The fact box (FT-35, docs/PLAN_V0.8.md). What a place is, shown where
	// the player is already looking.
	//
	// The same card serves four screens, because the fact is the same fact
	// wherever you meet it: tap a region in the Overview, click one in Known,
	// resolve a name in the Quiz, or watch a step of the Tour. Each view
	// decides WHEN to show it; this component only decides how it looks and
	// how many clauses fit.
	//
	// It declares data-map-overlay="bottom" so mapFit.ts keeps the map clear
	// of it (FT-25's contract, the same one the map bar uses at the top).
	import { factClauses, type Fact } from './facts';
	import { t } from './i18n.svelte';

	let {
		name,
		fact,
		hook,
		max = 3,
		bottom = '0.75rem',
		onclose
	}: {
		/** The place the card is about. */
		name: string;
		fact: Fact | undefined;
		/**
		 * The rotating name-fact (FT-36): why the place is called what it is.
		 * The VIEW picks it rather than this component, because picking one
		 * advances the rotation, and a component that re-renders - on a
		 * language change, say - must not advance it again.
		 */
		hook?: string;
		/** How many clauses this screen has room for. */
		max?: number;
		/**
		 * How far off the bottom of the map to sit. The Known screen has a
		 * legend down there and the Quiz has a tray whose height the player
		 * can drag, so neither can use the default.
		 */
		bottom?: string;
		/** Omit to make the card undismissable (the tour drives its own). */
		onclose?: () => void;
	} = $props();

	// Recomputed when the language changes, because t() is read inside.
	const clauses = $derived(factClauses(fact).slice(0, max));
</script>

{#if clauses.length > 0 || hook}
	<div class="fact-card" data-map-overlay="bottom" data-testid="fact-card" style="bottom: {bottom}">
		<div class="fact-body">
			<p class="fact-where">
				<span class="fact-name">{name}</span>
				<span class="fact-text">{clauses.join(' ')}</span>
			</p>
			<!-- Why it is called that (FT-36). A second line, not another
			     clause: the derived line above says where the place is, and
			     this says where its NAME comes from, which is the thing being
			     learned. -->
			{#if hook}
				<p class="fact-hook" data-testid="fact-hook">{hook}</p>
			{/if}
		</div>
		{#if onclose}
			<button type="button" class="fact-close" aria-label={t('fact.close')} onclick={onclose}>
				<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"
					><path
						d="M6 6l12 12M18 6L6 18"
						fill="none"
						stroke="currentColor"
						stroke-width="2.4"
						stroke-linecap="round"
					/></svg
				>
			</button>
		{/if}
	</div>
{/if}

<style>
	.fact-card {
		position: absolute;
		left: 0.75rem;
		right: 0.75rem;
		z-index: 2;
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		box-sizing: border-box;
		max-width: 34rem;
		margin: 0 auto;
		padding: 0.55rem 0.7rem;
		background: rgba(255, 255, 255, 0.96);
		border: 1px solid rgba(17, 24, 21, 0.12);
		border-radius: 0.7rem;
		box-shadow: 0 2px 10px rgba(17, 24, 21, 0.14);
		font-family: system-ui, sans-serif;
		/* The card is something to read, never something in the way: a drag
		   that starts on the map and passes over it must not be captured.
		   The close button turns pointer events back on for itself. */
		pointer-events: none;
	}
	.fact-body {
		flex: 1;
		min-width: 0;
		font-size: 0.8125rem;
		line-height: 1.35;
		color: #2b332e;
	}
	.fact-where,
	.fact-hook {
		margin: 0;
	}
	/* Set apart from the line above it, and in the accent the app uses for
	   anything it is offering rather than stating. */
	.fact-hook {
		margin-top: 0.3rem;
		padding-top: 0.3rem;
		border-top: 1px solid rgba(17, 24, 21, 0.09);
		color: #6b4a22;
	}
	.fact-name {
		font-weight: 700;
		color: #1f3d2a;
	}
	.fact-name::after {
		content: ' — ';
		color: #7b877f;
		font-weight: 400;
	}
	.fact-text {
		color: #3d4a42;
	}
	.fact-close {
		flex: none;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1.6rem;
		height: 1.6rem;
		margin: -0.1rem -0.2rem 0 0;
		padding: 0;
		background: none;
		border: none;
		border-radius: 999px;
		color: #6b7770;
		cursor: pointer;
		pointer-events: auto;
	}
	.fact-close:hover {
		background: rgba(17, 24, 21, 0.07);
		color: #2b332e;
	}
	.fact-close:focus-visible {
		outline: 2px solid #b5691f;
		outline-offset: 1px;
	}
</style>
