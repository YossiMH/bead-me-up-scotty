// Apply the reviewed three-file correction to the existing source archive.
// Root runs this with no app/check using the archive and a fresh output directory.
// Usage: node --max-old-space-size=64 stage-tray-repair-20261125.mjs F:/Dev/.bead-edit-20261111/stage-tray-repair-20261125-v1
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';

assert.equal(process.platform, 'win32', 'This staging correction requires Windows.');
assert.equal(process.argv.length, 3, 'Supply one fresh output directory.');
os.setPriority(0, os.constants.priority.PRIORITY_BELOW_NORMAL);

const taskRoot = 'F:\\Dev\\.bead-edit-20261111';
const stageRoot = path.join(taskRoot, 'stage-v6');
const stageResultPath = path.join(stageRoot, 'stage-result.json');
const inputPath = 'C:\\Users\\YossiMH\\AppData\\Local\\bead-edit-20261111\\browser-execution-20261124\\windows-browser-input-local.json';
const inputSha256 = '2c689e960998deaf41c13b507f3596cb3c5c56000e826416cac9357fc55f8b86';
const baseCommit = 'f47fd7adef41e989072d5fa8c39160681aa6fd2a';
const patchCommit = '38c21a77b4e875d75e17ee68683846601df33591';
const helperSha256 = '46c98de97680cad44f8aa70c643a9538941cc0a0a6f5b4f86b6b2f0eae5716fb';
const files = [
  { path: 'bin/windows-tray.mjs', before: 'fa66d90908397d29722b5a8fcae54f89ec815d5dea54f221af33ce8f9ca4eb5b', after: 'a947ec77a5d742f3d735288483dcf0f54e5b057ec7d3b64370e656b878fea611', bytes: 5896, blob: 'f740c9b95370ed632c7f65f8778d034d32f75a51' },
  { path: 'scripts/fixtures/tray-process-boundary.mjs', before: 'ff7dae48575110ac0d7f8e23ca92cfb9761da00f95fc38092067d1af92b0f6c3', after: '7e94e76548e61bde08ca2899fb8a24ed0bb74041ebfa2375436bba3573cd1e31', bytes: 1765, blob: '2ba0b1a937d2880b1aa522670a62dc591a03a21c' },
  { path: 'scripts/test-windows-tray.mjs', before: '7f0be31c8f19384896b4bc7bdc42c38598e536ef75bf3b6dd641e0c4ababdb40', after: 'd48e8b73c16b4196ab880d53023d98fbe89df3068ea111b0b05c5a29a8acbacb', bytes: 16500, blob: '6d12ea6c8bde18f672e84098e9ac82c2cd1edb97' },
];
const started = Date.now();
const output = path.resolve(process.argv[2]);
const result = {
  schema_version: 1, status: 'running', started_utc: new Date(started).toISOString(),
  task_id: 'beadrs-ea7bc5dd', output_directory: output,
  source_kind: 'archive_with_three_file_patch', base_archive_commit: baseCommit,
  patch_source_commit: patchCommit, replacements: [], events: [],
  interpretation: 'The original archive receipt remains unchanged. This result identifies only the three applied source files; it asserts no Git HEAD or complete-archive equality with the patch commit.',
};
let outputCreated = false;

function budget() {
  assert.ok(Date.now() - started < 60000, 'Staging correction exceeded 60 seconds.');
  assert.ok(process.memoryUsage().rss < 128 * 1024 * 1024, 'Staging correction exceeded 128 MiB resident memory.');
}
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const samePath = (left, right) => path.resolve(left).toLowerCase() === path.resolve(right).toLowerCase();

