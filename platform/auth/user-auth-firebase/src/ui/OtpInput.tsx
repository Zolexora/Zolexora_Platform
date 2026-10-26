"use client";

import { useRef, useEffect, type KeyboardEvent, type ClipboardEvent } from "react";

export interface OtpInputProps {
  value: string[];
  onChange: (value: string[]) => void;
  prefix?: string;
  disabled?: boolean;
  expiresIn?: number;
  resendIn?: number;
  onResend?: () => void;
  resending?: boolean;
}

export function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function OtpInput({
  value,
  onChange,
  prefix = "zx-otp",
  disabled = false,
  expiresIn = 0,
  resendIn = 0,
  onResend,
  resending = false,
}: OtpInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Auto-focus first empty box on mount
    const firstEmptyIndex = value.findIndex((v) => !v);
    const targetIndex = firstEmptyIndex === -1 ? 0 : firstEmptyIndex;
    inputRefs.current[targetIndex]?.focus();
  }, []);

  const handleChange = (val: string, index: number) => {
    if (!/^\d*$/.test(val)) return;
    const next = [...value];
    next[index] = val.slice(-1);
    onChange(next);

    if (val && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "Backspace") {
      if (!value[index] && index > 0) {
        const next = [...value];
        next[index - 1] = "";
        onChange(next);
        inputRefs.current[index - 1]?.focus();
      } else if (value[index]) {
        const next = [...value];
        next[index] = "";
        onChange(next);
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const next = [...value];
    for (let i = 0; i < 6; i++) {
      next[i] = pasted[i] || "";
    }
    onChange(next);
    const focusTarget = Math.min(pasted.length, 5);
    inputRefs.current[focusTarget]?.focus();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", width: "100%" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "0.5rem",
          margin: "0.5rem 0",
        }}
      >
        {value.map((digit, index) => (
          <input
            key={`${prefix}-${index}`}
            ref={(el) => {
              inputRefs.current[index] = el;
            }}
            id={`${prefix}-${index}`}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            disabled={disabled}
            onChange={(e) => handleChange(e.target.value, index)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            onPaste={handlePaste}
            style={{
              width: "2.75rem",
              height: "3.25rem",
              textAlign: "center",
              fontSize: "1.25rem",
              fontWeight: 700,
              fontFamily: "monospace",
              borderRadius: "0.5rem",
              border: digit ? "2px solid #6366f1" : "1px solid #334155",
              background: "#0f172a",
              color: "#ffffff",
              outline: "none",
              transition: "border-color 0.2s, box-shadow 0.2s",
            }}
          />
        ))}
      </div>

      {(expiresIn > 0 || resendIn > 0 || onResend) && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: "0.75rem",
            color: "#94a3b8",
            padding: "0 0.25rem",
          }}
        >
          {expiresIn > 0 ? (
            <span>
              Expires in <strong style={{ color: "#e2e8f0" }}>{formatCountdown(expiresIn)}</strong>
            </span>
          ) : (
            <span style={{ color: "#ef4444" }}>Code expired</span>
          )}

          {onResend && (
            <button
              type="button"
              disabled={resendIn > 0 || disabled || resending}
              onClick={onResend}
              style={{
                background: "transparent",
                border: "none",
                color: resendIn > 0 || disabled || resending ? "#64748b" : "#818cf8",
                fontWeight: 600,
                cursor: resendIn > 0 || disabled || resending ? "not-allowed" : "pointer",
                padding: "0.25rem 0.5rem",
                borderRadius: "0.25rem",
              }}
            >
              {resending ? "Sending..." : resendIn > 0 ? `Resend in ${resendIn}s` : "Resend Code"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
