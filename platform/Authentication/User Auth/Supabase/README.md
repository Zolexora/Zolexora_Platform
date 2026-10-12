# Zolexora User Auth Supabase

Reusable Supabase Auth client helpers for Zolexora web, server-rendered, and React Native apps. Add `@zolexora/user-auth-supabase` as a `workspace:*` dependency.

```ts
import { createSupabaseAuthClient, supabaseAuth } from "@zolexora/user-auth-supabase";

const client = createSupabaseAuthClient({
  url: process.env.EXPO_PUBLIC_SUPABASE_URL!,
  publishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
});
const { session, user } = await supabaseAuth.signInWithPassword(client, email, password);
```

Use `@zolexora/user-auth-supabase/native` with an `AuthStorage` adapter from SecureStore or AsyncStorage for native apps. Use `@zolexora/user-auth-supabase/ssr` for cookie-based server rendering; its server factory accepts the framework's cookie adapter.

Only use the project URL and publishable key in clients. Never place a `service_role` key in browser or mobile builds. The consuming backend must validate Supabase access tokens and enforce its own roles and permissions. Auth user metadata is user-controlled and must not grant authorization.

Configure email, OAuth providers, redirect URLs, and deep-link schemes in the Supabase project and consuming app. This package does not create or modify a Supabase project.
