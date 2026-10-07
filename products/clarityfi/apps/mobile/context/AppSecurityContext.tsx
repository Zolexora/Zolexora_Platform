import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";

export const SHEETS_URL_KEY = "@sheets_url_v1";
const PASSCODE_KEY = "@app_passcode_v1";
const BIOMETRIC_KEY = "@app_biometric_v1";
const LOCK_TIMEOUT_MS = 30_000;

interface AppSecurityContextType {
  isLocked: boolean;
  isLoaded: boolean;
  passcode: string | null;
  biometricEnabled: boolean;
  biometricAvailable: boolean;
  sheetsUrl: string;
  setPasscode: (code: string | null) => Promise<void>;
  toggleBiometric: () => Promise<void>;
  setSheetsUrl: (url: string) => Promise<void>;
  unlock: (code: string) => boolean;
  unlockWithBiometric: () => Promise<boolean>;
  lockApp: () => void;
}

const AppSecurityContext = createContext<AppSecurityContextType | null>(null);

export function AppSecurityProvider({ children }: { children: React.ReactNode }) {
  const [passcode, setPasscodeState] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [sheetsUrl, setSheetsUrlState] = useState("");
  const backgroundTime = useRef<number | null>(null);

  useEffect(() => {
    (async () => {
      const [code, bio, url] = await Promise.all([
        AsyncStorage.getItem(PASSCODE_KEY),
        AsyncStorage.getItem(BIOMETRIC_KEY),
        AsyncStorage.getItem(SHEETS_URL_KEY),
      ]);
      const hasBio = await LocalAuthentication.hasHardwareAsync();
      setPasscodeState(code ?? null);
      setBiometricEnabled(bio === "true");
      setBiometricAvailable(hasBio);
      setSheetsUrlState(url ?? "");
      if (code) setIsLocked(true);
      setIsLoaded(true);
    })();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background" || state === "inactive") {
        backgroundTime.current = Date.now();
      } else if (state === "active") {
        if (passcode && backgroundTime.current) {
          if (Date.now() - backgroundTime.current > LOCK_TIMEOUT_MS) {
            setIsLocked(true);
          }
        }
        backgroundTime.current = null;
      }
    });
    return () => sub.remove();
  }, [passcode]);

  const setPasscode = useCallback(async (code: string | null) => {
    if (code) {
      await AsyncStorage.setItem(PASSCODE_KEY, code);
    } else {
      await AsyncStorage.removeItem(PASSCODE_KEY);
    }
    setPasscodeState(code);
    setIsLocked(false);
  }, []);

  const toggleBiometric = useCallback(async () => {
    const next = !biometricEnabled;
    await AsyncStorage.setItem(BIOMETRIC_KEY, String(next));
    setBiometricEnabled(next);
  }, [biometricEnabled]);

  const setSheetsUrl = useCallback(async (url: string) => {
    await AsyncStorage.setItem(SHEETS_URL_KEY, url.trim());
    setSheetsUrlState(url.trim());
  }, []);

  const unlock = useCallback(
    (code: string) => {
      if (code === passcode) {
        setIsLocked(false);
        return true;
      }
      return false;
    },
    [passcode]
  );

  const unlockWithBiometric = useCallback(async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock Money Manager",
        fallbackLabel: "Use Passcode",
      });
      if (result.success) {
        setIsLocked(false);
        return true;
      }
    } catch {}
    return false;
  }, []);

  const lockApp = useCallback(() => {
    if (passcode) setIsLocked(true);
  }, [passcode]);

  return (
    <AppSecurityContext.Provider
      value={{
        isLocked,
        isLoaded,
        passcode,
        biometricEnabled,
        biometricAvailable,
        sheetsUrl,
        setPasscode,
        toggleBiometric,
        setSheetsUrl,
        unlock,
        unlockWithBiometric,
        lockApp,
      }}
    >
      {children}
    </AppSecurityContext.Provider>
  );
}

export function useAppSecurity() {
  const ctx = useContext(AppSecurityContext);
  if (!ctx) throw new Error("useAppSecurity must be used within AppSecurityProvider");
  return ctx;
}
