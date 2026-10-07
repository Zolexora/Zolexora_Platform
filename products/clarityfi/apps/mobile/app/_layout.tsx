import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import AIChatBubble from "@/components/AIChatBubble";
import DrawerMenu from "@/components/DrawerMenu";
import PasscodeGate from "@/components/PasscodeGate";
import { AppSecurityProvider } from "@/context/AppSecurityContext";
import { DrawerProvider } from "@/context/DrawerContext";
import { FitnessProvider } from "@/context/FitnessContext";
import { GeminiProvider } from "@/context/GeminiContext";
import { LifestyleProvider } from "@/context/LifestyleContext";
import { MoneyProvider } from "@/context/MoneyContext";
import { SectionProvider } from "@/context/SectionContext";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AppSecurityProvider>
            <MoneyProvider>
              <SectionProvider>
                <GeminiProvider>
                  <LifestyleProvider>
                    <DrawerProvider>
                      <GestureHandlerRootView style={{ flex: 1 }}>
                        <KeyboardProvider>
                          <FitnessProvider>
                            <RootLayoutNav />
                            <PasscodeGate />
                            <DrawerMenu />
                            <AIChatBubble />
                          </FitnessProvider>
                        </KeyboardProvider>
                      </GestureHandlerRootView>
                    </DrawerProvider>
                  </LifestyleProvider>
                </GeminiProvider>
              </SectionProvider>
            </MoneyProvider>
          </AppSecurityProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
