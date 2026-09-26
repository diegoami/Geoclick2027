// Runs in the browser project: the store's state lives in module scope and
// persists to a real localStorage.
import { beforeEach, describe, expect, it } from 'vitest';
import {
	RECENT_SHOWN,
	recentMaps,
	recordVisit,
	setUnrecordedMap,
	pickerGoUp,
	pickerView,
	setPickerShown,
	setPickerView,
	homeView,
	setHomeView
} from './mapPrefs.svelte';

const stored = () => JSON.parse(localStorage.getItem('geoclick:recent-maps:v1') ?? '[]');

describe('Recent maps store', () => {
	beforeEach(() => setUnrecordedMap(undefined));

	it('records visits newest first and saves them on the device', () => {
		recordVisit('italy-regions');
		recordVisit('usa-states');
		recordVisit('italy-regions');
		expect(recentMaps().slice(0, 2)).toEqual(['italy-regions', 'usa-states']);
		expect(stored().slice(0, 2)).toEqual(['italy-regions', 'usa-states']);
	});

	it(`shows at most ${RECENT_SHOWN}`, () => {
		for (const id of [
			'japan-regions',
			'china-regions',
			'france-regions',
			'spain-regions',
			'poland-regions'
		])
			recordVisit(id);
		expect(recentMaps()).toHaveLength(RECENT_SHOWN);
		expect(recentMaps()[0]).toBe('poland-regions');
	});

	it('ignores ids that are not maps in the catalog', () => {
		const before = recentMaps();
		recordVisit('no-such-map');
		expect(recentMaps()).toEqual(before);
	});

	it('skips the unrecorded map (the tutorial) and still records the others', () => {
		const before = recentMaps();
		setUnrecordedMap('germany-states');
		recordVisit('germany-states');
		expect(recentMaps()).toEqual(before);
		recordVisit('usa-states');
		expect(recentMaps()[0]).toBe('usa-states');
	});
});

describe("the start screen's view (FT-77)", () => {
	it('is kept on the device, and the back button goes up from a continent', () => {
		setPickerShown(true);
		setPickerView('europe');
		expect(pickerView()).toBe('europe');
		expect(localStorage.getItem('geoclick:picker-view:v1')).toBe('europe');
		expect(pickerGoUp()).toBe(true);
		expect(pickerView()).toBe('world');
		// On the world, back leaves the app: nothing to go up to.
		expect(pickerGoUp()).toBe(false);
	});

	it('the back button leaves when the map is not up, whatever continent is kept (#81)', () => {
		// The list, or a map still loading: the player sees no continent.
		setPickerShown(false);
		setPickerView('europe');
		expect(pickerGoUp()).toBe(false);
		expect(pickerView()).toBe('europe');
		setPickerView('world');
	});
});

describe('the start screen: map or list (FT-78)', () => {
	it('is kept on the device', () => {
		setHomeView('list');
		expect(homeView()).toBe('list');
		expect(localStorage.getItem('geoclick:home-view:v1')).toBe('list');
		setHomeView('map');
		expect(homeView()).toBe('map');
	});
});
