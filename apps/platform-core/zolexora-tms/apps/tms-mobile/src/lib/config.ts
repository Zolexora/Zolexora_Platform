import Constants from 'expo-constants';

function required(key: 'apiBaseUrl' | 'authServiceUrl' | 'turnstileSiteKey', source: string): string {
  const value = String(Constants.expoConfig?.extra?.[key] ?? '').trim().replace(/\/$/, '');
  if (!value) throw new Error(`${source} is not configured (Infisical)`);
  return value;
}

export const config = {
  apiBaseUrl: () => required('apiBaseUrl', 'EXPO_PUBLIC_API_BASE_URL'),
  authServiceUrl: () => required('authServiceUrl', 'AUTH_SERVICE_PUBLIC_URL'),
  turnstileSiteKey: () => required('turnstileSiteKey', 'TURNSTILE_SITE_KEY'),
};
