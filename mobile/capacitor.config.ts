import type { CapacitorConfig } from '@capacitor/cli';

// Mirrors desktop/src-tauri/tauri.conf.json's build.frontendDist - same
// `app/build` static output wrapped unmodified, no separate mobile-only
// frontend code (Iteration 8+, Android POC).
const config: CapacitorConfig = {
	appId: 'com.geoclick.mobile',
	appName: 'Geoclick',
	webDir: '../app/build'
};

export default config;
