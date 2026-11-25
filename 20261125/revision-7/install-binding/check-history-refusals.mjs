// Hosted-only tests call the existing read-only graph verifier on synthetic data.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
assert.equal(process.env.GITHUB_ACTIONS, 'true');
assert.equal(process.argv.length, 4);
const [directory, manifestHash] = process.argv.slice(2);
const sha = value => createHash('sha256').update(value).digest('hex');
const inputBytes = fs.readFileSync(path.join(directory, 'parse-inputs.json'));
assert.equal(sha(inputBytes), manifestHash);
const inputs = JSON.parse(inputBytes);
const source = fs.readFileSync(path.join(directory, 'checkpoint-handoff-20261125.mjs'), 'utf8');
assert.equal(sha(source), inputs.files['checkpoint-handoff-20261125.mjs']);
const planBytes = fs.readFileSync(path.join(directory, 'plan.json'));
assert.equal(sha(planBytes), inputs.files['plan.json']);
const plan = JSON.parse(planBytes);
assert.equal(plan.tasks.length, 49);
assert.equal(plan.blocking_edges.length, 78);
const output = path.join(process.env.RUNNER_TEMP, 'bead-binding-checks-' + process.env.GITHUB_RUN_ID + '-' + process.env.GITHUB_RUN_ATTEMPT);
assert.ok(fs.statSync(output).isDirectory());
const fixture = fs.mkdtempSync(path.join(process.env.RUNNER_TEMP, 'bead-history-mock-'));
const copied = path.join(fixture, 'history-verifier.mjs');
const result = { schema_version: 1, status: 'failed', operation: 'synthetic-history-refusals',
  source_sha256: sha(source), plan_sha256: sha(planBytes), cases: [],
  native_commands: 0, history_phase_executed: false, pc_actions: 0 };
try {
  // Preserve every implementation byte. This test-only export exposes the
  // existing private function; the module's main dispatch remains unentered.
  fs.writeFileSync(copied, source + '\nexport { verifyPlan };\n', { flag: 'wx' });
  const { verifyPlan, PIN } = await import(pathToFileURL(copied).href);
  const baseline = Array.from({ length: 954 }, (_, i) => ({ id: 'synthetic-original-' + i,
    title: 'Original ' + i, description: '', status: 'open', revision: 1, dependencies: [] }));
  const mapping = { tasks: Object.fromEntries(plan.tasks.map((task, i) => [task.key,
    task.key === 'preserve-and-clean' ? PIN.cleanup : 'synthetic-task-' + i])), blocking_edges: 78 };
  const own = plan.tasks.map(task => ({ id: mapping.tasks[task.key], title: task.title,
    description: task.description, status: task.key === 'preserve-and-clean' ? 'open' : 'closed',
    revision: 1, dependencies: plan.blocking_edges.filter(edge => edge.blocked === task.key)
      .map(edge => ({ blocker: mapping.tasks[edge.blocker], kind: 'blocks' })) }));
  const inventory = [...baseline, ...own];
  const before = JSON.stringify({ inventory, plan, mapping, baseline });
  verifyPlan(inventory, plan, mapping, baseline);
  result.cases.push({ name: 'matching-49-task-78-edge-graph', result: 'passed' });
  const refused = (name, change) => {
    const copy = structuredClone({ inventory, mapping, baseline });
    change(copy);
    assert.throws(() => verifyPlan(copy.inventory, plan, copy.mapping, copy.baseline));
    result.cases.push({ name, result: 'passed', expected_refusal: true });
  };
  refused('missing-task-mapping', state => { delete state.mapping.tasks[plan.tasks[0].key]; });
  refused('duplicate-task-id', state => { state.mapping.tasks[plan.tasks[1].key] = state.mapping.tasks[plan.tasks[0].key]; });
  refused('incorrect-edge-count', state => { state.mapping.blocking_edges++; });
  refused('incorrect-edge-kind', state => {
    state.inventory.find(row => row.dependencies.length).dependencies[0].kind = 'relates_to';
  });
  refused('changed-original-record', state => { state.inventory[0] = { ...state.inventory[0], title: 'changed' }; });
  refused('unclosed-substantive-task', state => {
    state.inventory.find(row => row.id === state.mapping.tasks[plan.tasks[0].key]).status = 'open';
  });
  refused('changed-task-description', state => {
    state.inventory.find(row => row.id === state.mapping.tasks[plan.tasks[0].key]).description += '\nchanged';
  });
  assert.equal(JSON.stringify({ inventory, plan, mapping, baseline }), before);
  result.inputs_unchanged = true;
  result.status = 'passed';
} catch (error) {
  result.error = error.stack;
  process.exitCode = 1;
} finally {
  fs.rmSync(fixture, { recursive: true });
  fs.writeFileSync(path.join(output, 'history-refusals.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  console.log('BINDING_HISTORY_REFUSALS_BASE64 ' + Buffer.from(JSON.stringify(result, null, 2) + '\n').toString('base64'));
}