/** Refuse junctions or symlinks along a path that this operation will modify. */
function plainPath(filename, missingLeaf = false) {
  let cursor = filename;
  for (;;) {
    try { assert.equal(fs.lstatSync(cursor).isSymbolicLink(), false, `Linked staging path: ${cursor}`); }
    catch (error) {
      if (!(missingLeaf && cursor === filename && error.code === 'ENOENT')) throw error;
    }
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
}

/** Read bounded metadata/source bytes; configuration contents never enter receipts. */
function readFile(filename) {
  budget();
  const stat = fs.statSync(filename);
  assert.ok(stat.isFile() && stat.size <= 2 * 1024 * 1024, `Unexpected file type or size: ${filename}`);
  const bytes = fs.readFileSync(filename);
  assert.equal(bytes.length, stat.size, `File size changed while reading: ${filename}`);
  return bytes;
}

function writeNew(filename, bytes) {
  const descriptor = fs.openSync(filename, 'wx');
  try { fs.writeFileSync(descriptor, bytes); fs.fsyncSync(descriptor); }
  finally { fs.closeSync(descriptor); }
}

/** Save each phase separately so interruption never requires an automatic replay. */
function record(phase, detail) {
  const event = { phase, utc: new Date().toISOString(), detail };
  result.events.push(event);
  writeNew(path.join(output, `${String(result.events.length).padStart(2, '0')}-${phase}.json`), JSON.stringify(event, null, 2) + '\n');
  const temporary = path.join(output, 'result.json.next');
  writeNew(temporary, JSON.stringify(result, null, 2) + '\n');
  fs.renameSync(temporary, path.join(output, 'result.json'));
}

function optionalFile(filename) {
  try { return { path: filename, sha256: hash(readFile(filename)) }; }
  catch (error) {
    if (error.code === 'ENOENT') return { path: filename, absent: true };
    throw error;
  }
}

/** Capture only hashes and link locations for unchanged configuration/dependencies. */
function protectedSnapshot(app, input) {
  const names = new Set(['.env', '.env.local', '.env.production.local', '.npmrc', '.editorconfig', 'config.json', 'components.json', 'tsconfig.json']);
  for (const name of fs.readdirSync(app)) {
    if (/^\.env(?:\.|$)/.test(name) || /\.config\.(?:json|[cm]?[jt]s)$/.test(name)) names.add(name);
  }
  const configuration = [...names].sort().map(name => optionalFile(path.join(app, name)));
  const configRoot = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  configuration.push(optionalFile(path.join(configRoot, 'bead-me-up-scotty', 'config.json')));
  const modules = path.join(app, 'node_modules');
  const linked = fs.lstatSync(modules).isSymbolicLink();
  const packages = Object.entries({ ...input.package_versions, 'react-dom': '19.2.4' }).sort(([a], [b]) => a.localeCompare(b)).map(([name, version]) => {
    const filename = path.join(modules, name, 'package.json');
    const bytes = readFile(filename);
    assert.equal(JSON.parse(bytes.toString('utf8')).version, version, `Installed package version differs: ${name}`);
    return { path: filename, sha256: hash(bytes), version };
  });
  packages.push(optionalFile(path.join(modules, '.package-lock.json')));
  return {
    configuration, packages,
    node_modules: { linked, target: linked ? fs.readlinkSync(modules) : null, resolved: fs.realpathSync.native(modules) },
    environment_sha256: hash(Buffer.from(JSON.stringify(Object.entries(process.env).sort(([a], [b]) => a.localeCompare(b))))),
  };
}

function verifyInputs(app, input) {
  assert.equal(input.runtime_files.length, 230, 'Runtime file inventory differs.');
  assert.equal(Object.keys(input.source_files).length, 6, 'UI/source file inventory differs.');
  for (const [relative, expected] of Object.entries(input.source_files)) {
    assert.equal(hash(readFile(path.join(app, relative))), expected, `UI/source file differs: ${relative}`);
  }
  for (const entry of input.runtime_files) {
    assert.ok(entry.path.startsWith('.next/') && !entry.path.split('/').includes('..'), 'Invalid runtime path.');
    const bytes = readFile(path.join(app, entry.path));
    assert.equal(bytes.length, entry.bytes, `Runtime size differs: ${entry.path}`);
    assert.equal(hash(bytes), entry.sha256, `Runtime file differs: ${entry.path}`);
  }
  assert.equal(readFile(path.join(app, '.next', 'BUILD_ID')).toString('utf8').trim(), input.build_id, 'Runtime build ID differs.');
  assert.equal(hash(readFile(path.join(app, 'bin', 'windows-tray.ps1'))), helperSha256, 'PowerShell helper differs.');
  return { runtime_files: 230, ui_source_files: 6, build_id: input.build_id, powershell_helper_sha256: helperSha256 };
}

async function download(file) {
  budget();
  const url = `https://raw.githubusercontent.com/YossiMH/bead-me-up-scotty/${patchCommit}/${file.path}`;
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(Math.max(1, Math.min(10000, 60000 - (Date.now() - started)))) });
  assert.equal(response.status, 200, `Source download failed: ${file.path}`);
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    budget();
    size += chunk.length;
    assert.ok(size <= file.bytes, `Source download exceeded its expected size: ${file.path}`);
    chunks.push(chunk);
  }
  const bytes = Buffer.concat(chunks, size);
  assert.equal(size, file.bytes, `Source download size differs: ${file.path}`);
  assert.equal(hash(bytes), file.after, `Source download hash differs: ${file.path}`);
  const blob = createHash('sha1').update(`blob ${size}\0`).update(bytes).digest('hex');
  assert.equal(blob, file.blob, `Source download Git blob differs: ${file.path}`);
  return { bytes, url };
}

