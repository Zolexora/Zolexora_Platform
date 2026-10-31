import { execFile } from "node:child_process";
import { promisify } from "node:util";
import dotenv from "dotenv";

const execFileAsync = promisify(execFile);

export type SecretsSyncStatus = "connected" | "environment_fallback" | "offline_fallback" | "disabled";
export type SecretsProvider = "infisical_cli" | "infisical_cloud_api" | "process_environment" | "mock_defaults";

export interface SecretsDiagnostics {
  status: SecretsSyncStatus;
  provider: SecretsProvider;
  workspaceId: string;
  environment: string;
  secretsPath: string;
  syncedCount: number;
  timestamp: string;
  durationMs: number;
  diagnostics: string[];
  missingCriticalKeys: string[];
}

export interface SyncOptions {
  workspaceId?: string;
  environment?: string;
  secretsPath?: string;
  siteUrl?: string;
  timeoutMs?: number;
  forceFallback?: boolean;
}

export const SECRET_ALIASES: Record<string, string[]> = {
  AUTH_DATABASE_URL: [
    "ZOLEXORA_AUTHENTICATION_DATABASE_URL",
    "DATABASE_URL",
  ],
  ADMIN_DATABASE_URL: [
    "ZOLEXORA_AUTHENTICATION_INTERNAL_DATABASE_URL",
    "ZOLEXORA_ADMIN_DATABASE_URL",
  ],
  SESSION_SECRET: [
    "ZOLEXORA_AUTHENTICATION_SECRET_KEY",
    "ZOLEXORA_AUTHENTICATION_INTERNAL_SECRET_KEY",
    "JWT_SECRET",
  ],
  TURNSTILE_SECRET_KEY: [
    "CF_TURNSTILE_SECRET_KEY",
    "CLOUDFLARE_TURNSTILE_SECRET_KEY",
  ],
  FIREBASE_PROJECT_ID: [
    "ZOLEXORA_FIREBASE_PROJECT_ID",
  ],
  FIREBASE_CLIENT_EMAIL: [
    "ZOLEXORA_FIREBASE_CLIENT_EMAIL",
  ],
  FIREBASE_PRIVATE_KEY: [
    "ZOLEXORA_FIREBASE_KEY_FILE",
    "ZOLEXORA_FIREBASE_PRIVATE_KEY",
  ],
  CLOUDINARY_CLOUD_NAME: [
    "ZOLEXORA_CLOUDINARY_CLOUD_NAME",
  ],
  CLOUDINARY_API_KEY: [
    "ZOLEXORA_CLOUDINARY_API_KEY",
  ],
  CLOUDINARY_API_SECRET: [
    "ZOLEXORA_CLOUDINARY_API_SECRET",
  ],
  RESEND_API_KEY: [
    "ZOLEXORA_PRODUCTION_RESEND_API_KEY",
    "ZOLEXORA_RESEND_API_KEY",
  ],
  AUTH_FROM_EMAIL: [
    "ZOLEXORA_AUTH_FROM_EMAIL",
  ],
};

const CRITICAL_KEYS = [
  "AUTH_DATABASE_URL",
  "ADMIN_DATABASE_URL",
  "SESSION_SECRET",
  "TURNSTILE_SECRET_KEY",
  "FIREBASE_PROJECT_ID",
];

const _secretsCache: Map<string, string> = new Map();
let _lastDiagnostics: SecretsDiagnostics = {
  status: "environment_fallback",
  provider: "process_environment",
  workspaceId: "188824cd-59ce-468f-b60f-f2da7aeefe63",
  environment: "dev",
  secretsPath: "/",
  syncedCount: 0,
  timestamp: new Date().toISOString(),
  durationMs: 0,
  diagnostics: ["Initial un-synchronized state"],
  missingCriticalKeys: [],
};

export function resolveAliases(): void {
  for (const [canonicalKey, aliases] of Object.entries(SECRET_ALIASES)) {
    if (!process.env[canonicalKey] || process.env[canonicalKey]?.trim() === "") {
      for (const alias of aliases) {
        const val = process.env[alias] || _secretsCache.get(alias);
        if (val && val.trim() !== "") {
          process.env[canonicalKey] = val;
          break;
        }
      }
    }
  }
}

export function getSecret(key: string, defaultValue?: string): string | undefined {
  if (_secretsCache.has(key)) {
    return _secretsCache.get(key);
  }
  if (process.env[key]) {
    return process.env[key];
  }
  const aliases = SECRET_ALIASES[key] || [];
  for (const alias of aliases) {
    if (_secretsCache.has(alias)) return _secretsCache.get(alias);
    if (process.env[alias]) return process.env[alias];
  }
  return defaultValue;
}

export function getSecretsDiagnostics(): SecretsDiagnostics {
  return { ..._lastDiagnostics };
}

async function tryCliSync(
  workspaceId: string,
  environment: string,
  secretsPath: string,
  timeoutMs: number,
  diagnostics: string[]
): Promise<number | null> {
  try {
    const args = [
      "export",
      `--projectId=${workspaceId}`,
      `--env=${environment}`,
      `--path=${secretsPath}`,
      "--format=json",
    ];

    const { stdout } = await execFileAsync("infisical", args, {
      timeout: timeoutMs,
      env: process.env,
    });

    const parsed = JSON.parse(stdout);
    if (Array.isArray(parsed)) {
      let count = 0;
      for (const item of parsed) {
        if (item && item.key && item.value !== undefined) {
          _secretsCache.set(item.key, item.value);
          process.env[item.key] = item.value;
          count++;
        }
      }
      diagnostics.push(
        `[SUCCESS] Infisical CLI synchronized ${count} secrets from workspace '${workspaceId}' (${environment}:${secretsPath}).`
      );
      return count;
    }
  } catch (err: any) {
    if (err.killed || err.code === "ETIMEDOUT") {
      diagnostics.push(`[WARN] Infisical CLI export timed out after ${timeoutMs}ms.`);
    } else {
      diagnostics.push(`[WARN] Infisical CLI export unavailable: ${err.message || String(err)}`);
    }
  }
  return null;
}

