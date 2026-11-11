import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const root = process.env.SCOTTY_TRAY_TEST_DIR;
const mode = process.env.SCOTTY_TRAY_TEST_SERVER_MODE;
function record(event, extra = {}) {
  fs.appendFileSync(path.join(root, 'events.jsonl'), `${JSON.stringify({
    event, pid: process.pid, ...extra,
  })}\n`);
}
record('server_started', { args: process.argv.slice(2) });
const restartMarker = path.join(root, 'server-restarted');
if (mode === 'restart' && !fs.existsSync(restartMarker)) {
  fs.writeFileSync(restartMarker, 'first child');
  setTimeout(() => process.exit(75), 80);
} else {
  const args = process.argv.slice(2);
  const portIndex = args.findLastIndex(value => value === '-p' || value === '--port');
  const port = Number(portIndex < 0 ? process.env.PORT : args[portIndex + 1]);
  const server = http.createServer((_request, response) => response.end('ready'));
  server.listen(port, '127.0.0.1', () => record('server_ready', { port }));
  for (const signal of ['SIGTERM', 'SIGINT']) {
    process.on(signal, () => {
      record('server_stop', { signal });
      setTimeout(() => server.close(() => process.exit(mode === 'restart-on-stop' ? 75 : 0)), 80);
    });
  }
  setInterval(() => {
    if (fs.existsSync(path.join(root, 'fail-server'))) server.close(() => process.exit(17));
  }, 20).unref();
}
