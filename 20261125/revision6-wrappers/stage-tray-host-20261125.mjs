// Apply the reviewed nine-file host correction to the existing source archive.
// Root runs this with no app/check using the archive and a fresh output directory.
// Usage: node --max-old-space-size=64 stage-tray-host-20261125.mjs F:/Dev/.bead-edit-20261111/stage-tray-host-20261125-v1
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
const previousPatchCommit = '38c21a77b4e875d75e17ee68683846601df33591';
const patchCommit = '5232c8b94804064ab71af571ee28797667bd72bd';
const stageResultSha256 = '50d778ac4cad653d5136fe5e85b4cd652efb662ad4560bb972a8c2888ef20fe3';
const previousPatchPath = path.join(taskRoot, 'stage-tray-repair-20261125-v1', 'result.json');
const previousPatchSha256 = '112afac739308ac3c365ca8b2a30481efd9bf81043136035dab295f959e661fe';
const helperSha256 = '46c98de97680cad44f8aa70c643a9538941cc0a0a6f5b4f86b6b2f0eae5716fb';
const files = [
  {
    "path": "bin/windows-tray.mjs",
    "before": "a947ec77a5d742f3d735288483dcf0f54e5b057ec7d3b64370e656b878fea611",
    "before_blob": "f740c9b95370ed632c7f65f8778d034d32f75a51",
    "after": "4205c86aab176cd394c528221d946bcf920f854d26e539164e62cc109c747446",
    "bytes": 6214,
    "blob": "329e2379c0dc72b396d9fa12872c7db39700451f"
  },
  {
    "path": "bin/windows-tray-host.mjs",
    "before": null,
    "before_blob": null,
    "after": "39d1f1e609a787f862cdc21d6fef7aa3c768d981233a12e22c0d2108e93cf0dd",
    "bytes": 3571,
    "blob": "c3a31c8bd8b73f21ab15573080794198b12934dc"
  },
  {
    "path": "scripts/fixtures/tray-process-boundary.mjs",
    "before": "7e94e76548e61bde08ca2899fb8a24ed0bb74041ebfa2375436bba3573cd1e31",
    "before_blob": "2ba0b1a937d2880b1aa522670a62dc591a03a21c",
    "after": "85a0e9339e6f9b9b89ff235de6ac82422babb4fbf705653137e38217470f611e",
    "bytes": 2383,
    "blob": "44ce6973f4307c5d03285fdfaa700af1078afdec"
  },
  {
    "path": "scripts/fixtures/tray-helper.mjs",
    "before": "597bac6ccb4033ff219e90df8e8b490ef3e7f8e34bfc85f1b5287b099d1391c1",
    "before_blob": "6c3180c296f129121d45328670983d42c810f30b",
    "after": "59e189900441b953e25d40f95d70d9009c181e539942c7f77125d709dea4ec00",
    "bytes": 1469,
    "blob": "0980a266807ba2313b4af8704b9802e6bb900816"
  },
  {
    "path": "scripts/test-windows-tray.mjs",
    "before": "d48e8b73c16b4196ab880d53023d98fbe89df3068ea111b0b05c5a29a8acbacb",
    "before_blob": "6d12ea6c8bde18f672e84098e9ac82c2cd1edb97",
    "after": "422a40265365c8cc58862a7a6dd47a05f22d0b7a1f648755de936974e88149d8",
    "bytes": 18097,
    "blob": "e070bfe66ce63017f510d06f1c630626ae595a8d"
  },
  {
    "path": "scripts/test-windows-tray-host.mjs",
    "before": null,
    "before_blob": null,
    "after": "3e021347c1066d7f023d2abfce07d46347f848e5e8eb19bf5190bdf228902726",
    "bytes": 5318,
    "blob": "cd1499376938bed82ed52da829810f417459ba92"
  },
  {
    "path": "scripts/fixtures/windows-tray-observer.mjs",
    "before": "02ec2ee65cd737ba4d46f4f9d1b291f85bf7fa937e3aca3a6dd0d80063e6e243",
    "before_blob": "e80b528fb0a4ca83add42a7a2962a5ff38994ba8",
    "after": "a46859f6582fd1d248e4548c7a6d1f00673ab9541c77ed045930aa231c5b45de",
    "bytes": 4686,
    "blob": "7dbb50fffef9f58c863721693d2af5deaff98218"
  },
  {
    "path": "scripts/test-windows-tray-smoke.ps1",
    "before": "f0f065541fec53fc720350cca7cc533e52207657c230da2457e74ec469aaedac",
    "before_blob": "8638310d6dfa2a9af83f60855adce2b20189a857",
    "after": "4e13d7172c8f520c17ae1698cc9428b5b5a87aaa3ed30e2bcc7a2dcbad870279",
    "bytes": 13515,
    "blob": "cb9db28373ee2a7d68406128e333a7720ba544f0"
  },
  {
    "path": "scripts/test-windows-tray-host-windows.mjs",
    "before": null,
    "before_blob": null,
    "after": "609fe2e0ae05acd9ddea4e9e8db5a9f349ee86fb5b4bac2443d1c7314434ed5e",
    "bytes": 19239,
    "blob": "5b0d0a608451f29548d3765242c7c323a7d7770d"
  }
];
const started = Date.now();
const output = path.resolve(process.argv[2]);
const result = {
  schema_version: 1, status: 'running', started_utc: new Date(started).toISOString(),
  task_id: 'beadrs-ea7bc5dd', output_directory: output,
  source_kind: 'archive_with_three_file_patch_and_nine_file_host_patch', base_archive_commit: baseCommit,
  previous_patch_source_commit: previousPatchCommit, patch_source_commit: patchCommit, replacements: [], events: [],
  interpretation: 'The original archive receipt remains unchanged. This result identifies only the nine applied source files; it asserts no Git HEAD or complete-archive equality with the patch commit.',
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

function assertBefore(target, file) {
  plainPath(target, file.before === null);
  if (file.before === null) {
    assert.equal(fs.existsSync(target), false, `New candidate path already exists: ${file.path}`);
    return null;
  }
  const bytes = readFile(target);
  assert.equal(hash(bytes), file.before, `Archive source changed: ${file.path}`);
  assert.equal(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'), file.before_blob, `Archive source Git bytes differ: ${file.path}`);
  return bytes;
}

function assertPriorReceipts() {
  assert.equal(hash(readFile(stageResultPath)), stageResultSha256, 'Original stage receipt changed.');
  assert.equal(hash(readFile(previousPatchPath)), previousPatchSha256, 'Previous source-patch receipt changed.');
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
  assert.ok(path.isAbsolute(process.argv[2]) && samePath(path.dirname(output), taskRoot) && /^stage-tray-host-20261125-[A-Za-z0-9_-]+$/.test(path.basename(output)), 'Output must be a fresh named child of the task root.');
  plainPath(output, true);
  fs.mkdirSync(output);
  outputCreated = true;
  record('started', { stage_result: stageResultPath, previous_patch_result: previousPatchPath, input_manifest: inputPath });
  assertPriorReceipts();
  const previousPatch = JSON.parse(readFile(previousPatchPath).toString('utf8').replace(/^\uFEFF/, ''));
  assert.equal(previousPatch.status, 'passed', 'Previous source patch did not pass.');
  assert.equal(previousPatch.base_archive_commit, baseCommit);
  assert.equal(previousPatch.patch_source_commit, previousPatchCommit);
  const previousPaths = ['bin/windows-tray.mjs', 'scripts/fixtures/tray-process-boundary.mjs', 'scripts/test-windows-tray.mjs'];
  assert.deepEqual(previousPatch.replacements, previousPaths.map(relative => {
    const file = files.find(entry => entry.path === relative);
    return { path: relative, sha256: file.before, git_blob: file.before_blob };
  }), 'Previous source-patch replacement inventory differs.');
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
  result.previous_patch_result_sha256 = previousPatchSha256;
  assert.ok(samePath(previousPatch.app_directory, app), 'Previous patch archive differs.');
  result.input_manifest_sha256 = inputSha256;
  result.app_directory = app;
  for (const file of files) {
    const target = path.join(app, file.path);
    assertBefore(target, file);
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
    const before = assertBefore(target, file);
    if (before === null) continue;
    const backup = path.join(output, 'before', file.path);
    fs.mkdirSync(path.dirname(backup), { recursive: true });
    writeNew(backup, before);
    assert.equal(hash(readFile(backup)), file.before, `Backup differs: ${file.path}`);
  }
  assert.deepEqual(protectedSnapshot(app, input), result.protected_before, 'Configuration or dependency manifests changed before replacement.');
  verifyInputs(app, input);
  assertPriorReceipts();
  record('backups_complete', { files: files.map(file => ({ path: file.path, sha256: file.before })) });

  for (const file of files) {
    budget();
    const target = path.join(app, file.path);
    assertBefore(target, file);
    const bytes = readFile(path.join(output, 'download', file.path));
    assert.equal(hash(bytes), file.after, `Prepared source changed: ${file.path}`);
    const prepared = path.join(output, 'prepared', file.path);
    fs.mkdirSync(path.dirname(prepared), { recursive: true });
    writeNew(prepared, bytes);
    record('replacement_started', { path: file.path, before_sha256: file.before, after_sha256: file.after, prepared });
    if (file.before === null) {
      // COPYFILE_EXCL cannot overwrite a new file created after the absence check.
      fs.copyFileSync(prepared, target, fs.constants.COPYFILE_EXCL);
      const descriptor = fs.openSync(target, 'r+');
      try { fs.fsyncSync(descriptor); } finally { fs.closeSync(descriptor); }
      fs.unlinkSync(prepared);
    } else {
      fs.renameSync(prepared, target);
    }
    assert.equal(hash(readFile(target)), file.after, `Replaced source differs: ${file.path}`);
    result.replacements.push({ path: file.path, before_sha256: file.before, was_absent: file.before === null, sha256: file.after, git_blob: file.blob });
    record('replacement_finished', result.replacements.at(-1));
  }
  for (const file of files) assert.equal(hash(readFile(path.join(app, file.path))), file.after, `Final source differs: ${file.path}`);
  result.inputs_after = verifyInputs(app, input);
  result.protected_after = protectedSnapshot(app, input);
  assert.deepEqual(result.protected_after, result.protected_before, 'Configuration or dependency manifests changed.');
  assertPriorReceipts();
  assert.equal(hash(readFile(inputPath)), inputSha256, 'Browser input manifest changed.');
  result.status = 'passed';
  result.completed_utc = new Date().toISOString();
  record('completed', { files_replaced: files.filter(file => file.before !== null).length, files_created: files.filter(file => file.before === null).length, original_stage_receipt_preserved: true, previous_patch_receipt_preserved: true });
} catch (error) {
  result.status = 'failed';
  result.error = { name: error.name, message: error.message, code: error.code };
  result.recovery = 'Read all phase receipts and the nine current file states/hashes before any retry; use only backups whose hashes were recorded. No automatic rollback or replay was attempted.';
  result.completed_utc = new Date().toISOString();
  if (outputCreated) {
    try { record('failed', result.error); }
    catch (recordError) { result.record_error = recordError.message; }
  }
  process.exitCode = 1;
}
process.stdout.write(JSON.stringify(result) + '\n');
