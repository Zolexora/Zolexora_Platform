import { useEffect } from "react";
import { Stack, usePathname, useRouter } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Toast from "react-native-toast-message";
import { configureApi } from "@zolexora/marketplace-shared-api";
import { clearSessionToken, mobileConfig, sessionToken, signOut } from "@zolexora/marketplace-mobile-sign-in";
import { useAuthStore } from "../src/store";
import { authApi } from "../src/lib/api";

configureApi({ baseURL: mobileConfig().apiUrl, getToken: sessionToken, onUnauthorized: () => void clearSessionToken() });

export default function RootLayout() {
  const { user, login } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  // Runs on start and after sign-in (the auth screen navigates away from /auth).
  useEffect(() => {
    if (pathname.startsWith("/auth") || user) return;
    (async () => {
      try {
        if (!(await sessionToken())) throw new Error("signed out");
        const me = await authApi.me();
        if (me.role !== "seller") {
          await signOut();
          Toast.show({ type: "info", text1: "Seller access needed", text2: "Complete business verification on the seller website." });
          throw new Error("not a seller");
        }
        login(me);
      } catch {
        router.replace("/auth");
      }
    })();
  }, [pathname, user]);

  return (
    <GestureHandlerRootView style={{ flex:1 }}>
      <Stack screenOptions={{ headerShown:false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth/index" />
        <Stack.Screen name="product-form/index" options={{ presentation:"modal" }} />
      </Stack>
      <Toast />
    </GestureHandlerRootView>
  );
}
