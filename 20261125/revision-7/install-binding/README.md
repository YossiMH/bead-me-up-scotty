# Revision 7 installation preparation

This packet prepares the reviewed helpers for the final type-file correction.
It does not run installation, native task creation, checkpoint merge, or a PC
command. `binding.json` records measured build identities and the remaining
qualification steps. Its materialization field is deliberately null until the
actual native transition has passed.

The installer and configured launcher are byte-identical to the accepted
revision 6 files at app commit 457ae66a702f9515e8255bab0837fa51993acdb4.
The production runtime is built from exact app source 0309539797fd7d016e2b8fd8bdc0ae9cefc20219.
The installer already checks each measured runtime file, total count and build
ID. The new 560-file manifest replaces the historical 230-file manifest as an
input. No path exception is added for an unbuilt adapter.

The history helper differs from the accepted revision 6 file only in these
three exact literals:

- `revision-6/plan.json` becomes `revision-7/plan.json`.
- `materialization-result-v6.json` becomes `materialization-result-v7.json`.
- The required accepted plan-review revision changes from 6 to 7.

Its task count, full graph, original 954 records, receipts, outcomes, event
identities and current/previous recovery checks are already derived from the
pinned plan and actual mapping. Its supervisor is unchanged. Each future phase
still requires a fresh reviewed request with the exact measured mapping hash,
qualified native binary and prerequisite receipts; a synthetic fixture is never
a substitute for that mapping.

The accepted revision 7 materializer is included unchanged from
907e1a6ebb3b9ce4d0f9936fb7adee7f3c913b9a for ordinary cloud syntax checking.

## Cloud verification

The dormant workflow uses an isolated hosted Windows runner. It checks exact
input hashes, parses all six executable helper files, compiles only the four
embedded C# declarations, and invokes no declaration methods. It then loads
only selected existing read-only installer functions for synthetic hash, size,
build, path and source mismatch cases. Source fixtures use ordinary local Git
commits. A fresh hosted F: fixture is used only because the existing path
verifier requires that drive; no F:/Dev path is used.

The Node fixture preserves all implementation bytes and adds a test-only export
for the existing graph verifier. It checks a synthetic 49-task/78-edge graph
and refusals for missing/duplicate mappings, wrong edges, changed originals,
unclosed tasks and altered descriptions. It never enters a native history
phase. All fixtures are explicitly synthetic and are removed afterward.

The workflow remains dormant until independent preparation review. Its actual
parser and refusal receipts must be retained before final helper acceptance.
Actual installation and history binding also require the materialization and
runtime evidence listed in `binding.json`.

## Interrupted-session cleanup

Development uses the existing Riftri worktree
`/tmp/beads-55c9/coordination-type-edit`, whose parent is
`/tmp/beads-55c9/bead-me-up-scotty`. Local execution is unavailable at the time
of this packet, so these remote changes have not been materialized into that
worktree. Future agents must reconcile the published helper commits, preserve
any local unpublished work, then remove only the clean published worktree
through `/tmp/beads-55c9/tools/node_modules/.bin/riftri exec -- git -C /tmp/beads-55c9/bead-me-up-scotty worktree remove /tmp/beads-55c9/coordination-type-edit`
without force. Retain this packet and actual check outputs before deleting the
exact task-owned packet/verification branches. The source task branches and PC
rollback, private data and coordination authority remain preserved.
