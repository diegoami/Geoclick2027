// MapLibre needs the DOM; never render this route on the server. Not
// prerendered either - map ids aren't enumerated at build time, so this
// is served via the SPA fallback (200.html) instead.
export const ssr = false;
export const prerender = false;
