import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../src/context/AuthContext';
import { PERSONA_META } from '../../src/lib/personas';
import { theme } from '../../src/lib/theme';
import { OfflineBanner } from '../../src/components/OfflineBanner';

function TabIcon({ focused, icon, label }: { focused: boolean; icon: string; label: string }) {
  return (
    <View style={[styles.tabItem, focused && styles.tabItemActive]}>
      <Text style={[styles.tabIcon, focused && styles.tabIconActive]}>{icon}</Text>
      <Text style={[styles.tabLabel, focused && styles.tabLabelActive]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  const { isAuthenticated, isLoading, activeMode } = useAuth();
  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={theme.colors.primaryLight} />
      </View>
    );
  }
  if (!isAuthenticated) return <Redirect href="/(auth)/login" />;

  const meta = PERSONA_META[activeMode];

  return (
    <>
      <OfflineBanner />
      <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTintColor: theme.colors.textPrimary,
        headerTitleStyle: { fontWeight: '700' },
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: meta.title,
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon="⚡" label="Home" />,
        }}
      />
      <Tabs.Screen
        name="duties"
        options={{
          href: meta.showDutiesTab ? '/duties' : null,
          title: activeMode === 'driver' || activeMode === 'driver_vendor' ? 'My Duties' : 'Duties',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon="🚚" label="Duties" />,
        }}
      />
      <Tabs.Screen
        name="workspace"
        options={{
          href: meta.showWorkspaceTab ? '/workspace' : null,
          title: meta.workspaceTabTitle,
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon={meta.workspaceTabIcon} label={meta.workspaceTabTitle} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Account',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon="👤" label="Account" />,
        }}
      />
      </Tabs>
    </>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  tabBar: {
    backgroundColor: theme.colors.surface,
    borderTopColor: theme.colors.border,
    borderTopWidth: 1,
    height: 68,
    paddingBottom: 8,
  },
  tabItem: {
    alignItems: 'center',
    paddingTop: 8,
    paddingHorizontal: 10,
    borderRadius: theme.radius.sm,
    minWidth: 64,
  },
  tabItemActive: {
    backgroundColor: theme.colors.primaryMuted,
  },
  tabIcon: {
    fontSize: 19,
    opacity: 0.55,
  },
  tabIconActive: {
    opacity: 1,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  tabLabelActive: {
    color: theme.colors.primaryLight,
  },
});
