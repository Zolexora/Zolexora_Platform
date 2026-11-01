function withFirebaseNativeAuth(config) {
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON;
  const googleServiceInfoFile = process.env.GOOGLE_SERVICE_INFO_PLIST;
  const plugins = [...(config.plugins || [])];

  for (const plugin of ["@react-native-firebase/app", "@react-native-firebase/auth"]) {
    if (!plugins.some((entry) => (Array.isArray(entry) ? entry[0] : entry) === plugin)) {
      plugins.push(plugin);
    }
  }

  const platform = process.env.EAS_BUILD_PLATFORM;
  if (process.env.EAS_BUILD && ((platform === "android" && !googleServicesFile) || (platform === "ios" && !googleServiceInfoFile))) {
    throw new Error("Set the matching Firebase file variable: GOOGLE_SERVICES_JSON for Android or GOOGLE_SERVICE_INFO_PLIST for iOS.");
  }

  return {
    ...config,
    android: {
      ...config.android,
      ...(googleServicesFile ? { googleServicesFile } : {}),
    },
    ios: {
      ...config.ios,
      ...(googleServiceInfoFile ? { googleServicesFile: googleServiceInfoFile } : {}),
    },
    plugins,
  };
}

module.exports = { withFirebaseNativeAuth };
