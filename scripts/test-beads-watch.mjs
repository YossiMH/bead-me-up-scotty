import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { sourceLoader } from './support/load-source-module.mjs';

/** Explicit filesystem boundary double; the production watcher is loaded unchanged. */
function harness(backend, exists = true) {
  const calls = [];
  const project = { id: 'watch-test', path: '/synthetic/watch-test', backend };
  const fs = {
    existsSync: directory => exists || !directory.endsWith(path.join('.beads', 'checkpoint')),
    watch: (directory, options, callback) => {
      const watcher = new EventEmitter();
      const call = { directory, options, callback, closed: 0 };
      watcher.close = () => { call.closed += 1; };
      call.watcher = watcher; calls.push(call); return watcher;
    },
  };
  const loader = sourceLoader({ replacements: {
    'node:fs': fs,
    './config': { getProject: id => id === project.id ? project : undefined, DEMO_PROJECT: { id: 'demo' } },
  } });
  return { calls, project, ...loader.load('lib/beads-watch.ts') };
}

for (const backend of [undefined, 'bd']) {
  test(`original ${backend ?? 'default'} watches only the top-level .beads directory`, () => {
    const h = harness(backend), stop = h.subscribeBeadsChange(h.project.id, () => {});
    assert.equal(h.calls.length, 1);
    assert.equal(h.calls[0].directory, path.join(h.project.path, '.beads'));
    assert.deepEqual(h.calls[0].options, { recursive: false, persistent: false });
    stop(); assert.equal(h.calls[0].closed, 1);
  });
}

test('native watches public checkpoint publication, never top-level SQLite read churn', () => {
  const h = harness('bead-rs'), stop = h.subscribeBeadsChange(h.project.id, () => {});
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].directory, path.join(h.project.path, '.beads', 'checkpoint'));
  assert.deepEqual(h.calls[0].options, { recursive: false, persistent: false });
  stop();
});

test('missing native checkpoint falls back to polling rather than the noisy parent', () => {
  const h = harness('bead-rs', false); h.subscribeBeadsChange(h.project.id, () => {})();
  assert.equal(h.calls.length, 0);
});

test('demo and unknown projects create no filesystem watcher', () => {
  const h = harness('bead-rs'); h.subscribeBeadsChange('demo', () => {})();
  h.subscribeBeadsChange('unknown', () => {})(); assert.equal(h.calls.length, 0);
});

test('native subscribers share a watcher and only final unsubscribe closes it', () => {
  const h = harness('bead-rs');
  const first = h.subscribeBeadsChange(h.project.id, () => {});
  const second = h.subscribeBeadsChange(h.project.id, () => {});
  assert.equal(h.calls.length, 1); first(); assert.equal(h.calls[0].closed, 0);
  second(); assert.equal(h.calls[0].closed, 1);
});

test('watcher error closes the handle and a later subscriber can re-establish it', () => {
  const h = harness('bead-rs'), first = h.subscribeBeadsChange(h.project.id, () => {});
  h.calls[0].watcher.emit('error', new Error('synthetic removal'));
  assert.equal(h.calls[0].closed, 1);
  const second = h.subscribeBeadsChange(h.project.id, () => {});
  assert.equal(h.calls.length, 2); first(); second(); assert.equal(h.calls[1].closed, 1);
});
