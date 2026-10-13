# @zolexora/user-auth-firebase

Unified Firebase Authentication & Identity SDK for the Zolexora Platform.

Designed to integrate into any web app, mobile app, or backend **natively and seamlessly** with the developer experience of **Clerk, Supabase, and Firebase**.

---

## 1. Quick Start: Native React Web Integration

### A. Wrap Your App in `<ZolexoraAuthProvider>`
Zero configuration needed — automatically resolves `VITE_FIREBASE_*`, `NEXT_PUBLIC_FIREBASE_*`, or `FIREBASE_*` environment variables:

```tsx
import { ZolexoraAuthProvider } from "@zolexora/user-auth-firebase";

export function App() {
  return (
    <ZolexoraAuthProvider>
      <Dashboard />
    </ZolexoraAuthProvider>
  );
}
```

### B. Use Native Hooks Anywhere
```tsx
import { 
  useAuth, 
  useUser, 
  useOrganization, 
  SignedIn, 
  SignedOut, 
  Protect, 
  UserButton 
} from "@zolexora/user-auth-firebase";

export function Header() {
  const { isSignedIn, signOut } = useAuth();
  const { user, zolexoraId } = useUser(); // Canonical ZX-XXXX-XXXX-XXXX
  const { activeOrgId, isCommander } = useOrganization();

  return (
    <header className="flex justify-between p-4">
      <SignedOut>
        <a href="/login">Sign In</a>
      </SignedOut>

      <SignedIn>
        <div className="flex items-center gap-4">
          <span>{user?.display_name} ({zolexoraId})</span>

          {/* RBAC Capability Guard */}
          <Protect permission="fleet.trucks.create">
            <button>Add Truck</button>
          </Protect>

          {/* Drop-in User Profile Badge & Sign Out */}
          <UserButton />
        </div>
      </SignedIn>
    </header>
  );
}
```

---

## 2. Universal Authenticated HTTP Client (`zolexoraFetch`)

Zero boilerplate fetch client that automatically attaches the current Firebase ID token and active organization headers:

```ts
import { zolexoraFetch } from "@zolexora/user-auth-firebase";

// Automatically injects:
// Authorization: Bearer <fresh_id_token>
// X-Organisation-ID: <active_org_id>
// X-Zolexora-ID: <zolexora_id>
// Automatically refreshes token on 401
const response = await zolexoraFetch("/api/v1/trips");
```

---

## 3. Direct / Headless Web Usage

```ts
import { getWebFirebaseAuth, webAuth, getIdToken } from "@zolexora/user-auth-firebase";

// Global singleton instance
const auth = getWebFirebaseAuth();

// Direct sign-in actions (auth parameter is optional!)
await webAuth.signInWithEmail("driver@zolexora.com", "SecretPass123!");
await webAuth.signInWithGoogle();
await webAuth.signOut();

// Token helper
const token = await getIdToken();
```

---

## 4. Expo / React Native Mobile Apps

Import directly from `@zolexora/user-auth-firebase/native`:

```ts
import { createNativeMarketplaceAuth, nativeAuth } from "@zolexora/user-auth-firebase/native";

const auth = createNativeMarketplaceAuth({
  apiBaseUrl: process.env.EXPO_PUBLIC_API_URL!,
  allowBuyerRegistration: true,
});

const session = await auth.signInWithEmail(email, password);
// Persist session.session_token using expo-secure-store.
```

---

## 5. Canonical Zolexora ID (`ZX-XXXX-XXXX-XXXX`)

```ts
import { generateZolexoraId, isValidZolexoraId, normalizeZolexoraId } from "@zolexora/user-auth-firebase";

const id = generateZolexoraId(); // "ZX-8K9M-4P2W-7Y3X"
isValidZolexoraId(id); // true
```

---

## 6. Environment Variables

| Variable | Description |
| :--- | :--- |
| `VITE_FIREBASE_API_KEY` / `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Web API Key |
| `VITE_FIREBASE_AUTH_DOMAIN` / `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `*.firebaseapp.com` auth domain |
| `VITE_FIREBASE_PROJECT_ID` / `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase Project ID |
| `VITE_FIREBASE_APP_ID` / `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase Web App ID |
