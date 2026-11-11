import childProcess from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { syncBuiltinESMExports } from 'node:module';
import { fileURLToPath } from 'node:url';

// Substitute only the unavailable Windows process boundary. The controllers,
// pipes, server children, signals and process termination remain real.
const directory = fileURLToPath(new URL('.', import.meta.url));
const originalSpawn = childProcess.spawn;
const root = process.env.SCOTTY_TRAY_TEST_DIR;
Object.defineProperty(process, 'platform', {
  value: process.env.SCOTTY_TRAY_TEST_PLATFORM || 'win32',
});

childProcess.spawn = (command, args = [], options = {}) => {
  if (!/(^|[\\/])(?:powershell|pwsh)(?:\.exe)?$/i.test(command)) {
    return originalSpawn(command, args, options);
  }
  fs.appendFileSync(path.join(root, 'events.jsonl'), `${JSON.stringify({
    event: 'tray_spawn', command, args,
    windowsHide: options.windowsHide, shell: options.shell,
  })}\n`);
  return originalSpawn(process.execPath, [path.join(directory, 'tray-helper.mjs')], {
    ...options,
    env: { ...process.env, ...options.env },
  });
};
syncBuiltinESMExports();
