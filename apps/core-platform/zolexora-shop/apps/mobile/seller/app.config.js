// Runtime values come from Infisical when Expo/EAS runs (scripts/setup/with-infisical.sh); no defaults.
module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    apiUrl: process.env.MARKETPLACE_API_URL,
    authServiceUrl: process.env.AUTH_SERVICE_PUBLIC_URL,
    turnstileSiteKey: process.env.TURNSTILE_SITE_KEY,
  },
});
