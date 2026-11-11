import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/** Materialize the bundled script in one user-owned local session. */
function prepareHelperCopy() {
  const local = process.env.LOCALAPPDATA;
  if (!local || !path.isAbsolute(local)) {
    throw new Error('Windows tray needs an absolute LOCALAPPDATA directory.');
  }
  const root = path.join(local, 'bead-me-up-scotty', 'tray');
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  const directory = fs.mkdtempSync(path.join(root, 'session-'));
  const script = path.join(directory, 'windows-tray.ps1');
  function remove() {
    // Never remove shared parents, other sessions or unexpected extra files.
    try { fs.unlinkSync(script); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    try { fs.rmdirSync(directory); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  try {
    const bundled = fileURLToPath(new URL('./windows-tray.ps1', import.meta.url));
    fs.copyFileSync(bundled, script, fs.constants.COPYFILE_EXCL);
    return { directory, script, remove };
  } catch (error) {
    try { remove(); } catch (cleanupError) { console.error('Windows tray cache cleanup:', cleanupError.message); }
    throw error;
  }
}

/** Own one Windows Forms helper for the lifetime of a server controller. */
export function createWindowsTray({ url, onExit, onFailure }) {
  if (process.platform !== 'win32' || process.env.BMUS_TRAY === '0') {
    return { ready: Promise.resolve(), stop: async () => {} };
  }

  const copy = prepareHelperCopy();
  let cleanupError;
  function removeCopy() {
    try {
      copy.remove();
      cleanupError = undefined;
      process.off('exit', parentExit);
    } catch (error) {
      cleanupError = new Error(`Windows tray cache could not be removed: ${error.message}`);
    }
  }
  function parentExit() {
    removeCopy();
    if (cleanupError) console.error(cleanupError.message);
  }
  process.on('exit', parentExit);
  const executable = path.win32.join(process.env.SystemRoot || 'C:\\Windows',
    'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  let child;
  try {
    child = spawn(executable, ['-NoLogo', '-NoProfile', '-NonInteractive',
      '-STA', '-WindowStyle', 'Hidden', '-File', copy.script,
      '-ParentProcessId', String(process.pid), '-Url', url, '-CacheDirectory', copy.directory], {
      windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (error) {
    removeCopy();
    if (cleanupError) console.error(cleanupError.message);
    throw error;
  }
  let phase = 'starting';
  let output = '';
  let diagnostic = '';
  let stopOperation;
  let acceptReady;
  let rejectReady;
  const ready = new Promise((resolve, reject) => {
    acceptReady = resolve;
    rejectReady = reject;
  });
  const closed = new Promise(resolve => child.once('close', resolve));

  function fail(error) {
    if (['failed', 'stopping', 'closed', 'exit-requested'].includes(phase)) return;
    phase = 'failed';
    clearTimeout(startupTimer);
    rejectReady(error);
    onFailure(error);
  }

  const startupTimer = setTimeout(() => {
    fail(new Error('Windows tray did not become ready within 15 seconds'));
  }, 15000);
  child.on('error', error => fail(new Error(`Windows tray could not start: ${error.message}`)));
  child.stderr.on('data', chunk => { diagnostic = (diagnostic + chunk).slice(-4096); });
  child.stdin.on('error', error => fail(new Error(`Windows tray input failed: ${error.message}`)));
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', chunk => {
    output += chunk;
    if (output.length > 4096) {
      fail(new Error('Windows tray sent an oversized response'));
      return;
    }
    let end;
    while ((end = output.indexOf('\n')) >= 0) {
      const line = output.slice(0, end).replace(/\r$/, '');
      output = output.slice(end + 1);
      if (line === 'READY' && phase === 'starting') {
        phase = 'ready';
        clearTimeout(startupTimer);
        acceptReady();
      } else if (line === 'EXIT' && phase === 'ready') {
        phase = 'exit-requested';
        onExit();
      } else if (line === 'EXIT' && ['exit-requested', 'stopping', 'closed'].includes(phase)) {
        continue;
      } else if (!['stopping', 'closed', 'failed'].includes(phase)) {
        fail(new Error(`Windows tray sent an unexpected response: ${line}`));
      }
    }
  });
  child.once('close', (code, signal) => {
    clearTimeout(startupTimer);
    removeCopy();
    if (['starting', 'ready'].includes(phase)) {
      const details = diagnostic.trim() || `exit ${code ?? signal ?? 'unknown'}`;
      fail(new Error(`Windows tray stopped unexpectedly: ${details}`));
    }
    phase = 'closed';
  });

  return {
    ready,
    /** Ask the helper to dispose its icon, then observe its actual termination. */
    stop() {
      if (stopOperation) return stopOperation;
      stopOperation = (async () => {
        clearTimeout(startupTimer);
        if (phase === 'closed') {
          if (cleanupError) throw cleanupError;
          return;
        }
        if (phase === 'starting') rejectReady(new Error('Windows tray startup was cancelled'));
        phase = 'stopping';
        if (!child.stdin.destroyed) child.stdin.end('STOP\n');
        let shutdown = 'requested';
        const timer = setTimeout(() => {
          shutdown = 'forced';
          child.kill('SIGKILL');
        }, 3000);
        try {
          await closed;
          if (cleanupError) throw cleanupError;
          if (shutdown === 'forced') throw new Error('Windows tray required forced termination');
        }
        finally { clearTimeout(timer); }
      })();
      return stopOperation;
    },
  };
}
