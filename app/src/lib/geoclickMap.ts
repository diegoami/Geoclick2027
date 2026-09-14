// Shared map-bootstrapping logic used by both the free-explore viewer
// (MapView.svelte) and the guided tour player (TourView.svelte).

import * as maplibregl from 'maplibre-gl';
import type { StyleSpecification } from 'maplibre-gl';
import { PMTiles, Protocol, type RangeResponse, type Source } from 'pmtiles';
import { asset } from '$app/paths';
import { enableLabelMagnify } from './labelMagnify';
import { isNativeShell } from './platform';
import { overallBounds, type MapDefinition } from './mapDefinition';

let protocol: Protocol | undefined;

function ensurePmtilesProtocol(): Protocol {
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
//   The old comment here claimed desktop worked; it did not.
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
	// asset() prefixes kit.paths.base (or paths.assets) - a bare "/maps/..."
	// 404s as soon as the app is served under a subpath (e.g. GitHub Pages).
	const [mapDefRes, baseStyleRes] = await Promise.all([
		fetch(asset(`/maps/${mapId}/map.json`)),
		fetch(asset('/styles/base.json'))
	]);
	if (!mapDefRes.ok || !baseStyleRes.ok) {
		throw new Error(`Could not load map "${mapId}".`);
	}
	const mapDef: MapDefinition = await mapDefRes.json();
	const baseStyle = await baseStyleRes.json();

	// pmtiles needs an absolute URL; new URL() keeps it absolute while honouring
	// the base path (and stays correct if asset() ever returns a full CDN URL).
	const tilesUrl = new URL(asset(`/maps/${mapId}/tiles.pmtiles`), location.origin).href;
	if (await isNativeShell()) {
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
	// The tutorial rings the +/- buttons in its zoom-and-pan step (FT-11).
	container
		.querySelector('.maplibregl-ctrl-top-right .maplibregl-ctrl-group')
		?.setAttribute('data-tutorial', 'zoom-control');

	// Each target's adjacency-aware colour slot (GC-032) is read by base.json
	// through feature-state, so recolouring never means rebuilding tiles.
	// 'style.load' is the earliest moment setFeatureState is legal (the source
	// exists) and it comes before the first tile paints - so there is no flash of
	// the fallback colour, unlike waiting for 'load'. Other feature-state keys
	// (quizCorrect, highlighted...) are merged, not replaced, so views that set
	// those later don't disturb it.
	const applyColorIndex = () => {
		for (const target of mapDef.targets) {
			if (target.colorIndex === undefined) continue;
			map.setFeatureState(
				{ source: 'targets', sourceLayer: 'targets', id: target.name },
				{ colorIndex: target.colorIndex }
			);
		}
	};
	map.on('style.load', applyColorIndex);
	if (map.isStyleLoaded()) applyColorIndex();

	// Magnify a name label under the mouse (FT-02) or on a tap (FT-03). Labels
	// take no pointer input, so drags on them move the map (FT-18).
	map.once('remove', enableLabelMagnify(container));
	return map;
}
