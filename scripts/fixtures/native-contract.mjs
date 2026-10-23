/** Synthetic public-command documents using pinned bead-rs native-v1 field names. */
export function nativeIssue(id, overrides = {}) {
  return {
    id, title: `Issue ${id}`, description: '', notes: '', status: 'open',
    effective_status: 'open', priority: 2, assignee: null, manual_blocked: false,
    revision: 1, labels: [], dependencies: [], comments: [],
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
    attempts: { consecutive_failures: 0, count: 0, last_outcomes: [] },
    ...overrides,
  };
}

/** Query projection keys are PascalCase despite snake_case query field names. */
export function nativeMetadata(id, overrides = {}) {
  return { Id: id, IssueType: 'task', ClosedAt: null, CloseReason: null, ...overrides };
}

/** The capability subset used by adapter qualification; not a complete CLI schema. */
export const nativeCapabilities = {
  contract: 'native-v1', implementation: 'bead-rs', version: '0.3.0',
  logical_revision: true, atomic_claim: true,
  statuses: ['closed', 'deferred', 'in_progress', 'open'],
  dependency_kinds: ['blocks', 'relates_to', 'verifies'],
  commands: ['capabilities', 'changes', 'claim', 'close', 'comment', 'create', 'dep',
    'doctor', 'label', 'list', 'manifest', 'query', 'release', 'reopen', 'show', 'update'],
  agent_ergonomics: {
    version: 1,
    issue_documents: { list_json: 'array', show_json: 'object', create_json: 'object' },
  },
};
