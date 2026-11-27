import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Root-owned documentation/checkpoint publication and exact reviewed task-ref
// deletion. There is no general command, repository or ref interface.
export const PIN = Object.freeze({
  isolated: 'F:/Dev/.bead-edit-20261111/coordination-20261124',
  retention: 'F:/Dev/.bead-edit-20261111/preservation-checkpoint-only-20261127-v1',
  history: 'F:/Dev/.bead-edit-20261111/coordination-20261124/revision-9/checkpoint-only-inputs/git-finalization/checkpoint-only-handoff-crlf-20261127.mjs',
  historySha: '2f0f403c5747047bf452514513a9bfb2e18b59b83675be268d348ba88b4b303b',
  gitPath: 'C:/Program Files/Git/cmd/git.exe',
  gitSha: '20d0dde30a65afb6e5810a883700a94dcd77fbf3b44b32868d45bf7c9b30137c',
  nodeSha: '91ec09dda8f20556f366110859f106ab189d45f8f6a2bd092e6785174ad4a0fa',
  originalCheckpointTree: 'ff0759095a01edb38ca4bb8aa90fbdb84476e0f7',
  planSha: '18130e44ab27047dcb397de53caa0a9006c56cfd478d417f884e42452ff62582',
  mappingSha: '6d1cca5e2495011ae3dac4320e622f67c6f871186ef112edd8f51f8c98d1e5b3',
  runtimeSha: '0431a828bf95038641a0c55b4cf11c5800b52881940a13bd2f56b02f0b27177a',
});
export const REPOS = Object.freeze({
  native: { path: 'F:/Dev/bead-rs', name: 'YossiMH/bead-rs', url: 'https://github.com/YossiMH/bead-rs.git', built: '2d801ba455b7a722daf644a7615445117d57e8e9', documents: ['.marathon/progress.md'] },
  scotty: { path: 'F:/Dev/bead-me-up-scotty', name: 'YossiMH/bead-me-up-scotty', url: 'https://github.com/YossiMH/bead-me-up-scotty.git', built: '0309539797fd7d016e2b8fd8bdc0ae9cefc20219', documents: ['README.md', 'docs/backend-compatibility.md'] },
});
// Exact task names retained by the reviewed cleanup inventory; no prefix deletion.
export const CLEANUP_REFS = Object.freeze({
  "native": [
    "refs/heads/task/bead-finish-20261124",
    "refs/heads/task/type-file-20261125"
  ],
  "scotty": [
    "refs/heads/task/artifact-stage-checks-20261125",
    "refs/heads/task/artifact-stage-packet-20261125",
    "refs/heads/task/browser-check-20261125",
    "refs/heads/task/browser-retain-20261125",
    "refs/heads/task/build-transfer-20261111",
    "refs/heads/task/checkpoint-candidate-20261125",
    "refs/heads/task/checkpoint-helper-20261125",
    "refs/heads/task/checkpoint-linux-build-20261125",
    "refs/heads/task/checkpoint-linux-build-20261125-v2",
    "refs/heads/task/checkpoint-linux-check-20261125",
    "refs/heads/task/checkpoint-linux-full-suite-20261125-v2",
    "refs/heads/task/checkpoint-red-build-20261125",
    "refs/heads/task/checkpoint-red-build-20261125-v2",
    "refs/heads/task/checkpoint-red-check-20261125",
    "refs/heads/task/checkpoint-red-diagnose-20261125",
    "refs/heads/task/checkpoint-red-streams-20261125",
    "refs/heads/task/checkpoint-windows-build-20261125",
    "refs/heads/task/checkpoint-windows-build-20261125-v2",
    "refs/heads/task/checkpoint-windows-build-20261125-v3",
    "refs/heads/task/checkpoint-windows-build-20261125-v4",
    "refs/heads/task/checkpoint-windows-build-20261125-v5",
    "refs/heads/task/checkpoint-windows-compiler-probe-20261125",
    "refs/heads/task/checkpoint-windows-compiler-proposal-20261125",
    "refs/heads/task/checkpoint-windows-final-20261125",
    "refs/heads/task/checkpoint-windows-final-check-20261125",
    "refs/heads/task/checkpoint-windows-final-resume-20261125",
    "refs/heads/task/checkpoint-windows-job-diagnostic-20261125",
    "refs/heads/task/checkpoint-windows-job-proposal-20261125",
    "refs/heads/task/checkpoint-windows-packet-20261125",
    "refs/heads/task/checkpoint-windows-packet-20261125-v2",
    "refs/heads/task/checkpoint-windows-packet-20261125-v3",
    "refs/heads/task/checkpoint-windows-packet-20261125-v4",
    "refs/heads/task/checkpoint-windows-packet-20261125-v5",
    "refs/heads/task/checkpoint-windows-resume-packet-20261125",
    "refs/heads/task/checkpoint-windows-simple-packet-20261125",
    "refs/heads/task/checkpoint-windows-startup-diagnostic-20261125",
    "refs/heads/task/checkpoint-windows-startup-proposal-20261125",
    "refs/heads/task/checkpoint-windows-v8-check-20261125",
    "refs/heads/task/checkpoint-windows-v9-check-20261125",
    "refs/heads/task/coordination-type-20261125",
    "refs/heads/task/native-final-linux-build-20261125",
    "refs/heads/task/native-final-linux-build-v2-20261125",
    "refs/heads/task/native-final-linux-build-v2-packet-20261125",
    "refs/heads/task/native-final-linux-check-20261125",
    "refs/heads/task/native-final-linux-check-packet-20261125",
    "refs/heads/task/native-final-linux-check-v2-20261125",
    "refs/heads/task/native-final-linux-packet-20261125",
    "refs/heads/task/native-final-producers-packet-20261125",
    "refs/heads/task/native-final-windows-build-20261125",
    "refs/heads/task/native-final-windows-check-packet-20261125",
    "refs/heads/task/native-linux-oracle-packet-20261125",
    "refs/heads/task/native-lock-linux-build-20261125",
    "refs/heads/task/native-lock-linux-check-20261125",
    "refs/heads/task/native-lock-linux-check-packet-20261125",
    "refs/heads/task/native-maintenance-red-20261125",
    "refs/heads/task/native-maintenance-red-packet-20261125",
    "refs/heads/task/native-repair-linux-build-20261125",
    "refs/heads/task/native-repair-linux-check-20261125",
    "refs/heads/task/native-repair-linux-check-packet-20261125",
    "refs/heads/task/native-repair-producers-packet-20261125",
    "refs/heads/task/native-repair-windows-build-20261125",
    "refs/heads/task/revision6-helpers-20261125",
    "refs/heads/task/revision6-wrappers-20261125",
    "refs/heads/task/runtime-manifest-packet-20261125",
    "refs/heads/task/runtime-manifest-recovery-20261125",
    "refs/heads/task/scotty-finish-20261124",
    "refs/heads/task/tray-launch-probe-20261125",
    "refs/heads/task/tray-launch-probe-draft-20261125",
    "refs/heads/task/tray-windows-host-20261125",
    "refs/heads/task/tray-wrapper-parse-20261125",
    "refs/heads/task/tray-wrapper-parse-20261125-v2",
    "refs/heads/task/type-app-checks-20261125",
    "refs/heads/task/type-app-red-20261125",
    "refs/heads/task/type-binding-checks-20261125",
    "refs/heads/task/type-binding-packet-20261125",
    "refs/heads/task/type-binding-v8-checks-20261125",
    "refs/heads/task/type-binding-v8-packet-20261125",
    "refs/heads/task/type-binding-v9-checks-20261125",
    "refs/heads/task/type-binding-v9-packet-20261125",
    "refs/heads/task/type-native-red-20261125",
    "refs/heads/task/type-native-red-packet-20261125",
    "refs/heads/task/type-windows-packet-v8-20261125",
    "refs/heads/task/type-windows-packet-v9-20261125",
    "refs/heads/task/type-windows-roundtrip-20261125",
    "refs/heads/task/windows-check-runner-v8-20261125",
    "refs/heads/task/windows-check-runner-v9-20261125"
  ]
});
const SHA = /^[a-f0-9]{64}$/, OID = /^[a-f0-9]{40}$/;
const MAX_FILE = 64 * 1024 * 1024, MAX_LOG = 16 * 1024 * 1024;
const HOOKS = ['post-index-change', 'reference-transaction', 'post-merge', 'pre-push', 'pre-commit', 'prepare-commit-msg', 'commit-msg', 'post-commit'];
export const CONFIGURED_HOOK_QUERY = Object.freeze(['config', '--includes', '--null', '--name-only', '--get-regexp', '^hook\\.']);
export function requireNoConfiguredHooks(keys) {
  assert.equal(keys, '', 'Effective hook.* configuration requires separate reviewed execution; stored hook configuration was preserved');
}
const canonical = value => JSON.stringify(value, (_, x) => x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map(k => [k, x[k]])) : x);
const equal = (a, b, message) => assert.equal(canonical(a), canonical(b), message);
const digest = value => createHash('sha256').update(value).digest('hex');
let output, result, request, mutationAttempted = false;

