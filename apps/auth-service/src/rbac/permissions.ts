// Business-level (org:…) and shared (common:…) permissions are defined here, in code, reviewed in git (ADR 0005 §2).
// Product permissions (tms:…, marketplace:…) are registered by each product through the catalog API.

export const ORG_PERMISSIONS = {
  "org:profile:view": "View the business profile",
  "org:profile:edit": "Edit the business profile",
  "org:team:view": "View the team",
  "org:team:invite": "Invite people",
  "org:team:manage": "Change roles, suspend and remove people",
  "org:roles:manage": "Create, edit and disable roles",
  "org:roles:assign": "Assign product roles to people",
  "org:access:override": "Give or block individual permissions",
  "org:verification:view": "View verification status",
  "org:verification:submit": "Submit verification details and documents",
  "org:payouts:manage": "Add and change payout accounts",
  "org:security:manage": "Business security settings (MFA rules)",
  "org:ownership:transfer": "Transfer ownership",
  "org:business:close": "Close the business",
} as const;

export const COMMON_PERMISSIONS = {
  "common:billing:view": "See plans and invoices",
  "common:billing:manage": "Change plans and payment methods",
} as const;

export type OrgPermission = keyof typeof ORG_PERMISSIONS;

/** Never held by anyone but an owner, whatever roles or grants say. */
export const OWNER_ONLY: readonly string[] = ["org:ownership:transfer", "org:business:close"];
/** May go to a custom business role only when the business requires MFA, and needs a fresh MFA code to use. */
export const MFA_GATED = "org:payouts:manage";

export const BUILT_IN_ORG_ROLES = ["owner", "admin", "manager", "member"] as const;
export type BuiltInOrgRole = (typeof BUILT_IN_ORG_ROLES)[number];

const ALL_ORG = Object.keys(ORG_PERMISSIONS);

/** The table approved in ADR 0005 §3. */
export const BUILT_IN_GRANTS: Record<BuiltInOrgRole, readonly string[]> = {
  owner: [...ALL_ORG, ...Object.keys(COMMON_PERMISSIONS)],
  admin: ALL_ORG.filter((p) => !["org:payouts:manage", "org:ownership:transfer", "org:business:close"].includes(p)),
  manager: ["org:profile:view", "org:team:view", "org:team:invite", "org:roles:assign", "org:verification:view"],
  member: ["org:profile:view"],
};

const KEY_RE = /^[a-z][a-z0-9_]*:[a-z][a-z0-9_]*:[a-z][a-z0-9_]*$/;
export const isPermissionKey = (k: unknown): k is string => typeof k === "string" && k.length <= 120 && KEY_RE.test(k);
export const permissionPrefix = (k: string) => k.split(":")[0];
export const isOrgPermission = (k: string) => k in ORG_PERMISSIONS;
export const isCommonPermission = (k: string) => k in COMMON_PERMISSIONS;
/** Product keys a product may register: lowercase, not a reserved prefix. */
export const PRODUCT_KEY_RE = /^[a-z][a-z0-9_]{1,30}$/;
export const RESERVED_SCOPES = ["org", "common"];
