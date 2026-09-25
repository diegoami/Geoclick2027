// Runs in the browser project (real Chromium) against the real app.css (#34,
// FT-74): a region's name is set in the stretched name's type - on Explore,
// where it does not fit along its region, and in the Quiz, Overview and Tour -
// and a town's name keeps its box.
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
});

describe('region labels in the Quiz, Overview and Tour (FT-74)', () => {
	afterEach(() => document.body.replaceChildren());
	const REGION_INK = 'rgba(31, 61, 42, 0.9)';

	it('set a solved region in the Quiz or Overview without a box', () => {
		const style = label('geoclick-solved-popup geoclick-region-name', 'Toscana');
		expect(style.backgroundColor).toBe(NONE);
		expect(style.fontFamily).toContain('Georgia');
		expect(style.textTransform).toBe('uppercase');
		expect(style.color).toBe(REGION_INK);
	});

	it('ink a given-away Quiz region apart from a placed one', () => {
		const style = label('geoclick-solved-popup geoclick-region-name revealed', 'Toscana');
		expect(style.backgroundColor).toBe(NONE);
		expect(style.color).not.toBe(REGION_INK);
	});

	it('stay boxless when magnified, given away or not', () => {
		for (const classes of [
			'geoclick-solved-popup geoclick-region-name',
			'geoclick-solved-popup geoclick-region-name revealed',
			'geoclick-popup geoclick-region-name'
		]) {
			const popup = document.createElement('div');
			popup.className = `maplibregl-popup ${classes}`;
			popup.innerHTML = `<div class="maplibregl-popup-content ${MAGNIFIED_CLASS}">Toscana</div>`;
			document.body.append(popup);
			expect(getComputedStyle(popup.firstElementChild!).backgroundColor).toBe(NONE);
		}
	});

	it('set the Tour’s region name the same way', () => {
		const style = label('geoclick-popup geoclick-region-name', 'Toscana');
		expect(style.backgroundColor).toBe(NONE);
		expect(style.fontFamily).toContain('Georgia');
	});

	it('leave a town its box in the Quiz, the Overview and the Tour', () => {
		for (const classes of [
			'geoclick-solved-popup',
			'geoclick-solved-popup revealed',
			'geoclick-popup'
		]) {
			const style = label(classes, 'Essen');
			expect(style.backgroundColor).not.toBe(NONE);
			expect(style.fontFamily).not.toContain('Georgia');
		}
	});
});
