/**
 * useUpdateCheck — ClarityFi in-app update checker
 *
 * On mount, hits the GitHub Releases API to compare the latest published
 * version against the bundled app version from app.json.  If a newer
 * release is available it returns `{ available: true, version, downloadUrl }`
 * so the caller can show a non-intrusive banner.
 *
 * No external dependencies — pure React Native + fetch.
 */

import { useEffect, useState } from "react";
import { Platform } from "react-native";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UpdateInfo {
  available: boolean;
  /** Latest version tag on GitHub, e.g. "1.1.0" */
  version: string;
  /** Direct .apk download URL from GitHub Releases */
  downloadUrl: string;
  /** Full GitHub release page URL */
  releasePageUrl: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Bundled app version — matches expo.version in app.json */
const CURRENT_VERSION = "1.0.0";

/**
 * GitHub Releases API endpoint.
 * Returns the latest non-prerelease, non-draft release.
 */
const GITHUB_RELEASES_API =
  "https://api.github.com/repos/Zolexora/Zolexora_Platform/releases/latest";

/**
 * Permanent redirect URL that always points to the latest APK.
 * Used as fallback if the API response doesn't include an APK asset.
 */
const GITHUB_LATEST_APK_URL =
  "https://github.com/Zolexora/Zolexora_Platform/releases/latest/download/ClarityFi-latest-arm64.apk";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Simple semver comparison — returns true when `latest` is strictly
 * greater than `current`.  Handles "clarityfi-v1.2.3" and "v1.2.3" prefixes.
 */
function isNewer(current: string, latest: string): boolean {
  const parse = (v: string) =>
    v
      .replace(/^[^0-9]*/, "") // strip any "clarityfi-v" / "v" prefix
      .split(".")
      .map((n) => parseInt(n, 10) || 0);

  const [ca, cb, cc] = parse(current);
  const [la, lb, lc] = parse(latest);

  if (la !== ca) return la > ca;
  if (lb !== cb) return lb > cb;
  return lc > cc;
}

/** Extract the .apk asset URL from a GitHub release object, if present. */
function extractApkUrl(assets: Array<{ name: string; browser_download_url: string }>): string {
  const apk = assets.find((a) => a.name.endsWith(".apk"));
  return apk?.browser_download_url ?? GITHUB_LATEST_APK_URL;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * @example
 * const update = useUpdateCheck();
 * if (update?.available) {
 *   // show banner
 * }
 */
export function useUpdateCheck(): UpdateInfo | null {
  const [info, setInfo] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    // Update checks only make sense on Android (APK distribution).
    // iOS builds go through the App Store which handles updates automatically.
    if (Platform.OS !== "android") return;

    let cancelled = false;

    async function checkForUpdate() {
      try {
        const res = await fetch(GITHUB_RELEASES_API, {
          headers: {
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
          },
          // Timeout via AbortController — 8 s to avoid blocking startup
          signal: AbortSignal.timeout(8_000),
        });

        if (!res.ok || cancelled) return;

        const data = await res.json();

        const tagName: string = data.tag_name ?? "";
        const assets: Array<{ name: string; browser_download_url: string }> =
          data.assets ?? [];
        const releasePageUrl: string =
          data.html_url ?? "https://github.com/Zolexora/Zolexora_Platform/releases/latest";

        if (!tagName || cancelled) return;

        if (isNewer(CURRENT_VERSION, tagName)) {
          setInfo({
            available: true,
            version: tagName.replace(/^[^0-9]*/, ""),
            downloadUrl: extractApkUrl(assets),
            releasePageUrl,
          });
        }
      } catch {
        // Network errors are silently swallowed — update check is best-effort.
        // Never crash the app or annoy the user because of this.
      }
    }

    // Slight delay so the check doesn't compete with the app's own startup I/O
    const timer = setTimeout(checkForUpdate, 3_000);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  return info;
}
