# ADR 0015: Firebase Authentication Provider Bridge

- Status: Accepted
- Date: 2026-08-19

## Context

Zolexora Shop, Mahila Madel, and the seller portal require Email/Password,
Google, and phone sign-in. Marketplace already uses PostgreSQL as the canonical
identity and RBAC authority plus Redis-backed opaque, revocable sessions.
Accepting a browser-supplied Firebase UID, email, role, or storefront would
violate those boundaries.

## Decision

Firebase Authentication is an external identity provider for the three named
web applications only. FastAPI verifies every Firebase ID token using the
configured Firebase project audience and Firebase public signing keys, then
issues the existing opaque Marketplace session. PostgreSQL remains authoritative
for users, roles, seller organizations, storefront grants, and authorization.

`external_identity` records the one-to-one link between a Firebase subject and
a Marketplace user. A new buyer account may be created only from a verified
Firebase email plus an explicit Marketplace profile name. Phone-only Firebase
identities are rejected until linked to that email-backed Firebase account.
Seller and administrator roles are never created or inferred from Firebase;
seller access requires an existing Marketplace seller role and admin remains
outside this Firebase integration.

## Consequences

- Firebase passwords, Google credentials, and SMS verification are not stored
  by Marketplace.
- Firebase ID tokens are verification inputs only; they are not Marketplace
  sessions and do not carry Marketplace authorization.
- Existing accounts link on a verified matching email. Users with legacy local
  passwords need an explicit Firebase enrollment/reset flow.
- Phone Authentication requires Firebase billing and provider activation, and
  its SMS limits/costs are operated in Firebase.

## Related decisions

- ADR 0004: secure session architecture
- ADR 0008: storefront context resolution
