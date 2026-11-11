// Runtime configuration from public/env-config.js (window.__ENV__), written from Infisical by
// scripts/web-env-config.sh at container start (or before `pnpm dev`). Nothing is baked into the build.
const env = (typeof window !== 'undefined' && window.__ENV__) || {};

export function config(name) {
  const value = String(env[name] || '').trim();
  if (!value) throw new Error(`${name} is not configured (Infisical /Zolexora_Marketplace)`);
  return value.replace(/\/+$/, '');
}
