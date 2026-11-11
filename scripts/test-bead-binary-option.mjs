import assert from 'node:assert/strict';
import test from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beadBinaryOptions } from '../bin/backend-binary.mjs';

const execute = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));

test('binary selection resolves against the invoking folder and retains other options', () => {
  const relative = path.relative(root, process.execPath);
  assert.deepEqual(beadBinaryOptions(['--port', '4123', '--bead-bin', relative, '--no-open'], root), {
    args: ['--port', '4123', '--no-open'], beadBin: process.execPath,
  });
  assert.deepEqual(beadBinaryOptions([`--bead-bin=${process.execPath}`, '--help'], root), {
    args: ['--help'], beadBin: process.execPath,
  });
  assert.deepEqual(beadBinaryOptions(['--no-open'], root), { args: ['--no-open'], beadBin: undefined });
});

test('missing values and directories fail before server creation', () => {
  for (const args of [['--bead-bin'], ['--bead-bin='], ['--bead-bin', '--help']]) {
    assert.throws(() => beadBinaryOptions(args, root), /requires an executable path/);
  }
  assert.throws(() => beadBinaryOptions(['--bead-bin', root], root), /Cannot use bead-rs executable/);
});

test('launcher refuses a missing explicitly selected bead binary before starting', async () => {
  const missing = path.join(root, 'definitely-absent-bead-binary');
  await assert.rejects(
    () => execute(process.execPath, ['bin/bead-me-up-scotty.mjs', '--bead-bin', missing, '--help'], { cwd: root, timeout: 10000 }),
    (error) => error.code === 1 && error.stderr.includes('Cannot use bead-rs executable') && error.stderr.includes(missing),
  );
});
