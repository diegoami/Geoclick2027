// Shared map-bootstrapping logic used by both the free-explore viewer
// (MapView.svelte) and the guided tour player (TourView.svelte).

import * as maplibregl from 'maplibre-gl';
import type { StyleSpecification } from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import { base } from '$app/paths';
import { overallBounds, type MapDefinition } from './mapDefinition';

let protocolRegistered = false;

function ensurePmtilesProtocol() {
	if (protocolRegistered) return;
	const protocol = new Protocol();
	maplibregl.addProtocol('pmtiles', protocol.tile);
	protocolRegistered = true;
}

export async function fetchMapDefAndStyle(
	mapId: string
): Promise<{ mapDef: MapDefinition; style: StyleSpecification }> {
	const [mapDefRes, baseStyleRes] = await Promise.all([
		fetch(`${base}/maps/${mapId}/map.json`),
		fetch(`${base}/styles/base.json`)
	]);
	if (!mapDefRes.ok || !baseStyleRes.ok) {
		throw new Error(`Could not load map "${mapId}".`);
	}
	const mapDef: MapDefinition = await mapDefRes.json();
	const baseStyle = await baseStyleRes.json();

	const style: StyleSpecification = {
		...baseStyle,
		sources: {
			...baseStyle.sources,
			targets: {
				...baseStyle.sources.targets,
				url: `pmtiles://${location.origin}${base}/maps/${mapId}/tiles.pmtiles`
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
