# Platform modules

Reusable packages for applications in this repository live here. Add a package
as a `workspace:*` dependency from a consumer app and keep product-specific
roles, sessions, and data rules in that product's backend.

## Zolexora User Auth Firebase

See [`zolexora-user-auth-firebase`](<./Authentication/User Auth/Firebase/README.md>) for
web and Expo usage, Firebase configuration, session exchange, and security
boundaries.

The sibling [`Supabase` package](<./Authentication/User Auth/Supabase/README.md>) provides
Supabase Auth helpers for browser, SSR, and native apps.

[`Zolexora User Auth`](<./Authentication/User Auth/Zolexora/README.md>) provides
server-side email/password authentication with Resend for verification and reset emails.
