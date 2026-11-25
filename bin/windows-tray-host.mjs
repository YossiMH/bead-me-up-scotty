import path from 'node:path';
import { spawn } from 'node:child_process';

// A detached Node process can run without a Windows console. It keeps the
// ordinary PowerShell child in its own Job until that child finishes cleanup.
const [script, parentProcessId, url, cacheDirectory] = process.argv.slice(2);
if (process.platform !== 'win32' || process.argv.length !== 6 ||
    !path.isAbsolute(script || '') || !path.isAbsolute(cacheDirectory || '') ||
    path.dirname(script) !== cacheDirectory || path.basename(script) !== 'windows-tray.ps1' ||
    !/^[1-9][0-9]*$/.test(parentProcessId || '') || !Number.isSafeInteger(Number(parentProcessId)) || !url) {
  throw new Error('Windows tray host received invalid helper arguments.');
}
const executable = path.win32.join(process.env.SystemRoot || 'C:\\Windows',
  'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
const child = spawn(executable, ['-NoLogo', '-NoProfile', '-NonInteractive',
  '-STA', '-WindowStyle', 'Hidden', '-File', script,
  '-ParentProcessId', parentProcessId, '-Url', url, '-CacheDirectory', cacheDirectory], {
  detached: false, windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'],
});
let stopping = false;
let closed = false;
let failed = false;
let forced = false;
let shutdownTimer;

function report(message) {
  if (!process.stderr.destroyed) process.stderr.write('Windows tray host: ' + message + '\n');
}
function stopInput() {
  if (closed || stopping) return;
  stopping = true;
  process.stdin.unpipe(child.stdin);
  process.stdin.pause();
  if (!child.stdin.destroyed) child.stdin.end();
  // Normal Forms cleanup observes STOP, EOF or the original parent handle.
  // Leave room for the controller's existing three-second shutdown deadline.
  shutdownTimer = setTimeout(() => {
    if (closed) return;
    forced = true;
    report('PowerShell required forced termination.');
    child.kill('SIGKILL');
  }, 2000);
}
function parentOutputClosed(stream) {
  // Losing the controller must not turn EPIPE into an immediate host crash.
  // Drain the helper's remaining output while it runs its finally block.
  child[stream].unpipe(process[stream]);
  child[stream].resume();
  stopInput();
}
process.stdout.on('error', () => parentOutputClosed('stdout'));
process.stderr.on('error', () => parentOutputClosed('stderr'));
process.stdin.on('error', stopInput);
process.stdin.on('end', stopInput);
process.on('SIGINT', stopInput);
process.on('SIGTERM', stopInput);
child.stdin.on('error', error => {
  if (!stopping && child.exitCode === null) {
    failed = true;
    report('PowerShell input failed: ' + error.message);
  }
  stopInput();
});
for (const stream of ['stdout', 'stderr']) {
  child[stream].on('error', error => {
    failed = true;
    report('PowerShell ' + stream + ' failed: ' + error.message);
    stopInput();
  });
}
child.once('error', error => {
  failed = true;
  report('PowerShell could not start: ' + error.message);
  stopInput();
});
child.once('close', (code, signal) => {
  closed = true;
  clearTimeout(shutdownTimer);
  process.stdin.unpipe(child.stdin);
  process.stdin.destroy();
  process.off('SIGINT', stopInput);
  process.off('SIGTERM', stopInput);
  process.exitCode = failed || forced || signal || !Number.isInteger(code) ? 1 : code;
});

// Each layer owns fresh pipes: inheriting descriptors can change Windows
// console creation. pipe() also preserves stream backpressure and final bytes.
process.stdin.pipe(child.stdin);
child.stdout.pipe(process.stdout, { end: false });
child.stderr.pipe(process.stderr, { end: false });
