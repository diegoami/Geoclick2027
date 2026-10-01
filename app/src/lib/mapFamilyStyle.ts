import type { StyleSpecification } from 'maplibre-gl';
import type { Target } from './mapDefinition';

/** A brighter country fill gives a towns map a visible surface under its dots. */
export const CITY_CONTEXT_FILL = '#d7e28c';
export const CITY_CONTEXT_OUTLINE = '#8c965c';

/** Colors the mapped country's context by map family without recoloring the sea. */
export function styleForMapFamily(
	style: StyleSpecification,
	mapDef: { targets: readonly Pick<Target, 'type'>[] }
): StyleSpecification {
	if (mapDef.targets.length === 0 || !mapDef.targets.every((target) => target.type === 'city'))
		return style;

	return {
		...style,
		layers: style.layers.map((layer) => {
			if (layer.type === 'fill' && layer.id === 'context-fill')
				return {
					...layer,
					paint: { ...layer.paint, 'fill-color': CITY_CONTEXT_FILL }
				};
			if (layer.type === 'line' && layer.id === 'context-outline')
				return {
					...layer,
					paint: { ...layer.paint, 'line-color': CITY_CONTEXT_OUTLINE }
				};
			return layer;
		})
	};
}
