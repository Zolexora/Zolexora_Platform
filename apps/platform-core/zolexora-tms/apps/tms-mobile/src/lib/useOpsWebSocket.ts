/**
 * useOpsWebSocket – real-time operational events via the backend /ws/ops/{org_id} channel.
 *
 * Protocol (enforced by the server):
 *   1. Connect → server accepts.
 *   2. Within 5 s send: { "type": "auth", "token": "<session token>" }
 *   3. Server replies: { "type": "auth_ok" } — now subscribed.
 *   4. Send "ping" text every 30 s to keep alive; server replies "pong".
 *   5. Incoming events: { "event": "duty.assigned", "organisation_id": "...", "data": {...} }
 *
 * The hook connects only when authenticated and an orgId is known. It
 * exponentially backs off on failure (cap 30 s) and stops on unmount.
 *
 * Consumers: QueryClient keys are invalidated on duty/trip events.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from './authApi';
import { config } from './config';

const PING_INTERVAL_MS = 30_000;
const BASE_BACKOFF_MS = 2_000;
const MAX_BACKOFF_MS = 30_000;

/** Converts an http(s) base URL to a ws(s) URL for the ops channel. */
function wsUrl(apiBaseUrl: string, orgId: string): string {
  const base = apiBaseUrl.replace(/^http/, 'ws').replace(/\/$/, '');
  return `${base}/ws/ops/${orgId}`;
}

export function useOpsWebSocket(orgId: string | null | undefined) {
  const qc = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffRef = useRef(BASE_BACKOFF_MS);
  const unmountedRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (pingRef.current) { clearInterval(pingRef.current); pingRef.current = null; }
    if (reconnectRef.current) { clearTimeout(reconnectRef.current); reconnectRef.current = null; }
  }, []);

  const closeSocket = useCallback(() => {
    clearTimers();
    if (wsRef.current) {
      // Prevent the onclose handler from triggering a reconnect on intentional close
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
  }, [clearTimers]);

  const connect = useCallback(async () => {
    if (unmountedRef.current || !orgId) return;

    let token: string | null = null;
    try {
      token = await authApi.getValidAccessToken();
    } catch {
      // Not authenticated – don't connect
      return;
    }
    if (!token) return;

    let url: string;
    try {
      url = wsUrl(config.apiBaseUrl(), orgId);
    } catch {
      return; // config not ready
    }

    closeSocket();

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (unmountedRef.current) { ws.close(); return; }
      backoffRef.current = BASE_BACKOFF_MS; // reset on successful connect
      ws.send(JSON.stringify({ type: 'auth', token }));

      // Heartbeat
      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send('ping');
      }, PING_INTERVAL_MS);
    };

    ws.onmessage = (event) => {
      if (typeof event.data !== 'string') return;
      if (event.data === 'pong') return;

      let msg: { event?: string; type?: string; data?: unknown };
      try { msg = JSON.parse(event.data); } catch { return; }

      if (msg.type === 'auth_ok') return; // connected, nothing to do

      // Invalidate relevant React Query keys on operational events
      const ev = msg.event ?? '';
      if (ev.startsWith('duty.')) {
        qc.invalidateQueries({ queryKey: ['duties'] });
        qc.invalidateQueries({ queryKey: ['mobile-dispatch-board'] });
        if (ev === 'duty.assigned' || ev === 'duty.dispatched') {
          // Surface a toast — components can subscribe to a simple global ref/event
          emitToast(`📋 ${humanise(ev)}`);
        }
      }
      if (ev.startsWith('trip.')) {
        qc.invalidateQueries({ queryKey: ['duties'] });
        qc.invalidateQueries({ queryKey: ['trip'] });
        qc.invalidateQueries({ queryKey: ['trip-events'] });
        if (ev === 'trip.exception') {
          const d = msg.data as { event_type?: string; trip_number?: string } | undefined;
          const isSos = d?.event_type === 'SOS_EMERGENCY';
          emitToast(
            isSos
              ? `🆘 SOS ALERT on ${d?.trip_number ?? 'active trip'}`
              : `⚠️ Exception reported on ${d?.trip_number ?? 'active trip'}`,
          );
        }
      }
      if (ev.startsWith('booking.')) {
        qc.invalidateQueries({ queryKey: ['bookings'] });
      }
      if (ev === 'eway_bill.expiring') {
        qc.invalidateQueries({ queryKey: ['duties'] });
        qc.invalidateQueries({ queryKey: ['bookings'] });
        const d = msg.data as { booking_number?: string; expired?: boolean; hours_left?: number } | undefined;
        emitToast(
          d?.expired
            ? `🚨 e-Way Bill EXPIRED (${d.booking_number ?? 'Booking'})`
            : `⚠️ e-Way Bill expiring in ${Math.max(1, Math.ceil(d?.hours_left ?? 1))}h (${d?.booking_number ?? 'Booking'})`,
        );
      }
      if (ev === 'fastag.toll_synced') {
        qc.invalidateQueries({ queryKey: ['fastag-reconciliation'] });
        const d = msg.data as { plaza_name?: string; amount?: number; duplicate_flag?: boolean } | undefined;
        emitToast(
          d?.duplicate_flag
            ? `🚨 Duplicate FASTag Charge at ${d.plaza_name ?? 'Plaza'} (₹${d.amount ?? 0})`
            : `🛣️ FASTag Toll ₹${d?.amount ?? 0} at ${d?.plaza_name ?? 'Plaza'}`,
        );
      }
    };

    ws.onerror = () => {
      // onerror is always followed by onclose; let onclose handle reconnect
    };

    ws.onclose = () => {
      clearTimers();
      wsRef.current = null;
      if (unmountedRef.current) return;
      // Exponential backoff reconnect
      const delay = backoffRef.current;
      backoffRef.current = Math.min(delay * 2, MAX_BACKOFF_MS);
      reconnectRef.current = setTimeout(connect, delay);
    };
  }, [orgId, qc, closeSocket, clearTimers]);

  useEffect(() => {
    unmountedRef.current = false;
    connect();
    return () => {
      unmountedRef.current = true;
      closeSocket();
    };
  }, [connect, closeSocket]);
}

function humanise(event: string): string {
  return event.replace('.', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Minimal in-process toast bus (no extra deps).
// Components can subscribe with onOpsToast(); the hook fires toasts here.
// ---------------------------------------------------------------------------
type ToastListener = (message: string) => void;
const toastListeners: Set<ToastListener> = new Set();

export function onOpsToast(listener: ToastListener): () => void {
  toastListeners.add(listener);
  return () => toastListeners.delete(listener);
}

function emitToast(message: string) {
  toastListeners.forEach((l) => l(message));
}
