# Checkpoint handoff runner: prepared candidate

This package supersedes the unreviewed pre-outage local draft and prepares root-owned execution. It does not report a PC merge,
publication, restore, task closure, or cleanup as completed. The public task
branch is retention for helpers only; it must not be merged into product main.

## Required decisions and inputs

Use the reviewed replacement runtime after the set-v2 outcome-count and
immutable-tail repairs are qualified. The helper deliberately rejects the
historical Windows SHA256
25a05bdfd8feaea92faf6827e9268e597d25432826f1082c7ebadc3af8658798.
Supply the new executable path, full source commit and actual binary SHA256,
plus pinned successful qualification and independent review records. Each of
those two records must contain status, source_commit and binary_sha256.

The current approved shape is revision 5: 31 continuation tasks, 49 blocking
edges and 985 total issues. There are 954 original issues. Root must supply
the actual accepted plan and materialization-result-v5 hashes; no future hash
is embedded in this candidate. Thirty continuation tasks must be closed before
freeze; preserve-and-clean (beadrs-3ec972f8) stays open until the final close.
The exact plan supplies titles, descriptions, task keys and all edges.

Each request is an immutable JSON file in the owned coordination area. Pass its
exact SHA256 to the supervisor. Use a new supervisor_output basename on every
invocation. The semantic phase directory is fixed and may be created only once.
A previous phase directory or mutation attempt is a stop for reconciliation,
even if its final result is missing. Never delete or rename it to enable replay.

The template file contains nulls for unknown inputs and cannot execute. Fill it
from actual retained receipts. Request fields:

| Field | Contract |
| --- | --- |
| schema_version | 1 |
| phase | One of the ordered phases below |
| helper_sha256, supervisor_sha256 | Exact independently reviewed source bytes |
| runtime | path, sha256, source_commit, qualification pin, review pin |
| node | Observed Windows Node v25.2.1 path and SHA256 |
| job_helper_path | Existing qualified windows-task-job.ps1, SHA256 2758a6ff94c0eecdfa360363469069dfa8470efc1f91228812146919a978921f |
| plan | Pin of isolated/revision-5/plan.json |
| materialization | Pin of isolated/materialization-result-v5.json |
| accepted | Named prerequisite pins; every referenced JSON must have status passed |
| prior | Pins for successful earlier phases' fixed result.json files |
| backup_result | Pin of preservation-20261125-v1/original-sqlite/result.json |
| attestations | Actual root confirmation of exclusive writers and accepted installation/handoffs |
| cleanup_revision, close_reason | Required for close and copied exactly to final-publish |

A pin is {"path":"absolute owned path","sha256":"64 lowercase hex characters"}.
Accepted evidence roles always include plan-review, install, configured-launch,
installed-review, backend-text-review, app-text-review and original-git-baseline.
The plan review must include plan_sha256. The original-git-baseline is root's
read-only HEAD/status/index preservation receipt, taken after installation and
before original native opens. Root preserves its index bytes and source checks;
this helper performs no Git commands.

For close/final phases, also require cleanup-results, cleanup-text-review and
checkpoint-publication. The publication receipt must bind the initial published
generation_id and root_sha256, its full Git commit and equal verified
remote_commit. These are root's actual publication/cleanup evidence, not a
substitute for performing those actions. Root's cleanup_completed and
cleanup_handoffs_published attestations must be true for close.

Provide all earlier passed phase pins in each later request. The helper binds
runtime, plan and materialization identities across every consumed phase.
Pinned prerequisite files must stay under the isolated coordination or retention
root. Preserve them before deleting any disposable worktree.

## Phase sequence

| Phase | Result |
| --- | --- |
| preserve | Requires absent retention root. Saves exact original config and full checkpoint tree; verifies the fixed original generation/root and 954 / 11264 / 5 / 413 corpus. Root has already preserved Git/index. No original native open. |
| external backup | Run the independently reviewed fixed-path read-only backup helper once. Its expected SHA256 is 85e6b942b2d4f7976c7bd3dec854918ad213583b11e085b0707ef653e611d48a. Keep the private SQLite backup on the PC. It is not part of this package. |
| freeze | Checks all 31 task IDs/titles/descriptions/statuses and 49 edges against the accepted mapping. Leaves cleanup open, freezes isolated authority, flushes once, copies/hashes full checkpoint and compares all original public records. |
| source-restore | Mandatory exact-runtime native restore of the frozen selected current generation into a fresh owned target. Compares complete public corpus and new-task SQLite auxiliary rows. Runs before any native original open. |
| dry-run | Binds the original backup and unchanged original files. Reads all SQLite tables, original canonical event identities and receipts. Runs one native merge dry-run, then proves every raw SQLite row, inventory and pointer unchanged. |
| merge | Rechecks unchanged dry-run state and frozen source. Saves authority-transfer intention and mutation attempt, imports exactly once with --merge --profile native-v1 --no-auto-flush. Proves original raw rows survive, new-task rows/auxiliary data match source, full receipt set and all input event identities/content survive with one summary/receipt. All future writes belong to original. |
| publish | Flushes original once, proves semantic SQLite state unchanged by publication and full public checkpoint equivalent to source plus merge provenance. Saves immutable checkpoint copy and complete live snapshot. |
| restore | Restores that exact published current generation into a fresh owned directory. Verifies all original/new issues, dependencies, labels, comments, outcomes, events and receipts. Accounts for one restore event and one restore receipt. |
| root Git/cleanup | Root publishes checkpoint using short directory pathspecs, verifies remote objects, removes published clean worktrees through Riftri, retains all results, appends/reviews/publishes cleanup handoffs. |
| close | Requires accepted cleanup/publication evidence. Reads actual current cleanup revision, requires open/unassigned/no claim epoch, dry-runs and commits exactly one guarded close operation without auto-flush. Verifies all other raw records and one added closed event. |
| final-publish | Flushes the closure and verifies original-owned durable generation, unchanged other issues and exact close reason/revision. |
| final-restore | Restores and verifies the final selected generation. Root then publishes the final checkpoint and verifies remote reachability. |

