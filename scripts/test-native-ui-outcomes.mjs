// Real client parsing and mutation hooks with HTTP, cache and notification boundaries replaced.
import assert from 'node:assert/strict';
import test from 'node:test';
import { sourceLoader } from './support/load-source-module.mjs';
const client = sourceLoader().load('lib/api-client.ts');
const committed = { state: 'committed', operation: 'create', issueId: 'work-created', receiptId: 'receipt-1', phase: 'readback' };
const originalFetch = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = originalFetch; });
test('client preserves committed identity instead of an ordinary retryable create error', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ error: 'Write committed. Refresh before retrying.', code: 'mutation_committed', outcome: committed }), { status: 409 });
  await assert.rejects(client.api.create('native', { title: 'Work' }, true), error => {
    assert.deepEqual(error.outcome, committed);
    return true;
  });
});
test('native create and comment transport failures remain uncertain; original errors stay original', async () => {
  const failure = new TypeError('connection lost');
  globalThis.fetch = async () => { throw failure; };
  for (const call of [() => client.api.create('native', { title: 'Work' }, true), () => client.api.addComment('native', 'work-1', 'Comment', true)]) {
    await assert.rejects(call(), error => error.outcome?.state === 'uncertain' && error.code === 'mutation_uncertain');
  }
  await assert.rejects(client.api.create('bd', { title: 'Work' }), error => error === failure);
});
test('commit metadata does not turn invalid native readback into success', async () => {
  globalThis.fetch = async () => new Response('not-json', { status: 200 });
  await assert.rejects(client.api.create('native', { title: 'Work' }, true), error => error.outcome?.state === 'uncertain');
});
test('create and comment failures refresh read-only without success or mutation replay', async () => {
  const events = [];
  const qc = { invalidateQueries: options => { events.push(['refresh', options.queryKey]); } };
  const loader = sourceLoader({ replacements: {
    '@tanstack/react-query': { useMutation: options => options, useQueryClient: () => qc },
    'sonner': { toast: { success: () => events.push(['success']) } },
    '@/components/error-toast': { toastError: error => events.push(['error', error]) },
    '@/components/app-context': { useApp: () => ({ projectId: 'native', meta: { kind: 'bead-rs' }, readOnly: false }) },
  } });
  const hooks = loader.load('hooks/use-beads.ts');
  const hookClient = loader.load('lib/api-client.ts');
  for (const hook of [hooks.useCreateBead, hooks.useAddComment]) {
    const options = hook();
    const error = new hookClient.ApiError('Committed', 409, 'mutation_committed', undefined, committed);
    await options.onError(error);
  }
  assert.equal(events.filter(([event]) => event === 'refresh').length, 2);
  assert.equal(events.filter(([event]) => event === 'success').length, 0);
});
test('comment reconciliation requires its exact receipt, not identical text or an uncertain outcome', () => {
  const outcome = { ...committed, operation: 'comment', issueId: 'work-1', receiptId: 'comment-2' };
  const bead = { id: 'work-1', comments: [{ id: 'comment-1', text: 'Same text' }] };
  assert.equal(client.mutationReadbackMatches(outcome, bead), false);
  assert.equal(client.mutationReadbackMatches(outcome, { ...bead, comments: [{ id: 'comment-2' }] }), true);
  assert.equal(client.mutationReadbackMatches({ ...outcome, state: 'uncertain' }, { ...bead, comments: [{ id: 'comment-2' }] }), false);
  assert.equal(client.mutationReadbackMatches(committed, { id: 'other' }), false);
});
function find(node, predicate) {
  if (!node || typeof node !== 'object') return;
  if (predicate(node)) return node;
  for (const child of [node.props?.children].flat(Infinity)) { const found = find(child, predicate); if (found) return found; }
}
test('the recovery control makes reads only and resolves a known receipt without replay', async () => {
  const requests = [], resolved = [], refreshed = [];
  const bead = { id: 'work-1', comments: [{ id: 'comment-2' }] };
  globalThis.fetch = async (url, init) => {
    requests.push({ url, method: init?.method ?? 'GET' });
    return new Response(JSON.stringify(bead));
  };
  const { MutationOutcomeNotice } = sourceLoader({ replacements: {
    'react': { useState: initial => [initial, () => {}] },
    '@tanstack/react-query': { useQueryClient: () => ({ invalidateQueries: key => refreshed.push(key) }) },
    '@/hooks/use-beads': { beadsKey: id => ['beads', id] },
  } }).load('components/mutation-outcome-notice.tsx');
  const props = { outcome: { ...committed, operation: 'comment', issueId: 'work-1', receiptId: 'comment-2' }, projectId: 'native', mode: 'comment', onReconciled: value => resolved.push(value) };
  await find(MutationOutcomeNotice(props), node => node.type === 'button').props.onClick();
  assert.deepEqual(requests, [{ url: '/api/p/native/beads/work-1', method: 'GET' }]);
  assert.deepEqual(resolved, [bead]);
  assert.equal(refreshed.length, 1);
  resolved.length = 0;
  await find(MutationOutcomeNotice({ ...props, outcome: { ...props.outcome, state: 'uncertain' } }), node => node.type === 'button').props.onClick();
  assert.deepEqual(resolved, []);
  assert.ok(requests.every(request => request.method === 'GET'));
});
test('label recovery keeps its outcome when GET succeeds but the coherent list refresh fails', async () => {
  const requests = [], resolved = [], published = [];
  const bead = { id: 'work-1', labels: ['external-C'] };
  const snapshot = { meta: { kind: 'bead-rs', readyIds: [] }, beads: [bead] };
  let listFails = true;
  globalThis.fetch = async (url, init) => {
    requests.push({ url, method: init?.method ?? 'GET' });
    if (url.endsWith('/work-1')) return new Response(JSON.stringify(bead));
    return listFails
      ? new Response(JSON.stringify({ error: 'Read unavailable' }), { status: 503 })
      : new Response(JSON.stringify(snapshot));
  };
  const { MutationOutcomeNotice } = sourceLoader({ replacements: {
    'react': { useState: initial => [initial, () => {}] },
    '@tanstack/react-query': { useQueryClient: () => ({
      cancelQueries: async () => {},
      setQueryData: (key, data) => published.push({ key, data }),
      // QueryClient's default invalidation does not reject a failed refetch.
      invalidateQueries: async () => {},
    }) },
    '@/hooks/use-beads': { beadsKey: id => ['beads', id] },
  } }).load('components/mutation-outcome-notice.tsx');
  const props = { outcome: { state: 'uncertain', operation: 'label_add', issueId: 'work-1', phase: 'command' }, projectId: 'native', mode: 'labels', onReconciled: value => resolved.push(value) };
  await find(MutationOutcomeNotice(props), node => node.type === 'button').props.onClick();
  assert.deepEqual(resolved, [], 'A successful targeted GET cannot release stale label chips');
  assert.deepEqual(published, []);
  listFails = false;
  await find(MutationOutcomeNotice(props), node => node.type === 'button').props.onClick();
  assert.deepEqual(published, [{ key: ['beads', 'native'], data: snapshot }], 'Publish the whole native snapshot, including readiness');
  assert.deepEqual(resolved, [bead]);
  assert.deepEqual(requests.map(request => request.method), ['GET', 'GET', 'GET', 'GET']);
});
