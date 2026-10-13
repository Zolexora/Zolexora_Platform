export type OrganizationRole = "owner" | "admin" | "manager" | "member" | "viewer";

export interface Organization {
  id: string;
  zolexoraOrgId: string;
  slug: string;
  name: string;
  logoUrl?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrganizationMembership {
  id: string;
  organizationId: string;
  zolexoraOrgId: string;
  userId: string;
  zolexoraId: string;
  role: OrganizationRole;
  permissions: string[];
  createdAt: Date;
}

export interface TenantContext {
  tenantId: string;
  zolexoraOrgId: string;
  zolexoraId: string;
  role: OrganizationRole;
  permissions: string[];
}
