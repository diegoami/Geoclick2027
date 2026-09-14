<script lang="ts">
	// The tutorial's layer over the app (FT-11): a spotlight on the element the
	// current step is about, a card with its text and buttons, and the "paused"
	// bar. Mounted once in +layout.svelte so it survives route changes. None of
	// it takes clicks except the card and the bar, so the real controls keep
	// working underneath; wandering off is handled by pausing
	// (docs/TUTORIAL.md, "Going off-script").
	import { onMount, tick } from 'svelte';
	import { t } from './i18n.svelte';
	import { dispatch, tutorialState } from './tutorial.svelte';
	import {
		NUMBERED_STEPS,
		STEPS,
		showsNext,
		stepNumber,
		type Highlight,
		type Screen
	} from './tutorialMachine';

	const tut = $derived(tutorialState());
	const step = $derived(STEPS[tut.step]);
	const running = $derived(tut.status === 'running');
	const highlight = $derived<Highlight>(step.highlight[tut.place as Screen] ?? { dim: false });
	const stepNo = $derived(stepNumber(tut.step));

	// Phones and tablets get the "tap" wording (same test as docs/TUTORIAL.md).
	let touch = $state(false);
	onMount(() => {
		touch = matchMedia('(hover: none)').matches;
	});
	const text = $derived(t(touch && step.touchCopy ? step.touchCopy : step.copy));

	// "Try **Sicilia**" -> plain and bold runs, without {@html}.
	const runs = $derived(text.split('**').map((part, i) => ({ part, bold: i % 2 === 1 })));

	type Box = { x: number; y: number; w: number; h: number };
	let spot = $state<Box | undefined>(undefined);
	let rings = $state<Box[]>([]);
	let card = $state<HTMLDivElement>();
	let cardPos = $state<{ left: number; top: number; width: number | undefined }>({
		left: 0,
		top: 0,
		width: undefined
	});
	// The card stays hidden until it has been placed for the current step, so it
	// never flashes at its old spot or the top-left corner.
	let placedFor = $state('');

	const PAD = 8;
	const GAP = 12;
	const EDGE = 16;
	// The map bar's own breakpoint (MapNav.svelte).
	const NARROW = 720;

	function boxOf(anchor: string): Box | undefined {
		const el = document.querySelector<HTMLElement>(`[data-tutorial="${anchor}"]`);
		if (!el) return undefined;
		const r = el.getBoundingClientRect();
		if (r.width === 0 && r.height === 0) return undefined;
		return { x: r.left, y: r.top, w: r.width, h: r.height };
	}

	const same = (a: Box | undefined, b: Box | undefined) =>
		a === b ||
		(!!a &&
			!!b &&
			Math.round(a.x) === Math.round(b.x) &&
			Math.round(a.y) === Math.round(b.y) &&
			Math.round(a.w) === Math.round(b.w) &&
			Math.round(a.h) === Math.round(b.h));

	// Where the card goes: next to the spotlight on wide screens, docked to the
	// top or bottom edge on phones, and always at the top on the quiz and the
	// tour.
	function placeCard(target: Box | undefined): typeof cardPos {
		const vw = innerWidth;
		const vh = innerHeight;
		const cw = card?.offsetWidth ?? 320;
		const ch = card?.offsetHeight ?? 160;
		const nav = document.querySelector('.nav-overlay')?.getBoundingClientRect();
		const belowNav = nav ? nav.bottom + GAP : EDGE;
		const narrow = vw < NARROW;
		const width = narrow ? vw - 2 * EDGE : undefined;
		const w = width ?? cw;
		const centreX = (vw - w) / 2;

		if (step.id === 'intro') return { left: centreX, top: (vh - ch) / 2, width };
		// The quiz's tray and the tour's controls are at the bottom.
		if (tut.place === 'quiz' || tut.place === 'tour')
			return { left: centreX, top: belowNav, width };
		if (!target) return { left: centreX, top: vh - ch - EDGE * 2, width };
		if (narrow) {
			const inLowerHalf = target.y + target.h / 2 > vh / 2;
			return { left: EDGE, top: inLowerHalf ? belowNav : vh - ch - EDGE * 2, width };
		}
		const below = target.y + target.h + PAD + GAP;
		const top = below + ch < vh - EDGE ? below : Math.max(EDGE, target.y - PAD - GAP - ch);
		const left = Math.min(Math.max(EDGE, target.x - PAD), vw - cw - EDGE);
		return { left, top, width };
	}

	// Follow the highlighted element every frame while a card is up: it moves
	// with scrolling, resizing, rotation, the map bar's own layout and the
	// quiz tray being dragged. Cheap (a few getBoundingClientRect calls), and
	// state only changes when something actually moved.
	let scrolledFor = '';
	$effect(() => {
		if (!running) {
			spot = undefined;
			rings = [];
			return;
		}
		const current = highlight;
		const key = `${tut.step}:${tut.place}`;
		let frame = 0;
		const measure = () => {
			const found = current.spot ? boxOf(current.spot) : undefined;
			// Bring the element into view once per step: Italy's card is far
			// down the home page (centred there), Sicilia further along the quiz
			// tray ("nearest": only if needed, so a map screen doesn't shift).
			if (found && current.spot && scrolledFor !== key) {
				scrolledFor = key;
				document.querySelector(`[data-tutorial="${current.spot}"]`)?.scrollIntoView({
					block: tut.place === 'home' ? 'center' : 'nearest',
					inline: 'nearest'
				});
			}
			if (!same(found, spot)) spot = found;
			const nextRings = (current.rings ?? []).map(boxOf).filter((b): b is Box => !!b);
			if (nextRings.length !== rings.length || nextRings.some((b, i) => !same(b, rings[i])))
				rings = nextRings;
			const pos = placeCard(found);
			if (
				Math.round(pos.left) !== Math.round(cardPos.left) ||
				Math.round(pos.top) !== Math.round(cardPos.top) ||
				pos.width !== cardPos.width
			)
				cardPos = pos;
			if (placedFor !== key) {
				placedFor = key;
				// Each new card takes focus once it is visible, so keyboard and
				// screen-reader users follow along; without trapping it, since the
				// next move is on the real controls.
				tick().then(() => card?.focus({ preventScroll: true }));
			}
			frame = requestAnimationFrame(measure);
		};
		// First measurement on the next frame, not here: reading the state it
		// updates inside this effect would make the effect depend on it.
		frame = requestAnimationFrame(measure);
		return () => cancelAnimationFrame(frame);
	});

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && tut.status === 'running') dispatch({ type: 'skip' });
	}
