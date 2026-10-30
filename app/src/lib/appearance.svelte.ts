import { APPEARANCE_KEY, DEFAULT_APPEARANCE, parseAppearance, type Appearance } from './appearance';

let preference = $state<Appearance>({ ...DEFAULT_APPEARANCE });
let open = $state(false);
export function appearance(): Appearance {
	return preference;
}
export function appearanceOpen(): boolean {
	return open;
}
export function setAppearanceOpen(value: boolean): void {
	open = value;
}
export function loadAppearance(): void {
	try {
		preference = parseAppearance(localStorage.getItem(APPEARANCE_KEY));
	} catch {
		/* Blocked storage: defaults, then session-only changes. */
	}
}
export function setAppearance(value: Appearance): void {
	preference = parseAppearance(JSON.stringify(value));
	try {
		localStorage.setItem(APPEARANCE_KEY, JSON.stringify(preference));
	} catch {
		/* Full/blocked storage: keep the session's choice. */
	}
}
