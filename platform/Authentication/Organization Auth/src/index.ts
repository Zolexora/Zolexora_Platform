export * from "./types";
export * from "./org-id";

/**
 * Validates whether a membership has a required permission.
 */
export function hasPermission(permissions: string[], required: string): boolean {
  if (permissions.includes("*") || permissions.includes("admin:*")) return true;
  return permissions.includes(required);
}
