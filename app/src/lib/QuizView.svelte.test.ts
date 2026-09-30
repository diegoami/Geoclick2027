// FT-59: one test across QuizView's own seams - the drop and its grading,
// the save, leaving mid-round and coming back, and the summary saved once.
// The parts are unit-tested alone (quizDrop, difficulty, quizRound, the
// scheduler, the engine); this is the component that wires them together.
//
// MapLibre is replaced by a small fake: regions are fixed rectangles in
// container px, and the projection is the identity, so a target's centroid
// is its point on screen. Geometry stays in the pure tests.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { rate } from '@geoclick/srs';
import QuizView from './QuizView.svelte';
import { setLanguage } from './i18n.svelte';
import { createInMemoryProgressRepository, todayLocalDate } from './progressRepository';
import type { ProgressRepository } from './progressRepository';
import { forgetRound } from './quizRound';

const fake = vi.hoisted(() => {
	type Point = [number, number];
	const NAMES = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta'];
	const MORE = ['Iota', 'Kappa', 'Lambda', 'Mu', 'Nu', 'Xi', 'Omicron', 'Pi'];
	// Sixteen regions, 70 px squares 20 px apart. Two placed still leaves
	// more than a hand of ten, so which names the tray offers is something a
	// resume can get wrong.
	const targets = [...NAMES, ...MORE].map((name, i) => {
		const left = 20 + (i % 4) * 90;
		const top = 80 + Math.floor(i / 4) * 90;
		return {
			id: name.toLowerCase(),
			name,
			type: 'region' as const,
			tier: 0,
			aliases: [],
			centroid: [left + 35, top + 35] as [number, number],
			bbox: [left, top, left + 70, top + 70] as [number, number, number, number],
			colorIndex: i % 6
		};
	});
	const mapDef = {
		id: 'ft59-test',
		name: 'Test map',
		country: 'test',
		attribution: '',
		tiles: '',
		targets,
		tourOrder: targets.map((t) => t.id)
	};

	const state = {
		container: undefined as HTMLElement | undefined,
		repository: undefined as ProgressRepository | undefined
	};

	const inRect = (x0: number, y0: number, x1: number, y1: number) =>
		targets
			.filter(({ bbox: [l, t, r, b] }) => x1 >= l && x0 <= r && y1 >= t && y0 <= b)
			.map((t) => ({ properties: { name: t.name } }));

	function createMap(container: HTMLElement) {
		state.container = container;
		const map = {
			getContainer: () => container,
			once: (type: string, fn: () => void) => {
				if (type === 'load') queueMicrotask(fn);
			},
			on: () => map,
			off: () => map,
			// A point, or a box [[x0, y0], [x1, y1]] for the drop tolerance.
			queryRenderedFeatures: (at: Point | [Point, Point]) => {
				const [[x0, y0], [x1, y1]] = (typeof at[0] === 'number' ? [at, at] : at) as [Point, Point];
				return inRect(x0, y0, x1, y1);
			},
			project: ([x, y]: [number, number]) => ({ x, y }),
			setFeatureState: () => {},
			fitBounds: () => map,
			remove: () => {}
		};
		const terrain = { setVisible: async () => {}, refreshLabels: () => {} };
		return { map, terrain };
	}

	// maplibregl.Popup, as far as QuizView and the collision pass use it: an
	// element in the map container, which is where the names are read back.
	class Popup {
		private readonly el = document.createElement('div');
		constructor({ className = '' }: { className?: string }) {
			this.el.className = `maplibregl-popup ${className}`;
		}
		setLngLat() {
			return this;
		}
		setText(text: string) {
			this.el.textContent = text;
			return this;
		}
		addTo(map: { getContainer(): HTMLElement }) {
			map.getContainer().append(this.el);
			return this;
		}
		getElement() {
			return this.el;
		}
		setOffset() {
			return this;
		}
		remove() {
			this.el.remove();
			return this;
		}
	}

	return { mapDef, state, createMap, Popup };
});

vi.mock('maplibre-gl', () => ({ Popup: fake.Popup }));
vi.mock('./geoclickMap', () => ({
	fetchMapDefAndStyle: async () => ({ mapDef: fake.mapDef, style: {} }),
	createMap: fake.createMap
}));
vi.mock('./progressRepository', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./progressRepository')>();
	return {
		...actual,
		loadPlayableCardStates: async (mapId: string) => ({
			repository: fake.state.repository!,
			cardStates: await fake.state.repository!.getCardStates(mapId),
			failed: false
		})
	};
});
vi.mock('./facts', async (importOriginal) => ({
	...(await importOriginal<typeof import('./facts')>()),
	fetchFacts: async () =>
		Object.fromEntries(
			fake.mapDef.targets.map((t) => [t.id, { hooks: [`${t.name} is named after a river.`] }])
		)
}));

const MAP_ID = fake.mapDef.id;
const slipNames = () =>
	[...document.querySelectorAll('.slip')].map((s) => s.textContent?.trim() ?? '');
