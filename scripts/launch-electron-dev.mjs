import { spawn } from "node:child_process";

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || "http://127.0.0.1:5173";
const MAX_WAIT_MS = 45_000;
const RETRY_INTERVAL_MS = 500;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isServerReady = async (url) => {
  try {
    const response = await fetch(url, { method: "GET" });
    return response.ok || response.status === 404;
  } catch {
    return false;
  }
};

const waitForServer = async () => {
  const start = Date.now();

  while (Date.now() - start < MAX_WAIT_MS) {
    if (await isServerReady(DEV_SERVER_URL)) {
      return;
    }
    await delay(RETRY_INTERVAL_MS);
  }

  throw new Error(`Timed out waiting for Vite dev server: ${DEV_SERVER_URL}`);
};

const launchElectron = () => {
  const child = spawn("electron", ["."], {
    stdio: "inherit",
    shell: true,
    env: {
      ...process.env,
      VITE_DEV_SERVER_URL: DEV_SERVER_URL
    }
  });

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });
};

const main = async () => {
  await waitForServer();
  launchElectron();
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
