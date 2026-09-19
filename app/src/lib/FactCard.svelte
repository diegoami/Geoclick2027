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
	//
	// On a small screen it shows ONE of its two lines at a time and rotates
	// between them every few seconds (FT-42), because on a phone two lines
	// are a real share of the screen and the map is the thing being learned.
	// The rule for what counts as small lives in cardLines.ts; this file
	// does the timing and the drawing only.
	import { cardLines, nextLine, ROTATE_MS, SMALL_VIEWPORT_QUERY } from './cardLines';
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
	const derivedLine = $derived(clauses.join(' '));

	// The two lines in the order a small screen shows them: name-fact first.
	const lines = $derived(cardLines(derivedLine, hook));

	// Whether this viewport gets one line at a time, and whether it wants
	// the rotation at all. Both are live: a phone turned sideways crosses
	// the threshold, and the motion setting can change while the app is open.
	let small = $state(false);
	let stillness = $state(false);
	$effect(() => {
		if (typeof matchMedia !== 'function') return;
		const isSmall = matchMedia(SMALL_VIEWPORT_QUERY);
		const wantsStillness = matchMedia('(prefers-reduced-motion: reduce)');
		const sync = () => {
			small = isSmall.matches;
			stillness = wantsStillness.matches;
		};
		sync();
		isSmall.addEventListener('change', sync);
		wantsStillness.addEventListener('change', sync);
		return () => {
			isSmall.removeEventListener('change', sync);
			wantsStillness.removeEventListener('change', sync);
		};
	});

	// Someone who has asked for less motion gets the full card instead of a
	// rotating one: text that changes under the reader IS motion, and the
	// honest alternative is to show everything at once and spend the height.
	// They lose map area rather than losing a line - see DECISIONS.md.
	const rotating = $derived(small && !stillness && lines.length > 1);

	let shown = $state(0);
	// A new place starts its card at the beginning. Keyed on the text rather
	// than on the name, because two places can share a name across maps and
	// the same place re-rendered in another language is still the same place
	// arriving fresh.
	$effect(() => {
		void lines.map((line) => line.text).join('\u0000');
		shown = 0;
	});

	$effect(() => {
		if (!rotating) return;
		const count = lines.length;
		const timer = setInterval(() => {
			shown = nextLine(shown, count);
		}, ROTATE_MS);
		return () => clearInterval(timer);
	});

	// Guard against an index left behind by a card that had more lines.
	const line = $derived(lines[Math.min(shown, lines.length - 1)]);
</script>

{#if lines.length > 0}
	<div
		class="fact-card"
		class:is-rotating={rotating}
		data-map-overlay="bottom"
		data-testid="fact-card"
		style="bottom: {bottom}"
	>
		<div class="fact-body">
			{#if rotating}
				<!-- One line at a time (FT-42). The name always stays, so the
				     card never stops saying what it is about; only the line
				     under it changes. aria-live is off deliberately: a line
				     announced every five seconds would talk over the player,
				     and anyone who has asked for less motion is not rotating
				     at all and has both lines in front of them. -->
				<p class="fact-where">
					<span class="fact-name">{name}</span>
					<span
						class="fact-text"
						class:is-hook={line.kind === 'hook'}
						data-testid={line.kind === 'hook' ? 'fact-hook' : 'fact-derived'}>{line.text}</span
					>
				</p>
				<span class="fact-dots" aria-hidden="true" data-testid="fact-dots">
					{#each lines as dotLine, i (dotLine.kind)}
						<span class="fact-dot" class:is-on={i === shown}></span>
					{/each}
				</span>
			{:else}
				<p class="fact-where">
					<span class="fact-name">{name}</span>
					<span class="fact-text" data-testid="fact-derived">{derivedLine}</span>
				</p>
				<!-- Why it is called that (FT-36). A second line, not another
				     clause: the derived line above says where the place is, and
				     this says where its NAME comes from, which is the thing being
				     learned. -->
				{#if hook}
					<p class="fact-hook" data-testid="fact-hook">{hook}</p>
				{/if}
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
	/* The rotating line keeps the colour it would have had as its own row,
	   so the player can tell at a glance which of the two they are reading
	   without the border that separates them on a large screen. */
	.fact-text.is-hook {
		color: #6b4a22;
	}
	.fact-dots {
		display: flex;
		gap: 0.25rem;
		margin-top: 0.3rem;
	}
	.fact-dot {
		width: 0.3rem;
		height: 0.3rem;
		background: rgba(17, 24, 21, 0.18);
		border-radius: 999px;
		transition: background-color 180ms ease;
	}
	.fact-dot.is-on {
		background: #6b4a22;
	}
	@media (prefers-reduced-motion: reduce) {
		.fact-dot {
			transition: none;
		}
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
