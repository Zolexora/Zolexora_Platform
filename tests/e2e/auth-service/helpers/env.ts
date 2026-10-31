import net from "node:net";

export const DEFAULT_AUTH_URL = process.env.AUTH_SERVICE_URL || `http://localhost:${process.env.PORT || 3081}`;

export async function isPortOpen(port: number, host = "127.0.0.1", timeout = 200): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let status = false;

    socket.setTimeout(timeout);
    socket.once("connect", () => {
      status = true;
      socket.destroy();
    });
    socket.once("timeout", () => {
      socket.destroy();
    });
    socket.once("error", () => {
      socket.destroy();
    });
    socket.once("close", () => {
      resolve(status);
    });

    socket.connect(port, host);
  });
}

export async function isLiveServiceAvailable(url = DEFAULT_AUTH_URL): Promise<boolean> {
  if (process.env.AUTH_TEST_MODE === "contract") return false;
  if (process.env.AUTH_TEST_MODE === "live") return true;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1000);
    const res = await fetch(`${url}/api/v1/health`, {
      method: "GET",
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return data.service === "zolexora-auth-service";
    }
    return false;
  } catch {
    return false;
  }
}
