# Zolexora User Auth

Server-side email/password authentication for Zolexora apps. Resend delivers email verification and password reset links; your app supplies persistent storage and creates its own session after `signIn` succeeds.

Install `@zolexora/user-auth-zolexora` and `resend` in a Node.js server app. Keep `RESEND_API_KEY` on the server and configure `from` with an address on a verified Resend domain.

```ts
import { createZolexoraAuth } from "@zolexora/user-auth-zolexora";

const auth = createZolexoraAuth({
  store, // implement ZolexoraAuthStore with your database
  resendApiKey: process.env.RESEND_API_KEY!,
  from: "Zolexora <auth@example.com>",
  appUrl: "https://app.example.com",
});

await auth.signUp(email, password);
await auth.verifyEmail(tokenFromLink);
const user = await auth.signIn(email, password);
// Create your app's secure session for user.id here.
await auth.requestPasswordReset(email);
await auth.resetPassword(tokenFromLink, newPassword);
```

The storage adapter must enforce unique normalized emails, store only password hashes and token hashes, and atomically consume unexpired one-time tokens. Make `updatePassword` invalidate existing sessions if your app stores them. Add rate limits to sign-up, sign-in, verification, and reset endpoints. `requestPasswordReset` intentionally returns the same result whether the account exists. Resend does not provide a user database or session management.
