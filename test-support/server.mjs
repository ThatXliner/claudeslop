import { spawn } from "node:child_process";
import { once } from "node:events";

export async function launch(directory) {
  const child = spawn(process.execPath, ["server.mjs"], {
    env: {
      ...process.env,
      DATA_DIR: directory,
      PORT: "0",
      SEED: "false",
      APP_URL: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const port = await new Promise((resolve, reject) => {
    child.stdout.on("data", (chunk) => {
      const match = /listening on 127.0.0.1:(\d+)/.exec(String(chunk));
      if (match) resolve(match[1]);
    });
    child.once("error", reject);
    child.once("exit", (code) => reject(new Error(`Server exited ${code}`)));
  });
  return {
    base: `http://127.0.0.1:${port}`,
    stop: async () => {
      child.kill("SIGTERM");
      await once(child, "exit");
    },
  };
}
