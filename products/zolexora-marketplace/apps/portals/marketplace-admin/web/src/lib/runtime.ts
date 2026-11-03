/** Runtime configuration, read from the environment (Infisical) by the server on each request. */
export interface RuntimeConfig {
  apiUrl: string;
  authServiceUrl: string;
  turnstileSiteKey: string;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not set (Infisical /Zolexora_Marketplace)`);
  return value;
}

export function readRuntimeConfig(): RuntimeConfig {
  return {
    apiUrl: required("MARKETPLACE_API_URL"),
    authServiceUrl: required("AUTH_SERVICE_PUBLIC_URL"),
    turnstileSiteKey: required("TURNSTILE_SITE_KEY"),
  };
}

let current: RuntimeConfig | null = null;
export function setRuntimeConfig(config: RuntimeConfig) {
  current = config;
}
export function runtimeConfig(): RuntimeConfig {
  if (!current) throw new Error("Runtime config not loaded");
  return current;
}
