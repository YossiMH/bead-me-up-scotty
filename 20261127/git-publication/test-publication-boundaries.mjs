import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { CLEANUP_REFS, CONFIGURED_HOOK_QUERY, requireNoConfiguredHooks, parseChanges, requireDocumentChanges, verifyDocumentWorkingFile, requireCheckpointChanges, reviewedRefSet, reviewedRefsDigest } from './publish-reviewed-git-20261127.mjs';

const file = path => ({ path, mode: '100644', bytes: 19, sha256: 'a'.repeat(64), git_blob: 'b'.repeat(40), working_bytes: 21, working_sha256: 'c'.repeat(64) });
const checkpoint = ['.beads/checkpoint/current.json', '.beads/checkpoint/previous.json', '.beads/checkpoint/set/manifest-example.json'];
const changes = names => names.map(path => ({ path, status: 'M' }));

test('NUL-delimited Git paths preserve spaces and reject rename/unmerged records', () => {
  assert.deepEqual(parseChanges('M\0docs/a file.md\0'), [{ status: 'M', path: 'docs/a file.md' }]);
  for (const raw of ['R100\0old\0new\0', 'U\0README.md\0', 'M\0README.md', 'M\0../outside\0']) assert.throws(() => parseChanges(raw));
});
test('native documentation cannot admit a source-file change', () => {
  requireDocumentChanges('native', changes(['.marathon/progress.md']), [file('.marathon/progress.md')]);
  assert.throws(() => requireDocumentChanges('native', changes(['.marathon/progress.md', 'src/main.rs']), [file('.marathon/progress.md')]));
});
test('documentation deletion, executable mode, duplicate and foreign paths are refused', () => {
  const good = file('README.md');
  requireDocumentChanges('scotty', changes(['README.md']), [good]);
  assert.throws(() => requireDocumentChanges('scotty', [{ status: 'D', path: 'README.md' }], [good]));
  assert.throws(() => requireDocumentChanges('scotty', changes(['README.md']), [{ ...good, mode: '100755' }]));
  assert.throws(() => requireDocumentChanges('scotty', changes(['README.md']), [good, good]));
  assert.throws(() => requireDocumentChanges('scotty', changes(['package.json']), [file('package.json')]));
});
test('checkpoint publication refuses unrelated staging and missing generation pointers', () => {
  requireCheckpointChanges(changes(checkpoint), checkpoint);
  assert.throws(() => requireCheckpointChanges(changes([...checkpoint, 'src/main.rs']), checkpoint));
  assert.throws(() => requireCheckpointChanges(changes([...checkpoint, 'src/main.rs']), [...checkpoint, 'src/main.rs']));
  assert.throws(() => requireCheckpointChanges(changes(checkpoint.slice(1)), checkpoint.slice(1)));
});
test('exact deletion allowlists refuse protected refs, missing refs and invalid tips', () => {
  for (const [repo, names] of Object.entries(CLEANUP_REFS)) {
    const rows = names.map(ref => ({ ref, sha: 'c'.repeat(40) }));
    assert.equal(reviewedRefSet(repo, rows).length, repo === 'scotty' ? 86 : 2);
    for (const ref of ['refs/heads/main', 'refs/heads/archive/bead-editing-complete-20261127', 'refs/heads/feat/unrelated']) assert.throws(() => reviewedRefSet(repo, [{ ...rows[0], ref }, ...rows.slice(1)]));
    assert.throws(() => reviewedRefSet(repo, rows.slice(1)));
    assert.throws(() => reviewedRefSet(repo, [{ ...rows[0], sha: 'c'.repeat(39) }, ...rows.slice(1)]));
  }
});
test('archive review digest is order-independent and detects a changed task tip', () => {
  const rows = CLEANUP_REFS.scotty.map(ref => ({ ref, sha: 'd'.repeat(40) }));
  assert.equal(reviewedRefsDigest(rows), reviewedRefsDigest([...rows].reverse()));
  assert.notEqual(reviewedRefsDigest(rows), reviewedRefsDigest([{ ...rows[0], sha: 'e'.repeat(40) }, ...rows.slice(1)]));
});
test('the complete atomic deletion command remains under the Windows argv ceiling', () => {
  const refs = CLEANUP_REFS.scotty.map(ref => ({ ref, sha: 'f'.repeat(40) }));
  const args = ['push', '--atomic', '--no-follow-tags', '--recurse-submodules=no', ...refs.map(row => '--force-with-lease=' + row.ref + ':' + row.sha), 'https://github.com/YossiMH/bead-me-up-scotty.git', ...refs.map(row => ':' + row.ref)];
  assert.ok(args.join(' ').length + 1200 < 30000);
});
test('effective hook definitions in included global config refuse before hook execution', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bead-git-hook-boundary-'));
  try {
    const globalConfig = path.join(directory, 'global.gitconfig'), included = path.join(directory, 'included.gitconfig');
    fs.writeFileSync(globalConfig, '');
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.toLowerCase().startsWith('git_')));
    env.GIT_CONFIG_GLOBAL = globalConfig; env.GIT_CONFIG_NOSYSTEM = '1';
    const query = () => spawnSync('git', CONFIGURED_HOOK_QUERY, { cwd: directory, env, encoding: 'utf8', timeout: 3000 });
    const empty = query(); assert.equal(empty.status, 1); assert.equal(empty.error, undefined); requireNoConfiguredHooks(empty.stdout);
    fs.writeFileSync(globalConfig, '[include]\n\tpath = ' + included + '\n');
    fs.writeFileSync(included, '[hook "review-boundary"]\n\tevent = pre-commit\n\tcommand = echo must-not-execute\n');
    const configured = query(); assert.equal(configured.status, 0); assert.equal(configured.error, undefined);
    assert.deepEqual(configured.stdout.split('\0').filter(Boolean).sort(), ['hook.review-boundary.command', 'hook.review-boundary.event']);
    assert.throws(() => requireNoConfiguredHooks(configured.stdout), /Effective hook\.\* configuration/);
  } finally { fs.rmSync(directory, { recursive: true }); }
});
test('autocrlf=true preserves the Git blob and exact filtered working bytes separately', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bead-git-crlf-boundary-'));
  try {
    const globalConfig = path.join(directory, 'global.gitconfig'), emptyTemplates = path.join(directory, 'empty-templates');
    fs.writeFileSync(globalConfig, ''); fs.mkdirSync(emptyTemplates);
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.toLowerCase().startsWith('git_')));
    env.GIT_CONFIG_GLOBAL = globalConfig; env.GIT_CONFIG_NOSYSTEM = '1'; env.GIT_TEMPLATE_DIR = emptyTemplates;
    const git = (args, input) => {
      const result = spawnSync('git', ['-c', 'core.autocrlf=true', ...args], { cwd: directory, env, input, timeout: 3000 });
      assert.equal(result.error, undefined); assert.equal(result.status, 0, result.stderr?.toString()); return result.stdout;
    };
    git(['init', '--quiet']);
    const raw = Buffer.from('# Reviewed document\n\nExact content.\n'), working = Buffer.from('# Reviewed document\r\n\r\nExact content.\r\n');
    const blob = git(['hash-object', '-w', '--stdin', '--no-filters'], raw).toString().trim();
    git(['update-index', '--add', '--cacheinfo', '100644,' + blob + ',README.md']);
    const tree = git(['write-tree']).toString().trim();
    assert.deepEqual(git(['cat-file', 'blob', tree + ':README.md']), raw);
    assert.deepEqual(git(['cat-file', '--filters', tree + ':README.md']), working);
    git(['checkout-index', '--all']);
    const filename = path.join(directory, 'README.md');
    assert.deepEqual(fs.readFileSync(filename), working);
    const identity = { working_bytes: working.length, working_sha256: createHash('sha256').update(working).digest('hex') };
    verifyDocumentWorkingFile(filename, identity);
    fs.writeFileSync(filename, raw);
    assert.throws(() => verifyDocumentWorkingFile(filename, identity), /Working document/);
    assert.deepEqual(git(['cat-file', 'blob', tree + ':README.md']), raw);
    assert.throws(() => requireDocumentChanges('scotty', changes(['README.md']), [{ ...file('README.md'), working_sha256: null }]));
  } finally { fs.rmSync(directory, { recursive: true }); }
});
