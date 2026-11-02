// Runtime values come from Infisical when Expo/EAS runs (scripts/setup/with-infisical.sh);
// there are no defaults. Same key names as tms-web/tms-admin.
module.exports = ({ config }) => ({
  ...config,
  plugins: [...(config.plugins || []), 'expo-secure-store'],
  extra: {
    ...config.extra,
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
    authServiceUrl: process.env.AUTH_SERVICE_PUBLIC_URL,
    turnstileSiteKey: process.env.TURNSTILE_SITE_KEY,
  },
});
