import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMapResourceFetcher } from './mapResource';
const bundle = () => ({
	map: { id: 'example', targets: [{ id: 'one' }] },
	facts: { one: { kind: 'region' } },
	tour: { mapId: 'example', steps: [{ targetId: 'one' }] }
});
afterEach(() => vi.unstubAllGlobals());
describe('portable map resources', () => {
	it('shares one request for all three resources and returns independent response bodies', async () => {
		const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(bundle())));
		vi.stubGlobal('fetch', fetch);
		const read = createMapResourceFetcher(true, (p) => '/game' + p);
		const responses = await Promise.all([
			read('example', 'map.json'),
			read('example', 'facts.json'),
			read('example', 'tour.json')
		]);
		expect(fetch).toHaveBeenCalledTimes(1);
		expect(fetch).toHaveBeenCalledWith('/game/maps/example/bundle.json');
		const [map, facts, tour] = await Promise.all(responses.map((r) => r.json()));
		expect(map).toEqual(bundle().map);
		expect(facts).toEqual(bundle().facts);
		expect(tour).toEqual(bundle().tour);
		map.targets.push({ id: 'changed' });
		expect(await (await read('example', 'map.json')).json()).toEqual(bundle().map);
	});
	it('retries a failed HTTP response instead of keeping a permanent missing map', async () => {
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(new Response(null, { status: 503 }))
			.mockResolvedValueOnce(new Response(JSON.stringify(bundle())));
		vi.stubGlobal('fetch', fetch);
		const read = createMapResourceFetcher(true, (p) => p);
		expect((await read('example', 'map.json')).status).toBe(503);
		expect((await read('example', 'map.json')).ok).toBe(true);
		expect(fetch).toHaveBeenCalledTimes(2);
	});
	it('rejects a bundle for another map or incomplete resources and can recover', async () => {
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(new Response(JSON.stringify({ ...bundle(), map: { id: 'wrong' } })))
			.mockResolvedValueOnce(new Response(JSON.stringify({ map: { id: 'example' } })))
			.mockResolvedValueOnce(new Response(JSON.stringify(bundle())));
		vi.stubGlobal('fetch', fetch);
		const read = createMapResourceFetcher(true, (p) => p);
		await expect(read('example', 'map.json')).rejects.toThrow('Invalid bundled');
		await expect(read('example', 'facts.json')).rejects.toThrow('Invalid bundled');
		expect((await read('example', 'tour.json')).ok).toBe(true);
	});
	it('keeps the ordinary web/native file requests unchanged', async () => {
		const fetch = vi.fn().mockImplementation(() => Promise.resolve(new Response('{}')));
		vi.stubGlobal('fetch', fetch);
		const read = createMapResourceFetcher(false, (p) => p);
		await read('example', 'map.json');
		await read('example', 'facts.json');
		await read('example', 'tour.json');
		expect(fetch.mock.calls.map((c) => c[0])).toEqual([
			'/maps/example/map.json',
			'/maps/example/facts.json',
			'/maps/example/tour.json'
		]);
	});
});
