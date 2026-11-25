import childProcess from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { syncBuiltinESMExports } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

// The Windows smoke drives the real menu item inside its STA helper. This
// avoids displaying a context menu over the user's foreground application.
const originalSpawn = childProcess.spawn;
const directory = fileURLToPath(new URL('.', import.meta.url));
const root = process.env.SCOTTY_TRAY_SMOKE_DIR;
const digest = filename => createHash('sha256').update(fs.readFileSync(filename)).digest('hex');

// Only the test click wrapper is materialized here. The production owner must
// supply its own helper path; copying it here would conceal a product defect.
function cacheClickFixture() {
  const local = process.env.LOCALAPPDATA;
  if (!local || !path.isAbsolute(local)) throw new Error('The tray smoke needs absolute LOCALAPPDATA.');
  const cacheRoot = path.join(local, 'bead-me-up-scotty', 'tray-smoke');
  fs.mkdirSync(cacheRoot, { recursive: true });
  const session = fs.mkdtempSync(path.join(cacheRoot, 'session-'));
  const script = path.join(session, 'windows-tray-click.ps1');
  function remove() {
    try { fs.unlinkSync(script); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    try { fs.rmdirSync(session); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  try {
    const source = path.join(directory, 'windows-tray-click.ps1');
    const sourceHash = digest(source);
    fs.copyFileSync(source, script, fs.constants.COPYFILE_EXCL);
    if (digest(script) !== sourceHash) throw new Error('Copied click fixture differs from its source.');
    return { session, script, remove };
  } catch (error) {
    try { remove(); } catch (cleanupError) { console.error('Tray fixture cleanup:', cleanupError.message); }
    throw error;
  }
}

childProcess.spawn = (command, args = [], options = {}) => {
  const hostScript = command === process.execPath
    ? args.find(arg => /[\\/]windows-tray-host\.mjs$/.test(arg)) : undefined;
  const kind = hostScript ? 'tray-host'
    : /(^|[\\/])(?:powershell|pwsh)(?:\.exe)?$/i.test(command) ? 'tray' : 'server';
  const hostScriptSha256 = hostScript ? digest(hostScript) : undefined;
  if (hostScript && hostScriptSha256 !== digest(path.resolve(directory, '../../bin/windows-tray-host.mjs'))) {
    throw new Error('Observed Node tray host differs from the bundled source.');
  }
  const value = name => {
    const index = args.findIndex(arg => arg.toLowerCase() === name.toLowerCase());
    return index < 0 ? undefined : args[index + 1];
  };
  const helperScript = kind === 'tray' ? value('-File') : undefined;
  const helperScriptSha256 = helperScript ? digest(helperScript) : undefined;
  if (kind === 'tray' && helperScriptSha256 !== digest(path.resolve(directory, '../../bin/windows-tray.ps1'))) {
    throw new Error('Observed production helper differs from the bundled source.');
  }
  // The host is a separate Node process; observe its real PowerShell child too.
  let actualArgs = hostScript ? ['--import', import.meta.url, ...args] : args;
  let fixture;
  if (kind === 'tray' && process.env.SCOTTY_TRAY_SMOKE_ACTION === 'exit') {
    fixture = cacheClickFixture();
    actualArgs = ['-NoLogo', '-NoProfile', '-NonInteractive', '-STA', '-WindowStyle', 'Hidden',
      '-File', fixture.script, '-FixtureDirectory', fixture.session,
      '-TrayScript', helperScript, '-ParentProcessId', value('-ParentProcessId'),
      '-Url', value('-Url'), '-ExitFile', path.join(root, 'click-exit'),
      '-ReceiptFile', path.join(root, 'icon-receipt.json')];
  }
  const cleanup = () => {
    try { fixture?.remove(); process.off('exit', cleanup); }
    catch (error) { console.error('Tray fixture cleanup:', error.message); }
  };
  if (fixture) process.on('exit', cleanup);
  const startedAfter = Date.now();
  let child;
  try { child = originalSpawn(command, actualArgs, options); }
  catch (error) { cleanup(); throw error; }
  if (fixture) child.once('close', cleanup);
  // Record the PID synchronously, before control returns to a controller that
  // might fail during startup. Failed OS spawns have no PID to own or clean.
  if (child.pid) fs.appendFileSync(path.join(root, 'processes.jsonl'), `${JSON.stringify({
    kind, pid: child.pid, parentPid: process.pid, command, args: actualArgs,
    windowsHide: options.windowsHide, detached: options.detached, stdio: options.stdio,
    hostScript, hostScriptSha256,
    helperScript, helperScriptSha256,
    startedAfter, recordedAt: Date.now(),
  })}\n`);
  return child;
};
syncBuiltinESMExports();
