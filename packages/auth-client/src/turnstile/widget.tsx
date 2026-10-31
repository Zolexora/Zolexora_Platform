import React, {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
} from "react";
import { loadTurnstileScript } from "./loader.js";
import type {
  TurnstileRenderOptions,
  TurnstileWidgetProps,
  TurnstileWidgetRef,
} from "./types.js";

/**
 * Cloudflare Turnstile React component with explicit rendering and lifecycle cleanup.
 */
export const TurnstileWidget = forwardRef<
  TurnstileWidgetRef,
  TurnstileWidgetProps
>(function TurnstileWidget(props, ref) {
  const {
    siteKey,
    action,
    cData,
    theme = "auto",
    size = "normal",
    tabIndex,
    execution = "render",
    responseFieldName,
    onVerify,
    onSuccess,
    onError,
    onExpire,
    onTimeout,
    className,
    id,
    style,
  } = props;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const isMountedRef = useRef<boolean>(true);

  const onVerifyRef = useRef(onVerify || onSuccess);
  onVerifyRef.current = onVerify || onSuccess;

  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  // Expose programmatic controls via ref
  useImperativeHandle(
    ref,
    () => ({
      reset: () => {
        if (
          widgetIdRef.current &&
          typeof window !== "undefined" &&
          window.turnstile
        ) {
          try {
            window.turnstile.reset(widgetIdRef.current);
          } catch {}
        }
      },
      execute: () => {
        if (
          containerRef.current &&
          typeof window !== "undefined" &&
          window.turnstile
        ) {
          try {
            window.turnstile.execute(containerRef.current);
          } catch {}
        }
      },
      getResponse: () => {
        if (
          widgetIdRef.current &&
          typeof window !== "undefined" &&
          window.turnstile
        ) {
          return window.turnstile.getResponse(widgetIdRef.current);
        }
        return undefined;
      },
      getWidgetId: () => widgetIdRef.current,
    }),
    []
  );

  useEffect(() => {
    isMountedRef.current = true;

    if (typeof window === "undefined" || !containerRef.current) {
      return;
    }

    let active = true;

    loadTurnstileScript()
      .then(() => {
        if (
          !active ||
          !isMountedRef.current ||
          !containerRef.current ||
          !window.turnstile
        ) {
          return;
        }

        // Clean up any existing widget in container before re-rendering
        if (widgetIdRef.current) {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch {}
          widgetIdRef.current = null;
        }

        const renderOptions: TurnstileRenderOptions = {
          sitekey: siteKey,
          theme,
          size,
          execution,
          ...(action ? { action } : {}),
          ...(cData ? { cData } : {}),
          ...(tabIndex !== undefined ? { tabindex: tabIndex } : {}),
          ...(responseFieldName
            ? { "response-field-name": responseFieldName }
            : {}),
          callback: (token: string) => {
            if (active && onVerifyRef.current) {
              onVerifyRef.current(token);
            }
          },
          "error-callback": (err: any) => {
            if (active && onErrorRef.current) {
              onErrorRef.current(
                typeof err === "string" ? err : "Turnstile challenge failed"
              );
            }
          },
          "expired-callback": () => {
            if (active && onExpireRef.current) {
              onExpireRef.current();
            }
          },
          "timeout-callback": () => {
            if (active && onTimeoutRef.current) {
              onTimeoutRef.current();
            }
          },
        };

        const id = window.turnstile.render(containerRef.current, renderOptions);
        widgetIdRef.current = id;
      })
      .catch((err) => {
        if (active && onErrorRef.current) {
          onErrorRef.current(err?.message || "Turnstile script failed to load");
        }
      });

    return () => {
      active = false;
      isMountedRef.current = false;
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
  }, [
    siteKey,
    action,
    cData,
    theme,
    size,
    execution,
    tabIndex,
    responseFieldName,
  ]);

  return (
    <div
      ref={containerRef}
      id={id}
      className={className}
      style={{ minHeight: size === "compact" ? 120 : 65, ...style }}
      data-testid="turnstile-widget-container"
    />
  );
});
