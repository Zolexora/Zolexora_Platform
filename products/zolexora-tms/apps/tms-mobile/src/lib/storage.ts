import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  AUTH_TOKEN: 'zolexora_tms_auth_token',
  USER_DATA: 'zolexora_tms_user_data',
  ACTIVE_ORG_ID: 'zolexora_tms_active_org_id',
  ACTIVE_ORG_NAME: 'zolexora_tms_active_org_name',
  SHIFT_STATE: 'zolexora_tms_shift_state',
};

export const storage = {
  async getToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    } catch {
      return null;
    }
  },

  async setToken(token: string): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
    } catch {}
  },

  async removeToken(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
    } catch {}
  },

  async getActiveOrg(): Promise<{ id: string; name: string } | null> {
    try {
      const id = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_ORG_ID);
      const name = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_ORG_NAME);
      if (id) {
        return { id, name: name || 'Default Org' };
      }
      return null;
    } catch {
      return null;
    }
  },

  async setActiveOrg(id: string, name: string): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_ORG_ID, id);
      await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_ORG_NAME, name);
    } catch {}
  },

  async getUserData<T>(): Promise<T | null> {
    try {
      const json = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
      return json ? JSON.parse(json) : null;
    } catch {
      return null;
    }
  },

  async setUserData<T>(data: T): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(data));
    } catch {}
  },

  async clearSession(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.AUTH_TOKEN,
        STORAGE_KEYS.USER_DATA,
        STORAGE_KEYS.ACTIVE_ORG_ID,
        STORAGE_KEYS.ACTIVE_ORG_NAME,
      ]);
    } catch {}
  },
};
