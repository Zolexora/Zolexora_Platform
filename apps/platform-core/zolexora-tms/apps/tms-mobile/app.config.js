// Runtime values come from Infisical when Expo/EAS runs (scripts/setup/with-infisical.sh);
// there are no defaults. Same key names as tms-web/tms-admin.
module.exports = ({ config }) => {
  const projectId = process.env.EAS_PROJECT_ID || config.extra?.eas?.projectId;
  const plugins = [...(config.plugins || [])];

  if (!plugins.includes('expo-secure-store')) {
    plugins.push('expo-secure-store');
  }

  return {
    ...config,
    runtimeVersion: {
      policy: 'appVersion',
    },
    ...(projectId
      ? {
          updates: {
            url: `https://u.expo.dev/${projectId}`,
          },
        }
      : {}),
    ios: {
      ...config.ios,
      infoPlist: {
        ...config.ios?.infoPlist,
        UIBackgroundModes: ['location'],
        NSLocationWhenInUseUsageDescription:
          'Zolexora TMS uses your location to stamp trip start/end coordinates and share live transit updates.',
        NSLocationAlwaysAndWhenInUseUsageDescription:
          'Zolexora TMS continues sharing trip GPS updates in the background while your duty is in transit, even during turn-by-turn navigation.',
        NSCameraUsageDescription:
          'Zolexora TMS uses the camera to capture Proof of Delivery (POD) and expense receipts.',
        NSPhotoLibraryUsageDescription:
          'Zolexora TMS accesses your photos so you can attach existing receipts or POD documents.',
      },
    },
    plugins,
    extra: {
      ...config.extra,
      ...(projectId ? { eas: { projectId } } : {}),
      apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
      authServiceUrl: process.env.AUTH_SERVICE_PUBLIC_URL,
      turnstileSiteKey: process.env.TURNSTILE_SITE_KEY,
    },
  };
};
