import type { MarketplaceSession, SessionExchangeOptions } from "./types";

/** Exchange a verified Firebase ID token for the consuming product's session. */
export async function exchangeFirebaseToken<User = Record<string, unknown>>(
  options: SessionExchangeOptions,
): Promise<MarketplaceSession<User>> {
  const baseUrl = options.apiBaseUrl.replace(/\/+$/, "");
  if (!baseUrl) throw new Error("An authentication API base URL is required.");

  const response = await fetch(`${baseUrl}/auth/firebase`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(options.native ? { "X-Session-Transport": "native" } : {}),
    },
    credentials: options.native ? "omit" : "include",
    body: JSON.stringify({
      id_token: options.idToken,
      registration_name: options.registrationName,
      allow_buyer_registration: options.allowBuyerRegistration ?? false,
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = typeof body.detail === "string" ? body.detail : "Firebase sign-in failed.";
    throw Object.assign(new Error(detail), { status: response.status, body });
  }
  return body as MarketplaceSession<User>;
}
