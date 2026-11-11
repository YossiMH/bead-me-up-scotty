import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const [role, directory] = process.argv.slice(2);
if (role === 'root') {
  spawn(process.execPath, [fileURLToPath(import.meta.url), 'leaf', directory], {
    stdio: 'ignore', windowsHide: true,
  });
} else {
  fs.writeFileSync(path.join(directory, 'leaf.json'), JSON.stringify({ pid: process.pid }));
}
const deadline = Date.now() + 10000;
const clock = setInterval(() => {
  if (Date.now() >= deadline || fs.existsSync(path.join(directory, 'stop'))) {
    clearInterval(clock);
    process.exit(0);
  }
}, 10);
