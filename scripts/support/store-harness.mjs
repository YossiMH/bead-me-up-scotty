import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { sourceLoader } from './load-source-module.mjs';
import { nativeCapabilities, nativeIssue, nativeMetadata } from '../fixtures/native-contract.mjs';

/**
 * Subprocess test double only: native commands return supplied public documents;
 * unknown commands fail rather than pretending to implement a real database.
 * Caller-provided replies simulate malformed output and interleaved external edits.
 */
export function storeHarness({ backend, issues = [nativeIssue('work-a')],
  metadata = issues.map((issue) => nativeMetadata(issue.id)), readyIds = ['work-a'],
  reply, env = {} } = {}) {
  const calls = [];
  const repositoryPath = path.resolve(process.env.SCOTTY_TEST_ROOT || '/tmp/scotty-contract-unit', 'project');
  const configRoot = path.join(repositoryPath, '..', 'config');
  fs.mkdirSync(configRoot, { recursive: true });
  const configHome = env.XDG_CONFIG_HOME || fs.mkdtempSync(path.join(configRoot, 'store-'));
  const actor = 'test-person';
  const project = { id: 'contract', name: 'Contract', path: repositoryPath, backend };
  const config = {
    getProject: () => project,
    touchProject: () => {},
    DEMO_PROJECT: { id: 'demo', path: null, name: 'Demo' },
    ConfigError: class ConfigError extends Error {
      constructor(message, code) { super(message); this.code = code; }
    },
    getConfig: () => ({ humanActor: actor, humanAllowlist: [actor], pollIntervalMs: 30000 }),
    isReadOnly: () => false,
    lanePrefix: () => null,
    closeActor: (assignee) => assignee || actor,
  };
  let snapshotRead = 0;
  const execFile = (...args) => {
    const callback = args.pop();
    execute(...args).then(({ stdout, stderr }) => callback(null, stdout, stderr), callback);
  };
  /** Invoke the explicit double and retain the complete argv/cwd/env boundary. */
  async function execute(binary, args, options = {}) {
    const call = { binary, args: [...args], options };
    calls.push(call);
    const supplied = await reply?.(call, calls);
    if (supplied !== undefined) return { stdout: typeof supplied === 'string' ? supplied : JSON.stringify(supplied), stderr: '' };
    if (args[0] === '--version') return { stdout: binary.includes('native') ? 'bead 0.3.0' : 'bd version 1.1.0', stderr: '' };
    if (backend !== 'bead-rs') {
      if (args[0] === 'export') return { stdout: issues.map((issue) => JSON.stringify({ ...issue, issue_type: 'task', assignee: issue.assignee ?? '' })).join('\n'), stderr: '' };
      if (args[0] === 'show') return { stdout: JSON.stringify({ data: [{ ...issues[0], issue_type: 'task', assignee: '' }] }), stderr: '' };
    }
    let output;
    if (args[0] === 'capabilities') output = nativeCapabilities;
    else if (args[0] === 'list') output = args.includes('--ready') ? issues.filter((issue) => readyIds.includes(issue.id)) : issues;
    else if (args[0] === 'show') output = issues.find((issue) => issue.id === args[1]);
    else if (args[0] === 'query') output = metadata;
    else if (args[0] === 'changes' && args.includes('--snapshot')) {
      snapshotRead += 1;
      output = { workspace_uuid: 'synthetic-workspace', max_sequence: 9, timestamp: new Date(Date.UTC(2026, 0, 1, 0, 0, snapshotRead)).toISOString(), checksum: `observation-${snapshotRead}` };
    } else if (args[0] === 'doctor') output = { checks: [], has_errors: false, has_warnings: false };
    else throw Object.assign(new Error(`Unsupported command in native fixture: ${args.join(' ')}`), { stderr: `unrecognized command ${args[0]}`, code: 2 });
    return { stdout: JSON.stringify(output) ?? '', stderr: '' };
  }
  execFile[promisify.custom] = execute;
  const loader = sourceLoader({
    env: { BD_BIN: '/test/original-bd', BEAD_BIN: '/test/native-bead', POSTHOG_KEY: '', NEXT_TELEMETRY_DISABLED: '1', XDG_CONFIG_HOME: configHome, ...env },
    replacements: {
      'node:child_process': { execFile },
      'node:fs': { ...fs, existsSync: (filename) => filename === path.join(repositoryPath, '.beads') || fs.existsSync(filename) },
      [path.resolve('lib/config.ts')]: config,
    },
  });
  const storeModule = loader.load('lib/store.ts');
  return { calls, loader, actor, project, getStore: (id = 'contract') => storeModule.getStore(id) };
}

/** Require the additive coherent-read API with a useful missing-behavior failure. */
export async function snapshotOf(store) {
  assert.equal(typeof store.listSnapshot, 'function', 'native store must expose a coherent listSnapshot() read');
  return store.listSnapshot();
}

/** Return only commands that could mutate issue state, excluding qualification and reads. */
export function writes(calls) {
  const readCommands = new Set(['--version', 'capabilities', 'list', 'show', 'query', 'changes', 'doctor']);
  return calls.filter((call) => !readCommands.has(call.args[0]));
}
