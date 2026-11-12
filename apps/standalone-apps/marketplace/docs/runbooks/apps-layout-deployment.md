# Deploying after the apps layout change

The product folder moved from `apps/core-platform/zolexora-shop` to `apps/standalone-apps/marketplace`, and its apps moved from `apps/storefronts/…` and `apps/portals/…` to `apps/web/<app>`, `apps/mobile/<app>` and `apps/admin`. Package names, ports, bundle IDs, EAS project IDs and environment variable names did not change. The repository is complete; the settings below live outside it and must be changed by someone with access.

## Vercel: Root Directory

Each Next.js app keeps its own `vercel.json`, so each Vercel project's **Root Directory** is the app folder.

| Vercel project (package) | Old Root Directory | New Root Directory |
| --- | --- | --- |
| `@zolexora/shop-web` | `apps/core-platform/zolexora-shop/apps/storefronts/zolexora-shop/web` | `apps/standalone-apps/marketplace/apps/web/shop` |
| `@zolexora/shop-seller-web` | `apps/core-platform/zolexora-shop/apps/portals/seller/web` | `apps/standalone-apps/marketplace/apps/web/seller` |
| `@zolexora/shop-admin` | `apps/core-platform/zolexora-shop/apps/portals/marketplace-admin/web` | `apps/standalone-apps/marketplace/apps/admin` |

Change nothing else: build and install commands come from each `vercel.json`, and "Include files outside the Root Directory" stays on.

### When to change it

Root Directory is one setting per project, shared by production and every preview branch, so there is no moment when both layouts build. Production must never be the side that breaks:

1. **Before merge — change nothing.** Preview deployments of this branch fail with a missing Root Directory. That is expected; production keeps building from `main`.
2. **Merge to `main`.**
3. **Right after merge**, set the new Root Directory on all three projects, then redeploy the latest `main` commit of each.
   If the merge's automatic production build starts first, it fails. A failed Vercel build never replaces the live deployment, so the sites keep serving the previous version; there is no downtime.
4. Branches created before the move fail their preview builds until they are rebased onto `main`.

Check: each production deployment is from the merge commit or later, and the site loads.

## EAS (Expo)

EAS stores no repository path: `eas build` uses the folder it is run from, and the project ID stays in each `app.json`. The move needs no EAS setting change, except:

- If an Expo project uses **Build from GitHub** (expo.dev → project → GitHub), set its base directory to the new app folder.

Validate from each app folder, logged in with `eas login`:

```bash
cd apps/standalone-apps/marketplace/apps/mobile/shop     # then apps/mobile/seller
npx eas-cli build:inspect --platform android --profile preview --stage archive --output "$(mktemp -d)"
npx eas-cli build --platform android --profile preview
```

`build:inspect --stage archive` shows the exact files EAS would upload without using a build; the preview build proves the full pipeline.

Known before the move, not caused by it:

- **Mahila Madel mobile** has a placeholder EAS project ID (`11111111-2222-…`) and cannot be built on EAS until a real project is created.
- **`expo export` fails locally for all three mobile apps** with a React Native codegen error in `react-native-screens@4.27.0` (`The first argument of method blur must be of type React.ElementRef<>`). EAS builds are likely to hit the same error until the dependency is fixed.
