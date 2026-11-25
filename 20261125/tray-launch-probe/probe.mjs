import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const self = fileURLToPath(import.meta.url);
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const hash = p => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const powershell = path.win32.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
function write(p, value) { fs.writeFileSync(p, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' }); }
function psArgs(script, out, mode, parent) {
  return ['-NoLogo', '-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden',
    '-File', script, '-OutputDirectory', out, '-Mode', mode, '-ParentProcessId', String(parent)];
}
function options(detached) { return { detached, windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'] }; }
function alive(pid) { try { process.kill(pid, 0); return true; } catch (e) { if (e.code === 'ESRCH') return false; throw e; } }
async function until(predicate, ms, label) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (predicate()) return; await pause(50); }
  throw new Error('Timed out: ' + label);
}
if (process.argv[2] === '--host') {
  const [script, out, mode, parent] = process.argv.slice(3);
  const args = psArgs(script, out, mode, parent);
  const child = spawn(powershell, args, options(false));
  write(path.join(out, 'host-start.json'), {
    pid: process.pid, parentPid: process.ppid, startedAt: Date.now(), node: process.version,
    childPid: child.pid ?? null, command: powershell, args, options: options(false),
  });
  let childClosed = false;
  let forwarding = true;
  let inputError = null;
  const closeInput = () => { if (!child.stdin.destroyed) child.stdin.end(); };
  process.stdout.on('error', () => { forwarding = false; closeInput(); });
  process.stderr.on('error', () => { forwarding = false; closeInput(); });
  child.stdin.on('error', e => { inputError = e.message; });
  process.stdin.on('error', closeInput);
  process.stdin.on('data', bytes => { if (!child.stdin.destroyed) child.stdin.write(bytes); });
  process.stdin.on('end', closeInput);
  child.stdout.on('data', bytes => { if (forwarding && !process.stdout.destroyed) process.stdout.write(bytes); });
  child.stderr.on('data', bytes => { if (forwarding && !process.stderr.destroyed) process.stderr.write(bytes); });
  const lifetime = setTimeout(() => { if (!childClosed) child.kill('SIGKILL'); }, 12000);
  child.on('error', e => { write(path.join(out, 'host-spawn-error.json'), { message: e.message }); process.exitCode = 1; });
  child.once('close', (code, signal) => {
    childClosed = true; clearTimeout(lifetime); process.stdin.destroy();
    write(path.join(out, 'host-close.json'), { pid: process.pid, childPid: child.pid, code, signal, inputError, endedAt: Date.now() });
    process.exitCode = Number.isInteger(code) ? code : 1;
  });
} else if (process.argv[2] === '--controller') {
  const [script, out] = process.argv.slice(3);
  const args = ['--max-old-space-size=64', self, '--host', script, out, 'ParentLoss', String(process.pid)];
  const child = spawn(process.execPath, args, options(true));
  write(path.join(out, 'controller-start.json'), { pid: process.pid, parentPid: process.ppid, childPid: child.pid, command: process.execPath, args, options: options(true) });
  child.stdin.on('error', () => {});
  child.stdout.on('data', bytes => {
    if (bytes.toString().includes('READY') && !fs.existsSync(path.join(out, 'controller-ready.json')))
      write(path.join(out, 'controller-ready.json'), { ready: true, pid: process.pid });
  });
  child.stderr.on('data', bytes => process.stderr.write(bytes));
  const timer = setTimeout(() => { if (!child.stdin.destroyed) child.stdin.end(); }, 14000);
  child.once('error', () => { process.exitCode = 1; });
  child.once('close', code => { clearTimeout(timer); process.exitCode = Number.isInteger(code) ? code : 1; });
} else {
  const output = path.resolve(process.argv[2] || 'tray-launch-probe-output');
  const script = path.join(path.dirname(self), 'marker.ps1');
  assert.equal(process.platform, 'win32'); assert.equal(process.version, 'v25.2.1');
  assert(!fs.existsSync(output), 'Refuse existing output'); fs.mkdirSync(output, { recursive: true });
  const cases = [], handles = [];
  const result = { status: 'running', startedAt: new Date().toISOString(), platform: process.platform,
    node: process.version, libuv: process.versions.uv, selfSha256: hash(self), markerSha256: hash(script),
    noNextOrForms: true, noPcAccess: true, cases };
  function capture(command, args, opts, directory) {
    const record = { command, args, options: opts, stdout: '', stderr: '', startedAt: Date.now(), pid: null };
    const child = spawn(command, args, opts); handles.push(child); record.pid = child.pid ?? null;
    let settled = false;
    const closed = new Promise(resolve => {
      child.on('error', error => { record.error = error.message; });
      child.stdin.on('error', error => { record.stdinError = error.message; });
      for (const field of ['stdout', 'stderr']) child[field].on('data', bytes => {
        record[field] += bytes.toString();
        if (record[field].length > 262144) { record.excessOutput = true; child.kill('SIGKILL'); }
      });
      const deadline = setTimeout(() => { record.timedOut = true; child.kill('SIGKILL'); }, 15000);
      child.once('close', (code, signal) => {
        clearTimeout(deadline); settled = true; record.code = code; record.signal = signal;
        record.elapsedMs = Date.now() - record.startedAt; write(path.join(directory, 'launch.json'), record); resolve(record);
      });
    });
    return { child, record, closed, get settled() { return settled; } };
  }
  const absoluteDeadline = setTimeout(() => {
    result.overallTimedOut = true;
    for (const child of handles) if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  }, 120000);
  try {
    for (const mode of ['attached', 'detached', 'host']) {
      const directory = path.join(output, mode); fs.mkdirSync(directory);
      const hosted = mode === 'host';
      const invocation = capture(hosted ? process.execPath : powershell,
        hosted ? ['--max-old-space-size=64', self, '--host', script, directory, 'Marker', String(process.pid)]
          : psArgs(script, directory, 'Marker', process.pid), options(mode !== 'attached'), directory);
      const record = await invocation.closed;
      const entryPath = path.join(directory, 'entry.json'), finalPath = path.join(directory, 'finally.json');
      const item = { name: mode, launch: record, entry: fs.existsSync(entryPath) ? JSON.parse(fs.readFileSync(entryPath, 'utf8')) : null,
        final: fs.existsSync(finalPath) ? JSON.parse(fs.readFileSync(finalPath, 'utf8')) : null };
      cases.push(item); assert(!record.timedOut && !record.error && !record.excessOutput);
      if (mode === 'detached') {
        assert.equal(record.code, 0, 'Documented detached PowerShell exit');
        assert.equal(item.entry, null, 'Detached PowerShell did not enter script'); assert.equal(item.final, null);
      } else {
        assert.equal(record.code, 7, 'Script-controlled exit relayed');
        assert(item.entry && item.final && item.final.completed); assert(record.stdout.includes('READY'));
      }
      if (hosted) {
        item.host = JSON.parse(fs.readFileSync(path.join(directory, 'host-start.json'), 'utf8'));
        item.hostClose = JSON.parse(fs.readFileSync(path.join(directory, 'host-close.json'), 'utf8'));
        assert.equal(item.host.options.detached, false);
        await until(() => !alive(item.host.childPid), 2000, 'host child ended');
      }
      item.status = 'passed';
    }
    const directory = path.join(output, 'parent-loss'); fs.mkdirSync(directory);
    const invocation = capture(process.execPath, ['--max-old-space-size=64', self, '--controller', script, directory], options(false), directory);
    const item = { name: 'parent-loss', status: 'running' }; cases.push(item);
    await until(() => fs.existsSync(path.join(directory, 'controller-ready.json')) || invocation.settled, 10000, 'controller readiness');
    assert(!invocation.settled, 'Controller must still run before forced parent loss');
    item.controller = JSON.parse(fs.readFileSync(path.join(directory, 'controller-start.json'), 'utf8'));
    item.host = JSON.parse(fs.readFileSync(path.join(directory, 'host-start.json'), 'utf8'));
    item.entry = JSON.parse(fs.readFileSync(path.join(directory, 'entry.json'), 'utf8'));
    assert.equal(item.entry.parentProcessId, invocation.child.pid, 'PowerShell watches original controller');
    assert.equal(item.controller.options.detached, true); assert.equal(item.host.options.detached, false);
    invocation.child.kill('SIGKILL'); item.controllerExit = await invocation.closed;
    await until(() => fs.existsSync(path.join(directory, 'finally.json')) && fs.existsSync(path.join(directory, 'host-close.json')), 5000, 'graceful child finally after controller loss');
    item.final = JSON.parse(fs.readFileSync(path.join(directory, 'finally.json'), 'utf8'));
    item.hostClose = JSON.parse(fs.readFileSync(path.join(directory, 'host-close.json'), 'utf8'));
    assert(item.final.completed && item.final.parentLost); assert.equal(item.hostClose.code, 0);
    await until(() => !alive(item.host.pid) && !alive(item.host.childPid), 2000, 'host and child ended');
    item.status = 'passed'; result.status = 'passed';
  } catch (error) {
    result.status = 'failed'; result.error = error.stack; process.exitCode = 1;
  } finally {
    clearTimeout(absoluteDeadline);
    for (const child of handles) if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    const recorded = [];
    for (const name of fs.readdirSync(output)) {
      const directory = path.join(output, name);
      for (const filename of ['host-start.json', 'controller-start.json']) {
        const file = path.join(directory, filename);
        if (fs.existsSync(file)) {
          const r = JSON.parse(fs.readFileSync(file, 'utf8'));
          for (const pid of [r.pid, r.childPid]) if (Number.isInteger(pid)) recorded.push(pid);
        }
      }
    }
    await until(() => recorded.every(pid => !alive(pid)), 15000, 'all recorded children ended')
      .catch(error => { result.status = 'failed'; result.cleanupError = error.message; process.exitCode = 1; });
    result.recordedProcesses = [...new Set(recorded)].map(pid => ({ pid, alive: alive(pid) }));
    result.completedAt = new Date().toISOString(); write(path.join(output, 'result.json'), result);
    const bytes = fs.readFileSync(path.join(output, 'result.json'));
    console.log('TRAY_PROBE_RESULT_SHA256=' + createHash('sha256').update(bytes).digest('hex'));
    console.log('TRAY_PROBE_RESULT_BASE64=' + bytes.toString('base64'));
  }
}
