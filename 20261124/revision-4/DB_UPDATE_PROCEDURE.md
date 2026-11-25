# Apply the accepted revision 4 to the existing tasks

Root alone performs native task writes, using Emergency Maintenance. This
directory is a planning candidate until an independent whole-plan review passes
on the exact files in checks.json. The renderer reads files only. No command here
authorizes a second restore or a new copy of the existing 17 tasks.

## Existing store and records

The isolated canonical store is
F:/Dev/.bead-edit-20261111/coordination-20261124. Its UUID is
1c4f5d56-dcff-cbc5-ddf9-c536653c45f4. The successful original restore retained
954 records and 11264 original events. Revision 3 added 17 tasks and 26 blocking
edges, producing 971 records. Use results/materialization-result-v3.json for the
actual IDs; those exact IDs are already embedded in this delta.

Use the verified Windows native executable with SHA-256
25a05bdfd8feaea92faf6827e9268e597d25432826f1082c7ebadc3af8658798. Keep TEMP and TMP
child-local in a fresh owned directory as in the successful v3 materializer;
do not change host settings. Preserve every earlier manifest, result and restore
receipt. Original source .beads checkpoint files remain untouched through
installer preflight, and Scotty's private task store is never used.

## Read and bind current records

1. Confirm the independent revision-4 review passed on the complete 21-task plan,
   all expanded descriptions, the delta template, renderer and this procedure.
   Retain its exact reviewed hashes. Pause claims only for the changed tasks and
   proposed four new tasks while reconciling and applying the atomic delta.
   Ordinary completion records for unaffected accepted work remain permitted.
2. Retain fresh unfiltered `bead list --all --json`, current store identity and
   supported `show`/claim details. Require 971 distinct records before a fresh
   delta, the 17 exact existing IDs, their original expanded descriptions, all
   26 accepted blocking edges and unchanged resource keys. Compare the original
   954 records with the successful v3 before-inventory; do not replace history.
   Use actual current revisions after any legitimate release of root's own
   claim. Manifest v1 has no fencing credential and refuses edits to claimed
   issues. Never acquire another worker's secret or release its claim.
3. Read `bead ref find --namespace bead-edit-20261124 --value KEY --json` for all
   17 existing keys and require the one recorded ID. Read the same command for
   tray-repair, tray-repair-checks, installer-repair and tray-repair-review and
   require an empty array before a fresh application. Any existing or uncertain
   new reference requires reconciliation of the earlier attempt, not a replay.
4. Copy bindings.example.json to a fresh current-bindings file. Set the four
   reconciliation booleans only after their checks succeed; fill each existing
   task's actual revision, unique-reference matches and retained readback path.
   Set claim_released_or_absent only from legitimate current claim information.
   Keep the expected old-description hashes. Record each new reference's empty
   result and readback path. Supply the absolute local copy of the full fresh
   inventory and its SHA-256. Preserve the current descriptions verbatim; do not
   manufacture a prior-state inventory from the plan.
5. In the cloud run `python coordination/revision-4/render_delta.py --bindings
   /ABSOLUTE/current-bindings.json --output /ABSOLUTE/revision-4-bound.json`.
   The renderer verifies the reviewed file hashes, actual IDs, current revisions,
   complete old descriptions, resources, old edges and new-reference absence.
   It emits one new JSON file and its hash. The only substitutions are actual
   current revision numbers; existing task IDs and new local references are
   already concrete. A changed description, closed affected task, conflicting
   edge, missing claim reconciliation or unexpected record count stops rendering.

## Apply and reconcile once

1. Transfer the exact rendered bytes through the existing permitted transfer
   route; recheck their hash and the verified native executable. Re-read the
   affected live revisions/descriptions and reference absence before submission.
   Keep claiming paused for the affected tasks through the transaction.
2. Run native `manifest dry-run --input PATH --format json` from the canonical
   store, retain full output/exit, and require the exact operation count in
   checks.json, four new creates, the specified description updates and eight
   new blocks edges. Require no unsupported field, revision conflict or claim
   error. Dry-run IDs are provisional. Do not count dry-run as materialization.
3. Recheck payload/executable hashes and run `manifest commit --input PATH
   --format json` once. Creates precede all references to them, existing guarded
   description updates precede edge additions, and all operations share one
   transaction. No status, priority, assignee, notes, claim, label or resource
   changes are requested for existing tasks. Record actual new IDs from commit.
4. Read a new complete inventory and all 21 reference mappings. Require 975
   distinct records, the same original 954 records, the same old 17 IDs, exactly
   four new IDs, all complete revision-4 descriptions, unchanged existing states
   and related data, and all 34 blocks edges in the intended direction. Compare
   original records byte-for-byte; for changed continuation records allow only
   the accepted description/dependency edits and their native revision/history
   metadata. Unaffected old records must remain identical to the fresh before
   snapshot. Verify new resource declarations and retained old declarations.
5. Save results/materialization-result-v4.json with actual mappings, exact
   payload/review hashes, record counts, complete description/edge comparisons,
   unchanged-history checks and all command result paths. Root records the
   already completed whole-plan review in the existing plan-review task rather
   than creating a second plan-review task. Preserve existing result/closure
   records and then resume normal claims on the accepted graph.
6. A timeout, missing reply, nonzero commit, native exit 6 or uncertain result
   requires full readback before another mutation. If the delta committed,
   reconcile it, recover publication with supported sync flush-only where
   needed, and never resend guarded description updates or four creates as
   though absent. If all new references are absent and all old descriptions,
   revisions and edges remain unchanged, only the unchanged accepted payload
   may be retried after resolving the concrete failure. Conflicting/partial
   contents need an exact reviewed correction; do not restore or recreate.

The final preserve-and-clean task retains this complete graph, actual IDs and
same-history checkpoint through publication and worktree removal. The new repair
tasks do not replace any unfinished browser, tray, install, launch, writing or
cleanup requirement.
