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

## 5. Dual Profiles & Conditional Organization Flow

Zolexora Platform implements a native **Dual Profile Model**:
1. **User Profile (`ZolexoraUserProfile`)**: Individual user identity with canonical ID format `ZX-XXXX-XXXX-XXXX`.
2. **Org Profile (`ZolexoraOrgProfile`)**: Workspace/organization identity with canonical ID format `ZX-ORG-XXXX-XXXX-XXXX`.

### Flow Branching:
- **No Organization Needed (`requiresOrg: false`)**: B2C shoppers, riders, or individual users log in immediately upon Firebase authentication.
- **Organization Required (`requiresOrg: true`)**: B2B enterprise applications (TMS, IMS, ERP, Seller Portal) guide the authenticated user through Organization Setup, where the user continues with just the **Name of Organisation** (`ZX-ORG-XXXX-XXXX-XXXX` is generated automatically).

```tsx
import { ZolexoraAuthCard } from "@zolexora/user-auth-firebase";

// B2B Enterprise App: Requires organization setup
export function EnterpriseLogin() {
  return (
    <ZolexoraAuthCard
      requiresOrg={true}
      onSuccess={({ user, org, token }) => {
        console.log("Logged in User:", user.zolexora_id);
        console.log("Active Organization:", org?.zolexora_org_id, org?.name);
      }}
    />
  );
}

// B2C Consumer App: Immediate login without organization
export function ConsumerLogin() {
  return (
    <ZolexoraAuthCard
      requiresOrg={false}
      onSuccess={({ user, token }) => {
        console.log("Logged in User:", user.zolexora_id);
      }}
    />
  );
}
```

---

## 6. Canonical Zolexora IDs

```ts
import { 
  generateZolexoraId, 
  isValidZolexoraId, 
  generateZolexoraOrgId, 
  isValidZolexoraOrgId 
} from "@zolexora/user-auth-firebase";

// Individual User ID
const userId = generateZolexoraId(); // "ZX-8K9M-4P2W-7Y3X"
isValidZolexoraId(userId); // true

// Organization Workspace ID
const orgId = generateZolexoraOrgId(); // "ZX-ORG-8K9M-4P2W-7Y3X"
isValidZolexoraOrgId(orgId); // true
```

---

## 7. Environment Variables

| Variable | Description |
| :--- | :--- |
| `VITE_FIREBASE_API_KEY` / `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Web API Key |
| `VITE_FIREBASE_AUTH_DOMAIN` / `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `*.firebaseapp.com` auth domain |
| `VITE_FIREBASE_PROJECT_ID` / `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase Project ID |
| `VITE_FIREBASE_APP_ID` / `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase Web App ID |

