export default {
  expo: {
    name: 'IronClub Member Pass',
    slug: 'ironclub-member-mobile',
    version: '1.0.0',
    orientation: 'portrait',
    userInterfaceStyle: 'dark',
    icon: './assets/icon.png',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#030712',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'io.zolexora.ironclub.member',
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#F59E0B',
      },
      package: 'io.zolexora.ironclub.member',
    },
    web: {
      favicon: './assets/favicon.png',
    },
    assetBundlePatterns: ['**/*'],
    extra: {
      apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:4060',
    },
  },
};
