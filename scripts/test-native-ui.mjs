import assert from 'node:assert/strict';
import test from 'node:test';
import { sourceLoader } from './support/load-source-module.mjs';
const loader = sourceLoader();
const view = loader.load('lib/beads-view.ts');
const columns = loader.load('lib/board-columns.ts');
const native = { kind: 'bead-rs', capabilities: {
  operations: ['create', 'comment', 'dependencies', 'label-delta'], editableFields: ['status', 'assignee'],
  statuses: ['open', 'in_progress', 'blocked', 'deferred', 'closed'],
  dependencyTypes: ['blocks', 'relates_to', 'verifies'], closeReason: 'required', attribution: 'unavailable',
}, readyIds: [] };
const issue = { id: 'work-1', title: 'Work', status: 'open', priority: 2, issue_type: 'review_check', dependencies: [] };
const index = new Map([[issue.id, issue]]);
test('empty native frontier never infers Ready from open status', () => {
  assert.equal(view.isReady(issue, index, new Set(native.readyIds)), false);
  assert.equal(columns.colOf(issue, index, new Set(native.readyIds)), 'not_ready');
});
test('native ready membership overrides open/dependency inference without hiding other work', () => {
  assert.equal(columns.colOf(issue, index, new Set([issue.id])), 'ready');
  assert.equal(columns.colOf({...issue, assignee: 'someone'}, index, new Set()), 'not_ready');
  assert.equal(columns.colOf({...issue, status: 'blocked'}, index, new Set()), 'blocked');
  assert.equal(columns.colOf({...issue, status: 'closed'}, index, new Set()), 'done');
});
test('missing readiness preserves original columns', () => {
  assert.equal(columns.colOf(issue, index), 'ready');
  assert.equal(view.isReady(issue, index), true);
  assert.equal(columns.boardColumns().some(column => column.id === 'not_ready'), false);
});
test('capability membership preserves original controls and refuses absent native actions', () => {
  assert.equal(view.canOperate(undefined, 'delete'), true);
  assert.equal(view.canEdit(undefined, 'title'), true);
  assert.equal(view.canOperate(native, 'delete'), false);
  assert.equal(view.canEdit(native, 'description'), false);
  assert.equal(view.canEdit(native, 'labels'), false);
  assert.equal(view.canOperate(native, 'label-delta'), true);
  assert.equal(view.canOperate({ ...native, capabilities: { ...native.capabilities, operations: [] } }, 'create'), false);
});

test('native status actions respect base lifecycle under a blocked overlay', () => {
  assert.equal(view.canChangeStatus(native, { ...issue, status: 'blocked', base_status: 'deferred' }, 'in_progress'), false);
  assert.equal(view.canChangeStatus(native, { ...issue, status: 'blocked', base_status: 'deferred' }, 'open'), true);
  assert.equal(view.canChangeStatus(native, { ...issue, status: 'closed', base_status: 'closed' }, 'in_progress'), false);
  assert.equal(view.canChangeStatus(native, { ...issue, status: 'closed', base_status: 'closed' }, 'open'), true);
  assert.equal(view.canChangeStatus(native, issue, 'hooked'), false);
  assert.equal(view.canChangeStatus(undefined, issue, 'hooked'), true);
});
test('views without native attribution do not offer invented activity metrics', () => {
  for (const name of ['activity', 'insights', 'achievements', 'needsyou', 'publish']) {
    assert.equal(view.canView(native, name), false, name);
    assert.equal(view.canView(undefined, name), true, name);
  }
  for (const name of ['board', 'list', 'focus', 'graph', 'settings']) assert.equal(view.canView(native, name), true, name);
});
test('custom types remain filterable and missing native creation authors never classify as agents', () => {
  const filters = loader.load('lib/filters.ts');
  const parsed = filters.filtersFromSearchParams(new URLSearchParams('type=review_check&origin=agent'), true);
  assert.deepEqual(parsed.type, ['review_check']);
  assert.deepEqual(filters.filtersFromSearchParams(new URLSearchParams('type=task&type=no')).type, ['task']);
  assert.equal(filters.matchesFilters(issue, parsed, [], 'unavailable'), true);
  assert.equal(filters.matchesFilters({ ...issue, issue_type: 'task' }, parsed, [], 'unavailable'), false);
});

test('native explicit close reasons do not inherit the bd placeholder convention', () => {
  assert.equal(view.closeReasonOf({ ...issue, close_reason: 'Closed' }, 'bead-rs'), 'Closed');
  assert.equal(view.closeReasonOf({ ...issue, close_reason: 'Closed' }), '');
});
