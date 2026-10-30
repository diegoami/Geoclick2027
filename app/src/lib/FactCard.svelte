<script lang="ts">
	// The fact box (FT-35, docs/PLAN_V0.8.md). What a place is, shown where
	// the player is already looking.
	//
	// The same card serves four screens, because the fact is the same fact
	// wherever you meet it: tap a region in the Overview, click one in Known,
	// resolve a name in the Quiz, or watch a step of the Tour. Each view
	// decides WHEN to show it; this component only decides how it looks.
	//
	// It declares data-map-overlay="bottom" so mapFit.ts keeps the map clear
	// of it (FT-25's contract, the same one the map bar uses at the top).
	//
	// Three lines at most, in descending order of what they are worth:
	//   1. where the NAME comes from - pinned, the same every visit (FT-47)
	//   2. something else about the place - a different one each visit
	//   3. the little of the derived line that survives - quiet, small
	//
	// SHORTER since FT-45 (product owner, 2026-09-19). The card used to lead
	// with a derived line composed from Natural Earth - "In the south of the
	// country. No coast of its own. Biggest city: Milan." - above the
	// authored name-fact. That line was "useless and distracting", and the
	// reason is the principle behind the whole cut: the map already shows
	// you where a place is. What survives is what the map does NOT show - a
	// region’s biggest city, or a town’s region and its rank - and it sits
	// UNDER the name-fact now rather than over it.
	//
	// That also removed FT-42's reason to exist: the small-screen rotation
	// was built to alternate two full lines, and these two are short enough
	// to show at once. `cardLines.ts` went with it.
	import { factClauses, type Fact } from './facts';
	import { t } from './i18n.svelte';

	let {
		name,
		fact,
		origin,
		extra,
		bottom = '0.75rem',
		onclose
	}: {
		/** The place the card is about. */
		name: string;
		/** Its derived fields; only a little of it is shown - see factClauses. */
		fact: Fact | undefined;
		/**
		 * Where the name comes from. PINNED: the same sentence every time,
		 * because it is the half that does the work (FT-47). It used to
		 * rotate with the others, which meant two visits in three showed no
		 * etymology at all.
		 */
		origin?: string;
		/**
		 * One of the place's other facts, a different one each visit. The
		 * VIEW picks it rather than this component, because picking one
		 * advances the rotation, and a component that re-renders - on a
		 * language change, say - must not advance it again.
		 */
		extra?: string;
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
	// One or two short clauses since FT-45 - a region's biggest city, or a
	// town's region and rank - never the old paragraph.
	const context = $derived(factClauses(fact).join(' '));
	let factBody = $state<HTMLElement>();
	let scrollable = $state(false);
	$effect(() => {
		// Recheck content changes even when its capped height stays the same.
		void origin;
		void extra;
		void context;
		const body = factBody;
		if (!body) return;
		const measure = () => {
			scrollable = body.scrollHeight > body.clientHeight + 1;
		};
		const observer = new ResizeObserver(measure);
		observer.observe(body);
		window.addEventListener('geoclick:appearancechange', measure);
		const frame = requestAnimationFrame(measure);
		return () => {
			cancelAnimationFrame(frame);
			observer.disconnect();
			window.removeEventListener('geoclick:appearancechange', measure);
		};
	});
</script>

{#if origin || extra || context}
	<div class="fact-card" data-map-overlay="bottom" data-testid="fact-card" style="bottom: {bottom}">
		<!-- svelte-ignore a11y_no_noninteractive_tabindex (Overflowing prose needs keyboard scrolling.) -->
		<div
			class="fact-body"
			bind:this={factBody}
			class:scrollable
			tabindex={scrollable ? 0 : undefined}
			role={scrollable ? 'region' : undefined}
			aria-label={scrollable ? name : undefined}
		>
			<!-- Where the name comes from. Always here. -->
			{#if origin}
				<p class="fact-where">
					<span class="fact-name">{name}</span>
					<span class="fact-text" data-testid="fact-origin">{origin}</span>
				</p>
			{/if}
			<!-- Something else about the place, a different one each visit. -->
			{#if extra}
				<p class="fact-extra" data-testid="fact-extra">
					{#if !origin}<span class="fact-name">{name}</span>{/if}{extra}
				</p>
			{/if}
			<!-- What little is left of the derived line, quietest of the three. -->
			{#if context}
				<p class="fact-city" data-testid="fact-city">
					{#if !origin && !extra}<span class="fact-name">{name}</span>{/if}{context}
				</p>
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
		pointer-events: none;
		margin: 0 auto;
		padding: 0.55rem 0.7rem;
		background: var(--gc-surface, rgba(255, 255, 255, 0.96));
		border: 1px solid var(--gc-border, rgba(17, 24, 21, 0.12));
		border-radius: 0.7rem;
		box-shadow: 0 2px 10px rgba(17, 24, 21, 0.14);
		font-family: system-ui, sans-serif;
		/* Large text can scroll within the card without covering the whole map. */
	}
	.fact-body.scrollable {
		pointer-events: auto;
	}
	.fact-body {
		max-height: 35dvh;
		overflow-y: auto;
		flex: 1;
		min-width: 0;
		font-size: 0.8125rem;
		line-height: 1.35;
		color: var(--gc-text, #2b332e);
	}
	.fact-where,
	.fact-extra,
	.fact-city {
		margin: 0;
	}
	/* Between the origin and the clause: plainer than the origin, but still
	   something to read rather than something to glance at. */
	.fact-extra {
		margin-top: 0.25rem;
		color: var(--gc-text, #3d4a42);
	}
	/* Quieter than the name-fact above it: it is context, not the point. */
	.fact-city {
		margin-top: 0.15rem;
		color: var(--gc-muted, #6b7770);
		font-size: 0.75rem;
	}
	.fact-name {
		font-weight: 700;
		color: var(--gc-text, #1f3d2a);
	}
	.fact-name::after {
		content: ' — ';
		color: var(--gc-muted, #7b877f);
		font-weight: 400;
	}
	/* The accent the app uses for anything it is offering rather than
	   stating. It was the second line's colour when there were two. */
	.fact-text {
		color: var(--gc-accent, #6b4a22);
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
		color: var(--gc-muted, #6b7770);
		cursor: pointer;
		pointer-events: auto;
	}
	.fact-close:hover {
		background: var(--gc-hover, rgba(17, 24, 21, 0.07));
		color: var(--gc-text, #2b332e);
	}
	.fact-close:focus-visible {
		outline: 2px solid var(--gc-accent, #b5691f);
		outline-offset: 1px;
	}
</style>
