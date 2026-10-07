import { useEffect } from "react";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Toast from "react-native-toast-message";
import { useAuthStore } from "../src/store";
import { authApi } from "../src/lib/api";
import { useRouter } from "expo-router";

export default function RootLayout() {
  const { login } = useAuthStore();
  const router = useRouter();
  useEffect(() => {
    (async () => {
      try {
        const user = await authApi.me();
        if (user.role !== "seller" && user.role !== "admin") { router.replace("/auth"); return; }
        await login(user);
      } catch { router.replace("/auth"); }
    })();
  }, []);
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
