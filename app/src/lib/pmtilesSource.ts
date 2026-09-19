// Loading a PMTiles archive, for whoever needs one.
//
// Split out of geoclickMap.ts when the Terrain layer (FT-33) needed the same
// treatment for its own archive. terrainLayer.ts importing it back out of
// geoclickMap.ts made a cycle - geoclickMap -> terrainLayer -> geoclickMap -
// and in the dev server that produced TWO live copies of geoclickMap.ts:
// createMap registered its map in one copy's registry while the map bar's
// Terrain button read the other copy's, which was empty. The button flipped
// the preference and did nothing at all, silently. This module has no
// imports from the app, so it cannot be part of a cycle.

import * as maplibregl from 'maplibre-gl';
import { PMTiles, Protocol, type RangeResponse, type Source } from 'pmtiles';

let protocol: Protocol | undefined;

export function ensurePmtilesProtocol(): Protocol {
	if (!protocol) {
		protocol = new Protocol();
		maplibregl.addProtocol('pmtiles', protocol.tile);
	}
	return protocol;
}

// Neither app shell serves HTTP Range requests for bundled files, and
// pmtiles' normal FetchSource depends on them:
// - Capacitor's Android WebView asset server ignores them for arbitrary
//   file extensions (ionic-team/capacitor#7664), so no tile data arrives.
// - Tauri's desktop protocol (http://tauri.localhost) answers a Range request
//   with a plain 200 and no Content-Length, and pmtiles aborts with "Server
//   returned no content-length header". Found in the published v0.3.0 desktop
//   app (empty map), caught via WebView2 remote debugging - see ONBOARDING.md.
// The fix for both is to fetch the whole archive once, as a normal full GET
// the shells serve correctly, and answer pmtiles' byte-range reads from that
// in-memory buffer. Map archives are small (russia-regions, the largest, is
// about 2 MB). The web build keeps real range requests; Netlify and dev
// servers support them.
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

/** Buffers one archive for the native shells, protocol and all. */
export async function registerTilesArchive(url: string): Promise<void> {
	const mapProtocol = ensurePmtilesProtocol();
	if (mapProtocol.get(url)) return;
	const res = await fetch(url);
	if (!res.ok) throw new Error(`Could not load tiles "${url}".`);
	const buffer = await res.arrayBuffer();
	mapProtocol.add(new PMTiles(new ArrayBufferSource(url, buffer)));
}
