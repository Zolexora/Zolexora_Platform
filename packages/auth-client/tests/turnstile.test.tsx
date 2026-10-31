import React, { createRef } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, act, renderHook } from "@testing-library/react";
import {
  TurnstileWidget,
  type TurnstileWidgetRef,
} from "../src/turnstile/widget.js";
import { useTurnstile } from "../src/turnstile/use-turnstile.js";

describe("Cloudflare Turnstile Component & Hook (turnstile.test.tsx)", () => {
  let mockTurnstile: any;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockTurnstile = {
      render: vi.fn((container: HTMLElement, options: any) => {
        return "widget_mock_id_123";
      }),
      reset: vi.fn(),
      remove: vi.fn(),
      getResponse: vi.fn(() => "mock_cf_token_456"),
      isExpired: vi.fn(() => false),
      execute: vi.fn(),
    };
    (window as any).turnstile = mockTurnstile;
  });

  afterEach(() => {
    cleanup();
    delete (window as any).turnstile;
  });

  it("renders widget container and calls turnstile.render with explicit options", async () => {
    const onVerify = vi.fn();
    const onError = vi.fn();

    const { getByTestId } = render(
      <TurnstileWidget
        siteKey="1x00000000000000000000AA"
        action="public_login"
        theme="dark"
        size="compact"
        onVerify={onVerify}
        onError={onError}
      />
    );

    const container = getByTestId("turnstile-widget-container");
    expect(container).toBeDefined();

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(mockTurnstile.render).toHaveBeenCalledWith(
      container,
      expect.objectContaining({
        sitekey: "1x00000000000000000000AA",
        action: "public_login",
        theme: "dark",
        size: "compact",
      })
    );
  });

  it("invokes onVerify callback when Turnstile challenge succeeds", async () => {
    let capturedCallback: any;
    mockTurnstile.render.mockImplementation((el: any, opts: any) => {
      capturedCallback = opts.callback;
      return "widget_1";
    });

    const onVerify = vi.fn();
    render(
      <TurnstileWidget
        siteKey="1x00000000000000000000AA"
        onVerify={onVerify}
      />
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(capturedCallback).toBeDefined();
    act(() => {
      capturedCallback("valid_turnstile_token_xyz");
    });

    expect(onVerify).toHaveBeenCalledWith("valid_turnstile_token_xyz");
  });

  it("cleans up widget via turnstile.remove on component unmount", async () => {
    const { unmount } = render(
      <TurnstileWidget siteKey="1x00000000000000000000AA" />
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(mockTurnstile.render).toHaveBeenCalledTimes(1);

    unmount();

    expect(mockTurnstile.remove).toHaveBeenCalledWith("widget_mock_id_123");
  });

  it("provides imperative ref methods: reset, execute, getResponse, getWidgetId", async () => {
    const ref = createRef<TurnstileWidgetRef>();
    render(
      <TurnstileWidget
        ref={ref}
        siteKey="1x00000000000000000000AA"
      />
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    act(() => {
      ref.current?.reset();
    });
    expect(mockTurnstile.reset).toHaveBeenCalledWith("widget_mock_id_123");

    act(() => {
      ref.current?.execute();
    });
    expect(mockTurnstile.execute).toHaveBeenCalled();

    const token = ref.current?.getResponse();
    expect(token).toBe("mock_cf_token_456");
    expect(ref.current?.getWidgetId()).toBe("widget_mock_id_123");
  });

  it("useTurnstile hook manages widget lifecycle and updates token state", async () => {
    let capturedCallback: any;
    mockTurnstile.render.mockImplementation((el: any, opts: any) => {
      capturedCallback = opts.callback;
      return "widget_hook_1";
    });

    const onVerify = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);

    const { result } = renderHook(() =>
      useTurnstile({
        siteKey: "1x00000000000000000000AA",
        onVerify,
      })
    );

    await act(async () => {
      result.current.render(container);
    });

    expect(result.current.widgetId).toBe("widget_hook_1");
    expect(result.current.status).toBe("ready");

    act(() => {
      capturedCallback?.("token_from_hook_callback");
    });

    expect(result.current.status).toBe("verified");
    expect(result.current.token).toBe("token_from_hook_callback");
    expect(onVerify).toHaveBeenCalledWith("token_from_hook_callback");

    act(() => {
      result.current.reset();
    });

    expect(result.current.token).toBeNull();
    expect(result.current.status).toBe("ready");
    expect(mockTurnstile.reset).toHaveBeenCalledWith("widget_hook_1");
  });
});
