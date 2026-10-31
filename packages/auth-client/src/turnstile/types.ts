import type { CSSProperties } from "react";

export interface TurnstileRenderOptions {
  sitekey: string;
  action?: string;
  cData?: string;
  callback?: (token: string) => void;
  "error-callback"?: (error?: any) => void;
  "expired-callback"?: () => void;
  "timeout-callback"?: () => void;
  theme?: "light" | "dark" | "auto";
  size?: "normal" | "compact" | "flexible";
  tabindex?: number;
  execution?: "render" | "execute";
  appearance?: "always" | "execute" | "interaction-only";
  "response-field"?: boolean;
  "response-field-name"?: string;
}

export interface TurnstileObject {
  render: (
    container: string | HTMLElement,
    options: TurnstileRenderOptions
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId: string) => void;
  getResponse: (widgetId?: string) => string | undefined;
  isExpired: (widgetId?: string) => boolean;
  execute: (
    container?: string | HTMLElement,
    options?: TurnstileRenderOptions
  ) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileObject;
  }
}

export interface TurnstileWidgetProps {
  siteKey: string;
  action?: string;
  cData?: string;
  theme?: "light" | "dark" | "auto";
  size?: "normal" | "compact" | "flexible";
  tabIndex?: number;
  execution?: "render" | "execute";
  responseFieldName?: string;
  onVerify?: (token: string) => void;
  onSuccess?: (token: string) => void; // Alias for onVerify
  onError?: (error: string) => void;
  onExpire?: () => void;
  onTimeout?: () => void;
  className?: string;
  id?: string;
  style?: CSSProperties;
}

export interface TurnstileWidgetRef {
  reset: () => void;
  execute: () => void;
  getResponse: () => string | undefined;
  getWidgetId: () => string | null;
}

export type TurnstileStatus =
  | "idle"
  | "loading"
  | "ready"
  | "verified"
  | "expired"
  | "error";
