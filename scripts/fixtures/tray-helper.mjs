import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const root = process.env.SCOTTY_TRAY_TEST_DIR;
const events = path.join(root, 'events.jsonl');
function record(event) {
  fs.appendFileSync(events, `${JSON.stringify({ event, pid: process.pid })}\n`);
}
record('tray_started');
if (process.env.SCOTTY_TRAY_TEST_HELPER_MODE === 'failure') {
  process.stderr.write('Windows tray fixture initialization failed\n');
  process.exit(23);
}

process.stdout.write('READY\n');
const input = readline.createInterface({ input: process.stdin });
function dispose() {
  record('tray_disposed');
  process.exit(0);
}
input.on('line', line => {
  if (line === 'STOP') dispose();
});
input.on('close', dispose);
const timer = setInterval(() => {
  if (fs.existsSync(path.join(root, 'click-exit'))) {
    clearInterval(timer);
    record('tray_exit_clicked');
    // Repeated activation must never turn a requested stop into a restart.
    process.stdout.write('EXIT\nEXIT\n');
  }
  if (fs.existsSync(path.join(root, 'fail-helper'))) process.exit(29);
}, 20);
