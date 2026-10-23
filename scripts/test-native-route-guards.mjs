import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { sourceLoader } from './support/load-source-module.mjs';

// Native attachments are unavailable, including direct URLs outside the UI.
test('native attachment reads refuse before reading a project file', async () => {
  const { repositoryRoot } = sourceLoader();
  const config = {
    DEMO_PROJECT: { id: 'demo' },
    getProject: () => ({ id: 'native', path: '/fixture', backend: 'bead-rs' }),
    ConfigError: class extends Error {},
  };
  const loader = sourceLoader({ replacements: {
    [path.join(repositoryRoot, 'lib/config.ts')]: config,
    'node:fs': { statSync() { throw new Error('Attachment filesystem must not be reached'); } },
  } });
  const route = loader.load('app/api/p/[projectId]/attachments/[...path]/route.ts');
  const response = await route.GET(new Request('http://localhost/attachment'), {
    params: Promise.resolve({ projectId: 'native', path: ['issue', 'image.png'] }),
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, 'unsupported_operation');
});

for (const backend of ['bd', 'bead-rs']) {
  test(`${backend} upload validates its capability without launching a CLI`, async () => {
    const { repositoryRoot } = sourceLoader();
    const loader = sourceLoader({ replacements: {
      [path.join(repositoryRoot, 'lib/config.ts')]: {
        DEMO_PROJECT: { id: 'demo' },
        getProject: () => ({ id: 'project', path: '/fixture', backend }),
        ConfigError: class extends Error {},
      },
      'node:child_process': { execFile() { throw new Error('Upload must not launch a CLI'); } },
    } });
    const route = loader.load('app/api/p/[projectId]/attachments/route.ts');
    const response = await route.POST(new Request('http://localhost/attachments', { method: 'POST', body: new FormData() }), {
      params: Promise.resolve({ projectId: 'project' }),
    });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).code, backend === 'bd' ? 'invalid_input' : 'unsupported_operation');
  });
}

for (const backend of [undefined, 'bd']) {
  test(`${backend ?? 'default'} selection refuses a native fingerprint before original CLI discovery`, async () => {
    const fs = await import('node:fs');
    const os = await import('node:os');
    const directory = fs.mkdtempSync(path.join(process.env.SCOTTY_TEST_ROOT || os.tmpdir(), 'wrong-backend-'));
    fs.mkdirSync(path.join(directory, '.beads'));
    const marker = JSON.stringify({ version: 1, uuid: 'native-workspace', prefix: 'native' });
    fs.writeFileSync(path.join(directory, '.beads/config.json'), marker);
    const { repositoryRoot } = sourceLoader();
    let calls = 0;
    const loader = sourceLoader({ replacements: {
      [path.join(repositoryRoot, 'lib/config.ts')]: {
        DEMO_PROJECT: { id: 'demo' },
        getProject: () => ({ id: 'project', path: directory, name: 'Fixture', backend }),
        ConfigError: class extends Error {},
      },
      'node:child_process': { execFile() { calls += 1; throw new Error('Original CLI must not run'); } },
    } });
    try {
      await assert.rejects(() => loader.load('lib/store.ts').getStore('project'), (error) => error.code === 'backend_mismatch');
      assert.equal(calls, 0);
      assert.equal(fs.readFileSync(path.join(directory, '.beads/config.json'), 'utf8'), marker);
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
  });
}


// Archive capability must be checked before looking up an unsupported native item.
test('native archive refuses before item reads or actor selection', async () => {
  const { repositoryRoot } = sourceLoader();
  const calls = [];
  const store = {
    capabilities: { operations: [] },
    async get() { calls.push('get'); throw new Error('Unsupported archive must not read an item'); },
    async archive() { calls.push('archive'); throw new Error('Unsupported archive must not execute'); },
  };
  const loader = sourceLoader({ replacements: {
    [path.join(repositoryRoot, 'lib/store.ts')]: { getStore: async () => store },
    [path.join(repositoryRoot, 'lib/config.ts')]: {
      ConfigError: class extends Error {},
      closeActor() { calls.push('closeActor'); throw new Error('Unsupported archive must not select an actor'); },
    },
  } });
  const route = loader.load('app/api/p/[projectId]/beads/[id]/archive/route.ts');
  const response = await route.POST(new Request('http://localhost/archive', { method: 'POST' }), {
    params: Promise.resolve({ projectId: 'native', id: 'native-item' }),
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, 'unsupported_operation');
  assert.deepEqual(calls, []);
});

for (const capabilityMode of ['explicit', 'legacy']) {
  test(`${capabilityMode} original archive preserves item lookup and close actor`, async () => {
    const { repositoryRoot } = sourceLoader();
    const calls = [];
    const archived = { id: 'original-item', status: 'closed', labels: ['retained', 'archived'] };
    const store = {
      ...(capabilityMode === 'explicit' ? { capabilities: { operations: ['archive'] } } : {}),
      async get(id) { calls.push(['get', id]); return { id, assignee: 'original-owner' }; },
      async archive(id, actor) { calls.push(['archive', id, actor]); return archived; },
    };
    const loader = sourceLoader({ replacements: {
      [path.join(repositoryRoot, 'lib/store.ts')]: { getStore: async () => store },
      [path.join(repositoryRoot, 'lib/config.ts')]: {
        ConfigError: class extends Error {},
        closeActor(assignee) { calls.push(['closeActor', assignee]); return `closer:${assignee}`; },
      },
    } });
    const route = loader.load('app/api/p/[projectId]/beads/[id]/archive/route.ts');
    const response = await route.POST(new Request('http://localhost/archive', { method: 'POST' }), {
      params: Promise.resolve({ projectId: 'original', id: 'original-item' }),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), archived);
    assert.deepEqual(calls, [['get', 'original-item'], ['closeActor', 'original-owner'],
      ['archive', 'original-item', 'closer:original-owner']]);
  });
}
