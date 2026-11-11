import { useEffect } from "react";
import { Stack, usePathname, useRouter } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Toast from "react-native-toast-message";
import { configureApi } from "@zolexora/shop-shared-api";
import { activeOrganizationId, clearSessionToken, mobileConfig, sessionToken } from "@zolexora/shop-mobile-sign-in";
import { useAuthStore } from "../src/store";
import { authApi, sellerOrgApi } from "../src/lib/api";

configureApi({
  baseURL: mobileConfig().apiUrl,
  getToken: sessionToken,
  onUnauthorized: () => void clearSessionToken(),
  getOrganizationId: activeOrganizationId,
});

export default function RootLayout() {
  const { user, login } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  // Runs on start and after sign-in (the auth screen navigates away from /auth).
  useEffect(() => {
    if (pathname.startsWith("/auth") || pathname.startsWith("/organisations") || user) return;
    (async () => {
      try {
        if (!(await sessionToken())) throw new Error("signed out");
        const me = await authApi.me();
        // Staff act for their linked organisation; owners need an active organisation chosen.
        if (!me.zolexora_org_id) {
          const [orgId, orgs] = await Promise.all([activeOrganizationId(), sellerOrgApi.listMy()]);
          if (!orgs.some((o: any) => o.id === orgId && o.status === "ACTIVE")) { router.replace("/organisations"); return; }
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
        <Stack.Screen name="organisations/index" />
        <Stack.Screen name="product-form/index" options={{ presentation:"modal" }} />
      </Stack>
      <Toast />
    </GestureHandlerRootView>
  );
}
