#!/usr/bin/env node
/**
 * Supervised production server (bead bgb). Runs `next start` and relaunches it
 * when the app requests a self-update restart (child exits with code 75). This is
 * what makes the one-click "Update now" button able to bring the server back on
 * the new build. Sets BMUS_SUPERVISED=1 so the app knows auto-restart is possible.
 *
 *   npm run build && npm run serve
 *
 * Zero deps — Node stdlib only.
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { createServerController } from "../bin/server-controller.mjs";

const RESTART_CODE = 75;
const require = createRequire(import.meta.url);

function nextBin() {
  // Resolve the next CLI from the local install. Under non-standard layouts
  // (pnpm symlink store, global/linked install, monorepo hoist) this can throw —
  // fall back to running `next` from PATH (via npx) rather than crashing on boot.
  try {
    const pkg = require.resolve("next/package.json");
    return path.join(path.dirname(pkg), "dist", "bin", "next");
  } catch {
    return null;
  }
}

const port = process.env.PORT || "3000";
const host = process.env.HOST || "localhost";
// Preserve the complete Next start CLI surface, including a directory,
// --hostname, --port, --keepAliveTimeout and future Next options.
const forwardedArgs = process.argv.slice(2);
// Test hook: override the spawned command with a JSON array (BMUS_SERVE_CMD).
const override = process.env.BMUS_SERVE_CMD ? JSON.parse(process.env.BMUS_SERVE_CMD) : null;

function launchServer() {
  const bin = nextBin();
  const cmd = override ? override[0] : bin ? process.execPath : "npx";
  const args = override
    ? override.slice(1)
    : bin
      ? [bin, "start", "-p", port, "-H", host, ...forwardedArgs]
      : ["next", "start", "-p", port, "-H", host, ...forwardedArgs]; // bin unresolved → use PATH via npx
  return spawn(cmd, args, {
    stdio: "inherit",
    env: { ...process.env, BMUS_SUPERVISED: "1", PORT: port, HOST: host },
  });
}

const controller = createServerController({
  launchServer,
  // The tray only needs a stable identity; Next receives the original options.
  url: `http://${host}:${port}`,
  restartExitCode: RESTART_CODE,
  onRestart: () => console.log("\n[serve] self-update requested — relaunching the server…\n"),
});
controller.completion.then(code => process.exit(code));
await controller.start();
