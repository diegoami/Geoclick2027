// Runs in the browser project (real Chromium): what this component has to
// get right is all about layout and pointer behaviour, which jsdom cannot
// answer. FT-35, docs/PLAN_V0.8.md.
import { afterEach, describe, expect, it } from 'vitest';
import { mount, unmount } from 'svelte';
import FactCard from './FactCard.svelte';
import { mapFitPadding } from './mapFit';
import { setLanguage } from './i18n.svelte';
import type { Fact } from './facts';

const piemonte: Fact = {
	kind: 'region',
	position: 'north-west',
	coastal: false,
	peak: { name: 'Monte Rosa', elevation: 4634 },
	largestCity: { name: 'Turin', nameDe: 'Turin', nameIt: 'Torino', population: 1652000 },
	borders: ['Liguria', 'Lombardia']
};

// Every card needs one now: without a name-fact and without a biggest
// city there is nothing to show.
const HOOK = 'Named for the Longobards, the "long-beards".';

let mounted: Record<string, unknown> | undefined;
let root: HTMLElement | undefined;

interface CardProps {
	name: string;
	fact: Fact | undefined;
	hook?: string;
	bottom?: string;
	onclose?: () => void;
}

function render(props: CardProps) {
	root = document.createElement('div');
	// The shape every map view has: a full-size map with overlays over it.
	root.style.cssText = 'position:fixed;left:0;top:0;width:390px;height:844px';
	const container = document.createElement('div');
	container.className = 'container';
	container.style.cssText = 'position:absolute;inset:0';
	root.append(container);
	document.body.append(root);
	mounted = mount(FactCard, { target: root, props }) as Record<string, unknown>;
	return { root, container };
}

afterEach(() => {
	if (mounted) unmount(mounted);
	root?.remove();
	mounted = undefined;
	root = undefined;
	setLanguage('en');
});

describe('FactCard', () => {
	it('says nothing at all when there is nothing to say', () => {
		// A map with no facts.json, or a place with no computable fact, must
		// not leave an empty box on the screen.
		const { root } = render({ name: 'Nowhere', fact: undefined });
		expect(root.querySelector('[data-testid="fact-card"]')).toBeNull();
	});

	it('leads with the name-fact and follows with the little context left', () => {
		// FT-45: the derived paragraph is gone. A region keeps its biggest
		// city; everything about position, coast, summit and neighbours went.
		const { root } = render({ name: 'Piemonte', fact: piemonte, hook: HOOK });
		const text = root.querySelector('[data-testid="fact-card"]')!.textContent!;
		expect(text).toContain('Piemonte');
		expect(text).toContain(HOOK);
		expect(text).toContain('Biggest city: Turin');
		expect(text).not.toMatch(/north-west|coast|Monte Rosa|Liguria/);
	});

	it('shows the name-fact alone when there is no context to add', () => {
		const { root } = render({ name: 'Nowhere', fact: undefined, hook: HOOK });
		const card = root.querySelector('[data-testid="fact-card"]')!;
		expect(card.textContent).toContain(HOOK);
		expect(card.querySelector('[data-testid="fact-city"]')).toBeNull();
	});

	it('never captures a drag crossing it', () => {
		// The quiz is a drag-and-drop game and this card sits over the map. If
		// it took pointer events, a drop that passed over it would be lost.
		const { root } = render({ name: 'Piemonte', fact: piemonte, hook: HOOK, onclose: () => {} });
		const card = root.querySelector<HTMLElement>('[data-testid="fact-card"]')!;
		expect(getComputedStyle(card).pointerEvents).toBe('none');
		// ...except its own close button, which has to be clickable.
		const close = card.querySelector<HTMLElement>('button')!;
		expect(getComputedStyle(close).pointerEvents).toBe('auto');
	});

	it('tells mapFit it is there, so the map is not fitted underneath it', () => {
		// FT-25's contract: an overlay declares itself and mapFitPadding
		// reserves the space. Without this the southern edge of a map would
		// open behind the card.
		const { root, container } = render({ name: 'Piemonte', fact: piemonte, hook: HOOK });
		const card = root.querySelector<HTMLElement>('[data-testid="fact-card"]')!;
		expect(card.dataset.mapOverlay).toBe('bottom');
		expect(mapFitPadding(container).bottom).toBeGreaterThan(card.getBoundingClientRect().height);
	});

	it('sits where the screen asks it to, clear of a tray or a legend', () => {
		const { root } = render({ name: 'Piemonte', fact: piemonte, hook: HOOK, bottom: '200px' });
		const card = root.querySelector<HTMLElement>('[data-testid="fact-card"]')!;
		expect(getComputedStyle(card).bottom).toBe('200px');
	});

	it('has no close button when the screen drives it', () => {
		// The tour changes the card on every step, so a dismiss would only
		// last until the next one.
		const { root } = render({ name: 'Piemonte', fact: piemonte, hook: HOOK });
		expect(root.querySelector('[data-testid="fact-card"] button')).toBeNull();
	});

	it('follows the language', () => {
		setLanguage('it');
		const { root } = render({ name: 'Piemonte', fact: piemonte, hook: HOOK });
		expect(root.querySelector('[data-testid="fact-card"]')!.textContent).toContain(
			'Città più grande: Torino'
		);
	});
});
