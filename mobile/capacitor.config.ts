import type { CapacitorConfig } from '@capacitor/cli';
import { existsSync } from 'node:fs';
import path from 'node:path';

// Mirrors desktop/src-tauri/tauri.conf.json's build.frontendDist - same
// `app/build` static output wrapped unmodified, no separate mobile-only
// frontend code (Iteration 8+, Android POC).
const accountConfigured = existsSync(path.join(__dirname, 'android/app/google-services.json'));
const config: CapacitorConfig = {
	appId: 'com.geoclick.mobile',
	appName: 'Geoclick',
	webDir: '../app/build',
	android: {
		includePlugins: [
			'@capacitor/app',
			'@capacitor/haptics',
			'@capacitor-community/sqlite',
			...(accountConfigured ? ['@capacitor-firebase/authentication'] : [])
		]
	},
	plugins: {
		FirebaseAuthentication: { skipNativeAuth: true, providers: ['google.com'] }
	},
	loggingBehavior: 'none'
};

export default config;
