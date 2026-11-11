import { createWindowsTray } from './windows-tray.mjs';

/**
 * Keep the server and its tray under one shutdown owner. Completion is reported
 * only after both children have exited; update restarts reuse the same tray.
 */
export function createServerController({ launchServer, url, restartExitCode,
  shutdownTimeoutMs = 5000, onRestart = () => {}, onStopping = () => {} }) {
  let phase = 'starting';
  let server;
  let serverClosed = Promise.resolve();
  let tray;
  let stopOperation;
  let resultCode = 0;
  let finish;
  const completion = new Promise(resolve => { finish = resolve; });

  function reportFailure(error) {
    console.error(error.message);
    if (resultCode === 0) resultCode = 1;
    void stop({ exitCode: resultCode });
  }

  function forceServer() {
    if (server && server.exitCode === null && server.signalCode === null) {
      if (resultCode === 0) resultCode = 1;
      try { server.kill('SIGKILL'); }
      catch (error) { console.error(`Could not stop the server: ${error.message}`); }
    }
  }

  function signalStop(signal) {
    if (phase === 'stopping') forceServer();
    else void stop({ signal });
  }
  const interrupt = () => signalStop('SIGINT');
  const terminate = () => signalStop('SIGTERM');
  const parentExit = () => {
    // This synchronous fallback covers a process.exit outside the normal path.
    // The tray independently watches the parent handle and its input pipe.
    try { server?.kill(); } catch { /* the owned server may already have exited */ }
  };
  process.on('SIGINT', interrupt);
  process.on('SIGTERM', terminate);
  process.on('exit', parentExit);

  function launch() {
    if (phase !== 'running') return;
    try { server = launchServer(); }
    catch (error) { reportFailure(error); return; }
    const current = server;
    serverClosed = new Promise(resolve => current.once('close', resolve));
    current.once('error', error => reportFailure(new Error(`Server could not start: ${error.message}`)));
    current.once('close', (code, signal) => {
      if (phase !== 'running') return;
      if (restartExitCode !== undefined && code === restartExitCode) {
        onRestart();
        launch();
      } else {
        void stop({ exitCode: signal ? 128 : (code ?? 1) });
      }
    });
  }

  /** Idempotently stop the current server and helper, preserving an earlier failure. */
  function stop({ signal = 'SIGTERM', exitCode = 0 } = {}) {
    if (exitCode !== 0 && resultCode === 0) resultCode = exitCode;
    if (stopOperation) return stopOperation;
    phase = 'stopping';
    stopOperation = (async () => {
      try {
        if (server && server.exitCode === null && server.signalCode === null) {
          onStopping();
          const timer = setTimeout(forceServer, shutdownTimeoutMs);
          try {
            server.kill(signal);
            await serverClosed;
          } finally { clearTimeout(timer); }
        } else {
          await serverClosed;
        }
      } catch (error) {
        console.error(`Server shutdown failed: ${error.message}`);
        if (resultCode === 0) resultCode = 1;
        forceServer();
        await serverClosed;
      }
      try { await tray?.stop(); }
      catch (error) {
        console.error(`Windows tray cleanup failed: ${error.message}`);
        if (resultCode === 0) resultCode = 1;
      }
      process.off('SIGINT', interrupt);
      process.off('SIGTERM', terminate);
      process.off('exit', parentExit);
      phase = 'closed';
      finish(resultCode);
    })();
    return stopOperation;
  }

  return {
    completion,
    stop,
    async start() {
      try {
        tray = createWindowsTray({ url, onExit: () => { void stop(); }, onFailure: reportFailure });
        await tray.ready;
        if (phase === 'starting') {
          phase = 'running';
          launch();
        }
      } catch (error) {
        if (phase === 'starting') reportFailure(error);
        await stop();
      }
      return phase;
    },
  };
}
