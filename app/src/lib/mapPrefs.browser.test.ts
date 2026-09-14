// Runs in the browser project: the store's state lives in module scope and
// persists to a real localStorage.
import { beforeEach, describe, expect, it } from 'vitest';
import { RECENT_SHOWN, recentMaps, recordVisit, setVisitRecording } from './mapPrefs.svelte';

const stored = () => JSON.parse(localStorage.getItem('geoclick:recent-maps:v1') ?? '[]');

describe('Recent maps store', () => {
	beforeEach(() => setVisitRecording(true));

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

	it('records nothing while recording is off (the tutorial)', () => {
		const before = recentMaps();
		setVisitRecording(false);
		recordVisit('germany-states');
		expect(recentMaps()).toEqual(before);
	});
});
