# Product and interface design

## Design objective

Zolexora Shop and Mahila Madel must feel like distinct customer brands while sharing reliable commerce behavior, accessibility, and platform components. Seller and admin experiences are shared operational products and should prioritize clarity over storefront styling.

## Experience surfaces

| Surface | Design character | Primary users |
| --- | --- | --- |
| Zolexora Shop | General marketplace and engagement-led shopping | Customers and reel viewers |
| Mahila Madel | Focused brand storefront; preserve useful visual identity from the current React app | Mahila Madel customers |
| Seller portal | Dense, task-oriented, store-aware operations | Sellers and seller staff |
| Admin panel | Neutral, auditable, cross-store control plane | Operators and administrators |
| Buyer/seller mobile | Native navigation with shared domain behavior | Mobile customers and sellers |

Each customer storefront owns a separately branded mobile binary. Mahila mobile uses text identity until approved icon and splash artwork exists; Zolexora assets must not be substituted. Seller mobile remains brand-neutral and cross-store.

## Shared design system

Build a shared foundation without forcing both storefronts to look identical.

### Shared primitives

- Typography scale, spacing scale, breakpoints, elevation, motion, focus behavior, and accessibility rules.
- Buttons, links, inputs, dialogs, drawers, tables, tabs, badges, alerts, skeletons, and empty states.
- Product price, inventory, address, payment status, order status, shipment timeline, and validation patterns.
- Semantic tokens such as `surface`, `text`, `accent`, `success`, `warning`, `danger`, and `focus`.

### Storefront themes

Brand packages supply logo assets, colors, font choices, imagery rules, border treatment, and editorial components. Themes cannot alter security, checkout validation, required legal copy, accessibility semantics, or payment status meanings.

Storefront selection is derived from the deployed application/host configuration. Do not let a query parameter or local storage value switch payment or data scope.

## Navigation

### Customer storefronts

- Global header: brand, search, account, wishlist if enabled, cart.
- Primary catalog navigation: categories and campaigns supported by that storefront.
- Product journey: discovery, listing, details, cart, checkout, confirmation, order tracking.
- Engagement features such as reels and coins appear only when enabled for that storefront.

### Seller portal

- The current working store context is always visible.
- Cross-store summaries must label each metric and order with its storefront.
- Creating a listing requires explicit store selection from the seller's grants.
- Switching store context must not discard unsaved work without warning.

### Admin panel

- Global views default to an explicit “All storefronts” label.
- Destructive or financial actions show scope, affected storefront, and confirmation.
- Audit and support screens expose correlation IDs and normalized event history without exposing secrets.

## Checkout design rules

1. Display a server-issued quote; never calculate the authoritative total only in the browser.
2. Group subtotal, discounts, coins, tax, shipping, and total consistently.
3. If price or stock changes, show the affected lines and require the user to accept the refreshed quote.
4. Show only payment methods returned as eligible by the backend for this order and storefront.
5. Never display or accept a raw merchant-account selector.
6. Treat “payment initiated,” “payment pending,” “paid,” and “payment failed” as distinct states.
7. After redirect or SDK return, poll or refresh authoritative backend payment status; a client callback alone is not proof of payment.
8. Make duplicate submission safe and show the existing result for an idempotent retry.

## Required UI states

Every networked screen must define:

- Initial loading and background refresh.
- Empty data with a useful next action.
- Validation errors tied to fields.
- Authorization failure without leaking resource existence.
- Offline/timeout and retry behavior.
- Partial failure for provider operations.
- Success confirmation and a stable reference number.

Payment and fulfillment screens additionally need pending, delayed, duplicate-event, refunded, partially refunded, cancelled, and reconciliation-review states as applicable.

## Accessibility

- Target WCAG 2.2 AA for web experiences.
- All interactive controls are keyboard accessible with visible focus.
- Use semantic HTML before ARIA and provide correct labels and error associations.
- Maintain sufficient text, icon, and focus contrast in every brand theme.
- Never communicate order or payment state through color alone.
- Respect reduced-motion preferences.
- Product images have meaningful alternative text; decorative images use empty alt text.
- Dialog focus is trapped and restored correctly.

## Responsive behavior

- Customer checkout is usable at narrow mobile widths without horizontal scrolling.
- Seller/admin tables provide deliberate responsive alternatives, not clipped columns.
- Tap targets are at least 44 by 44 CSS pixels where practical.
- Critical totals and primary actions remain visible and unambiguous.
- Mobile apps use platform secure storage and native deep-link handling for authentication/payment returns.

## Content and naming

- Use “Zolexora Shop” and “Mahila Madel” consistently on customer surfaces.
- Use “Marketplace Admin” for the shared admin surface.
- Replace legacy “ShopKart” copy as Mahila Madel migrates.
- Do not expose internal IDs, provider errors, stack traces, or secret configuration names to customers.
- Dates, currency, tax, returns, and delivery claims must use one centralized formatting and policy layer.

## Design acceptance checklist

- Both storefronts are visually identifiable without changing shared commerce semantics.
- Store context is obvious in seller/admin workflows.
- Checkout only presents server-eligible methods and server totals.
- Loading, empty, error, pending, and success states are designed.
- Keyboard and screen-reader checks pass on core customer flows.
- No demo admin credentials or secrets appear in shipped UI.