try {
  assert.ok(path.isAbsolute(process.argv[2]) && samePath(path.dirname(output), taskRoot) && /^stage-tray-repair-20261125-[A-Za-z0-9_-]+$/.test(path.basename(output)), 'Output must be a fresh named child of the task root.');
  plainPath(output, true);
  fs.mkdirSync(output);
  outputCreated = true;
  record('started', { stage_result: stageResultPath, input_manifest: inputPath });
  const stageBytes = readFile(stageResultPath);
  const stage = JSON.parse(stageBytes.toString('utf8').replace(/^\uFEFF/, ''));
  const inputBytes = readFile(inputPath);
  assert.equal(hash(inputBytes), inputSha256, 'Verified browser input manifest differs.');
  const input = JSON.parse(inputBytes.toString('utf8').replace(/^\uFEFF/, ''));
  assert.equal(stage.status, 'passed', 'Original archive staging did not pass.');
  assert.ok(samePath(stage.directory, stageRoot), 'Original stage directory differs.');
  const app = path.resolve(stage.app_directory);
  assert.ok(samePath(app, path.join(stageRoot, 'scotty')) && samePath(app, input.repository_path), 'Archive app directory differs.');
  plainPath(app);
  assert.equal(fs.existsSync(path.join(app, '.git')), false, 'Expected a source archive without Git metadata.');
  assert.equal(stage.source.scotty, baseCommit, 'Original archive source differs.');
  assert.equal(input.staged_source_commit, baseCommit, 'Browser input archive source differs.');
  assert.equal(stage.source.app_runtime_build, input.runtime_source_commit, 'Runtime source records differ.');
  assert.equal(stage.runtime_build_id, input.build_id, 'Runtime build records differ.');
  assert.ok(samePath(stage.bead_exe, input.bead_exe) && stage.binary_sha256 === input.bead_sha256, 'Native binary records differ.');
  result.stage_result_sha256 = hash(stageBytes);
  result.input_manifest_sha256 = inputSha256;
  result.app_directory = app;
  for (const file of files) {
    const target = path.join(app, file.path);
    plainPath(target);
    assert.equal(hash(readFile(target)), file.before, `Archive source differs from the recorded base: ${file.path}`);
  }
  result.inputs_before = verifyInputs(app, input);
  result.protected_before = protectedSnapshot(app, input);
  record('preflight_passed', { base_archive_commit: baseCommit, patch_source_commit: patchCommit, files });

  for (const file of files) {
    const downloaded = await download(file);
    const destination = path.join(output, 'download', file.path);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    writeNew(destination, downloaded.bytes);
    record('download_verified', { path: file.path, url: downloaded.url, sha256: file.after, git_blob: file.blob });
  }
  // Complete every backup and recheck all protected inputs before the first replacement.
  for (const file of files) {
    const target = path.join(app, file.path);
    const before = readFile(target);
    assert.equal(hash(before), file.before, `Archive source changed before backup: ${file.path}`);
    const backup = path.join(output, 'before', file.path);
    fs.mkdirSync(path.dirname(backup), { recursive: true });
    writeNew(backup, before);
    assert.equal(hash(readFile(backup)), file.before, `Backup differs: ${file.path}`);
  }
  assert.deepEqual(protectedSnapshot(app, input), result.protected_before, 'Configuration or dependency manifests changed before replacement.');
  verifyInputs(app, input);
  assert.equal(hash(readFile(stageResultPath)), result.stage_result_sha256, 'Original stage receipt changed.');
  record('backups_complete', { files: files.map(file => ({ path: file.path, sha256: file.before })) });

  for (const file of files) {
    budget();
    const target = path.join(app, file.path);
    plainPath(target);
    assert.equal(hash(readFile(target)), file.before, `Archive source changed before replacement: ${file.path}`);
    const bytes = readFile(path.join(output, 'download', file.path));
    assert.equal(hash(bytes), file.after, `Prepared source changed: ${file.path}`);
    const prepared = path.join(output, 'prepared', file.path);
    fs.mkdirSync(path.dirname(prepared), { recursive: true });
    writeNew(prepared, bytes);
    record('replacement_started', { path: file.path, before_sha256: file.before, after_sha256: file.after, prepared });
    fs.renameSync(prepared, target);
    assert.equal(hash(readFile(target)), file.after, `Replaced source differs: ${file.path}`);
    result.replacements.push({ path: file.path, sha256: file.after, git_blob: file.blob });
    record('replacement_finished', result.replacements.at(-1));
  }
  for (const file of files) assert.equal(hash(readFile(path.join(app, file.path))), file.after, `Final source differs: ${file.path}`);
  result.inputs_after = verifyInputs(app, input);
  result.protected_after = protectedSnapshot(app, input);
  assert.deepEqual(result.protected_after, result.protected_before, 'Configuration or dependency manifests changed.');
  assert.equal(hash(readFile(stageResultPath)), result.stage_result_sha256, 'Original stage receipt changed.');
  assert.equal(hash(readFile(inputPath)), inputSha256, 'Browser input manifest changed.');
  result.status = 'passed';
  result.completed_utc = new Date().toISOString();
  record('completed', { files_replaced: 3, original_stage_receipt_preserved: true });
} catch (error) {
  result.status = 'failed';
  result.error = { name: error.name, message: error.message, code: error.code };
  result.recovery = 'Read all phase receipts and the three current file hashes before any retry; use only backups whose hashes were recorded. No automatic rollback or replay was attempted.';
  result.completed_utc = new Date().toISOString();
  if (outputCreated) {
    try { record('failed', result.error); }
    catch (recordError) { result.record_error = recordError.message; }
  }
  process.exitCode = 1;
}
process.stdout.write(JSON.stringify(result) + '\n');
