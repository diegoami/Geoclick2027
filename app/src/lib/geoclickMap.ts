// Shared map-bootstrapping logic used by both the free-explore viewer
// (MapView.svelte) and the guided tour player (TourView.svelte).

import * as maplibregl from 'maplibre-gl';
import type { StyleSpecification } from 'maplibre-gl';
import { PMTiles, Protocol, type RangeResponse, type Source } from 'pmtiles';
import { overallBounds, type MapDefinition } from './mapDefinition';

let protocol: Protocol | undefined;

function ensurePmtilesProtocol(): Protocol {
	if (!protocol) {
		protocol = new Protocol();
		maplibregl.addProtocol('pmtiles', protocol.tile);
	}
	return protocol;
}

// Capacitor's Android WebView local asset server doesn't support HTTP
// Range/206 responses for arbitrary file extensions (a known upstream
// limitation, ionic-team/capacitor#7664) - pmtiles' normal FetchSource
// (which relies on range requests) silently never gets real tile data
// back, even though the identical bundled file works fine in the
// browser/Tauri builds. Demo maps are small (under 1MB each), so the fix
// is to fetch the whole archive once as a normal full GET - which
// Capacitor serves correctly - and serve pmtiles' byte-range reads out of
// that in-memory buffer instead of over HTTP. Only applied on native
// Capacitor (see fetchMapDefAndStyle's isNativePlatform check) - browser
// and Tauri already work correctly via real range requests, no reason to
// change already-verified behavior there.
class ArrayBufferSource implements Source {
	constructor(
		private key: string,
		private buffer: ArrayBuffer
	) {}
	getKey(): string {
		return this.key;
	}
	async getBytes(offset: number, length: number): Promise<RangeResponse> {
		return { data: this.buffer.slice(offset, offset + length) };
	}
}

async function registerBufferedPmtiles(mapProtocol: Protocol, url: string): Promise<void> {
	if (mapProtocol.get(url)) return;
	const res = await fetch(url);
	if (!res.ok) throw new Error(`Could not load tiles "${url}".`);
	const buffer = await res.arrayBuffer();
	mapProtocol.add(new PMTiles(new ArrayBufferSource(url, buffer)));
}

export async function fetchMapDefAndStyle(
	mapId: string
): Promise<{ mapDef: MapDefinition; style: StyleSpecification }> {
	const mapProtocol = ensurePmtilesProtocol();
	const [mapDefRes, baseStyleRes] = await Promise.all([
		fetch(`/maps/${mapId}/map.json`),
		fetch(`/styles/base.json`)
	]);
	if (!mapDefRes.ok || !baseStyleRes.ok) {
		throw new Error(`Could not load map "${mapId}".`);
	}
	const mapDef: MapDefinition = await mapDefRes.json();
	const baseStyle = await baseStyleRes.json();

	const tilesUrl = `${location.origin}/maps/${mapId}/tiles.pmtiles`;
	const { Capacitor } = await import('@capacitor/core');
	if (Capacitor.isNativePlatform()) {
		await registerBufferedPmtiles(mapProtocol, tilesUrl);
	}

	const style: StyleSpecification = {
		...baseStyle,
		sources: {
			...baseStyle.sources,
			targets: {
				...baseStyle.sources.targets,
				url: `pmtiles://${tilesUrl}`
			}
		}
	};
	return { mapDef, style };
}

export function createMap(
	container: HTMLDivElement,
	mapDef: MapDefinition,
	style: StyleSpecification
): maplibregl.Map {
	ensurePmtilesProtocol();
	const map = new maplibregl.Map({
		container,
		style,
		bounds: overallBounds(mapDef),
		fitBoundsOptions: { padding: 40 }
	});
	map.addControl(new maplibregl.NavigationControl(), 'top-right');
	return map;
}