const placedNames = () =>
	[...fake.state.container!.querySelectorAll('.maplibregl-popup')].map((p) => p.textContent);

/** Drags the named slip onto a region, the way a mouse does. pointerId 1 is
 * the mouse's own: setPointerCapture rejects a synthetic touch. */
async function drop(name: string, onto: string) {
	const slip = [...document.querySelectorAll<HTMLElement>('.slip')].find(
		(s) => s.textContent?.trim() === name
	)!;
	const target = fake.mapDef.targets.find((t) => t.name === onto)!;
	const box = fake.state.container!.getBoundingClientRect();
	const from = slip.getBoundingClientRect();
	const event = (type: string, clientX: number, clientY: number) =>
		new PointerEvent(type, {
			bubbles: true,
			cancelable: true,
			pointerId: 1,
			pointerType: 'mouse',
			clientX,
			clientY
		});
	slip.dispatchEvent(event('pointerdown', from.left + 5, from.top + 5));
	slip.dispatchEvent(
		event('pointerup', box.left + target.centroid[0], box.top + target.centroid[1])
	);
	await expect.poll(() => slipNames()).not.toContain(name);
}

/** Places every name left, each on its own region. */
async function finish() {
	for (let left = slipNames(); left.length > 0; left = slipNames()) await drop(left[0], left[0]);
}

async function mount() {
	const screen = await render(QuizView, { mapId: MAP_ID });
	await expect.poll(() => slipNames().length).toBe(10);
	return screen;
}

describe('QuizView (FT-59)', () => {
	let saveCardState: ReturnType<typeof vi.spyOn>;
	let saveSummary: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		setLanguage('en');
		forgetRound(MAP_ID);
		const repository = createInMemoryProgressRepository();
		saveCardState = vi.spyOn(repository, 'saveCardState');
		saveSummary = vi.spyOn(repository, 'saveLastSessionSummary');
		fake.state.repository = repository;
	});
	afterEach(() => forgetRound(MAP_ID));

	// The hand is dealt at random, so each test plays the names it was dealt:
	// the first placed right, the second dropped on the first's region.
	it('grades a correct drop good, and a revealed one again with its fact card', async () => {
		const screen = await mount();
		const [right, wrong] = slipNames();
		const today = todayLocalDate();

		await drop(right, right);
		expect(saveCardState).toHaveBeenLastCalledWith(MAP_ID, {
			targetId: right.toLowerCase(),
			...rate(undefined, 'good', today)
		});
		expect(screen.container.querySelector('.fact-card')).toBeNull();

		await drop(wrong, right);
		expect(saveCardState).toHaveBeenLastCalledWith(MAP_ID, {
			targetId: wrong.toLowerCase(),
			...rate(undefined, 'again', today)
		});
		expect(placedNames()).toEqual([right, wrong]);
		expect(fake.state.container!.querySelector('.revealed')?.textContent).toBe(wrong);
		await expect.element(screen.getByText(`${wrong} is named after a river.`)).toBeVisible();
	});

	it('resumes the same hand and the same placed names after leaving mid-round', async () => {
		const first = await mount();
		const [right, wrong] = slipNames();
		await drop(right, right);
		await drop(wrong, right);
		const hand = slipNames();
		expect(hand).toHaveLength(10); // of the 14 still to place
		first.unmount();

		await mount();
		expect(slipNames()).toEqual(hand);
		await expect.poll(placedNames).toEqual([right, wrong]);
		expect(fake.state.container!.querySelector('.revealed')?.textContent).toBe(wrong);
		expect(saveSummary).not.toHaveBeenCalled();
	});

	it('saves exactly one summary per finished round', async () => {
		const screen = await mount();
		await finish();
		await expect.poll(() => saveSummary.mock.calls.length).toBe(1);
		expect(screen.getByRole('button', { name: 'Close and view the map' })).toBeVisible();
		expect(screen.container.querySelector('.score-panel-actions')).toBeNull();
		expect(saveSummary).toHaveBeenCalledWith(MAP_ID, {
			total: 16,
			perfect: 16,
			totalErrors: 0,
			completedAt: expect.any(String)
		});
		// Nor later, once the tray has measured itself. (Nothing re-runs the
		// completion effect today, so this checks the outcome; the summarySaved
		// guard itself is defensive and no test can remove it and fail.)
		await new Promise((r) => setTimeout(r, 100));
		expect(saveSummary).toHaveBeenCalledTimes(1);

		// Closing leaves the solved map visible; Again is then available on
		// the map and starts a fresh round.
		await screen.getByRole('button', { name: 'Close and view the map' }).click();
		expect(screen.container.querySelector('.score-panel')).toBeNull();
		await screen.getByRole('button', { name: 'Play again' }).click();
		await expect.poll(() => slipNames().length).toBe(10);
		expect(screen.container.querySelector('.map-again')).toBeNull();
		await finish();
		await expect.poll(() => saveSummary.mock.calls.length).toBe(2);
	});
});
