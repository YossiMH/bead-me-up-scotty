// Exercise the graph's production edge mapper without mounting React Flow.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../components/graph-view.tsx', import.meta.url), 'utf8');
const parsed = ts.createSourceFile('graph-view.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const declarations = parsed.statements.filter(statement =>
  ts.isFunctionDeclaration(statement) && statement.name?.text === 'styledEdges' ||
  ts.isVariableStatement(statement) && statement.declarationList.declarations.some(declaration =>
    ['FLOW_BLOCKING', 'NATIVE_GRAPH_KINDS'].includes(declaration.name.getText(parsed))));
const compiled = ts.transpileModule(declarations.map(statement => statement.getText(parsed)).join('\n'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const read = vm.runInThisContext(`(function () { ${compiled}; return { styledEdges, nativeKinds: typeof NATIVE_GRAPH_KINDS === 'undefined' ? undefined : NATIVE_GRAPH_KINDS }; })`)();
const issue = { id: 'source', dependencies: ['blocks', 'relates_to', 'verifies'].map(type => ({ type, depends_on_id: 'target' })) };
const beads = [issue, { id: 'target', dependencies: [] }];
test('native graph names and styles each supported kind instead of hierarchy', () => {
  const edges = read.styledEdges(beads, false, true);
  assert.deepEqual(edges.map(edge => edge.label), ['blocks', 'relates_to', 'verifies']);
  assert.equal(edges[1].style.stroke, 'var(--brand)');
  assert.equal(edges[1].style.strokeDasharray, '5 4');
  assert.equal(edges[2].style.stroke, '#0891b2');
  assert.equal(edges[2].style.strokeDasharray, '2 3');
  assert.deepEqual(Object.keys(read.nativeKinds), ['blocks', 'relates_to', 'verifies']);
});
test('same-pair native kinds have separate labels and canonical kind-qualified IDs', () => {
  for (const horizontal of [false, true]) {
    const edges = read.styledEdges(beads, horizontal, true);
    assert.equal(new Set(edges.map(edge => edge.labelStyle?.transform)).size, 3);
    for (const [i, edge] of edges.entries()) {
      assert.equal(edge.id, `source->target:${issue.dependencies[i].type}`);
      assert.equal(edge.source, horizontal ? 'target' : 'source');
      assert.equal(edge.target, horizontal ? 'source' : 'target');
      assert.equal(edge.labelBgStyle.transform, edge.labelStyle.transform);
    }
  }
});
test('original hierarchy and related spellings retain their existing unlabeled styles', () => {
  const original = [{ id: 'source', dependencies: ['parent-child', 'related', 'relates-to'].map(type => ({ type, depends_on_id: 'target' })) }, beads[1]];
  const edges = read.styledEdges(original, false);
  assert.equal(edges[0].style.stroke, 'var(--text-3)');
  assert.equal(edges[0].style.strokeDasharray, undefined);
  for (const edge of edges.slice(1)) {
    assert.equal(edge.style.stroke, 'var(--brand)');
    assert.equal(edge.style.strokeDasharray, '5 4');
  }
  assert.ok(edges.every(edge => edge.label === undefined && !edge.animated));
});