async function tryRestApiSync(
  workspaceId: string,
  environment: string,
  secretsPath: string,
  siteUrl: string,
  timeoutMs: number,
  diagnostics: string[]
): Promise<number | null> {
  const token = process.env.INFISICAL_TOKEN;
  const clientId = process.env.INFISICAL_CLIENT_ID;
  const clientSecret = process.env.INFISICAL_CLIENT_SECRET;

  let accessToken = token;

  if (!accessToken && clientId && clientSecret) {
    try {
      const loginRes = await fetch(`${siteUrl}/api/v1/auth/universal-auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, clientSecret }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (loginRes.ok) {
        const loginData = (await loginRes.json()) as any;
        accessToken = loginData.accessToken;
        diagnostics.push("[INFO] Authenticated via Infisical Universal Auth.");
      } else {
        diagnostics.push(`[WARN] Universal Auth failed with HTTP ${loginRes.status}`);
      }
    } catch (e: any) {
      diagnostics.push(`[WARN] Universal Auth login error: ${e.message}`);
    }
  }

  if (accessToken) {
    try {
      const url = new URL(`${siteUrl}/api/v3/secrets/raw`);
      url.searchParams.set("workspaceId", workspaceId);
      url.searchParams.set("environment", environment);
      url.searchParams.set("secretPath", secretsPath);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (res.ok) {
        const payload = (await res.json()) as any;
        const secrets = payload.secrets || [];
        let count = 0;
        for (const s of secrets) {
          if (s.secretKey && s.secretValue !== undefined) {
            _secretsCache.set(s.secretKey, s.secretValue);
            process.env[s.secretKey] = s.secretValue;
            count++;
          }
        }
        diagnostics.push(`[SUCCESS] Infisical Cloud REST API synchronized ${count} secrets.`);
        return count;
      } else {
        diagnostics.push(`[WARN] Infisical Cloud REST API returned HTTP ${res.status}`);
      }
    } catch (e: any) {
      diagnostics.push(`[WARN] Infisical REST API request failed: ${e.message}`);
    }
  }
  return null;
}

export async function syncSecretsFromInfisical(options: SyncOptions = {}): Promise<SecretsDiagnostics> {
  const startTime = Date.now();
  const diagnostics: string[] = [];

  const workspaceId = options.workspaceId || process.env.INFISICAL_WORKSPACE_ID || "188824cd-59ce-468f-b60f-f2da7aeefe63";
  let environment = options.environment || process.env.INFISICAL_ENV || process.env.NODE_ENV || "dev";
  if (environment === "development") environment = "dev";
  const secretsPath = options.secretsPath || process.env.INFISICAL_SECRETS_PATH || "/";
  const siteUrl = (options.siteUrl || process.env.INFISICAL_SITE_URL || "https://app.infisical.com").replace(/\/$/, "");
  const timeoutMs = options.timeoutMs ?? 3000;

  dotenv.config();

  // Fast path for test runs unless explicitly forced
  if (
    (process.env.NODE_ENV === "test" && process.env.INFISICAL_FORCE_SYNC !== "true") ||
    process.env.INFISICAL_DISABLE === "true" ||
    options.forceFallback
  ) {
    resolveAliases();
    diagnostics.push("[INFO] Test or local-fallback mode: skipping external Infisical sync.");
    _lastDiagnostics = {
      status: "environment_fallback",
      provider: "process_environment",
      workspaceId,
      environment,
      secretsPath,
      syncedCount: 0,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      diagnostics,
      missingCriticalKeys: [],
    };
    return _lastDiagnostics;
  }

  // 1. Try CLI
  let syncedCount = await tryCliSync(workspaceId, environment, secretsPath, timeoutMs, diagnostics);
  let provider: SecretsProvider = "infisical_cli";
  let status: SecretsSyncStatus = "connected";

  // 2. If CLI failed, try REST API
  if (syncedCount === null) {
    syncedCount = await tryRestApiSync(workspaceId, environment, secretsPath, siteUrl, timeoutMs, diagnostics);
    provider = "infisical_cloud_api";
  }

  // 3. Fallback to process.env and defaults
  if (syncedCount === null) {
    status = "environment_fallback";
    provider = "process_environment";
    diagnostics.push("[NOTICE] Vault unreachable or unauthenticated; engaging structured environment fallback.");
    let envCount = 0;
    for (const key of Object.keys(process.env)) {
      if (process.env[key]) envCount++;
    }
    syncedCount = envCount;
  }

  resolveAliases();

  const missingKeys: string[] = [];
  if (process.env.NODE_ENV === "production") {
    for (const key of CRITICAL_KEYS) {
      if (!process.env[key] || process.env[key]?.trim() === "") {
        missingKeys.push(key);
      }
    }
    if (missingKeys.length > 0) {
      diagnostics.push(`[ERROR] Missing critical configuration keys in production: ${missingKeys.join(", ")}`);
      status = "offline_fallback";
    }
  }

  _lastDiagnostics = {
    status,
    provider,
    workspaceId,
    environment,
    secretsPath,
    syncedCount: syncedCount ?? 0,
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - startTime,
    diagnostics,
    missingCriticalKeys: missingKeys,
  };

  return _lastDiagnostics;
}
