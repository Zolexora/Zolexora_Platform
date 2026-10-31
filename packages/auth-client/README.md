# @zolexora/auth-client

Universal Authentication Client SDK for Zolexora Platform, supporting Next.js 14/15 App Router, React 18/19, Vite, and Node.js.

## Subpath Exports

- `@zolexora/auth-client` — Types, constants, environment resolver, Crockford ID utilities
- `@zolexora/auth-client/react` — React hooks (`useAuth`, `useUser`, `useOrganization`) and `ZolexoraAuthProvider`
- `@zolexora/auth-client/client` — `zolexoraFetch` auto-refresh HTTP client with single-flight mutex
- `@zolexora/auth-client/turnstile` — `TurnstileWidget` component and `useTurnstile` hook
