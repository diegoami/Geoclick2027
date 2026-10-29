<script lang="ts">
	// The end of a round (#259): the score, and what the round changed - the
	// names it made known, the ones to work on, and how it compares with the
	// last round. QuizView works the numbers out (roundReport.ts); this only
	// shows them.
	import { t, tPlural } from './i18n.svelte';
	import { capped, formatDuration } from './roundReport';
	import type { SessionSummary } from './progressRepository';

	type Named = { id: string; name: string };

	let {
		perfect,
		total,
		totalErrors,
		revealedCount,
		knownLine,
		lastTime,
		newlyKnown,
		toWorkOn,
		slippedCount,
		onclose,
		onfact,
		onstudy,
		practiseCount,
		onpractise,
		time,
		confusions
	}: {
		perfect: number;
		total: number;
		totalErrors: number;
		revealedCount: number;
		/** "14 / 20 known", plus the hand size when it applies. */
		knownLine: string | undefined;
		/** The round before this one, if there was one. */
		lastTime: SessionSummary | undefined;
		newlyKnown: Named[];
		toWorkOn: Named[];
		slippedCount: number;
		onclose: () => void;
		/** Opens a name's fact card. */
		onfact: (id: string) => void;
		/** Opens Known with the names to work on chosen. */
		onstudy: () => void;
		/** Names a practice round would ask for (#265); 0 offers none. */
		practiseCount: number;
		onpractise: () => void;
		/** A timed round on a fully known map (#267). */
		time?: { ms: number; bestMs?: number; newBest: boolean; clean: boolean };
		/** This round's mix-ups (#266): `a`'s name went to `b`'s place. */
		confusions: { a: string; b: string }[];
	} = $props();

	const mixed = $derived(capped(confusions));

	const known = $derived(capped(newlyKnown));
	const work = $derived(capped(toWorkOn));
</script>

