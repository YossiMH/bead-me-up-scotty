import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import crypto from 'node:crypto';

const execute = promisify(execFile);

export function isolateFixtureGit() {
  const ceiling = process.env.SCOTTY_TEST_ROOT;
  for (const name of Object.keys(process.env)) {
    if (name.toUpperCase().startsWith('GIT_')) delete process.env[name];
  }
  process.env.GIT_CONFIG_GLOBAL = process.platform === 'win32' ? 'NUL' : '/dev/null';
  process.env.GIT_CONFIG_NOSYSTEM = '1';
  process.env.GIT_CEILING_DIRECTORIES = ceiling;
  process.env.GIT_TERMINAL_PROMPT = '0';
}

export async function initializeGitFixture(workspace) {
  await execute('git', ['init', '--quiet', '--initial-branch=codex/scotty-fixture', '--template='], {
    cwd: workspace, env: process.env, timeout: 15000, windowsHide: true,
  });
}

export function createUnrelatedMarker(workspace) {
  const filename = 'scotty-unrelated-marker.txt';
  const contents = 'Unrelated project content must remain untracked and unchanged.\n';
  fs.writeFileSync(path.join(workspace, filename), contents, { flag: 'wx' });
  return { filename, contents };
}

export async function assertGitCheckpoint(workspace, marker) {
  assert.equal(fs.readFileSync(path.join(workspace, marker.filename), 'utf8'), marker.contents);
  const git = async (args, encoding = 'utf8') => execute('git', args, {
    cwd: workspace, env: process.env, timeout: 15000, encoding,
    maxBuffer: 4 * 1024 * 1024, windowsHide: true,
  });
  const staged = (await git(['diff', '--cached', '--name-only', '--no-renames'])).stdout.trim().split(/\r?\n/).filter(Boolean);
  assert.ok(staged.includes('.beads/checkpoint/current.json'), 'native changes must stage the checkpoint pointer in this Git repository');
  assert.ok(staged.every((filename) => filename.startsWith('.beads/checkpoint/')), 'only checkpoint files may be staged by the native operations');
  const checkpoint = path.join(workspace, '.beads', 'checkpoint');
  const pointer = JSON.parse(fs.readFileSync(path.join(checkpoint, 'current.json'), 'utf8'));
  assert.equal(pointer.format, 'checkpoint-set-v2', 'the selected fork must publish its current checkpoint format');
  const referenced = [];
  const readReference = async (reference) => {
    assert.equal(typeof reference.path, 'string');
    assert.equal(path.posix.normalize(reference.path), reference.path);
    assert.ok(!path.posix.isAbsolute(reference.path) && !reference.path.startsWith('../')
      && reference.path !== '..' && !reference.path.includes('\\') && !/^[A-Za-z]:/.test(reference.path));
    const filename = `.beads/checkpoint/${reference.path}`;
    assert.ok(staged.includes(filename), `current checkpoint reference must be staged: ${filename}`);
    const bytes = fs.readFileSync(path.join(checkpoint, reference.path));
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), reference.sha256);
    assert.deepEqual((await git(['show', `:${filename}`], null)).stdout, bytes, `staged reference must match the current file: ${filename}`);
    referenced.push(filename);
    return bytes;
  };
  assert.deepEqual((await git(['show', ':.beads/checkpoint/current.json'], null)).stdout, fs.readFileSync(path.join(checkpoint, 'current.json')));
  const manifest = JSON.parse((await readReference(pointer.active_root)).toString('utf8'));
  for (const reference of [...manifest.shards, ...manifest.segments, manifest.tail]) await readReference(reference);
  const markerStatus = (await git(['status', '--porcelain=v1', '--untracked-files=all', '--', marker.filename])).stdout.trim();
  assert.equal(markerStatus, `?? ${marker.filename}`, 'native checkpoint staging must leave the unrelated marker untracked');
  return { staged, referenced, markerStatus, markerContents: 'unchanged' };
}
