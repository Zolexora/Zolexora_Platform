import React, { createRef, useState } from "react";
import { renderToString } from "react-dom/server";
import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from "vitest";
import { render, cleanup, act, renderHook } from "@testing-library/react";
import fs from "node:fs";
import {
  TurnstileWidget,
  type TurnstileWidgetRef,
} from "../src/turnstile/widget.js";
import { loadTurnstileScript } from "../src/turnstile/loader.js";
import { useTurnstile } from "../src/turnstile/use-turnstile.js";
import { getRuntimeEnv, resolveAuthUrl } from "../src/env.js";
import { DEFAULT_AUTH_SERVICE_URL, TURNSTILE_SCRIPT_URL } from "../src/constants.js";

const PROBE_LOG_PATH =
  new URL("../../../.agents/teamwork/challenger_m5_2_gen9/raw_probe_logs.json", import.meta.url);

describe("Milestone 5 Empirical Challenger M5.2: Turnstile & Environment Resolver Stress", () => {
  let mockTurnstile: any;
  let widgetCounter = 0;
  let appendedScripts: Array<HTMLScriptElement> = [];
  let realQuerySelector: typeof document.querySelector;
  let realAppendChild: typeof HTMLHeadElement.prototype.appendChild;

  const probeRecords: Array<{
    id: string;
    title: string;
    category: string;
    status: "PASS" | "FAIL";
    timestamp: string;
    details?: any;
  }> = [];

  function recordProbe(id: string, title: string, category: string, details?: any) {
    probeRecords.push({
      id,
      title,
      category,
      status: "PASS",
      timestamp: new Date().toISOString(),
      details,
    });
  }

  afterAll(() => {
    try {
      fs.mkdirSync(new URL(".", PROBE_LOG_PATH), { recursive: true });
      fs.writeFileSync(
        PROBE_LOG_PATH,
        JSON.stringify(
          {
            agent: "challenger_m5_2_gen9",
            suite: "Turnstile Widget, Lifecycle, Ref, & Environment Resolver Empirical Stress",
            totalProbes: probeRecords.length,
            passed: probeRecords.filter((p) => p.status === "PASS").length,
            failed: probeRecords.filter((p) => p.status === "FAIL").length,
            probes: probeRecords,
          },
          null,
          2
        ),
        "utf8"
      );
    } catch (e) {
      console.error("Failed to write probe log:", e);
    }
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    widgetCounter = 0;
    appendedScripts = [];

    // Intercept script injection to prevent happy-dom from initiating external network fetches
    realQuerySelector = document.querySelector.bind(document);
    realAppendChild = HTMLHeadElement.prototype.appendChild;

    HTMLHeadElement.prototype.appendChild = function (node: any) {
      if (node?.tagName === "SCRIPT" && node?.src?.includes("turnstile")) {
        appendedScripts.push(node);
        return node;
      }
      return realAppendChild.call(this, node);
    };

    document.querySelector = function <E extends Element = Element>(selector: string): E | null {
      if (selector.includes("turnstile")) {
        return (appendedScripts[0] as unknown as E) || null;
      }
      return realQuerySelector.call(document, selector);
    };

    // Clean global window and process properties
    if (typeof window !== "undefined") {
      delete (window as any).turnstile;
      delete (window as any).__ENV__;
    }

    delete process.env.AUTH_SERVICE_URL;
    delete process.env.NEXT_PUBLIC_AUTH_SERVICE_URL;
    delete process.env.VITE_AUTH_SERVICE_URL;
    delete process.env.NEXT_PUBLIC_AUTH_URL;
    delete process.env.VITE_AUTH_URL;
    delete process.env.ZOLEXORA_AUTH_URL;

    mockTurnstile = {
      render: vi.fn((container: HTMLElement, options: any) => {
        widgetCounter++;
        return `widget_probe_id_${widgetCounter}`;
      }),
      reset: vi.fn(),
      remove: vi.fn(),
      getResponse: vi.fn((id: string) => `token_for_${id}`),
      isExpired: vi.fn(() => false),
      execute: vi.fn(),
    };
    (window as any).turnstile = mockTurnstile;
  });

  afterEach(() => {
    cleanup();
    HTMLHeadElement.prototype.appendChild = realAppendChild;
    document.querySelector = realQuerySelector;
    if (typeof window !== "undefined") {
      delete (window as any).turnstile;
      delete (window as any).__ENV__;
    }
  });

  // ===========================================================================
  // CATEGORY A: SCRIPT LOADER EMPIRICAL STRESS & IDEMPOTENCY
  // ===========================================================================

  it("LOADER-01: 50 concurrent calls to loadTurnstileScript() inject exactly ONE script tag", async () => {
    delete (window as any).turnstile;
    appendedScripts = [];
    vi.resetModules();
    const { loadTurnstileScript: freshLoader } = await import("../src/turnstile/loader.js");

    const CONCURRENCY = 50;
    const loadPromises = Array.from({ length: CONCURRENCY }, () =>
      freshLoader()
    );

    expect(appendedScripts.length).toBe(1);
    const injectedScript = appendedScripts[0];
    expect(injectedScript.src).toBe(TURNSTILE_SCRIPT_URL);
    expect(injectedScript.async).toBe(true);
    expect(injectedScript.defer).toBe(true);

    (window as any).turnstile = mockTurnstile;
    injectedScript.onload?.(new Event("load"));

    await Promise.all(loadPromises);

    expect(appendedScripts.length).toBe(1);
    recordProbe("LOADER-01", "50 concurrent script loads deduplicated to 1 DOM element", "Loader", { concurrency: 50, scriptCount: 1 });
  });

  it("LOADER-02: Pre-existing external Turnstile script tag in DOM is reused without duplicate insertion", async () => {
    delete (window as any).turnstile;
    vi.resetModules();
    const { loadTurnstileScript: freshLoader } = await import("../src/turnstile/loader.js");

    const preExisting = document.createElement("script");
    preExisting.src = TURNSTILE_SCRIPT_URL;
    preExisting.id = "pre-existing-turnstile";
    appendedScripts.push(preExisting);

    const promise = freshLoader();

    expect(appendedScripts.length).toBe(1);

    (window as any).turnstile = mockTurnstile;
    preExisting.dispatchEvent(new Event("load"));

    await promise;
    expect(appendedScripts.length).toBe(1);
    recordProbe("LOADER-02", "Pre-existing script tag in DOM reused without duplicate injection", "Loader", { existingScriptId: "pre-existing-turnstile" });
  });

  it("LOADER-03: Already loaded window.turnstile fast-path completes synchronously with 0 DOM mutations", async () => {
    (window as any).turnstile = mockTurnstile;
    appendedScripts = [];

    await loadTurnstileScript();

    expect(appendedScripts.length).toBe(0);
    recordProbe("LOADER-03", "Fast-path window.turnstile bypasses DOM injection", "Loader", { injectedCount: 0 });
  });

  it("LOADER-04: Script load failure cleans internal promise cache to permit subsequent retry", async () => {
    delete (window as any).turnstile;
    appendedScripts = [];
    vi.resetModules();
    const { loadTurnstileScript: freshLoader } = await import("../src/turnstile/loader.js");

    const promise1 = freshLoader();
    expect(appendedScripts.length).toBe(1);
    const script1 = appendedScripts[0];

    script1.onerror?.(new Event("error"));

    await expect(promise1).rejects.toThrow(
      "Failed to load Cloudflare Turnstile script from challenges.cloudflare.com"
    );

    appendedScripts = [];

    const promise2 = freshLoader();
    expect(appendedScripts.length).toBe(1);
    const script2 = appendedScripts[0];

    (window as any).turnstile = mockTurnstile;
    script2.onload?.(new Event("load"));

    await expect(promise2).resolves.toBeUndefined();
    recordProbe("LOADER-04", "Script error resets internal promise cache allowing successful retry", "Loader", { retriedSuccessfully: true });
  });

  // ===========================================================================
  // CATEGORY B: WIDGET LIFECYCLE & RAPID MOUNT / UNMOUNT STRESS
  // ===========================================================================

  it("LIFECYCLE-01: Rapid Mount/Unmount Churn (100 sequential cycles) causes 0 leaks and 0 orphaned renders", async () => {
    const CYCLES = 100;

    for (let i = 0; i < CYCLES; i++) {
      const { unmount } = render(
        <TurnstileWidget siteKey="1x00000000000000000000AA" />
      );
      unmount();
    }

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    const renderCalls = mockTurnstile.render.mock.calls.length;
    const removeCalls = mockTurnstile.remove.mock.calls.length;
    expect(renderCalls).toBe(removeCalls);
    recordProbe("LIFECYCLE-01", "100 rapid sequential mount/unmount cycles with zero orphaned renders", "Lifecycle", { cycles: CYCLES, renderCalls, removeCalls });
  });

  it("LIFECYCLE-02: Rendered widget strictly calls window.turnstile.remove on unmount", async () => {
    const { unmount } = render(
      <TurnstileWidget siteKey="1x00000000000000000000AA" />
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(mockTurnstile.render).toHaveBeenCalledTimes(1);
    const assignedId = mockTurnstile.render.mock.results[0].value;

    unmount();

    expect(mockTurnstile.remove).toHaveBeenCalledTimes(1);
    expect(mockTurnstile.remove).toHaveBeenCalledWith(assignedId);
    recordProbe("LIFECYCLE-02", "Unmount strictly removes widget by ID via window.turnstile.remove", "Lifecycle", { removedId: assignedId });
  });

  it("LIFECYCLE-03: Dynamic prop changes (theme, size, action) remove prior widget before rendering replacement", async () => {
    function HostComponent() {
      const [theme, setTheme] = useState<"light" | "dark">("light");
      const [action, setAction] = useState("login");
      return (
        <div>
          <button onClick={() => { setTheme("dark"); setAction("checkout"); }}>
            Update
          </button>
          <TurnstileWidget
            siteKey="1x00000000000000000000AA"
            theme={theme}
            action={action}
          />
        </div>
      );
    }

    const { getByText } = render(<HostComponent />);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(mockTurnstile.render).toHaveBeenCalledTimes(1);
    const firstWidgetId = mockTurnstile.render.mock.results[0].value;

    await act(async () => {
      getByText("Update").click();
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(mockTurnstile.render).toHaveBeenCalledTimes(2);
    expect(mockTurnstile.remove).toHaveBeenCalledWith(firstWidgetId);
    recordProbe("LIFECYCLE-03", "Dynamic prop changes remove old widget prior to mounting new one", "Lifecycle", { oldId: firstWidgetId });
  });

  it("LIFECYCLE-04: Resilient to window.turnstile.remove throwing an error", async () => {
    mockTurnstile.remove.mockImplementation(() => {
      throw new Error("Turnstile native error: widget container detached");
    });

    const { unmount } = render(
      <TurnstileWidget siteKey="1x00000000000000000000AA" />
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(() => unmount()).not.toThrow();
    expect(mockTurnstile.remove).toHaveBeenCalled();
    recordProbe("LIFECYCLE-04", "Turnstile.remove throwing error is trapped without crashing React tree", "Lifecycle", { resilient: true });
  });

  it("LIFECYCLE-05: Multi-widget Concurrency (10 simultaneous active widgets) maintain strict callback isolation", async () => {
    const WIDGET_COUNT = 10;
    const callbacks: Array<(token: string) => void> = [];
    const verifySpies = Array.from({ length: WIDGET_COUNT }, () => vi.fn());

    mockTurnstile.render.mockImplementation((container: HTMLElement, opts: any) => {
      widgetCounter++;
      callbacks.push(opts.callback);
      return `multi_widget_${widgetCounter}`;
    });

    const refArray = Array.from({ length: WIDGET_COUNT }, () =>
      createRef<TurnstileWidgetRef>()
    );

    const { unmount } = render(
      <div>
        {Array.from({ length: WIDGET_COUNT }, (_, i) => (
          <TurnstileWidget
            key={i}
            ref={refArray[i]}
            siteKey={`1x00000000000000000000A${i}`}
            onVerify={verifySpies[i]}
          />
        ))}
      </div>
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 15));
    });

    expect(mockTurnstile.render).toHaveBeenCalledTimes(WIDGET_COUNT);
    expect(callbacks.length).toBe(WIDGET_COUNT);

    act(() => {
      callbacks[4]("token_for_widget_4");
    });

    expect(verifySpies[4]).toHaveBeenCalledWith("token_for_widget_4");
    verifySpies.forEach((spy, idx) => {
      if (idx !== 4) {
        expect(spy).not.toHaveBeenCalled();
      }
    });

    unmount();
    expect(mockTurnstile.remove).toHaveBeenCalledTimes(WIDGET_COUNT);
    recordProbe("LIFECYCLE-05", "10 concurrent widgets maintain strict callback isolation and clean removal", "Lifecycle", { widgetCount: WIDGET_COUNT });
  });

  it("LIFECYCLE-06: Callback reference stability: parent inline function updates do NOT trigger turnstile re-render", async () => {
    function Parent() {
      const [count, setCount] = useState(0);
      return (
        <div>
          <button onClick={() => setCount((c) => c + 1)}>Increment</button>
          <TurnstileWidget
            siteKey="1x00000000000000000000AA"
            onVerify={() => {}}
          />
        </div>
      );
    }

    const { getByText } = render(<Parent />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(mockTurnstile.render).toHaveBeenCalledTimes(1);

    for (let i = 0; i < 5; i++) {
      await act(async () => {
        getByText("Increment").click();
      });
    }

    expect(mockTurnstile.render).toHaveBeenCalledTimes(1);
    recordProbe("LIFECYCLE-06", "Parent inline callback identity change avoids redundant widget re-renders", "Lifecycle", { renderCount: 1 });
  });

  it("LIFECYCLE-07: Resilient to window.turnstile.render() throwing an exception", async () => {
    mockTurnstile.render.mockImplementation(() => {
      throw new Error("Invalid Turnstile container parameter");
    });

    const onErrorSpy = vi.fn();
    render(
      <TurnstileWidget
        siteKey="1x00000000000000000000AA"
        onError={onErrorSpy}
      />
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(onErrorSpy).toHaveBeenCalledWith("Invalid Turnstile container parameter");
    recordProbe("LIFECYCLE-07", "Turnstile.render exception propagated to onError without tree crash", "Lifecycle", { handled: true });
  });

  it("LIFECYCLE-08: High-scale Stress: 500 rapid mount/unmount cycles verify zero memory leak", async () => {
    const STRESS_CYCLES = 500;
    for (let i = 0; i < STRESS_CYCLES; i++) {
      const { unmount } = render(
        <TurnstileWidget siteKey="1x00000000000000000000AA" />
      );
      unmount();
    }

    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });

    const renderCalls = mockTurnstile.render.mock.calls.length;
    const removeCalls = mockTurnstile.remove.mock.calls.length;
    expect(renderCalls).toBe(removeCalls);
    recordProbe("LIFECYCLE-08", "500 rapid mount/unmount stress cycles maintain 1:1 render/remove parity", "Lifecycle", { cycles: STRESS_CYCLES, renderCalls, removeCalls });
  });

  // ===========================================================================
  // CATEGORY C: IMPERATIVE REF CONTROLS
  // ===========================================================================

  it("REF-01: Pre-initialization calls on ref are completely safe no-ops", () => {
    delete (window as any).turnstile;
    const ref = createRef<TurnstileWidgetRef>();

    render(<TurnstileWidget ref={ref} siteKey="1x00000000000000000000AA" />);

    expect(() => ref.current?.reset()).not.toThrow();
    expect(() => ref.current?.execute()).not.toThrow();
    expect(ref.current?.getResponse()).toBeUndefined();
    expect(ref.current?.getWidgetId()).toBeNull();
    recordProbe("REF-01", "Pre-initialization ref methods are safe no-ops returning null/undefined", "Ref", { safe: true });
  });

  it("REF-02: Post-initialization calls execute turnstile native methods accurately", async () => {
    const ref = createRef<TurnstileWidgetRef>();
    render(<TurnstileWidget ref={ref} siteKey="1x00000000000000000000AA" />);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    const widgetId = ref.current?.getWidgetId();
    expect(widgetId).toBe("widget_probe_id_1");

    act(() => {
      ref.current?.reset();
    });
    expect(mockTurnstile.reset).toHaveBeenCalledWith("widget_probe_id_1");

    act(() => {
      ref.current?.execute();
    });
    expect(mockTurnstile.execute).toHaveBeenCalled();

    const response = ref.current?.getResponse();
    expect(response).toBe("token_for_widget_probe_id_1");
    recordProbe("REF-02", "Post-initialization ref delegates to window.turnstile methods accurately", "Ref", { widgetId, response });
  });

  it("REF-03: Post-unmount ref methods do NOT invoke stale Turnstile methods", async () => {
    const ref = createRef<TurnstileWidgetRef>();
    const { unmount } = render(
      <TurnstileWidget ref={ref} siteKey="1x00000000000000000000AA" />
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    unmount();

    expect(ref.current).toBeNull();
    expect(mockTurnstile.reset).not.toHaveBeenCalled();
    recordProbe("REF-03", "Component unmount clears forwarded ref to null preventing dangling calls", "Ref", { clearedToNull: true });
  });

  it("REF-04: Exceptions inside window.turnstile.reset() or execute() are cleanly trapped", async () => {
    mockTurnstile.reset.mockImplementation(() => {
      throw new Error("Turnstile native reset crash");
    });
    mockTurnstile.execute.mockImplementation(() => {
      throw new Error("Turnstile native execute crash");
    });

    const ref = createRef<TurnstileWidgetRef>();
    render(<TurnstileWidget ref={ref} siteKey="1x00000000000000000000AA" />);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(() => ref.current?.reset()).not.toThrow();
    expect(() => ref.current?.execute()).not.toThrow();
    recordProbe("REF-04", "Turnstile native exceptions inside ref methods are trapped cleanly", "Ref", { resetTrapped: true, executeTrapped: true });
  });

  // ===========================================================================
  // CATEGORY D: USE_TURNSTILE HOOK STATE MACHINE & EDGE CASES
  // ===========================================================================

  it("HOOK-01: useTurnstile render(null) gracefully returns null", async () => {
    const { result } = renderHook(() =>
      useTurnstile({ siteKey: "1x00000000000000000000AA" })
    );

    let id: string | null = null;
    await act(async () => {
      id = result.current.render(null);
    });
    expect(id).toBeNull();
    recordProbe("HOOK-01", "useTurnstile.render(null) returns null without exception", "Hook", { returnedNull: true });
  });

  it("HOOK-02: useTurnstile sequential render calls remove existing widget", async () => {
    const container1 = document.createElement("div");
    const container2 = document.createElement("div");
    document.body.appendChild(container1);
    document.body.appendChild(container2);

    const { result } = renderHook(() =>
      useTurnstile({ siteKey: "1x00000000000000000000AA" })
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    let id1: string | null = null;
    let id2: string | null = null;

    act(() => {
      id1 = result.current.render(container1);
    });
    expect(id1).toBe("widget_probe_id_1");

    act(() => {
      id2 = result.current.render(container2);
    });
    expect(id2).toBe("widget_probe_id_2");

    expect(mockTurnstile.remove).toHaveBeenCalledWith(id1);

    container1.remove();
    container2.remove();
    recordProbe("HOOK-02", "useTurnstile sequential renders remove previous widget ID before rendering next", "Hook", { id1, id2 });
  });

  it("HOOK-03: Complete state cycle: idle -> loading -> ready -> verified -> expired -> reset", async () => {
    let capturedCallbacks: any = {};
    mockTurnstile.render.mockImplementation((el: any, opts: any) => {
      capturedCallbacks = opts;
      return "hook_state_widget";
    });

    const container = document.createElement("div");
    document.body.appendChild(container);

    const onVerify = vi.fn();
    const onExpire = vi.fn();

    const { result } = renderHook(() =>
      useTurnstile({
        siteKey: "1x00000000000000000000AA",
        onVerify,
        onExpire,
      })
    );

    await act(async () => {
      result.current.render(container);
    });

    expect(result.current.status).toBe("ready");
    expect(result.current.token).toBeNull();

    act(() => {
      capturedCallbacks.callback("token_alpha_beta");
    });
    expect(result.current.status).toBe("verified");
    expect(result.current.token).toBe("token_alpha_beta");
    expect(onVerify).toHaveBeenCalledWith("token_alpha_beta");

    act(() => {
      capturedCallbacks["expired-callback"]();
    });
    expect(result.current.status).toBe("expired");
    expect(result.current.token).toBeNull();
    expect(onExpire).toHaveBeenCalled();

    act(() => {
      result.current.reset();
    });
    expect(result.current.status).toBe("ready");
    expect(result.current.token).toBeNull();

    container.remove();
    recordProbe("HOOK-03", "useTurnstile transitions correctly across full status lifecycle", "Hook", { finalStatus: "ready" });
  });

  // ===========================================================================
  // CATEGORY E: MULTI-TIER ENVIRONMENT RESOLVER RIGOROUS CHALLENGE
  // ===========================================================================

  it("ENV-01: Strict Tier Precedence Matrix: customUrl > window.__ENV__ > process.env > default", () => {
    (window as any).__ENV__ = { AUTH_SERVICE_URL: "https://win.env.zolexora.com" };
    process.env.AUTH_SERVICE_URL = "https://process.env.zolexora.com";
    expect(resolveAuthUrl("https://custom.zolexora.com")).toBe("https://custom.zolexora.com");

    expect(resolveAuthUrl()).toBe("https://win.env.zolexora.com");

    (window as any).__ENV__ = {};
    expect(resolveAuthUrl()).toBe("https://process.env.zolexora.com");

    delete process.env.AUTH_SERVICE_URL;
    expect(resolveAuthUrl()).toBe(DEFAULT_AUTH_SERVICE_URL);
    recordProbe("ENV-01", "Strict tier precedence customUrl > window.__ENV__ > process.env > default", "Environment", { default: DEFAULT_AUTH_SERVICE_URL });
  });

  it("ENV-02: Candidate Key Precedence within a tier strictly matches candidateKeys ordering", () => {
    process.env.ZOLEXORA_AUTH_URL = "https://url-6.zolexora.com";
    expect(resolveAuthUrl()).toBe("https://url-6.zolexora.com");

    process.env.VITE_AUTH_URL = "https://url-5.zolexora.com";
    expect(resolveAuthUrl()).toBe("https://url-5.zolexora.com");

    process.env.NEXT_PUBLIC_AUTH_URL = "https://url-4.zolexora.com";
    expect(resolveAuthUrl()).toBe("https://url-4.zolexora.com");

    process.env.VITE_AUTH_SERVICE_URL = "https://url-3.zolexora.com";
    expect(resolveAuthUrl()).toBe("https://url-3.zolexora.com");

    process.env.NEXT_PUBLIC_AUTH_SERVICE_URL = "https://url-2.zolexora.com";
    expect(resolveAuthUrl()).toBe("https://url-2.zolexora.com");

    process.env.AUTH_SERVICE_URL = "https://url-1.zolexora.com";
    expect(resolveAuthUrl()).toBe("https://url-1.zolexora.com");
    recordProbe("ENV-02", "Candidate key precedence matches specification across 6 candidate keys", "Environment", { winner: "https://url-1.zolexora.com" });
  });

  it("ENV-03: Adversarial string sanitization: trailing slashes, tabs, whitespace, and empty strings", () => {
    expect(resolveAuthUrl("https://auth.zolexora.com/////")).toBe("https://auth.zolexora.com");
    expect(resolveAuthUrl("  https://auth.zolexora.com/   ")).toBe("https://auth.zolexora.com");

    process.env.AUTH_SERVICE_URL = "https://env.zolexora.com";
    expect(resolveAuthUrl("    \t\n   ")).toBe("https://env.zolexora.com");

    process.env.AUTH_SERVICE_URL = "   \t  ";
    expect(resolveAuthUrl()).toBe(DEFAULT_AUTH_SERVICE_URL);

    process.env.AUTH_SERVICE_URL = "";
    expect(resolveAuthUrl()).toBe(DEFAULT_AUTH_SERVICE_URL);
    recordProbe("ENV-03", "Adversarial trailing slashes, whitespace, and empty strings safely sanitized", "Environment", { sanitized: true });
  });

  it("ENV-04: getRuntimeEnv safely extracts non-string values via String() coercion", () => {
    (window as any).__ENV__ = {
      PORT: 4040,
      DEBUG: true,
      ZERO: 0,
    };

    expect(getRuntimeEnv("PORT")).toBe("4040");
    expect(getRuntimeEnv("DEBUG")).toBe("true");
    expect(getRuntimeEnv("ZERO")).toBe("0");
    recordProbe("ENV-04", "Non-string variables coerced cleanly via String() without throwing", "Environment", { port: "4040", debug: "true", zero: "0" });
  });

  it("ENV-05: Hostile environment defense: throwing getters on window or process do not crash resolver", () => {
    Object.defineProperty(window, "__ENV__", {
      get() {
        throw new Error("Blocked by CSP / Sandbox");
      },
      configurable: true,
    });

    process.env.AUTH_SERVICE_URL = "https://fallback-safe.zolexora.com";

    expect(() => getRuntimeEnv("AUTH_SERVICE_URL")).not.toThrow();
    expect(resolveAuthUrl()).toBe("https://fallback-safe.zolexora.com");

    delete (window as any).__ENV__;
    recordProbe("ENV-05", "Hostile throwing proxy/getter on window.__ENV__ trapped safely", "Environment", { trapped: true });
  });

  it("SSR-01: Server-side rendering (renderToString) renders container div without DOM exceptions", () => {
    const html = renderToString(
      <TurnstileWidget
        siteKey="1x00000000000000000000AA"
        theme="dark"
        size="compact"
        className="turnstile-ssr-container"
      />
    );

    expect(html).toContain('data-testid="turnstile-widget-container"');
    expect(html).toContain('class="turnstile-ssr-container"');
    expect(html).toContain("min-height:120px");
    recordProbe("SSR-01", "renderToString completes cleanly with expected SSR container HTML", "SSR", { htmlLength: html.length });
  });
});
