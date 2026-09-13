# Geoclick logo

- `geoclick-logo.svg` — the master: a cream map pin with an amber centre
  on the app's deep green, full-bleed square (512×512 viewBox). Picked by
  the product owner from three candidates on 2026-09-13 (FT-04; see
  DECISIONS.md, "App logo").
- `geoclick-logo-1024.png` — the same, rendered at 1024×1024. Use it as the
  source for icon generators (`tauri icon`, `@capacitor/assets`).

The square is left full-bleed on purpose. Each platform applies its own
shape: Windows and web use a rounded tile, and Android launchers crop to a
circle, squircle or square. The pin stays inside Android's 66% safe
circle, so no launcher shape cuts it.

To re-render the PNG after editing the SVG, open it at 1024×1024 in a
browser and screenshot it. The PNG was made with Playwright's Chromium,
which the test suite already installs:

```js
// node, from the repo root
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const svg = readFileSync('design/logo/geoclick-logo.svg', 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } });
await page.setContent(svg.replace('<svg ', '<svg width="1024" height="1024" '));
await page.locator('svg').screenshot({ path: 'design/logo/geoclick-logo-1024.png' });
await browser.close();
```
