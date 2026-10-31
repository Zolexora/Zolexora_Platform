const { spawn, spawnSync } = require("child_process");
const path = require("path");

const TIMEOUT_MS = 60000;
const TUNNEL_URL_REGEX = /(?:exp|https?):\/\/[a-zA-Z0-9-]+\.(?:ngrok-free\.app|ngrok\.io|ngrok\.dev|expo\.direct|exp\.direct)(?::\d+)?(?:[^\s()<>"]*)/i;

function stripAnsi(str) {
  return str
    .replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, "")
    .replace(/\u001b\][^\u0007]*\u0007/g, "");
}

console.log("Starting Expo Go Tunnel verification...");

const projectRoot = path.resolve(__dirname, "..");
let devProcess;
let isCleanedUp = false;
let timeoutId = null;
let outputBuffer = "";

function killProcessTree(proc) {
  if (!proc || !proc.pid) return;
  try {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/pid", proc.pid, "/f", "/t"]);
    } else {
      try {
        process.kill(-proc.pid, "SIGTERM");
      } catch (e) {
        try {
          proc.kill("SIGTERM");
        } catch (err) {}
      }
      try {
        process.kill(-proc.pid, "SIGKILL");
      } catch (e) {
        try {
          proc.kill("SIGKILL");
        } catch (err) {}
      }
    }
  } catch (err) {
    console.error("Error killing process tree:", err.message);
  }
}

function cleanup(exitCode, message) {
  if (isCleanedUp) return;
  isCleanedUp = true;
  if (timeoutId) clearTimeout(timeoutId);

  if (devProcess) {
    console.log("Terminating spawned dev server process...");
    killProcessTree(devProcess);
  }

  if (message) {
    if (exitCode === 0) {
      console.log(message);
    } else {
      console.error(message);
    }
  }

  process.exit(exitCode);
}

["SIGINT", "SIGTERM", "SIGHUP"].forEach((signal) => {
  process.on(signal, () => {
    cleanup(1, `\n[SIGNAL] Received ${signal}, exiting...`);
  });
});

// Spawn dev server in tunnel mode
devProcess = spawn("pnpm", ["--filter", "@clarityfi/mobile", "run", "dev:tunnel"], {
  cwd: projectRoot,
  env: { ...process.env, FORCE_COLOR: "0" },
  detached: process.platform !== "win32",
  shell: true,
});

timeoutId = setTimeout(() => {
  cleanup(1, `[TIMEOUT] No tunnel URL detected within ${TIMEOUT_MS / 1000} seconds.`);
}, TIMEOUT_MS);

function handleData(data) {
  const text = data.toString();
  process.stdout.write(text);
  outputBuffer += stripAnsi(text);
  const match = outputBuffer.match(TUNNEL_URL_REGEX);
  if (match) {
    const foundUrl = match[0].trim().replace(/[.,;)]+$/, "");
    cleanup(0, `\n[SUCCESS] Public tunnel URL detected: ${foundUrl}`);
  } else if (outputBuffer.includes("Tunnel ready.") || outputBuffer.includes("Tunnel connected.")) {
    cleanup(0, `\n[SUCCESS] Tunnel connection established successfully.`);
  }
}

if (devProcess.stdout) {
  devProcess.stdout.on("data", handleData);
}

if (devProcess.stderr) {
  devProcess.stderr.on("data", handleData);
}

devProcess.on("error", (err) => {
  cleanup(1, `[ERROR] Failed to start process: ${err.message}`);
});

devProcess.on("exit", (code, signal) => {
  if (!isCleanedUp) {
    cleanup(code || 1, `[EXIT] Process exited prematurely with code ${code}, signal ${signal}`);
  }
});
