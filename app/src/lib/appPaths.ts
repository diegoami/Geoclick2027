import { asset as kitAsset, resolve as kitResolve } from '$app/paths';
/** Hash-routed exports can live in an unknown host folder. Native/web builds keep Kit paths. */
export function asset(file: Parameters<typeof kitAsset>[0]): string {
	if (import.meta.env.VITE_GEOCLICK_HTML5 === '1') {
		return new URL(String(file).replace(/^\/+/, ''), document.baseURI).href;
	}
	return kitAsset(file);
}

/** Keep hash navigation on the physical entry file, including on a plain static host. */
export const resolve: typeof kitResolve = (...args: unknown[]) => {
	const resolved: string = Reflect.apply(kitResolve, undefined, args);
	if (import.meta.env.VITE_GEOCLICK_HTML5 === '1') {
		const hash = resolved.indexOf('#');
		if (hash < 0) throw new Error('Portable navigation requires a hash route');
		return resolved.slice(hash) as ReturnType<typeof kitResolve>;
	}
	return resolved as ReturnType<typeof kitResolve>;
};
