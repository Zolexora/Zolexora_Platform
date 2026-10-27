import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../../src/lib/theme';

function TabIcon({ focused, icon, label }: { focused: boolean; icon: string; label: string }) {
  return (
    <View style={[styles.tabItem, focused && styles.tabItemActive]}>
      <Text style={[styles.tabIcon, focused && styles.tabIconActive]}>{icon}</Text>
      <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>{label}</Text>
    </View>
  );
}

export default function TabsLayout() {
  return (
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
          title: 'Dashboard',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon="⚡" label="Dashboard" />
          ),
        }}
      />
      <Tabs.Screen
        name="duties"
        options={{
          title: 'My Duties',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon="🚚" label="Duties" />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon="👤" label="Profile" />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
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
    paddingHorizontal: 12,
    borderRadius: theme.radius.sm,
    minWidth: 64,
  },
  tabItemActive: {
    backgroundColor: theme.colors.primaryMuted,
  },
  tabIcon: {
    fontSize: 20,
    opacity: 0.5,
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
