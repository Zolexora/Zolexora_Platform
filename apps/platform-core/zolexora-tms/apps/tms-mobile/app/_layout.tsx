import React from 'react';
import '../src/lib/backgroundLocationTask';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../src/context/AuthContext';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { OpsToastBanner } from '../src/components/OpsToastBanner';
import { OpsWebSocketGate } from '../src/components/OpsWebSocketGate';
import { theme } from '../src/lib/theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 30, // 30 seconds
    },
  },
});

export default function RootLayout() {
  return (
    <ErrorBoundary fallbackLabel="Zolexora TMS hit an unexpected error">
      <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <OpsWebSocketGate />
          <OpsToastBanner />
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerStyle: {
                backgroundColor: theme.colors.surface,
              },
              headerTintColor: theme.colors.textPrimary,
              headerTitleStyle: {
                fontWeight: '700',
              },
              contentStyle: {
                backgroundColor: theme.colors.background,
              },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen
              name="duty/[id]"
              options={{ title: 'Duty Details', headerBackTitle: 'Back' }}
            />
            <Stack.Screen
              name="duty/passenger-trip"
              options={{ title: 'Your Trip', headerBackTitle: 'Back' }}
            />
            <Stack.Screen
              name="duty/start-trip/[id]"
              options={{ title: 'Start Trip', headerBackTitle: 'Back' }}
            />
            <Stack.Screen
              name="duty/complete-trip/[trip_id]"
              options={{ title: 'Complete Trip', headerBackTitle: 'Back' }}
            />
            <Stack.Screen
              name="expense/log"
              options={{ title: 'Log Expense', headerBackTitle: 'Back', presentation: 'modal' }}
            />
            <Stack.Screen
              name="vehicle/[id]"
              options={{ title: 'Vehicle Details', headerBackTitle: 'Back' }}
            />
            <Stack.Screen
              name="dispatch/assign/[duty_id]"
              options={{ title: 'Assign Duty', headerBackTitle: 'Back' }}
            />
            <Stack.Screen
              name="booking/new"
              options={{ title: 'New Booking Request', headerBackTitle: 'Back' }}
            />
          </Stack>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
    </ErrorBoundary>
  );
}
