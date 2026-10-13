# 12 Zolexora Authentication & Identity Architecture

This document defines the production, backup, and testing authentication systems for the Zolexora Platform, ensuring every user across all products receives a unique platform-wide **Zolexora ID**.

---

## 1. The Three-Tier Auth Strategy

| Auth System | Package | Purpose | Behavior |
| :--- | :--- | :--- | :--- |
| **Primary Production Auth** | `@zolexora/user-auth-firebase` | **Live Production (100%)** | Handles Web & Expo Native apps with Email/Password, Google OAuth, and Phone OTP. |
| **Hot Backup / Failover Auth** | `@zolexora/user-auth-supabase` | **Failover Standby** | **100% API Identical** to Firebase. Swapped with zero code change in apps. |
| **Offline & CI/CD Testing Auth**| `@zolexora/user-auth-zolexora` | **Testing & Local Dev** | Self-hosted PostgreSQL + Resend with `mockEmail: true` for zero-cost offline CI. |

---

## 2. The Universal Zolexora ID (`ZX-XXXX-XXXX-XXXX`)

Every user account created on any product—regardless of whether they sign up via Firebase, Supabase, or the testing harness—is automatically assigned a unique, canonical **Zolexora ID**.

### Specification
* **Format:** `ZX-[4 alphanumeric]-[4 alphanumeric]-[4 alphanumeric]`
* **Alphabet:** Base32 Crockford-inspired (`23456789ABCDEFGHJKLMNPQRSTUVWXYZ`), excluding ambiguous characters (`0`, `O`, `1`, `I`).
* **Example:** `ZX-8K9M-4P2W-7Y3X`
* **Entropy:** Over 12 billion unique possibilities with zero collision probability.

### Helper API in All Packages
```typescript
import { generateZolexoraId, isValidZolexoraId, normalizeZolexoraId } from "@zolexora/user-auth-firebase";

const newId = generateZolexoraId(); // "ZX-4B8T-9M2K-7Y1X"
isValidZolexoraId(newId);           // true
```

---

## 3. Production: Firebase Auth (`@zolexora/user-auth-firebase`)

### Web Implementation (`webAuth`)
```typescript
import { getWebFirebaseAuth, webAuth } from "@zolexora/user-auth-firebase/web";

const auth = getWebFirebaseAuth(firebaseConfig);

// Sign up automatically generates and attaches a Zolexora ID
const { user, idToken, zolexoraId } = await webAuth.createEmailAccount(
  auth,
  "buyer@zolexora.com",
  "SecretPassword123!",
  "Rajesh Kumar"
);

// Sign in returns the user, token, and their Zolexora ID
const session = await webAuth.signInWithEmail(auth, "buyer@zolexora.com", "SecretPassword123!");
```

### Native Expo Implementation (`nativeAuth`)
```typescript
import { createNativeMarketplaceAuth } from "@zolexora/user-auth-firebase/native";

const native = createNativeMarketplaceAuth({
  apiBaseUrl: process.env.EXPO_PUBLIC_API_URL!,
  allowBuyerRegistration: true,
});

const session = await native.signInWithEmail("buyer@zolexora.com", "SecretPassword123!");
```

---

## 4. Hot Backup: Supabase Auth (`@zolexora/user-auth-supabase`)

Supabase Auth is configured to be **100% API identical** to Firebase. If Firebase encounters downtime or limits, consumer apps simply switch the import or toggle `AUTH_PROVIDER=supabase`:

```typescript
import { getWebSupabaseAuth, webAuth } from "@zolexora/user-auth-supabase/web";

const client = getWebSupabaseAuth(supabaseConfig);

// Identical method names, arguments, and return types
const { user, idToken, zolexoraId } = await webAuth.createEmailAccount(
  client,
  "buyer@zolexora.com",
  "SecretPassword123!",
  "Rajesh Kumar"
);
```

### Interchangeable Session Exchange
Both packages export an interchangeable `exchangeFirebaseToken` / `exchangeSupabaseToken` helper:
```typescript
import { exchangeFirebaseToken } from "@zolexora/user-auth-firebase/session";
// Or switch to:
// import { exchangeSupabaseToken as exchangeFirebaseToken } from "@zolexora/user-auth-supabase/session";

const session = await exchangeFirebaseToken({
  idToken,
  apiBaseUrl: "https://api.zolexora.com",
  zolexora_id: zolexoraId,
});
```

---

## 5. Testing & Local Dev: Zolexora Auth (`@zolexora/user-auth-zolexora`)

Dedicated for local development and CI/CD pipelines without needing external cloud credentials:
* **Zero External Dependencies:** Runs directly on local PostgreSQL.
* **Offline Mocking:** Setting `mockEmail: true` or `ZOLEXORA_AUTH_MOCK_EMAIL=true` bypasses Resend network calls and enables instant automated testing.
* **Scrypt Security:** Industry-standard password hashing (`N: 32768, r: 8, p: 3`) with SHA-256 digested tokens.
* **Zolexora ID Built-in:** Generates and stores `zolexora_id` on the `zolexora_auth_users` table.

```typescript
import { createZolexoraAuth } from "@zolexora/user-auth-zolexora";

const auth = createZolexoraAuth({
  databaseUrl: process.env.TEST_DATABASE_URL,
  mockEmail: true, // 100% offline testing
});

const user = await auth.signUp("test@zolexora.com", "password123456");
console.log(user.zolexoraId); // "ZX-9B1D-4F82-C0E1"
```

---

## 6. Organization Multi-Tenancy (`@zolexora/organization-auth`)

Built into [`platform/Authentication/Organization Auth`](file:///workspaces/Zolexora_Platform/platform/Authentication/Organization%20Auth) to provide reusable RBAC and tenancy models across products:
* **Unique Organization ID:** Generates `ZX-ORG-XXXX-XXXX-XXXX` for every organization/workspace.
* **Role Hierarchy:** `owner` > `admin` > `manager` > `member` > `viewer`.
* **PostgreSQL Schema:** Ready-to-apply `zolexora_organizations` and `zolexora_organization_memberships` tables.
