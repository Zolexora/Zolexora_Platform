import type { StorefrontKey } from "@zolexora/shared-api/storefront";

export const STOREFRONT_KEY = "zolexora-shop" satisfies StorefrontKey;

export function validateStorefrontKey(configured = process.env.EXPO_PUBLIC_STOREFRONT_KEY) {
  if (configured && configured !== STOREFRONT_KEY) {
    throw new Error(`Expected storefront ${STOREFRONT_KEY}, received ${configured}`);
  }
  return STOREFRONT_KEY;
}