</script>

<svelte:window onkeydown={onKeydown} />

{#if running}
	{#if spot}
		<div
			class="spotlight"
			class:spotlight--dim={highlight.dim}
			style="left: {spot.x - PAD}px; top: {spot.y - PAD}px; width: {spot.w +
				2 * PAD}px; height: {spot.h + 2 * PAD}px"
		></div>
	{:else if highlight.dim}
		<div class="dim"></div>
	{/if}
	{#each rings as ring, i (i)}
		<div
			class="ring"
			style="left: {ring.x - PAD / 2}px; top: {ring.y - PAD / 2}px; width: {ring.w +
				PAD}px; height: {ring.h + PAD}px"
		></div>
	{/each}

	<div
		bind:this={card}
		class="card"
		role="dialog"
		aria-label={t('tutorial.button')}
		aria-describedby="tutorial-card-text"
		tabindex="-1"
		style="left: {cardPos.left}px; top: {cardPos.top}px;{cardPos.width
			? ` width: ${cardPos.width}px; max-width: none;`
			: ''} visibility: {placedFor === `${tut.step}:${tut.place}` ? 'visible' : 'hidden'}"
	>
		{#if stepNo}
			<p class="counter">{t('tutorial.stepCounter', { n: stepNo, total: NUMBERED_STEPS })}</p>
		{/if}
		{#if step.title}
			<h2 class="title">{t(step.title)}</h2>
		{/if}
		<p class="text" id="tutorial-card-text">
			{#each runs as run, i (i)}{#if run.bold}<strong>{run.part}</strong
					>{:else}{run.part}{/if}{/each}
		</p>
		<div class="actions">
			{#if step.id === 'intro'}
				<button type="button" class="secondary" onclick={() => dispatch({ type: 'skip' })}
					>{t('tutorial.skip')}</button
				>
				<button type="button" class="primary" onclick={() => dispatch({ type: 'next' })}
					>{t('tutorial.start')}</button
				>
			{:else if step.id === 'outro'}
				<button type="button" class="secondary" onclick={() => dispatch({ type: 'replay' })}
					>{t('tutorial.replay')}</button
				>
				<button type="button" class="primary" onclick={() => dispatch({ type: 'next' })}
					>{t('tutorial.finish')}</button
				>
			{:else}
				{#if (stepNo ?? 0) >= 2}
					<button type="button" class="secondary" onclick={() => dispatch({ type: 'back' })}
						>{t('tutorial.back')}</button
					>
				{/if}
				<button type="button" class="secondary" onclick={() => dispatch({ type: 'skip' })}
					>{t('tutorial.skip')}</button
				>
				{#if showsNext(tut)}
					<button type="button" class="primary" onclick={() => dispatch({ type: 'next' })}
						>{t('tutorial.next')}</button
					>
				{/if}
			{/if}
		</div>
	</div>
{:else if tut.status === 'paused'}
	<div class="paused" role="status">
		<span>{t('tutorial.paused')}</span>
		<button type="button" class="primary" onclick={() => dispatch({ type: 'resume' })}
			>{t('tutorial.resume')}</button
		>
		<button type="button" class="secondary" onclick={() => dispatch({ type: 'skip' })}
			>{t('tutorial.end')}</button
		>
	</div>
{/if}

<style>
	.spotlight,
	.dim,
	.ring {
		position: fixed;
		z-index: 1000;
		pointer-events: none;
	}
	.spotlight {
		border-radius: 0.75rem;
		box-shadow: 0 0 0 3px #b5691f;
	}
	/* The dimming is the spotlight's own giant shadow, so the lit hole needs no
	   second element and moves with it. */
	.spotlight--dim {
		box-shadow:
			0 0 0 3px #b5691f,
			0 0 0 200vmax rgba(17, 24, 21, 0.45);
	}
	.dim {
		inset: 0;
		background: rgba(17, 24, 21, 0.45);
	}
	.ring {
		border-radius: 0.5rem;
		box-shadow: 0 0 0 3px #b5691f;
	}
	.card {
		position: fixed;
		z-index: 1001;
		box-sizing: border-box;
		max-width: 24rem;
		padding: 0.9rem 1rem 0.8rem;
		background: #ffffff;
		border-radius: 0.75rem;
		box-shadow: 0 8px 28px rgba(17, 24, 21, 0.28);
		font-family: system-ui, sans-serif;
		color: #1e2824;
		text-align: left;
	}
	.card:focus {
		outline: none;
	}
	.card:focus-visible {
		outline: 2px solid #b5691f;
		outline-offset: 2px;
	}
	.counter {
		margin: 0 0 0.3rem;
		font-size: 0.75rem;
		font-weight: 600;
		color: #b5691f;
	}
	.title {
		margin: 0 0 0.4rem;
		font-size: 1.1rem;
	}
	.text {
		margin: 0;
		font-size: 0.95rem;
		line-height: 1.4;
	}
	.actions {
		display: flex;
		justify-content: flex-end;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 0.75rem;
	}
	button {
		font-family: inherit;
		font-size: 0.85rem;
		font-weight: 600;
		padding: 0.45rem 0.9rem;
		border-radius: 999px;
		cursor: pointer;
	}
	.primary {
		background: #b5691f;
		border: 1px solid #b5691f;
		color: #ffffff;
	}
	.secondary {
		background: #ffffff;
		border: 1px solid rgba(30, 40, 36, 0.25);
		color: #4a5650;
	}
	button:focus-visible {
		outline: 2px solid #b5691f;
		outline-offset: 2px;
	}
	.paused {
		position: fixed;
		z-index: 1001;
		/* Both edges set plus fit-content: centred, and free to use the full
		   width before wrapping (left: 50% + a transform capped it at half). */
		left: 1rem;
		right: 1rem;
		bottom: 1rem;
		width: fit-content;
		margin-inline: auto;
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.6rem;
		box-sizing: border-box;
		padding: 0.55rem 0.8rem;
		background: #ffffff;
		border-radius: 0.9rem;
		box-shadow: 0 6px 20px rgba(17, 24, 21, 0.25);
		font-family: system-ui, sans-serif;
		font-size: 0.9rem;
		color: #1e2824;
	}
</style>
