// Device preferences, independent of progress and map zoom (#284).
export const TEXT_SCALES = [
	50, 60, 75, 90, 100, 115, 130, 150, 175, 200, 225, 250, 275, 300
] as const;
export const COLOR_SCHEMES = ['classic', 'ocean', 'forest', 'contrast'] as const;
export type TextScale = (typeof TEXT_SCALES)[number];
export type ColorScheme = (typeof COLOR_SCHEMES)[number];
export interface Appearance {
	scale: TextScale;
	scheme: ColorScheme;
}
export const DEFAULT_APPEARANCE: Appearance = { scale: 100, scheme: 'classic' };
export const APPEARANCE_KEY = 'geoclick:appearance:v1';
export const APPEARANCE_CHANGED = 'geoclick:appearancechange';

// Validate fields independently: a future/invalid scheme must not lose a
// valid size. No storage access during SSR or at module initialization.
export function parseAppearance(raw: string | null): Appearance {
	try {
		const value = JSON.parse(raw ?? 'null');
		return {
			scale: TEXT_SCALES.includes(value?.scale) ? value.scale : 100,
			scheme: COLOR_SCHEMES.includes(value?.scheme) ? value.scheme : 'classic'
		};
	} catch {
		return { ...DEFAULT_APPEARANCE };
	}
}