<div class="score-panel" data-testid="score-panel">
	<button class="score-panel-close" aria-label={t('quiz.closeAriaLabel')} onclick={onclose}>
		&times;
	</button>
	<h2>{t('quiz.done')}</h2>
	<p>
		<strong>{perfect}</strong>
		{t('quiz.scoreLineRest', { total })}
	</p>
	{#if lastTime}
		<p class="last-time" data-testid="last-time">
			{t('quiz.lastTime', { perfect: lastTime.perfect, total: lastTime.total })}
		</p>
	{/if}
	<p>{tPlural('quiz.totalMistakes', totalErrors, { count: totalErrors })}</p>
	{#if time}
		<p class="time" data-testid="round-time">
			{t('quiz.time', { time: formatDuration(time.ms) })}
			{#if time.newBest}
				· <strong class="new-best">{t('quiz.newBest')}</strong>
			{:else if time.bestMs !== undefined}
				· {t('quiz.best', { time: formatDuration(time.bestMs) })}
			{/if}
		</p>
		{#if !time.clean}
			<p class="known-note">{t('quiz.bestNeedsClean')}</p>
		{/if}
	{/if}
	{#if revealedCount > 0}
		<p class="revealed-note">{t('quiz.revealedNote', { count: revealedCount })}</p>
	{/if}
	<!-- What the round left behind (FT-26). The map list shows a bar
	     (FT-65); this panel keeps the number, because it records what
	     this round left behind rather than the map's standing. -->
	{#if knownLine}
		<p class="known-note">
			{knownLine}{#if slippedCount > 0}
				· {t('quiz.slipped', { count: slippedCount })}{/if}
		</p>
	{/if}
	{#if newlyKnown.length > 0}
		<div class="names" data-testid="newly-known">
			<h3>{t('quiz.newlyKnown')}</h3>
			{#each known.shown as item (item.id)}
				<button type="button" class="name known" onclick={() => onfact(item.id)}>{item.name}</button
				>
			{/each}
			{#if known.more > 0}<span class="more">{t('quiz.more', { count: known.more })}</span>{/if}
		</div>
	{/if}
	{#if toWorkOn.length > 0}
		<div class="names" data-testid="to-work-on">
			<h3>{t('quiz.toWorkOn')}</h3>
			{#each work.shown as item (item.id)}
				<button type="button" class="name" onclick={() => onfact(item.id)}>{item.name}</button>
			{/each}
			{#if work.more > 0}<span class="more">{t('quiz.more', { count: work.more })}</span>{/if}
		</div>
	{/if}
	{#if confusions.length > 0}
		<div class="names" data-testid="confusions">
			<h3>{t('quiz.confusions')}</h3>
			{#each mixed.shown as pair (pair.a + pair.b)}
				<span class="pair">{t('quiz.confusedWith', { a: pair.a, b: pair.b })}</span>
			{/each}
			{#if mixed.more > 0}<span class="more">{t('quiz.more', { count: mixed.more })}</span>{/if}
		</div>
	{/if}
	{#if toWorkOn.length > 0 || practiseCount > 0}
		<div class="actions">
			{#if toWorkOn.length > 0}
				<button type="button" class="action" data-testid="study-these" onclick={onstudy}>
					{t('quiz.studyThese')}
				</button>
			{/if}
			{#if practiseCount > 0}
				<button type="button" class="action" data-testid="practise-panel" onclick={onpractise}>
					{t('quiz.practise', { count: practiseCount })}
				</button>
			{/if}
		</div>
	{/if}
</div>

<style>
	.score-panel {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 2;
		box-sizing: border-box;
		width: max-content;
		max-width: min(30rem, calc(100% - 2rem));
		max-height: calc(100% - 9rem);
		overflow-y: auto;
		background: white;
		border-radius: 0.75rem;
		padding: 1.5rem 2rem;
		text-align: center;
		font-family: system-ui, sans-serif;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
	}
	.score-panel-close {
		position: absolute;
		top: 0.4rem;
		right: 0.4rem;
		width: 1.75rem;
		height: 1.75rem;
		margin: 0;
		padding: 0;
		border: none;
		border-radius: 50%;
		background: transparent;
		color: rgba(0, 0, 0, 0.45);
		font-size: 1.3rem;
		line-height: 1;
		cursor: pointer;
	}
	.score-panel-close:hover {
		background: rgba(0, 0, 0, 0.06);
		color: rgba(0, 0, 0, 0.75);
	}
	h2 {
		margin: 0 0 0.75rem;
	}
	h3 {
		flex-basis: 100%;
		margin: 0 0 0.15rem;
		font-size: 0.8rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: rgba(30, 40, 36, 0.6);
	}
	.last-time {
		margin-top: -0.5rem;
		font-size: 0.85rem;
		opacity: 0.7;
	}
	.time {
		font-variant-numeric: tabular-nums;
	}
	.new-best {
		color: #2f6b45;
	}
	.revealed-note {
		font-size: 0.85rem;
		color: #8a6d3b;
	}
	.known-note {
		font-size: 0.85rem;
		opacity: 0.7;
	}
	.names {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		align-items: center;
		gap: 0.3rem;
		margin: 0.75rem 0 0;
	}
	/* The same muted gold-brown as a name shown after a mistake; green for a
	   name the round made known. */
	.name {
		padding: 2px 8px;
		border: 1px solid rgba(138, 109, 59, 0.45);
		border-radius: 5px;
		background: #fbf4ec;
		color: #7a5a24;
		font-family: inherit;
		font-size: 0.8125rem;
		font-weight: 600;
		cursor: pointer;
	}
	.name.known {
		border-color: rgba(90, 156, 111, 0.5);
		background: #eef6f0;
		color: #2f6b45;
	}
	.pair {
		font-size: 0.8125rem;
	}
	.pair + .pair::before {
		content: '· ';
		opacity: 0.5;
	}
	.more {
		font-size: 0.8rem;
		opacity: 0.7;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.5rem;
		margin-top: 0.9rem;
	}
	.action {
		padding: 0.5rem 1rem;
		border: none;
		border-radius: 0.5rem;
		background: #5a9c6f;
		color: white;
		font-family: inherit;
		font-size: 0.9rem;
		font-weight: 600;
		cursor: pointer;
	}
</style>