function ordinary(file, directory = false) {
  const stat = fs.lstatSync(file);
  assert.ok(!stat.isSymbolicLink() && (directory ? stat.isDirectory() : stat.isFile()), 'Nonordinary path: ' + file);
  assert.equal(fs.realpathSync.native(file).toLowerCase(), path.resolve(file).toLowerCase(), 'Unexpected resolved path');
  if (!directory) assert.ok(stat.size <= MAX_FILE, 'File exceeds the 64 MiB bound');
  return stat;
}
function hashFile(file, algorithm = 'sha256', gitBlob = false) {
  const stat = ordinary(file), hash = createHash(algorithm), buffer = Buffer.alloc(65536), fd = fs.openSync(file, 'r');
  if (gitBlob) hash.update('blob ' + stat.size + '\0');
  try { let n; while ((n = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0) hash.update(buffer.subarray(0, n)); }
  finally { fs.closeSync(fd); }
  return hash.digest('hex');
}
function save(file, value) {
  const fd = fs.openSync(file, 'wx');
  try { fs.writeFileSync(fd, JSON.stringify(value, null, 2) + '\n'); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
}
function copy(source, target) {
  ordinary(source); fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL);
  const fd = fs.openSync(target, 'r+'); try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  assert.equal(hashFile(target), hashFile(source));
}
function safeRelative(value) {
  assert.equal(typeof value, 'string');
  assert.ok(value && !/[\\:\x00-\x1f\x7f]/.test(value) && value.split('/').every(p => p && p !== '.' && p !== '..'), 'Unsafe repository path');
  return value;
}
function beneath(root, name) { return path.join(root, ...safeRelative(name).split('/')); }
function retained(record) {
  assert.ok(record && typeof record.path === 'string'); assert.match(record.sha256, SHA);
  const full = path.resolve(record.path);
  assert.ok([PIN.isolated, PIN.retention].some(root => full.toLowerCase().startsWith(path.resolve(root).toLowerCase() + path.sep)), 'Evidence must be retained under coordination or history retention');
  assert.equal(hashFile(full), record.sha256, 'Evidence bytes changed');
  return JSON.parse(fs.readFileSync(full, 'utf8'));
}
function accepted(record) {
  const value = retained(record); assert.ok(['passed', 'PASS'].includes(value.status), 'Review is not accepted');
  if (value.open_findings !== undefined) equal(value.open_findings, [], 'Review has open findings');
  return value;
}
export function parseChanges(text) {
  const fields = text.split('\0'); assert.equal(fields.pop(), ''); assert.equal(fields.length % 2, 0);
  const changes = [];
  for (let i = 0; i < fields.length; i += 2) { assert.match(fields[i], /^[AMD]$/); changes.push({ status: fields[i], path: safeRelative(fields[i + 1]) }); }
  assert.equal(new Set(changes.map(x => x.path)).size, changes.length, 'Repeated changed path');
  return changes.sort((a, b) => a.path.localeCompare(b.path, 'en'));
}
export function requireDocumentChanges(repo, changes, files) {
  assert.ok(REPOS[repo]); assert.ok(Array.isArray(files) && files.length > 0 && files.length <= REPOS[repo].documents.length);
  assert.equal(new Set(files.map(f => f.path)).size, files.length);
  for (const file of files) {
    assert.ok(REPOS[repo].documents.includes(file.path), 'Unapproved documentation path');
    assert.match(file.sha256, SHA); assert.match(file.git_blob, OID); assert.equal(file.mode, '100644');
    assert.ok(Number.isSafeInteger(file.bytes) && file.bytes > 0 && file.bytes <= 4 * 1024 * 1024);
    assert.match(file.working_sha256, SHA);
    assert.ok(Number.isSafeInteger(file.working_bytes) && file.working_bytes > 0 && file.working_bytes <= 8 * 1024 * 1024);
  }
  equal(changes.map(x => x.path).sort(), files.map(x => x.path).sort(), 'Incoming changes differ from the exact reviewed documents');
  assert.ok(changes.every(x => ['A', 'M'].includes(x.status)), 'Document deletion is outside this operation');
}
export function verifyDocumentWorkingFile(filename, file) {
  assert.equal(ordinary(filename).size, file.working_bytes, 'Working document size differs from its reviewed checkout');
  assert.equal(hashFile(filename), file.working_sha256, 'Working document bytes differ from their reviewed checkout');
}
export function requireCheckpointChanges(changes, expected) {
  assert.ok(Array.isArray(expected) && expected.length > 0 && expected.length <= 4096);
  assert.equal(new Set(expected).size, expected.length);
  for (const name of expected) assert.ok(safeRelative(name).startsWith('.beads/checkpoint/'), 'Unrelated staged path');
  assert.ok(expected.includes('.beads/checkpoint/current.json') && expected.includes('.beads/checkpoint/previous.json'));
  equal(changes.map(x => x.path).sort(), [...expected].sort(), 'Staged changes differ from the verified checkpoint publication');
}
export function reviewedRefSet(repository, rows) {
  assert.ok(Object.hasOwn(CLEANUP_REFS, repository)); assert.ok(Array.isArray(rows));
  assert.equal(rows.length, CLEANUP_REFS[repository].length);
  for (const row of rows) { equal(Object.keys(row).sort(), ['ref', 'sha']); assert.match(row.sha, OID); }
  equal(rows.map(row => row.ref).sort(), CLEANUP_REFS[repository], 'Deletion targets differ from the exact task allowlist');
  return [...rows].sort((a, b) => a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0);
}
export const reviewedRefsDigest = rows => digest(canonical([...rows].sort((a, b) => a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0)));
function finish(status, detail = {}) {
  result = { ...result, ...detail, status, mutation_attempted: mutationAttempted, completed_utc: new Date().toISOString() };
  result.outputs = Object.fromEntries(fs.readdirSync(output).filter(n => fs.lstatSync(path.join(output, n)).isFile()).sort().map(n => [n, hashFile(path.join(output, n))]));
  save(path.join(output, 'result.json'), result);
}

async function main() {
  assert.equal(process.platform, 'win32'); assert.equal(process.version, 'v25.2.1');
  assert.ok(process.execArgv.includes('--max-old-space-size=128'), 'Use the accepted 128 MiB supervisor invocation');
  assert.equal(process.argv.length, 5); const [requestPath, requestHash, deadlineText] = process.argv.slice(2);
  assert.match(requestHash, SHA); assert.equal(hashFile(requestPath), requestHash);
  request = JSON.parse(fs.readFileSync(requestPath, 'utf8'));
  assert.equal(request.schema_version, 1); assert.ok(['documents', 'checkpoint', 'delete-reviewed-task-refs'].includes(request.phase));
  assert.ok(Object.hasOwn(REPOS, request.repository)); const repo = REPOS[request.repository];
  if (request.phase === 'checkpoint') assert.equal(request.repository, 'native');
  assert.match(request.run_id, /^[a-z][a-z0-9-]{3,80}$/);
  assert.equal(path.resolve(request.output_directory), path.resolve(PIN.isolated, 'git-publication-' + request.run_id));
  assert.equal(path.resolve(request.supervisor_output), path.resolve(request.output_directory + '.supervisor'));
  assert.equal(request.helper_sha256, hashFile(fileURLToPath(import.meta.url)));
  assert.equal(hashFile(PIN.history), PIN.historySha); const history = await import(pathToFileURL(PIN.history).href);
  assert.equal(hashFile(PIN.history), PIN.historySha);
  assert.equal(path.resolve(request.git.path), path.resolve(PIN.gitPath)); assert.equal(request.git.sha256, PIN.gitSha);
  assert.equal(hashFile(PIN.gitPath), PIN.gitSha); assert.equal(request.node.sha256, PIN.nodeSha);
  assert.equal(path.resolve(request.node.path).toLowerCase(), path.resolve(process.execPath).toLowerCase(), 'Request names a different Node executable');
  assert.match(request.expected_head, OID); assert.match(request.expected_remote_commit, OID);
  assert.match(request.expected_index_sha256, SHA); assert.match(request.expected_git_config_sha256, SHA);
  for (const flag of ['exclusive_repository_writer', 'reviewed_request', 'installed_reviews_accepted']) assert.equal(request.attestations?.[flag], true, 'Missing root attestation: ' + flag);
  assert.ok(Array.isArray(request.reviews) && request.reviews.length > 0 && request.reviews.length <= 8); for (const item of request.reviews) accepted(item);
  assert.ok(Array.isArray(request.accepted_hooks) && request.accepted_hooks.length <= HOOKS.length);
  if (request.accepted_hooks.length) accepted(request.hook_review);
  const deadline = Number(deadlineText); assert.ok(Number.isSafeInteger(deadline) && deadline > Date.now() && deadline <= Date.now() + 180000);
  const checkTime = () => assert.ok(Date.now() < deadline, 'Work deadline reached; reconcile actual state before another attempt');
  ordinary(repo.path, true); ordinary(path.join(repo.path, '.git'), true); ordinary(PIN.isolated, true);
  output = path.resolve(request.output_directory); assert.ok(!fs.existsSync(output), 'Existing attempt; do not replay'); fs.mkdirSync(output);
  const write = (name, value) => save(path.join(output, name), value);
  result = { schema_version: 1, status: 'failed', phase: request.phase, repository: request.repository, remote_repository: repo.name, run_id: request.run_id, request_sha256: requestHash, helper_sha256: request.helper_sha256, history_helper_sha256: PIN.historySha, started_utc: new Date().toISOString(), replay_allowed: false };
  write('request-binding.json', { ...result, request_path: requestPath, review_records: request.reviews, attestations: request.attestations });
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (key.toLowerCase().startsWith('git_') || ['node_options', 'node_path', 'beads_repo', 'bead_workspace_root'].includes(key.toLowerCase())) delete env[key];
  env.GIT_TERMINAL_PROMPT = '0'; env.GCM_INTERACTIVE = 'never'; env.GIT_OPTIONAL_LOCKS = '0';
  env.GIT_NO_LAZY_FETCH = '1'; env.GIT_NO_REPLACE_OBJECTS = '1';
  let command = 0;
  const git = (args, label, options = {}) => {
    checkTime(); assert.equal(hashFile(PIN.gitPath), PIN.gitSha);
    const name = String(++command).padStart(3, '0') + '-' + label;
    const actual = ['--no-optional-locks', '-C', repo.path, '-c', 'gc.auto=0', '-c', 'maintenance.auto=false', '-c', 'pack.threads=1', ...args];
    const stdoutPath = path.join(output, name + '.stdout'), stderrPath = path.join(output, name + '.stderr');
    const stdout = fs.openSync(stdoutPath, 'wx'), stderr = fs.openSync(stderrPath, 'wx');
    const stdin = options.stdin ? fs.openSync(options.stdin, 'r') : 'ignore'; let done;
    const started = new Date().toISOString(); write(name + '.started.json', { args: actual, cwd: repo.path, executable: PIN.gitPath, executable_sha256: PIN.gitSha, started, request_sha256: requestHash });
    const childEnv = options.index ? { ...env, GIT_INDEX_FILE: options.index } : env;
    try { done = spawnSync(PIN.gitPath, actual, { cwd: repo.path, env: childEnv, windowsHide: true, shell: false, timeout: Math.max(1, Math.min(45000, deadline - Date.now())), stdio: [stdin, stdout, stderr] }); }
    finally { if (typeof stdin === 'number') fs.closeSync(stdin); fs.fsyncSync(stdout); fs.fsyncSync(stderr); fs.closeSync(stdout); fs.closeSync(stderr); }
    write(name + '.exit.json', { args: actual, private_index: options.index || null, started, completed_utc: new Date().toISOString(), status: done.status, signal: done.signal, error: done.error?.message || null });
    assert.equal(done.error, undefined, 'Uncertain Git outcome; inspect saved command and actual refs before another attempt');
    assert.ok((options.exits || [0]).includes(done.status), 'Git command failed: ' + name + '; retain exact stderr and reconcile');
    assert.ok(fs.statSync(stdoutPath).size <= MAX_LOG && fs.statSync(stderrPath).size <= MAX_LOG, 'Git stream exceeds 16 MiB'); checkTime();
    const data = fs.readFileSync(stdoutPath); return options.bytes ? data : new TextDecoder('utf-8', { fatal: true }).decode(data);
  };
  const head = () => git(['rev-parse', 'HEAD'], 'head').trim();
  const assertMain = expected => { assert.equal(git(['symbolic-ref', '--quiet', 'HEAD'], 'branch').trim(), 'refs/heads/main'); assert.equal(head(), expected, 'Local HEAD changed'); };
  const remoteMain = label => { const raw = git(['ls-remote', '--heads', repo.url, 'refs/heads/main'], label).trim(); const match = /^([a-f0-9]{40})\s+refs\/heads\/main$/.exec(raw); assert.ok(match, 'Unexpected remote main response'); return match[1]; };
  const configPath = path.join(repo.path, '.git', 'config'); assert.equal(hashFile(configPath), request.expected_git_config_sha256);
  const indexPath = git(['rev-parse', '--path-format=absolute', '--git-path', 'index'], 'index-path').trim();
  assert.equal(path.resolve(indexPath), path.resolve(repo.path, '.git/index')); assert.equal(hashFile(indexPath), request.expected_index_sha256);
  copy(indexPath, path.join(output, 'index-before.raw'));
  const privateNames = request.repository === 'native' ? ['.beads/config.json', '.beads/.gitignore', '.beads/beads.db', '.beads/beads.db-wal', '.beads/beads.db-shm', '.beads/beads.db-journal'] : ['.env.local'];
  assert.ok(Array.isArray(request.private_state)); equal(request.private_state.map(x => x.path).sort(), [...privateNames].sort());
  const privateState = () => privateNames.map(name => {
    const full = beneath(repo.path, name); let stat; try { stat = ordinary(full); } catch (error) { if (error.code === 'ENOENT') return { path: name, exists: false, bytes: null, sha256: null }; throw error; }
    return { path: name, exists: true, bytes: stat.size, sha256: hashFile(full) };
  });
  const expectedPrivate = [...request.private_state].sort((a, b) => a.path.localeCompare(b.path, 'en'));
  const observedPrivate = () => privateState().sort((a, b) => a.path.localeCompare(b.path, 'en'));
  equal(observedPrivate(), expectedPrivate, 'Original private configuration/database bytes differ from the reviewed observation');
  for (const name of request.repository === 'native' ? ['.beads/config.json', '.beads/.gitignore'] : ['.env.local']) assert.equal(expectedPrivate.find(file => file.path === name).exists, true, 'Required configuration is absent');
  if (request.phase === 'checkpoint') assert.equal(expectedPrivate.find(file => file.path === '.beads/beads.db').exists, true, 'Accepted restored database is absent');
  const configGuard = () => { assert.equal(hashFile(configPath), request.expected_git_config_sha256, 'Git configuration changed'); equal(observedPrivate(), expectedPrivate, 'Private configuration or native database changed'); };
  const hookState = () => {
    requireNoConfiguredHooks(git(CONFIGURED_HOOK_QUERY, 'configured-hook-keys', { exits: [0, 1] }));
    let directory = git(['config', '--path', '--get', 'core.hooksPath'], 'hooks-path', { exits: [0, 1] }).trim();
    if (!directory) directory = git(['rev-parse', '--path-format=absolute', '--git-path', 'hooks'], 'default-hooks-path').trim();
    if (!path.isAbsolute(directory)) directory = path.resolve(repo.path, directory);
    const hooks = [];
    for (const name of HOOKS) { const file = path.join(directory, name); try { ordinary(file); } catch (error) { if (error.code === 'ENOENT') continue; throw error; } hooks.push({ name, path: path.resolve(file), sha256: hashFile(file) }); }
    return hooks.sort((a, b) => a.name.localeCompare(b.name, 'en'));
  };
  const assertHooks = () => equal(hookState(), [...request.accepted_hooks].sort((a, b) => a.name.localeCompare(b.name, 'en')), 'Unexpected or changed hook; inspect it rather than suppressing it');
  const gitState = label => {
    const indexBefore = hashFile(indexPath), local = head();
    const indexEntries = history.parseIndexEntries(git(['ls-files', '--stage', '-z'], label + '-index'));
    const status = git(['-c', 'status.renames=false', 'status', '--porcelain=v1', '-z', '--untracked-files=all'], label + '-status');
    const entries = {}; let checkpointTree = null;
    if (request.repository === 'native') {
      checkpointTree = git(['rev-parse', 'HEAD:.beads/checkpoint'], label + '-checkpoint-tree').trim(); assert.match(checkpointTree, OID);
      for (const row of git(['ls-tree', '-r', '-l', '-z', 'HEAD:.beads/checkpoint'], label + '-checkpoint-entries').split('\0').filter(Boolean)) {
        const match = /^(100644) blob ([a-f0-9]{40}) +([0-9]+)\t(.+)$/.exec(row); assert.ok(match); safeRelative(match[4]); assert.ok(!Object.hasOwn(entries, match[4])); entries[match[4]] = { mode: match[1], blob: match[2], bytes: Number(match[3]) };
      }
      assert.ok(Object.keys(entries).length <= 4096);
    }
    assert.equal(hashFile(indexPath), indexBefore, 'Read-only Git changed the index');
    const value = { head: local, checkpoint_tree: checkpointTree, index_path: indexPath, index_sha256: indexBefore, index_entries: indexEntries, status, entries };
    write(label + '.json', value); return value;
  };
  assert.equal(path.resolve(git(['rev-parse', '--show-toplevel'], 'worktree-root').trim()).toLowerCase(), path.resolve(repo.path).toLowerCase());
  assert.equal(path.resolve(git(['rev-parse', '--absolute-git-dir'], 'git-directory').trim()).toLowerCase(), path.resolve(repo.path, '.git').toLowerCase());
  const fsmonitor = git(['config', '--get', 'core.fsmonitor'], 'fsmonitor', { exits: [0, 1] }).trim().toLowerCase();
  assert.ok(['', 'false', '0'].includes(fsmonitor), 'Configured fsmonitor needs separate inspection before bounded Git work');
  assertMain(request.expected_head); git(['merge-base', '--is-ancestor', repo.built, request.expected_head], 'qualified-source-ancestor'); assertHooks();
  const before = gitState('before'); assert.equal(before.index_sha256, request.expected_index_sha256); configGuard();
  assert.equal(remoteMain('remote-before'), request.expected_remote_commit, 'Remote main changed before this attempt');
  const attempt = (name, detail) => { checkTime(); assert.equal(hashFile(PIN.history), PIN.historySha); configGuard(); assertHooks(); mutationAttempted = true; write(name + '-attempt.json', { utc: new Date().toISOString(), request_sha256: requestHash, replay_allowed: false, ...detail }); };
  const publish = commit => {
    assert.equal(remoteMain('remote-pre-push'), request.expected_remote_commit, 'Remote main advanced; reconcile without force');
    attempt('push-main', { commit, expected_remote: request.expected_remote_commit, url: repo.url });
    git(['push', '--no-follow-tags', '--recurse-submodules=no', repo.url, commit + ':refs/heads/main'], 'push-main');
    assert.equal(remoteMain('remote-after-push'), commit, 'Remote outcome requires reconciliation'); assertMain(commit); configGuard(); assertHooks();
  };

  if (request.phase === 'delete-reviewed-task-refs') {
    assert.equal(request.attestations.archive_and_cleanup_reviews_accepted, true);
    assert.equal(before.status, '', 'Task-ref cleanup requires a clean source and index');
    assert.equal(request.expected_remote_commit, request.expected_head, 'Retained main must match the accepted local source');
    const receiptPin = request.repository === 'scotty' ? request.archive_receipt : request.native_main_receipt;
    const reviewPin = request.repository === 'scotty' ? request.archive_review : request.native_main_review;
    const receipt = accepted(receiptPin), review = accepted(reviewPin);
    assert.equal(receipt.schema_version, 1); assert.equal(receipt.repository, repo.name); assert.equal(receipt.all_refs_covered, true);
    assert.equal(review.accepted, true); assert.equal(review.all_refs_covered, true);
    const refs = reviewedRefSet(request.repository, receipt.reviewed_refs);
    assert.equal(review.reviewed_refs_sha256, reviewedRefsDigest(refs), 'Reviewed tip set differs from the retention proof');
    const retainedRefs = { 'refs/heads/main': request.expected_head };
    if (request.repository === 'scotty') {
      assert.equal(receipt.archive_ref, 'refs/heads/archive/bead-editing-complete-20261127');
      assert.match(receipt.archive_commit, OID); assert.match(receipt.tree_sha, OID); assert.match(receipt.transfer_commit, OID);
      assert.equal(receipt.remote_ref_verified, true); assert.equal(receipt.parents.length, 32); assert.equal(new Set(receipt.parents).size, 32);
      for (const parent of receipt.parents) assert.match(parent, OID);
      assert.equal(receipt.parents[0], receipt.transfer_commit);
      assert.equal(refs.find(row => row.ref === 'refs/heads/task/build-transfer-20261111').sha, receipt.transfer_commit);
      assert.equal(review.archive_receipt_sha256, receiptPin.sha256); assert.equal(review.archive_commit, receipt.archive_commit);
      retainedRefs[receipt.archive_ref] = receipt.archive_commit;
    } else {
      assert.equal(receipt.main_commit, request.expected_head); assert.equal(receipt.remote_main_verified, true);
      assert.equal(review.main_receipt_sha256, receiptPin.sha256); assert.equal(review.main_commit, receipt.main_commit);
    }
    const observe = label => {
      const names = [...Object.keys(retainedRefs), ...refs.map(row => row.ref)];
      const text = git(['ls-remote', '--refs', repo.url, ...names], label), found = {};
      for (const line of text.trim().split('\n').filter(Boolean)) { const match = /^([a-f0-9]{40})\s+(refs\/[^\s]+)$/.exec(line); assert.ok(match); assert.ok(names.includes(match[2]) && !Object.hasOwn(found, match[2]), 'Unexpected or duplicate remote ref'); found[match[2]] = match[1]; }
      return found;
    };
    const expectedRemote = { ...retainedRefs, ...Object.fromEntries(refs.map(row => [row.ref, row.sha])) };
    equal(observe('deletion-remote-before'), expectedRemote, 'Archive/main/task tips changed; no deletion is authorized');
    const leases = refs.map(row => '--force-with-lease=' + row.ref + ':' + row.sha), deletions = refs.map(row => ':' + row.ref);
    const args = ['push', '--atomic', '--no-follow-tags', '--recurse-submodules=no', ...leases, repo.url, ...deletions];
    assert.ok(args.every(value => !/[\s"\x00]/.test(value)), 'Unexpected deletion argument encoding');
    assert.ok(args.join(' ').length + PIN.gitPath.length + repo.path.length + 1024 < 30000, 'Deletion command exceeds the bounded Windows command line');
    attempt('delete-task-refs', { repository: repo.name, refs, retained_refs: retainedRefs, retention_receipt: receiptPin, review: reviewPin, atomic: true });
    git(args, 'delete-task-refs');
    equal(observe('deletion-remote-after'), retainedRefs, 'Remote deletion or retained-ref outcome needs reconciliation');
    assertMain(request.expected_head); const after = gitState('after'); equal(after, before, 'Ref deletion changed source or index state'); configGuard(); assertHooks();
    finish('passed', { deleted_refs: refs, retained_refs: retainedRefs, retention_receipt: receiptPin, retention_review: reviewPin, retention_kind: request.repository === 'scotty' ? 'archive_ref' : 'native_main', reviewed_refs_sha256: reviewedRefsDigest(refs), atomic: true, explicit_expected_tip_leases: true, no_history_fetch: true }); return;
  }

  if (request.phase === 'documents') {
    assert.equal(request.attestations.document_reviews_accepted, true); assert.equal(before.status, '', 'Documentation adoption requires a clean source and index');
    assert.match(request.target_commit, OID); assert.notEqual(request.target_commit, request.expected_head, 'No new descendant to adopt');
    assert.ok([request.expected_head, request.target_commit].includes(request.expected_remote_commit));
    assert.ok(['false', 'input', 'true'].includes(request.document_autocrlf), 'Expected an explicitly reviewed built-in checkout mode');
    const checkDocumentMode = () => assert.equal(git(['config', '--default', 'false', '--get', 'core.autocrlf'], 'document-autocrlf').trim(), request.document_autocrlf, 'Document checkout mode changed');
    checkDocumentMode();
    attempt('fetch-documents', { url: repo.url, commit: request.target_commit });
    git(['fetch', '--no-tags', '--no-write-fetch-head', '--no-recurse-submodules', '--no-auto-maintenance', '--no-write-commit-graph', repo.url, request.target_commit], 'fetch-documents');
    assertMain(request.expected_head); assert.equal(hashFile(indexPath), before.index_sha256); configGuard(); assertHooks();
    git(['merge-base', '--is-ancestor', request.expected_head, request.target_commit], 'document-descendant');
    const changes = parseChanges(git(['diff', '--name-status', '-z', '--no-renames', request.expected_head, request.target_commit, '--'], 'document-changes'));
    requireDocumentChanges(request.repository, changes, request.document_files);
    const attributeInput = path.join(output, 'document-paths.stdin'); fs.writeFileSync(attributeInput, request.document_files.map(file => file.path + '\0').join(''), { flag: 'wx' });
    const checkDocumentAttributes = () => {
      const raw = git(['check-attr', '--all', '-z', '--stdin'], 'document-attributes', { stdin: attributeInput }), attributes = raw.split('\0'); assert.equal(attributes.pop(), ''); assert.equal(attributes.length % 3, 0);
      for (let i = 0; i < attributes.length; i += 3) if (['filter', 'working-tree-encoding', 'text', 'eol', 'ident'].includes(attributes[i + 1])) assert.ok(['unset', 'unspecified'].includes(attributes[i + 2]), 'Document transformation needs separate review: ' + attributes[i + 1]);
      return raw;
    };
    const attributesBefore = checkDocumentAttributes();
    const expectedIndex = { ...before.index_entries };
    for (const file of request.document_files) {
      const entry = git(['ls-tree', '-z', request.target_commit, '--', file.path], 'document-entry').split('\0'); assert.equal(entry.length, 2); assert.equal(entry[1], '');
      assert.equal(entry[0], file.mode + ' blob ' + file.git_blob + '\t' + file.path, 'Unexpected reviewed document mode/blob');
      const raw = git(['cat-file', 'blob', request.target_commit + ':' + file.path], 'document-bytes', { bytes: true });
      assert.equal(raw.length, file.bytes); assert.equal(digest(raw), file.sha256); expectedIndex[file.path] = { mode: file.mode, blob: file.git_blob };
      const working = git(['cat-file', '--filters', request.target_commit + ':' + file.path], 'document-working-bytes', { bytes: true });
      assert.equal(working.length, file.working_bytes); assert.equal(digest(working), file.working_sha256, 'Built-in checkout bytes differ from the reviewed working identity');
    }
    assertMain(request.expected_head); assert.equal(hashFile(indexPath), before.index_sha256); configGuard(); checkDocumentMode(); assert.equal(checkDocumentAttributes(), attributesBefore);
    attempt('fast-forward-documents', { before: request.expected_head, target: request.target_commit, files: request.document_files });
    git(['merge', '--ff-only', request.target_commit], 'fast-forward-documents'); assertMain(request.target_commit);
    const adopted = gitState('adopted'); assert.equal(adopted.status, ''); equal(adopted.index_entries, expectedIndex, 'Fast-forward changed unrelated index entries'); equal(adopted.entries, before.entries, 'Documentation changed checkpoint Git objects'); assert.equal(adopted.checkpoint_tree, before.checkpoint_tree);
    const checkWorkingDocuments = () => { for (const file of request.document_files) verifyDocumentWorkingFile(beneath(repo.path, file.path), file); };
    checkWorkingDocuments();
    configGuard(); assertHooks(); checkDocumentMode(); assert.equal(checkDocumentAttributes(), attributesBefore);
    if (request.expected_remote_commit !== request.target_commit) publish(request.target_commit);
    else assert.equal(remoteMain('remote-already-published'), request.target_commit);
    const after = gitState('after'); assert.equal(after.head, request.target_commit); assert.equal(after.status, ''); equal(after.index_entries, expectedIndex); checkWorkingDocuments(); configGuard(); checkDocumentMode(); assert.equal(checkDocumentAttributes(), attributesBefore);
    const backup = path.join(output, 'index-after.raw'); copy(indexPath, backup); assert.equal(hashFile(backup), after.index_sha256);
    const detail = { head: after.head, commit: after.head, remote_commit: after.head, index_sha256: after.index_sha256, index_backup: { path: backup, sha256: after.index_sha256 }, document_files: request.document_files, document_autocrlf: request.document_autocrlf, checkpoint_tree: after.checkpoint_tree, remote_checkpoint_tree: after.checkpoint_tree, remote_objects_verified: false };
    if (request.repository === 'native' && after.checkpoint_tree === PIN.originalCheckpointTree) {
      assert.equal(Object.keys(after.entries).length, 53); assert.equal(Object.values(after.entries).reduce((sum, row) => sum + row.bytes, 0), 429072095);
      const input = path.join(output, 'checkpoint-object-ids.stdin'); fs.writeFileSync(input, Object.values(after.entries).map(row => row.blob).join('\n') + '\n', { flag: 'wx' });
      const rows = git(['cat-file', '--batch-check=%(objectname) %(objecttype) %(objectsize)'], 'checkpoint-object-identities', { stdin: input }).trim().split('\n');
      equal(rows, Object.values(after.entries).map(row => row.blob + ' blob ' + row.bytes), 'Fetched commit checkpoint object identity differs');
      assert.equal(remoteMain('remote-baseline-final'), after.head); assert.equal(hashFile(indexPath), after.index_sha256); configGuard();
      detail.remote_objects_verified = true; detail.remote_object_verification = 'Explicit immutable fork fetch, exact main readback, original checkpoint tree and complete batched 53-object type/size identities retained in command logs';
      save(path.join(output, 'original-git-baseline.json'), { status: 'passed', remote_repository: repo.name, ...detail });
    }
    finish('passed', detail); return;
  }

  assert.equal(request.attestations.history_verifications_accepted, true);
  assert.equal(request.expected_remote_commit, request.expected_head); assert.ok(['initial', 'final'].includes(request.checkpoint_stage));
  const publicationName = request.checkpoint_stage === 'initial' ? 'restore-original' : 'final-publish';
  const verificationName = request.checkpoint_stage === 'initial' ? 'restore' : 'final-restore';
  const phaseRecord = (record, name) => {
    assert.equal(path.resolve(record.path), path.resolve(PIN.retention, 'phases', name, 'result.json'));
    const value = retained(record); assert.equal(value.status, 'passed'); assert.equal(value.phase, name); assert.equal(value.runtime_sha256, PIN.runtimeSha); assert.equal(value.plan_sha256, PIN.planSha); assert.equal(value.materialization_sha256, PIN.mappingSha); return value;
  };
  const publication = phaseRecord(request.checkpoint_publication, publicationName), verification = phaseRecord(request.checkpoint_verification, verificationName);
  assert.equal(publication.authority, REPOS.native.path); assert.equal(verification.authority, REPOS.native.path);
  const phaseOutput = (phase, name, filename) => retained({ path: path.join(PIN.retention, 'phases', name, filename), sha256: phase.outputs[filename] });
  const staged = phaseOutput(publication, publicationName, 'original-git-after.json');
  const initial = phaseOutput(publication, publicationName, 'original-git-before.json');
  const reconciliation = phaseOutput(publication, publicationName, 'checkpoint-index-reconciliation.json'); assert.equal(reconciliation.status, 'passed');
  equal(phaseOutput(verification, verificationName, 'original-git-before.json'), staged, 'Verification began from different staged Git state');
  equal(phaseOutput(verification, verificationName, 'original-git-after.json'), staged, 'Verification changed staged Git state');
  equal(before, staged, 'Current HEAD/index/staging differs from the accepted phase');
  for(const [record,name] of [[publication,publicationName],[verification,verificationName]]) assert.equal(phaseOutput(record,name,'request.json').helper_sha256,PIN.historySha,'Checkpoint phase used a different history compatibility helper');
  const checkedIndex = request.checkpoint_stage === 'initial'
    ? history.verifyInitialPublicationIndex(initial, before, path.join(repo.path, '.beads/checkpoint'), path.join(PIN.retention, 'original-files/checkpoint-raw'), path.join(PIN.retention, 'original-files/checkpoint'))
    : history.verifyPublicationIndex(initial, before, path.join(repo.path, '.beads/checkpoint'));
  equal(checkedIndex, reconciliation, 'Staged checkpoint reconciliation changed');
  const changes = parseChanges(git(['diff', '--cached', '--name-status', '-z', '--no-renames', '--'], 'staged-paths'));
  requireCheckpointChanges(changes, reconciliation.changed_paths);
  const expectedStatus = changes.map(row => row.status + '  ' + row.path).sort(); equal(before.status.split('\0').filter(Boolean).sort(), expectedStatus, 'Unrelated or unstaged source change');
  const selected = phaseOutput(publication, publicationName, 'published-manifest.json');
  const checkSelected = () => {
    const names = Object.keys(selected); assert.ok(names.length > 0 && names.length <= 4096); let total = 0;
    for (const name of names) { const file = beneath(path.join(repo.path, '.beads/checkpoint'), name), expected = selected[name]; assert.match(expected.sha256, SHA); assert.equal(ordinary(file).size, expected.bytes); total += expected.bytes; assert.ok(total <= MAX_FILE); assert.equal(hashFile(file), expected.sha256, 'Verified checkpoint file changed: ' + name); }
    const pointer = JSON.parse(fs.readFileSync(path.join(repo.path, '.beads/checkpoint/current.json'), 'utf8'));
    assert.equal(pointer.generation_id, publication.generation); assert.equal(pointer.active_root.sha256, publication.root_sha256);
    assert.equal(verification.verified_generation, publication.generation); assert.equal(verification.verified_root_sha256, publication.root_sha256);
  };
  checkSelected(); assertMain(request.expected_head); assert.equal(hashFile(indexPath), before.index_sha256); configGuard();
  assert.equal(typeof request.commit_message, 'string'); assert.ok(request.commit_message.trim().length >= 12 && request.commit_message.length <= 4096 && !request.commit_message.includes('\0'));
  const message = path.join(output, 'commit-message.txt'); fs.writeFileSync(message, request.commit_message.trim() + '\n', { flag: 'wx' });
  const treeIndex = path.join(output, 'expected-tree.index'); copy(indexPath, treeIndex);
  const expectedTree = git(['write-tree'], 'expected-index-tree', { index: treeIndex }).trim(); assert.match(expectedTree, OID);
  equal(history.parseIndexEntries(git(['ls-files', '--stage', '-z'], 'expected-tree-index-entries', { index: treeIndex })), before.index_entries, 'Private tree calculation changed staged content');
  assert.equal(hashFile(indexPath), before.index_sha256, 'Tree calculation changed the actual accepted index');
  attempt('commit-checkpoint', { before: request.expected_head, expected_tree: expectedTree, changed_paths: reconciliation.changed_paths, generation_id: publication.generation, root_sha256: publication.root_sha256 });
  git(['commit', '--file', message], 'commit-checkpoint'); const committed = head(); assert.notEqual(committed, request.expected_head);
  equal(git(['rev-list', '--parents', '-n', '1', committed], 'commit-parent').trim().split(/\s+/), [committed, request.expected_head], 'Unexpected commit parent');
  assert.equal(git(['rev-parse', committed + '^{tree}'], 'commit-tree').trim(), expectedTree, 'Hook or concurrent writer changed committed tree');
  equal(parseChanges(git(['diff', '--name-status', '-z', '--no-renames', request.expected_head, committed, '--'], 'committed-paths')), changes, 'Committed paths differ from verified staging');
  assertMain(committed); const committedState = gitState('committed'); assert.equal(committedState.status, ''); equal(committedState.index_entries, before.index_entries, 'Commit changed the staged content'); checkSelected(); configGuard(); assertHooks();
  publish(committed);
  const after = gitState('after'); assert.equal(after.head, committed); assert.equal(after.status, ''); equal(after.index_entries, before.index_entries); checkSelected(); configGuard();
  const backup = path.join(output, 'index-after.raw'); copy(indexPath, backup);
  assert.equal(hashFile(backup), after.index_sha256);
  finish('passed', { checkpoint_stage: request.checkpoint_stage, generation_id: publication.generation, root_sha256: publication.root_sha256, commit: committed, remote_commit: committed, checkpoint_tree: after.checkpoint_tree, commit_tree: expectedTree, changed_paths: reconciliation.changed_paths, index_sha256: after.index_sha256, index_backup: { path: backup, sha256: after.index_sha256 }, publication_phase: request.checkpoint_publication, verification_phase: request.checkpoint_verification });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    if (output && result && !fs.existsSync(path.join(output, 'result.json'))) {
      try { finish('failed', { error: error.stack || String(error), next_action: 'Retain every attempt file; inspect actual HEAD/index/working state/remote ref before any separate retry. No rollback or replay was attempted.' }); }
      catch (saveError) { process.stderr.write('Failure receipt could not be retained: ' + String(saveError) + '\n'); }
    }
    process.stderr.write((error.stack || String(error)) + '\n'); process.exitCode = 1;
  });
}
