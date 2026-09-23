// Runs in the browser project (real Chromium) against the real app.css (#34):
// on Explore, a region's name that does not fit along its region is set in
// the stretched name's type, and every other label keeps its box.
import { afterEach, describe, expect, it } from 'vitest';
import '../app.css';
import { MAGNIFIED_CLASS } from './labelMagnify';

const NONE = 'rgba(0, 0, 0, 0)';
const ASKED_INK = 'rgb(150, 85, 20)';

/** One MapLibre popup with the given classes, as MapView and QuizView add them. */
function label(classes: string, name = 'San Juan') {
	const popup = document.createElement('div');
	popup.className = `maplibregl-popup ${classes}`;
	popup.innerHTML = `<div class="maplibregl-popup-content">${name}</div>`;
	document.body.append(popup);
	return getComputedStyle(popup.firstElementChild!);
}

describe('region labels on Explore (#34)', () => {
	afterEach(() => document.body.replaceChildren());

	it("set a region's fallback name like its stretched one: serif capitals, no box", () => {
		const style = label(
			'geoclick-solved-popup geoclick-retention geoclick-region-name retention-known'
		);
		expect(style.backgroundColor).toBe(NONE);
		expect(style.fontFamily).toContain('Georgia');
		expect(style.textTransform).toBe('uppercase');
		expect(style.paddingLeft).toBe('0px');
	});

	it('ink an asked region in the same darker orange as its stretched name', () => {
		const style = label(
			'geoclick-solved-popup geoclick-retention geoclick-region-name retention-asked'
		);
		expect(style.backgroundColor).toBe(NONE);
		expect(style.color).toBe(ASKED_INK);

		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.classList.add('geoclick-stretched');
		const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
		text.classList.add('retention-asked');
		svg.append(text);
		document.body.append(svg);
		expect(getComputedStyle(text).fill).toBe(ASKED_INK);
	});

	it('stay boxless when magnified', () => {
		const popup = document.createElement('div');
		popup.className =
			'maplibregl-popup geoclick-solved-popup geoclick-retention geoclick-region-name retention-known';
		popup.innerHTML = `<div class="maplibregl-popup-content ${MAGNIFIED_CLASS}">San Juan</div>`;
		document.body.append(popup);
		expect(getComputedStyle(popup.firstElementChild!).backgroundColor).toBe(NONE);
	});

	it('leave a town name its box beside the dot', () => {
		const style = label('geoclick-solved-popup geoclick-retention retention-asked', 'Essen');
		expect(style.backgroundColor).not.toBe(NONE);
		expect(style.textTransform).toBe('none');
	});

	it('leave Quiz labels their box', () => {
		const style = label('geoclick-solved-popup', 'Toscana');
		expect(style.backgroundColor).not.toBe(NONE);
		expect(style.fontFamily).not.toContain('Georgia');
	});
});
