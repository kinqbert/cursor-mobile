/// <reference types="node" />
import { existsSync } from 'node:fs';
import type { ConfigContext, ExpoConfig } from 'expo/config';

// Firebase config for FCM (Android push). Either drop google-services.json next to this
// file, or store it as an EAS file env var named GOOGLE_SERVICES_JSON for cloud builds.
const googleServicesFile =
  process.env.GOOGLE_SERVICES_JSON ?? (existsSync('./google-services.json') ? './google-services.json' : undefined);

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  android: { ...config.android, ...(googleServicesFile ? { googleServicesFile } : {}) },
});
