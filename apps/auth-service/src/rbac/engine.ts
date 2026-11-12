// Effective permissions (ADR 0005 §3):
//   access = business role + one role per product + extra grants − blocks; the owner has everything.
// Pure function: the store loads the rows, this decides. Every permission carries its reasons ("explain access").
import {
  BUILT_IN_GRANTS, BuiltInOrgRole, COMMON_PERMISSIONS, MFA_GATED, ORG_PERMISSIONS, OWNER_ONLY,
  isCommonPermission, isOrgPermission, permissionPrefix,
} from "./permissions.js";

export interface RoleRow {
  id: string;
  scope: string; // "org" or product key
  key: string;
  name: string;
  built_in: boolean;
  disabled: boolean;
  /** Custom roles: grants. Built-in business roles: the business's blocks. */
  rules: { permission_key: string; effect: "grant" | "block" }[];
}

export interface AccessInput {
  memberActive: boolean;
  orgActive: boolean;
  orgRole: RoleRow | null;
  productRoles: RoleRow[]; // at most one per product
  overrides: { permission_key: string; effect: "grant" | "block" }[];
  /** Live product permission keys (active or awaiting removal approval). */
  catalog: Set<string>;
  mfaPolicy: "off" | "optional" | "required";
  mfaEnrolled: boolean;
}

export interface Access {
  isOwner: boolean;
  orgRoleKey: string | null;
  permissions: Set<string>;
  /** permission → why it is granted or withheld */
  explain: Record<string, string[]>;
  /** Business requires MFA for this person's sensitive permissions, and they have not set it up. */
  mfaSetupRequired: boolean;
}

/** Permissions that need MFA when the business requires it (ADR 0005 §6.5). */
export const MFA_SENSITIVE = ["org:team:manage", "org:roles:manage", "org:access:override", "org:security:manage", "org:payouts:manage", "org:ownership:transfer", "org:business:close"];

export function computeAccess(a: AccessInput): Access {
  const explain: Record<string, string[]> = {};
  const why = (p: string, reason: string) => (explain[p] ??= []).push(reason);
  const granted = new Set<string>();
  const add = (p: string, reason: string) => {
    granted.add(p);
    why(p, reason);
  };
  const empty = (reason: string): Access => ({ isOwner: false, orgRoleKey: a.orgRole?.key ?? null, permissions: new Set(), explain: { "*": [reason] }, mfaSetupRequired: false });

  if (!a.orgActive) return empty("business is not active");
  if (!a.memberActive) return empty("membership is suspended");
  const role = a.orgRole && !a.orgRole.disabled ? a.orgRole : null;
  const isOwner = !!role && role.built_in && role.key === "owner";

  const validProductKey = (p: string, scope?: string) =>
    a.catalog.has(p) && (scope === undefined || permissionPrefix(p) === scope);

  if (isOwner) {
    for (const p of [...Object.keys(ORG_PERMISSIONS), ...Object.keys(COMMON_PERMISSIONS), ...a.catalog]) add(p, "owner");
    return { isOwner: true, orgRoleKey: "owner", permissions: granted, explain, mfaSetupRequired: false };
  }

  // 1. Business role
  if (role) {
    if (role.built_in) {
      const blocked = new Set(role.rules.filter((r) => r.effect === "block").map((r) => r.permission_key));
      for (const p of BUILT_IN_GRANTS[role.key as BuiltInOrgRole] ?? []) {
        if (blocked.has(p)) why(p, `blocked in role ${role.name} for this business`);
        else add(p, `role ${role.name}`);
      }
    } else {
      for (const r of role.rules) {
        if (r.effect !== "grant") continue;
        const p = r.permission_key;
        if (OWNER_ONLY.includes(p)) why(p, "owner only");
        else if (p === MFA_GATED && a.mfaPolicy !== "required") why(p, `role ${role.name}: needs the business to require MFA`);
        else if (isOrgPermission(p) || isCommonPermission(p)) add(p, `role ${role.name}`);
      }
    }
  } else if (a.orgRole?.disabled) {
    why("*", `role ${a.orgRole.name} is disabled`);
  }

  // 2. One role per product
  for (const pr of a.productRoles) {
    if (pr.disabled) {
      why(`${pr.scope}:*`, `role ${pr.name} is disabled`);
      continue;
    }
    for (const r of pr.rules) {
      if (r.effect !== "grant") continue;
      if (validProductKey(r.permission_key, pr.scope) || isCommonPermission(r.permission_key)) add(r.permission_key, `${pr.scope} role ${pr.name}`);
    }
  }

  // 3. Extra grants, then blocks (a block always wins)
  for (const o of a.overrides) {
    if (o.effect !== "grant") continue;
    const p = o.permission_key;
    if (OWNER_ONLY.includes(p) || p === MFA_GATED) why(p, "cannot be given individually");
    else if (isOrgPermission(p) || isCommonPermission(p) || validProductKey(p)) add(p, "extra grant");
  }
  for (const o of a.overrides) {
    if (o.effect !== "block") continue;
    granted.delete(o.permission_key);
    why(o.permission_key, "blocked for this person");
  }

  // 4. MFA rule: sensitive permissions wait until MFA is set up
  let mfaSetupRequired = false;
  if (a.mfaPolicy === "required" && !a.mfaEnrolled) {
    for (const p of MFA_SENSITIVE) {
      if (granted.delete(p)) {
        why(p, "withheld until MFA is set up (business requires MFA)");
        mfaSetupRequired = true;
      }
    }
  }

  return { isOwner: false, orgRoleKey: role?.key ?? null, permissions: granted, explain, mfaSetupRequired };
}

/** Permissions to put in a token for one product: business-level, common, and that product's own keys. */
export function scopeToProduct(perms: Set<string>, product?: string | null): string[] {
  return [...perms].filter((p) => {
    const prefix = permissionPrefix(p);
    return prefix === "org" || prefix === "common" || (!!product && prefix === product);
  }).sort();
}
