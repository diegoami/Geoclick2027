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
	borders: ['Liguria', 'Lombardia']
};

let mounted: Record<string, unknown> | undefined;
let root: HTMLElement | undefined;

interface CardProps {
	name: string;
	fact: Fact | undefined;
	max?: number;
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

	it('shows the name and the clauses it has room for', () => {
		const { root } = render({ name: 'Piemonte', fact: piemonte, max: 2 });
		const text = root.querySelector('[data-testid="fact-card"]')!.textContent!;
		expect(text).toContain('Piemonte');
		expect(text).toContain('In the north-west of the country.');
		expect(text).toContain('No coast of its own.');
		// max: 2 - the summit and the neighbours are further down the list.
		expect(text).not.toContain('Monte Rosa');
	});

	it('never captures a drag crossing it', () => {
		// The quiz is a drag-and-drop game and this card sits over the map. If
		// it took pointer events, a drop that passed over it would be lost.
		const { root } = render({ name: 'Piemonte', fact: piemonte, onclose: () => {} });
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
		const { root, container } = render({ name: 'Piemonte', fact: piemonte });
		const card = root.querySelector<HTMLElement>('[data-testid="fact-card"]')!;
		expect(card.dataset.mapOverlay).toBe('bottom');
		expect(mapFitPadding(container).bottom).toBeGreaterThan(card.getBoundingClientRect().height);
	});

	it('sits where the screen asks it to, clear of a tray or a legend', () => {
		const { root } = render({ name: 'Piemonte', fact: piemonte, bottom: '200px' });
		const card = root.querySelector<HTMLElement>('[data-testid="fact-card"]')!;
		expect(getComputedStyle(card).bottom).toBe('200px');
	});

	it('has no close button when the screen drives it', () => {
		// The tour changes the card on every step, so a dismiss would only
		// last until the next one.
		const { root } = render({ name: 'Piemonte', fact: piemonte });
		expect(root.querySelector('[data-testid="fact-card"] button')).toBeNull();
	});

	it('follows the language', () => {
		setLanguage('it');
		const { root } = render({ name: 'Piemonte', fact: piemonte, max: 1 });
		expect(root.querySelector('[data-testid="fact-card"]')!.textContent).toContain(
			'Nel nord-ovest del paese.'
		);
	});
});
