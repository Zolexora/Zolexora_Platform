# Zolexora User Auth Firebase

Reusable Firebase Authentication client module for Zolexora applications. Add
`@zolexora/user-auth-firebase` as a workspace dependency, then import the
platform entry point:

```ts
import { getWebFirebaseAuth, webAuth } from "@zolexora/user-auth-firebase/web";
import { exchangeFirebaseToken } from "@zolexora/user-auth-firebase/session";
```

Expo native applications use `@zolexora/user-auth-firebase/native` and can use
the shared sign-in + Marketplace session flow:

```ts
import { createNativeMarketplaceAuth } from "@zolexora/user-auth-firebase/native";

const auth = createNativeMarketplaceAuth({
  apiBaseUrl: process.env.EXPO_PUBLIC_API_URL!,
  allowBuyerRegistration: true, // false for seller/admin clients
});
const session = await auth.signInWithEmail(email, password);
// Persist session.session_token using expo-secure-store.
```

The app must include the React Native Firebase app/auth config plugins and
Firebase's platform configuration files. Email/password, Google credentials, and phone
verification are handled by Firebase. After sign-in, send the Firebase ID token
to `exchangeFirebaseToken`; the API verifies it and returns the consuming
product's session. Native callers store only that opaque session in
`expo-secure-store`. Browser callers use the API's host-only HttpOnly cookie.

## Configuration

Web apps provide their Firebase web app configuration through their existing
`NEXT_PUBLIC_FIREBASE_*` or equivalent public build variables. Native builds
provide `GOOGLE_SERVICES_JSON` and `GOOGLE_SERVICE_INFO_PLIST` as build-time
file paths. Expo Google sign-in uses `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`,
`EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`, and `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`.
Keep the platform files and any server credentials outside source control.

This module does not decide Marketplace roles, seller access, admin permissions,
or application data ownership. The consuming API remains authoritative for
those decisions. Do not share web cookies across domains or use this module to
connect Marketplace identity to Zolexora ERP.
