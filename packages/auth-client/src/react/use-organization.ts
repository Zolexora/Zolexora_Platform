import { useAuth } from "./use-auth.js";

/**
 * Tenant scoping hook.
 * Returns organization context: org_id, name, role, permissions, and RBAC helpers.
 */
export function useOrganization() {
  const { org, switchOrganization, loading } = useAuth();

  const isCommander =
    org?.role === "owner" ||
    org?.role === "superadmin" ||
    (org?.permissions || []).includes("*");

  const hasPermission = (permission: string): boolean => {
    if (isCommander) return true;
    return (org?.permissions || []).includes(permission);
  };

  return {
    org,
    organization: org,
    orgId: org?.org_id ?? null,
    name: org?.name ?? null,
    role: org?.role ?? null,
    permissions: org?.permissions ?? [],
    isCommander,
    hasPermission,
    switchOrganization,
    isLoaded: !loading,
  };
}
