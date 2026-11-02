import * as SecureStore from 'expo-secure-store';

// The session token lives in the platform keystore (Keychain / Android Keystore).
const TOKEN_KEY = 'zolexora_tms_session_token';

export const storage = {
  getToken: () => SecureStore.getItemAsync(TOKEN_KEY),
  setToken: (token: string) => SecureStore.setItemAsync(TOKEN_KEY, token),
  clearSession: () => SecureStore.deleteItemAsync(TOKEN_KEY),
};
