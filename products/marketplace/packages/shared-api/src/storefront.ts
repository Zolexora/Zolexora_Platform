export const STOREFRONT_KEYS = ["zolexora-shop", "mahila-madel"] as const;
export type StorefrontKey = (typeof STOREFRONT_KEYS)[number];
export const STOREFRONT_HEADER = "X-Storefront-Key" as const;
export type ApplicationSurface = "customer-storefront" | "shared-api" | "seller-portal" | "marketplace-admin";

export interface PublicStorefrontResponse {
  key: StorefrontKey;
  display_name: string;
  canonical_host: string;
  currency: string;
  locale: string;
}

export function isStorefrontKey(value: unknown): value is StorefrontKey {
  return typeof value === "string" && STOREFRONT_KEYS.some((key) => key === value);
}

export function parsePublicStorefront(value: unknown): PublicStorefrontResponse {
  if (!value || typeof value !== "object") throw new Error("Invalid storefront response");
  const candidate = value as Record<string, unknown>;
  if (!isStorefrontKey(candidate.key) || !["display_name", "canonical_host", "currency", "locale"].every(
    (field) => typeof candidate[field] === "string" && candidate[field] !== ""
  )) throw new Error("Invalid storefront response");
  return {
    key: candidate.key,
    display_name: candidate.display_name as string,
    canonical_host: candidate.canonical_host as string,
    currency: candidate.currency as string,
    locale: candidate.locale as string,
  };
}
