// Prerender by default (fully static build). The dynamic /map/[mapId]
// routes opt out explicitly in their own +page.ts, since we don't
// enumerate map ids at build time - they're served via the SPA fallback
// (200.html) instead.
export const prerender = true;
