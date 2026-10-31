import { TURNSTILE_SCRIPT_URL } from "../constants.js";

let scriptPromise: Promise<void> | null = null;

/**
 * Idempotently injects and loads the Cloudflare Turnstile explicit rendering script.
 */
export function loadTurnstileScript(): Promise<void> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.resolve();
  }

  if (window.turnstile) {
    return Promise.resolve();
  }

  if (scriptPromise) {
    return scriptPromise;
  }

  // Check if script tag already exists in document
  const existingScript = document.querySelector<HTMLScriptElement>(
    'script[src*="challenges.cloudflare.com/turnstile"]'
  );

  if (existingScript) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      if (window.turnstile) {
        resolve();
        return;
      }
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("Failed to load Cloudflare Turnstile script")),
        { once: true }
      );
    });
    return scriptPromise;
  }

  scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = TURNSTILE_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.id = "cf-turnstile-script";

    script.onload = () => {
      resolve();
    };

    script.onerror = () => {
      scriptPromise = null; // Allow retry on failure
      reject(
        new Error(
          "Failed to load Cloudflare Turnstile script from challenges.cloudflare.com"
        )
      );
    };

    document.head.appendChild(script);
  });

  return scriptPromise;
}
