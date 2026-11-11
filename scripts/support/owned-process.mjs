import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';

/** Start a test command and keep its cleanup attached to this invocation. */
export async function startOwnedProcess(executable, args, options) {
  const child = spawn(executable, args, options);
  const completion = once(child, 'exit');
  return {
    pid: child.pid,
    get exitCode() { return child.exitCode; },
    async stop() {
      if (child.exitCode === null) child.kill('SIGTERM');
      const [code, signal] = await Promise.race([
        completion,
        delay(10000, undefined, { ref: false }).then(() => { throw new Error('owned command exit unobserved'); }),
      ]);
      return { code, signal };
    },
  };
}
