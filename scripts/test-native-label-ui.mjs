// Execute the production label field's event handlers; replace only React state and mutation boundaries.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import { createRequire } from 'node:module';
import { sourceLoader } from './support/load-source-module.mjs';
const require = createRequire(import.meta.url);
const source = fs.readFileSync(new URL('../components/bead-detail-drawer.tsx', import.meta.url), 'utf8');
const parsed = ts.createSourceFile('drawer.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const declaration = parsed.statements.find(statement => ts.isFunctionDeclaration(statement) && statement.name?.text === 'LabelsField');
const compiled = ts.transpileModule(declaration.getText(parsed), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const view = sourceLoader().load('lib/beads-view.ts');
function field(kind, error = null) {
  const state = [];
  let cursor = 0;
  let effects = [];
  let bead = { id: 'work-1', labels: ['A', 'archived'] };
  let outcome = error;
  const writes = [], replacements = [];
  const render = vm.runInThisContext(`(function(require, React, useApp, useLabelDelta, canEdit, canOperate, nativeMutationOutcome, MutationOutcomeNotice, Icon) { const exports={}; const ARCHIVED_LABEL='archived', fieldLabel='', labelChipClass=''; ${compiled}; return LabelsField; })`)(
    require, {
      useState: initial => {
        const index = cursor++;
        if (!(index in state)) state[index] = initial;
        return [state[index], value => { state[index] = value; }];
      },
      useEffect: effect => effects.push(effect),
    },
    () => ({ meta: kind === 'bead-rs' ? { kind, capabilities: { editableFields: [], operations: ['label-delta'] } } : { kind }, readOnly: false, projectId: 'fixture' }),
    () => ({ mutate: input => writes.push(input), isPending: false, error: outcome, reset: () => { outcome = null; } }), view.canEdit, view.canOperate, value => value, 'notice', 'icon');
  const tree = () => {
    cursor = 0;
    effects = [];
    const result = render({ bead, suggestions: [], onChange: labels => replacements.push(labels) });
    effects.forEach(effect => effect());
    return result;
  };
  return { tree, writes, replacements, display: value => { bead = value; } };
}
function find(node, predicate) {
  if (!node || typeof node !== 'object') return;
  if (predicate(node)) return node;
  for (const child of [node.props?.children].flat(Infinity)) { const found = find(child, predicate); if (found) return found; }
}
test('native chip add/remove emits one explicit label intent, never a stale set', () => {
  const control = field('bead-rs');
  find(control.tree(), node => node.props?.['aria-label'] === 'Add label').props.onChange({ target: { value: 'B' } });
  find(control.tree(), node => node.props?.['aria-label'] === 'Add label').props.onKeyDown({ key: 'Enter', preventDefault() {} });
  find(control.tree(), node => node.props?.['aria-label'] === 'Remove label A').props.onClick();
  assert.deepEqual(control.writes, [{ id: 'work-1', label: 'B', action: 'add' }, { id: 'work-1', label: 'A', action: 'remove' }]);
  assert.deepEqual(control.replacements, []);
});
test('original label replacement still carries archived through untouched', () => {
  const control = field('bd');
  find(control.tree(), node => node.props?.['aria-label'] === 'Add label').props.onChange({ target: { value: 'B' } });
  find(control.tree(), node => node.props?.['aria-label'] === 'Add label').props.onKeyDown({ key: 'Enter', preventDefault() {} });
  assert.deepEqual(control.replacements, [['A', 'B', 'archived']]);
  assert.deepEqual(control.writes, []);
});
test('native recovery stays locked until the refreshed labels are rendered', () => {
  const control = field('bead-rs', { state: 'uncertain', operation: 'label_add', issueId: 'work-1', phase: 'command' });
  const fresh = { id: 'work-1', labels: ['B', 'external-C', 'archived'] };
  find(control.tree(), node => node.type === 'notice').props.onReconciled(fresh);
  let tree = control.tree();
  assert.equal(find(tree, node => node.type === 'fieldset').props.disabled, true, 'Stale rendered chips must remain locked');
  find(tree, node => node.props?.['aria-label'] === 'Remove label A').props.onClick();
  assert.deepEqual(control.writes, []);
  control.display(fresh);
  control.tree();
  tree = control.tree();
  assert.equal(find(tree, node => node.type === 'fieldset').props.disabled, false);
  assert.ok(find(tree, node => node.props?.['aria-label'] === 'Remove label external-C'));
  assert.equal(find(tree, node => node.props?.['aria-label'] === 'Remove label A'), undefined);
  assert.equal(find(tree, node => node.type === 'notice'), undefined);
  assert.deepEqual(control.writes, [], 'Read-only recovery must not replay the label write');
});
test('native client sends one exact-label request per intent', async t => {
  const previous = globalThis.fetch, requests = [];
  t.after(() => { globalThis.fetch = previous; });
  globalThis.fetch = async (url, init) => {
    requests.push({ url, method: init.method, body: JSON.parse(init.body) });
    return new Response(JSON.stringify({ id: 'work-1', labels: ['external-C'] }));
  };
  const { api } = sourceLoader().load('lib/api-client.ts');
  await api.labelDelta('native', 'work-1', 'B', 'add');
  await api.labelDelta('native', 'work-1', 'A', 'remove');
  assert.deepEqual(requests, [
    { url: '/api/p/native/beads/work-1/labels', method: 'POST', body: { label: 'B' } },
    { url: '/api/p/native/beads/work-1/labels', method: 'DELETE', body: { label: 'A' } },
  ]);
});
