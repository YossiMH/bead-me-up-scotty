// Exercise the production drawer/palette handlers with React and network boundaries replaced.
import assert from 'node:assert/strict';
import test from 'node:test';
import { sourceLoader } from './support/load-source-module.mjs';

function find(node, predicate) {
  if (!node || typeof node !== 'object') return;
  if (predicate(node)) return node;
  for (const child of [node.props?.children].flat(Infinity)) {
    const found = find(child, predicate);
    if (found) return found;
  }
}

function fixture(kind = 'bead-rs') {
  const states = new Map();
  let slots, cursor, effects;
  const react = {
    useState(initial) {
      const index = cursor++, owner = slots;
      if (!(index in owner)) owner[index] = typeof initial === 'function' ? initial() : initial;
      return [owner[index], value => { owner[index] = typeof value === 'function' ? value(owner[index]) : value; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useMemo: factory => factory(),
    useCallback: callback => callback,
    useEffect: effect => effects.push(effect),
  };
  const render = (name, component, props) => {
    if (!states.has(name)) states.set(name, []);
    slots = states.get(name); cursor = 0; effects = [];
    const tree = component(props);
    effects.forEach(effect => effect());
    return tree;
  };
  let bead = { id: 'work-1', title: 'Saved title', description: 'Saved description', notes: 'Saved notes',
    status: 'open', base_status: 'open', priority: 2, issue_type: 'task', labels: [], dependencies: [], comments: [] };
  const meta = { kind, capabilities: { editableFields: ['title', 'description', 'notes', 'issue_type', 'priority', 'status', 'assignee'],
    operations: ['comment', 'dependencies'], statuses: ['open', 'in_progress', 'deferred', 'closed'], attribution: 'unavailable' } };
  const writes = [], closes = [];
  let callbacks;
  const mutation = {
    isPending: false, error: null, variables: undefined,
    mutate: (input, options) => { writes.push(input); mutation.variables = input; mutation.isPending = true; callbacks = options; },
    reset: () => { mutation.error = null; mutation.isPending = false; mutation.variables = undefined; },
  };
  const idle = () => ({ isPending: false, error: null, reset() {}, mutate() {} });
  const loader = sourceLoader({ replacements: {
    react,
    'next/navigation': { useRouter: () => ({ push() {} }) },
    sonner: { toast: Object.assign(() => {}, { error() {}, success() {} }) },
    '@/components/app-context': { useApp: () => ({ meta, projectId: 'native', readOnly: false, humanAllowlist: [],
      beads: [bead], index: new Map([[bead.id, bead]]), pushDetail() {}, openDetail() {}, openCreate() {} }) },
    '@/hooks/use-beads': { useUpdateBead: () => ({ ...mutation }), useSetStatus: idle, useAddComment: idle,
      useRemoveDep: idle, useArchiveBead: idle, useDeleteBead: idle, useCreateGate: idle, useLabelDelta: idle },
    '@/hooks/use-projects': { useProjects: () => ({ data: { projects: [] } }) },
    '@/hooks/use-image-drop': { useImageDrop: () => ({}) },
    '@/hooks/use-resizable-width': { useResizableWidth: () => ({ width: 720, startResize() {} }) },
    '@/components/theme-provider': { useTheme: () => ({ mode: 'dark', setTheme() {}, toggle() {} }) },
    '@/components/ui/dialog': { Dialog: 'dialog-root', DialogContent: 'dialog-content', DialogTitle: 'dialog-title' },
    '@/components/ui/sheet': { Sheet: 'sheet-root', SheetContent: 'sheet-content', SheetTitle: 'sheet-title', SheetDescription: 'sheet-description' },
    '@/components/icons': { Icon: 'icon', typeIconName: () => 'task' },
    '@/components/board/bead-card': { OriginBadge: 'origin-badge', PriorityChip: 'priority-chip' },
    '@/components/copyable-id': { CopyableId: 'copyable-id' },
    '@/components/gate-approval': { GateApproval: 'gate-approval' },
    '@/components/assignee-field': { AssigneeField: 'assignee-field' },
    '@/components/dependency-editor': { DependencyEditor: 'dependency-editor' },
    '@/components/description-content': { DescriptionContent: 'description-content' },
    '@/components/markdown-toolbar': { MarkdownToolbar: 'markdown-toolbar', applyTransform() {} },
    '@/components/ai-assist-panel': { AiAssistPanel: 'ai-assist' },
    '@/components/keyboard-help-dialog': { ShortcutKeys: 'shortcut' },
    '@/components/mutation-outcome-notice': { MutationOutcomeNotice: 'outcome-notice' },
  } });
  const { BeadDetailDrawer } = loader.load('components/bead-detail-drawer.tsx');
  const { CommandPalette } = loader.load('components/command-palette.tsx');
  const { ApiError } = loader.load('lib/api-client.ts');
  const drawer = () => {
    const outer = render('drawer', BeadDetailDrawer, { openId: bead.id, initialAction: 'edit', onClose: () => closes.push('drawer') });
    const body = find(outer, node => node.type?.name === 'DrawerBody');
    return render('drawer-body', body.type, body.props);
  };
  const palette = () => {
    const outer = render('palette', CommandPalette, { open: true, initialPage: 'priority', initialBeadId: bead.id,
      onOpenChangeAction: value => closes.push(value), onViewAction() {} });
    const body = find(outer, node => node.type?.name === 'PaletteBody');
    return { outer, body: body ? render('palette-body', body.type, body.props) : outer };
  };
  return {
    drawer, palette, writes, closes,
    display: patch => { bead = { ...bead, ...patch }; return bead; },
    settle(state) {
      mutation.isPending = false;
      if (state) mutation.error = new ApiError('Readback unavailable', 409, `mutation_${state}`, undefined,
        { state, operation: 'update', issueId: bead.id, phase: 'readback' });
      else callbacks?.onSuccess?.(bead);
      callbacks?.onSettled?.();
    },
  };
}

function input(tree, label) { return find(tree, node => node.props?.['aria-label'] === label); }
function priority(tree, value = '2') { return find(tree, node => node.type === 'select' && node.props.value === value); }
function notice(tree) { return find(tree, node => node.type === 'outcome-notice'); }
function priorityItem(tree) { return find(tree, node => node.props?.value === 'priority 1 High'); }

for (const resolution of ['reconcile', 'discard']) {
  test(`priority ${resolution} keeps an unrelated content draft open`, () => {
    const app = fixture();
    input(app.drawer(), 'Title').props.onChange({ target: { value: 'Unsaved title' } });
    input(app.drawer(), 'Description').props.onChange({ target: { value: 'Unsaved description' } });
    priority(app.drawer()).props.onChange({ target: { value: '0' } });
    app.settle('committed');
    const recovery = notice(app.drawer());
    assert.deepEqual(recovery.props.expectedPatch, { priority: 0 });
    if (resolution === 'reconcile') recovery.props.onReconciled(app.display({ priority: 0 }));
    else recovery.props.onDiscard();
    app.drawer();
    const refreshed = app.drawer();
    assert.equal(input(refreshed, 'Title')?.props.value, 'Unsaved title');
    assert.equal(input(refreshed, 'Description')?.props.value, 'Unsaved description');
    assert.equal(input(refreshed, 'Title').props.disabled, false);
    assert.equal(notice(refreshed), undefined);
    assert.deepEqual(app.writes, [{ id: 'work-1', patch: { priority: 0 } }]);
  });
}

test('one submitted drawer patch owns the immediate duplicate-submit guard', () => {
  const app = fixture();
  input(app.drawer(), 'Title').props.onChange({ target: { value: 'Edited title' } });
  const save = find(app.drawer(), node => node.type === 'button' && [node.props.children].flat().includes(' Save'));
  assert.ok(save);
  save.props.onClick();
  save.props.onClick();
  assert.deepEqual(app.writes, [{ id: 'work-1', patch: { title: 'Edited title' } }]);
});

for (const state of ['committed', 'uncertain']) {
  test(`native palette retains its ${state} priority request for reconciliation`, () => {
    const app = fixture();
    const option = priorityItem(app.palette().body);
    option.props.onSelect();
    option.props.onSelect();
    assert.deepEqual(app.writes, [{ id: 'work-1', patch: { priority: 1 } }]);
    assert.deepEqual(app.closes, [], 'A native priority request must remain mounted');
    app.settle(state);
    const { outer, body } = app.palette();
    const recovery = notice(body);
    assert.ok(recovery, 'The priority owner exposes read-only recovery');
    assert.deepEqual(recovery.props.expectedPatch, { priority: 1 });
    let cancelled = false;
    outer.props.onOpenChange(false, { cancel: () => { cancelled = true; } });
    assert.equal(cancelled, true);
    assert.deepEqual(app.closes, []);
    recovery.props.onReconciled(app.display({ priority: 1 }));
    assert.deepEqual(app.closes, [false]);
    assert.equal(app.writes.length, 1);
  });
}

test('original palette priority still closes immediately after submitting', () => {
  const app = fixture('bd');
  priorityItem(app.palette().body).props.onSelect();
  assert.deepEqual(app.writes, [{ id: 'work-1', patch: { priority: 1 } }]);
  assert.deepEqual(app.closes, [false]);
});
