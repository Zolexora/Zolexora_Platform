import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { BusinessSession, MobilePersona } from '../types/tms';

const BUSINESS_SESSION_KEY = 'zolexora_tms_business_session';
const PERSONAL_TOKEN_KEY = 'zolexora_tms_personal_token';
const ACTIVE_MODE_KEY = 'zolexora_tms_active_mode';
const LEGACY_TOKEN_KEY = 'zolexora_tms_session_token';

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
    } catch {
      // ignore storage quota errors
    }
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function deleteItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined') window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
    return;
  }
  await SecureStore.deleteItemAsync(key).catch(() => {});
}

export const storage = {
  async getBusinessSession(): Promise<BusinessSession | null> {
    const raw = await getItem(BUSINESS_SESSION_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as BusinessSession;
    } catch {
      return null;
    }
  },

  async setBusinessSession(session: BusinessSession): Promise<void> {
    await setItem(BUSINESS_SESSION_KEY, JSON.stringify(session));
  },

  async getToken(): Promise<string | null> {
    const session = await this.getBusinessSession();
    if (session?.access_token) return session.access_token;
    return getItem(LEGACY_TOKEN_KEY);
  },

  getPersonalToken(): Promise<string | null> {
    return getItem(PERSONAL_TOKEN_KEY);
  },

  setPersonalToken(token: string): Promise<void> {
    return setItem(PERSONAL_TOKEN_KEY, token);
  },

  async getActiveMode(): Promise<MobilePersona | null> {
    return (await getItem(ACTIVE_MODE_KEY)) as MobilePersona | null;
  },

  setActiveMode(mode: MobilePersona): Promise<void> {
    return setItem(ACTIVE_MODE_KEY, mode);
  },

  async clearSession(): Promise<void> {
    await Promise.all([
      deleteItem(BUSINESS_SESSION_KEY),
      deleteItem(PERSONAL_TOKEN_KEY),
      deleteItem(ACTIVE_MODE_KEY),
      deleteItem(LEGACY_TOKEN_KEY),
    ]);
  },
};
