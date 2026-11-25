# Revision-6 native update and task completion helpers

These prepared helpers target only the existing isolated coordination store at F:/Dev/.bead-edit-20261111/coordination-20261124. Root remains the sole native writer. No PC execution or native mutation was performed while preparing this package.

## Exact inputs and invocation

The accepted plan, description template, native protocol and review are at app transfer a516dee000d606bad0c0093232d35b8d39dcbbcf under 20261125/revision-6. Their full SHA-256 values and both helper hashes are in input-contract.json. The review is 27ee4c9b84debcd3706332105a055e48e4243930dbe4dde6a5b88c52da5fcbd0; the updater checks the real PASS/accepted/revision 6/32-task/51-edge review schema and each exact reviewed input hash. The old mapping file materialization-result-v5.json must remain 6a46c9dd..., and the old accepted plan is f078b507.... The historic 539 native executable remains the current isolated-store writer; this package does not qualify it for original-store merge or checkpoint recovery.

Root first stages the exact helper bytes and inputs, checks both files with ordinary Node --check, and completes independent helper review. Run the updater only inside the existing hidden BelowNormal owned Windows Job with aggregate 512 MiB, Node --max-old-space-size=128 and an outer 180-second deadline. Its own 180-second work budget bounds each native call to at most 30 seconds. Invocation after those preparations is:

    node --max-old-space-size=128 F:/Dev/.bead-edit-20261111/coordination-20261124/materialize-continuation-v6.mjs 27ee4c9b84debcd3706332105a055e48e4243930dbe4dde6a5b88c52da5fcbd0

The fresh output materialization-v6, temp-materialize-v6 and final materialization-result-v6.json must all be absent. An existing name refuses the operation. The original inventory-before-node-v3.json is read from the same isolated root. Original F:/Dev/bead-rs and the Scotty private store are never accessed.

## Native transitions and comparisons

The helper reads all 986 literal CLI records, checks all 954 original projections, exact 32 actual IDs, all 51 directed blocking edges, every old plan description/title/resource set and unassigned continuation state. It takes current status/revision values for unrelated tasks, so newly completed backend tasks remain closed. Only the four accepted tray tasks must still be closed at revision 2. It reads installed reopen help before writing.

Each reopen gets its own intent record, revision-guarded supported native call, exact raw stdout/stderr/exit result, full 986-row readback and verification record before the next reopen begins. It permits only the intended status/revision/update-time changes and the native clearing of assignee/manual-blocked/close metadata; all other stored CLI fields are compared. Readiness and blocker-state projections are the only derived fields removed from stored-field comparison. Prior per-task history arrays must remain exact prefixes and gain the expected reopened event. No claim or fencing token is invented, and notes remain unchanged.

After the four reopens, one description-only manifest binds current post-reopen revisions for the twelve accepted descriptions. Its dry-run must report precisely twelve description/revision changes; report text may be exact or the known native redaction marker. A complete unchanged precommit inventory is required. The actual commit runs once, with --no-auto-flush. Full literal stored descriptions and every untouched field are then compared, together with original 954 preservation, all 51 edges and retained close history. Config and current checkpoint-pointer hashes must remain unchanged. The ready list is recorded for continuation, without treating an empty result as task completion.

All native invocations suppress automatic checkpoint publication. Exact raw JSON stdout is retained once instead of writing a second pretty-printed copy of every large inventory. The final result and materialization-result-v6.json are created exclusively only after all comparisons pass. That final file records the new accepted-plan identity for subsequent root-owned operations; explicit checkpoint publication remains separate. Full raw inventories and histories stay on the PC; only appropriately small handoff summaries should be transferred.

## Failure and later task completion

A timeout, nonzero exit, unexpected output or changed row stops subsequent writes. Existing output prevents automatic replay. The failure record identifies attempted and verified reopens and whether the description commit was attempted. Root must inspect the saved intent, raw output and current native state before deciding on any specifically reviewed continuation. Successful earlier mutations are retained; this helper has no reset, rollback, deletion, restore or broad retry path.

record-accepted-tasks-v6.mjs is exactly the tested v5 closer with only four binding substitutions: materialization-result-v6.json, revision-6/plan.json plus its accepted hash, and temp-materialize-v6. Its request format, guarded current revisions, prerequisite order, close reasons, full original and other-field checks, no-auto-flush commit and fresh-output refusal are unchanged. It must be run under the same bounded root-owned supervision, with request path, request SHA-256 and fresh completed-YYYYMMDD-name arguments. It remains isolated-store-only and must never be reused after authority transfers to the original repository.

Both JavaScript bodies passed a nonexecuting syntax parse in the cloud. Ordinary Node parsing/import resolution and actual native execution remain root-owned. The audits bind the exact frozen files. If this session stops, future agents must preserve these inputs/results and clean the helper scratch branch task/revision6-helpers-20261125 together with the other owned task branches and Riftri worktrees after the final state is durable.