The entire selected current generation is required to verify. Previous-generation
verification is recorded separately as previous-generation-diagnostic.json.
An older writer may already have overwritten its legacy tail. Exact previous
bytes remain retained; the helper does not repair or reinterpret them. A passed
current-source restore must never be described as proof that a failed older
previous generation was recoverable.

Native sync import-only hashes the staged record stream, including its special
oversize-reference byte recipe. Its receipt digest differs from a set-v2
manifest digest. The helper calculates both and binds the correct one.
The dry-run inserted count is all 985 input issues, not the 31 inserted delta.
Its receipt preview includes the prospective added receipt; the actual merge
receipt's counts describe the input. The actual merge must report 31 inserted,
0 updated, 954 retained and 0 conflicted.

The original pointer snapshot 29609 is a local SQLite sequence. Original public
event identities are UUID 1c4f5d56-dcff-cbc5-ddf9-c536653c45f4 with origin
sequences 1..11264. Never copy the lower-sequence isolated pointer over original.
No reidentification, nonempty restore, original reset, or Scotty private-store
operation is present.

## Resource supervision and invocation

Root first stages and hashes both files, and independently parses the Windows
PowerShell script. Node --check is also required on the exact staged helper
before use. Neither full Windows parsing nor execution was available when this
candidate was retained after the cloud filesystem outage.

Invoke the supervisor in a fresh hidden PowerShell process:
powershell.exe -NoProfile -NonInteractive -File <SUPERVISOR>
  -InputManifest <ABSOLUTE_REQUEST> -InputSha256 <EXACT_SHA256>

Use the retained Emergency Maintenance route. Do not add an execution-policy
bypass. The wrapper sets BelowNormal, uses the existing qualified owned Job,
caps aggregate owned resident memory at 512 MiB, starts only with 3 GiB free physical
RAM, and stops its own phase if free RAM falls below 1 GiB. Node heap is 128 MiB.
Every native call is bounded to 30 seconds; the wrapper hard deadline is 180 seconds
and reserves time for cleanup. It monitors only its Job's retained process
handles and kills only owned members. No process-name or port killing, browser,
application launch, product build or GPU action occurs.

Native stdout/stderr go directly to exclusive files, with started/exit records;
an interrupted command keeps partial logs. The wrapper monitors their 16 MiB cap.
Node/supervisor output streams are capped at 8 MiB. Fresh child-only TEMP/TMP is
inside that phase's output. Runtime hash is checked before every native call.

A missing result, timeout, memory stop, connector loss, unexpected count or
publication error does not authorize another import or close. Inspect actual
live state and retained receipts. Root must prepare and review a distinct
reconciliation step; this helper has no replay/reset switch. A successful merge
followed by a failed publication remains an original-store transaction to
reconcile. Keep the original private backup and frozen source.

## Root-owned Git and cleanup

Windows long argv failed when hundreds of checkpoint files were expanded.
Use reviewed short directory pathspecs such as:
git add -A -- .beads/checkpoint
git commit --message "chore(beads): preserve reviewed editing continuation" -- .beads/checkpoint

Root preserves hooks and other staging, verifies the exact checkpoint-only
delta, verifies each staged object against retained digests, uses normal
fast-forward push, and verifies the final remote ref and selected closure.
Do not use sync commit's long file list on this Windows store.

Keep private database backups and raw table snapshots on the PC. Do not Git-add,
upload or publish them. Disposable verification stores are never merged back.
Root may remove only their exact recorded owned directories after retaining
their receipts. No helper phase deletes a store, worktree, branch or original
file.

If this session dies, a future agent must inspect authority-transfer and
attempt records before any write, resume only verified phases, preserve private
backups/results, remove remaining task worktrees through Riftri without force,
and clean the task/checkpoint-helper-20261125 preservation branch after its exact
helpers/audits exist in the normal durable handoff location. Root owns that
conditional branch cleanup.

## Validation available during preparation

Before the cloud outage, the read-only verifier parsed the exact public
afac9fa0 checkpoint: 954 issues, 11264 canonical events, 5 receipts, 413 outcomes; root
SHA256 4f5571a1823810366d4a3274c9231604913905c6334c380bf116b110ae5d486d.
A fresh historical-runtime cloud restore preserved every original public
record digest. Its read-only SQLite event identity map matched the checkpoint.
A single fixture-only append then reproduced the retained-tail failure, with
the current generation valid and previous generation's fixed tail hash wrong.
The concrete failure capsule was independently inspected before the outage.

The reconstructed helper has a V8 body-syntax check only (module-only syntax is
removed for that parser). It has not executed native phases. The final module
syntax check, PowerShell parser check, independent delivery review and exact
qualified runtime/source restore are required before PC execution.
