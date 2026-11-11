import childProcess from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { syncBuiltinESMExports } from 'node:module';
import { fileURLToPath } from 'node:url';

// The Windows smoke drives the real menu item inside its STA helper. This
// avoids displaying a context menu over the user's foreground application.
const originalSpawn = childProcess.spawn;
const directory = fileURLToPath(new URL('.', import.meta.url));
const root = process.env.SCOTTY_TRAY_SMOKE_DIR;
childProcess.spawn = (command, args = [], options = {}) => {
  const kind = /(^|[\\/])(?:powershell|pwsh)(?:\.exe)?$/i.test(command) ? 'tray' : 'server';
  let actualArgs = args;
  if (kind === 'tray' && process.env.SCOTTY_TRAY_SMOKE_ACTION === 'exit') {
    const value = name => args[args.findIndex(arg => arg.toLowerCase() === name.toLowerCase()) + 1];
    actualArgs = ['-NoLogo', '-NoProfile', '-NonInteractive', '-STA', '-WindowStyle', 'Hidden',
      '-File', path.join(directory, 'windows-tray-click.ps1'),
      '-TrayScript', value('-File'), '-ParentProcessId', value('-ParentProcessId'),
      '-Url', value('-Url'), '-ExitFile', path.join(root, 'click-exit'),
      '-ReceiptFile', path.join(root, 'icon-receipt.json')];
  }
  const startedAfter = Date.now();
  const child = originalSpawn(command, actualArgs, options);
  // Record the PID synchronously, before control returns to a controller that
  // might fail during startup. Failed OS spawns have no PID to own or clean.
  if (child.pid) fs.appendFileSync(path.join(root, 'processes.jsonl'), `${JSON.stringify({
    kind, pid: child.pid, command, args: actualArgs, windowsHide: options.windowsHide,
    startedAfter, recordedAt: Date.now(),
  })}\n`);
  return child;
};
syncBuiltinESMExports();
