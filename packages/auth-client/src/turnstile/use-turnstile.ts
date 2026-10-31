import { useState, useRef, useEffect, useCallback } from "react";
import { loadTurnstileScript } from "./loader.js";
import type { TurnstileStatus } from "./types.js";

export interface UseTurnstileOptions {
  siteKey?: string;
  action?: string;
  cData?: string;
  theme?: "light" | "dark" | "auto";
  size?: "normal" | "compact" | "flexible";
  onVerify?: (token: string) => void;
  onError?: (error: string) => void;
  onExpire?: () => void;
}

export interface UseTurnstileReturn {
  token: string | null;
  status: TurnstileStatus;
  error: string | null;
  widgetId: string | null;
  containerRef: React.RefObject<HTMLDivElement | null>;
  reset: () => void;
  execute: () => void;
  render: (targetContainer?: HTMLElement | null) => string | null;
}

/**
 * React hook for programmatic Turnstile widget management and token state.
 */
export function useTurnstile(
  options: UseTurnstileOptions = {}
): UseTurnstileReturn {
  const { siteKey, action, cData, theme, size, onVerify, onError, onExpire } =
    options;

  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<TurnstileStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [widgetId, setWidgetId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);

  const reset = useCallback(() => {
    if (
      widgetIdRef.current &&
      typeof window !== "undefined" &&
      window.turnstile
    ) {
      try {
        window.turnstile.reset(widgetIdRef.current);
      } catch {}
    }
    setToken(null);
    setStatus("ready");
    setError(null);
  }, []);

  const execute = useCallback(() => {
    if (
      containerRef.current &&
      typeof window !== "undefined" &&
      window.turnstile
    ) {
      try {
        window.turnstile.execute(containerRef.current);
      } catch {}
    }
  }, []);

  const renderExplicit = useCallback(
    (targetContainer?: HTMLElement | null): string | null => {
      const container = targetContainer || containerRef.current;
      if (
        !container ||
        typeof window === "undefined" ||
        !window.turnstile ||
        !siteKey
      ) {
        return null;
      }

      if (widgetIdRef.current) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {}
        widgetIdRef.current = null;
      }

      const id = window.turnstile.render(container, {
        sitekey: siteKey,
        action,
        cData,
        theme,
        size,
        callback: (newToken: string) => {
          setToken(newToken);
          setStatus("verified");
          setError(null);
          onVerify?.(newToken);
        },
        "error-callback": (err: any) => {
          const errMsg = typeof err === "string" ? err : "Verification failed";
          setError(errMsg);
          setStatus("error");
          onError?.(errMsg);
        },
        "expired-callback": () => {
          setToken(null);
          setStatus("expired");
          onExpire?.();
        },
      });

      widgetIdRef.current = id;
      setWidgetId(id);
      setStatus("ready");
      return id;
    },
    [siteKey, action, cData, theme, size, onVerify, onError, onExpire]
  );

  useEffect(() => {
    if (!siteKey || typeof window === "undefined") {
      return;
    }

    let active = true;
    setStatus("loading");

    loadTurnstileScript()
      .then(() => {
        if (!active) return;
        if (containerRef.current) {
          renderExplicit(containerRef.current);
        } else {
          setStatus("ready");
        }
      })
      .catch((err) => {
        if (!active) return;
        const msg = err?.message || "Failed to load Turnstile script";
        setError(msg);
        setStatus("error");
        onError?.(msg);
      });

    return () => {
      active = false;
      if (
        widgetIdRef.current &&
        typeof window !== "undefined" &&
        window.turnstile
      ) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {}
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, renderExplicit, onError]);

  return {
    token,
    status,
    error,
    widgetId,
    containerRef,
    reset,
    execute,
    render: renderExplicit,
  };
}
