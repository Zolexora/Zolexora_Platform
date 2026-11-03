import { getApiClient } from "./client";
import type { User } from "./types";

/**
 * The signed-in user's marketplace profile. Signing in, signing up, passwords, email and
 * phone all belong to the Zolexora auth service (@zolexora/auth-client).
 */
export const profile = {
  me:     ()                                          => getApiClient().get<User>("/users/me").then(r => r.data),
  update: (data: { name?: string; picture?: string }) => getApiClient().put<User>("/users/me", data).then(r => r.data),
};
