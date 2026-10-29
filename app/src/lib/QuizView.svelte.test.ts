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
import { quizMode, setQuizMode } from './mapPrefs.svelte';

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
			spine: {
				curve: [
					[left + 2, top + 35],
					[left + 35, top + 30],
					[left + 68, top + 35]
				] as [[number, number], [number, number], [number, number]],
				aspect: 1
			},
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
		repository: undefined as ProgressRepository | undefined,
		// The map's own listeners (a tap on the map, #260), by event type.
		handlers: {} as Record<string, ((e: { point: { x: number; y: number } }) => void)[]>,
		// The place lit up by quizHover: the one Name-it mode asks about (#264).
		hovered: undefined as string | undefined
	};

	const inRect = (x0: number, y0: number, x1: number, y1: number) =>
		targets
			.filter(({ bbox: [l, t, r, b] }) => x1 >= l && x0 <= r && y1 >= t && y0 <= b)
			.map((t) => ({ properties: { name: t.name } }));

	function createMap(container: HTMLElement) {
		state.container = container;
		const map = {
			getContainer: () => container,
			getCanvasContainer: () => container,
			once: (type: string, fn: () => void) => {
				if (type === 'load') queueMicrotask(fn);
			},
			on: (type: string, fn: unknown) => {
				if (typeof fn === 'function') (state.handlers[type] ??= []).push(fn as never);
				return map;
			},
			off: () => map,
			// A point, or a box [[x0, y0], [x1, y1]] for the drop tolerance.
			queryRenderedFeatures: (at: Point | [Point, Point]) => {
				const [[x0, y0], [x1, y1]] = (typeof at[0] === 'number' ? [at, at] : at) as [Point, Point];
				return inRect(x0, y0, x1, y1);
			},
			project: ([x, y]: [number, number]) => ({ x, y }),
			setFeatureState: ({ id }: { id: string }, value: { quizHover?: boolean }) => {
				if (value.quizHover) state.hovered = id;
				else if (value.quizHover === false && state.hovered === id) state.hovered = undefined;
			},
			easeTo: () => map,
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

vi.mock('maplibre-gl', () => ({
	Popup: fake.Popup,
	// Name places' "?" on the asked place (#264): an element in the container.
	Marker: class {
		private readonly el: HTMLElement;
		constructor({ element }: { element: HTMLElement }) {
			this.el = element;
		}
		setLngLat() {
			return this;
		}
		addTo(map: { getContainer(): HTMLElement }) {
			map.getContainer().append(this.el);
			return this;
		}
		remove() {
			this.el.remove();
		}
	}
}));
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

/** A tap on the map at a target's centroid, as MapLibre reports it (#260). */
function tapMap(onto: string) {
	const target = fake.mapDef.targets.find((t) => t.name === onto)!;
	const point = { x: target.centroid[0], y: target.centroid[1] };
	for (const fn of fake.state.handlers.click ?? []) fn({ point });
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
		setQuizMode('place');
		forgetRound(MAP_ID);
		const repository = createInMemoryProgressRepository();
		saveCardState = vi.spyOn(repository, 'saveCardState');
		saveSummary = vi.spyOn(repository, 'saveLastSessionSummary');
		fake.state.repository = repository;
	});
	afterEach(() => forgetRound(MAP_ID));

	it('describes the actual answer targets and follows the selected language (#253)', async () => {
		const region = await mount();
		expect(region.container.querySelector('.subtitle')?.textContent).toContain('matching area');
		region.unmount();
		forgetRound(MAP_ID);
		for (const target of fake.mapDef.targets) (target as { type: string }).type = 'city';
		try {
			const towns = await mount();
			expect(towns.container.querySelector('.subtitle')?.textContent).toContain('town marker');
			setLanguage('de');
			await expect
				.poll(() => towns.container.querySelector('.subtitle')?.textContent)
				.toContain('Stadtmarkierung');
			setLanguage('it');
			await expect
				.poll(() => towns.container.querySelector('.subtitle')?.textContent)
				.toContain('indicatore della città');
		} finally {
			for (const target of fake.mapDef.targets) (target as { type: string }).type = 'region';
			setLanguage('en');
		}
	});

	// The hand is dealt at random, so each test plays the names it was dealt:
	// the first placed right, the second dropped on the first's region.
	it('keeps quiz slips on the pointer-driven drag path, not native browser drag', async () => {
		const screen = await mount();
		const slip = screen.container.querySelector<HTMLButtonElement>('.slip')!;
		expect(slip.draggable).toBe(false);
		expect(slip.dispatchEvent(new Event('dragstart', { bubbles: true, cancelable: true }))).toBe(
			false
		);
	});

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
		expect(document.querySelector('.geoclick-stretched text.retention-seen')).not.toBeNull();
		setLanguage('de');
		expect(document.querySelector('.geoclick-stretched text.retention-seen')).not.toBeNull();
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
		expect(document.querySelectorAll('.geoclick-stretched text')).toHaveLength(0);
		expect(screen.container.querySelector('.map-again')).toBeNull();
		await finish();
		await expect.poll(() => saveSummary.mock.calls.length).toBe(2);
	});
	it('places a name with a tap on the slip and a tap on the map (#260)', async () => {
		const screen = await mount();
		const [name] = slipNames();
		const slip = screen.getByRole('button', { name, exact: true });
		await slip.click();
		await expect.element(slip).toHaveAttribute('aria-pressed', 'true');
		await expect.element(screen.getByText('Now tap its place on the map')).toBeVisible();
		tapMap(name);
		await expect.poll(slipNames).not.toContain(name);
		expect(saveCardState).toHaveBeenLastCalledWith(MAP_ID, {
			targetId: name.toLowerCase(),
			...rate(undefined, 'good', todayLocalDate())
		});
	});

	it('lets a selected slip go on a second tap, and ignores map taps with none selected', async () => {
		const screen = await mount();
		const [name] = slipNames();
		const slip = screen.getByRole('button', { name, exact: true });
		await slip.click();
		await slip.click();
		await expect.element(slip).toHaveAttribute('aria-pressed', 'false');
		tapMap(name);
		expect(slipNames()).toContain(name);
		expect(saveCardState).not.toHaveBeenCalled();
	});

	it('lists the names to work on and the mix-ups at the end of a round (#259, #266)', async () => {
		const saveRecords = vi.spyOn(fake.state.repository!, 'saveMapRecords');
		const screen = await mount();
		const [right, wrong] = slipNames();
		await drop(right, right);
		await drop(wrong, right);
		expect(saveRecords).toHaveBeenLastCalledWith(MAP_ID, {
			confusions: [{ targetId: wrong.toLowerCase(), chosenId: right.toLowerCase(), count: 1 }]
		});
		await finish();
		const toWorkOn = screen.container.querySelector('[data-testid="to-work-on"]');
		expect(toWorkOn?.textContent).toContain(wrong);
		expect(toWorkOn?.textContent).not.toContain(right);
		await expect.element(screen.getByRole('button', { name: 'Study these' })).toBeVisible();
		expect(screen.container.querySelector('[data-testid="confusions"]')?.textContent).toContain(
			`${wrong} placed on ${right}`
		);
	});
	it('offers a practice round of the names not yet known, with the known ones placed (#265)', async () => {
		const today = todayLocalDate();
		const known = fake.mapDef.targets.slice(0, 12);
		const repository = fake.state.repository!;
		for (const target of known) {
			let card = rate(undefined, 'good', today);
			card = rate(rate(card, 'good', today), 'good', today);
			await repository.saveCardState(MAP_ID, { targetId: target.id, ...card });
		}
		const screen = await render(QuizView, { mapId: MAP_ID });
		const practise = screen.getByRole('button', { name: 'Practise the 4 not yet known' });
		await practise.click();
		// 12 of 16 known is level 2: the four left are dealt three at a time.
		await expect.poll(() => slipNames().length).toBe(3);
		expect(slipNames().some((n) => known.some((t) => t.name === n))).toBe(false);
		await expect.poll(placedNames).toHaveLength(known.length);
		expect(screen.container.querySelector('.subtitle')?.textContent).toContain('Practice');
		expect(screen.container.querySelector('.subtitle')?.textContent).toContain('0 / 4');
		await expect.element(practise).not.toBeInTheDocument();
	});
	it('times a round on a fully known map and keeps a clean best (#267)', async () => {
		const today = todayLocalDate();
		const repository = fake.state.repository!;
		const saveRecords = vi.spyOn(repository, 'saveMapRecords');
		for (const target of fake.mapDef.targets) {
			const card = rate(rate(rate(undefined, 'good', today), 'good', today), 'good', today);
			await repository.saveCardState(MAP_ID, { targetId: target.id, ...card });
		}
		const screen = await render(QuizView, { mapId: MAP_ID });
		await expect.poll(() => slipNames().length).toBe(1);
		await finish();
		await expect.element(screen.getByText('New best!')).toBeVisible();
		expect(screen.container.querySelector('[data-testid="round-time"]')?.textContent).toMatch(
			/Time: \d+:\d\d/
		);
		expect(saveRecords).toHaveBeenCalledWith(MAP_ID, { bestTimeMs: expect.any(Number) });
	});
	it('asks for the name of a lit-up place in Name-it mode, and keeps the choice (#264)', async () => {
		const screen = await mount();
		await screen.getByRole('button', { name: 'Name places' }).click();
		const choices = () => [...document.querySelectorAll<HTMLElement>('[data-testid="choice"]')];
		await expect.poll(() => choices().length).toBe(4);
		await expect.poll(() => fake.state.hovered).toBeDefined();
		const asked = fake.state.hovered!;
		expect(choices().some((c) => c.textContent?.includes(asked))).toBe(true);
		expect(document.querySelectorAll('.ask-marker')).toHaveLength(1);
		expect(screen.container.querySelector('.subtitle')?.textContent).toContain('0 / 16 named');

		// The number key of the right name answers it.
		const index = choices().findIndex((c) => c.textContent?.includes(asked));
		window.dispatchEvent(new KeyboardEvent('keydown', { key: String(index + 1) }));
		await expect.poll(() => saveCardState.mock.calls.length).toBe(1);
		expect(saveCardState).toHaveBeenLastCalledWith(MAP_ID, {
			targetId: asked.toLowerCase(),
			...rate(undefined, 'good', todayLocalDate())
		});
		expect(screen.container.querySelector('.subtitle')?.textContent).toContain('1 / 16 named');
		expect(quizMode()).toBe('name');
	});
	it("keeps a round's mix-ups through a trip away and back (#276)", async () => {
		const first = await mount();
		const [right, wrong] = slipNames();
		await drop(right, right);
		await drop(wrong, right);
		first.unmount();

		const screen = await mount();
		await finish();
		expect(screen.container.querySelector('[data-testid="confusions"]')?.textContent).toContain(
			`${wrong} placed on ${right}`
		);
	});
});
