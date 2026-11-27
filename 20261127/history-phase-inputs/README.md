# Checkpoint-only phase inputs

This packet prepares the eight requests consumed by the accepted checkpoint-only
helper. It records input locations and conditions; actual history execution stays
with root. Each phase template has its phase name and the two accepted runtime
receipt pins filled in. Future result paths/hashes, supervisor output, Git
observations, cleanup revision/reason and root attestations remain null or false.
The supervisor rejects the null output at `Safe-Path` before creating an output
directory. Retain these templates unchanged and create a separate reviewed
request for each actual phase.

The driver remains SHA-256
`ff1597b37c873888aef55af6c67b39cd29efeb025d007fe11659ccb81a32cc46`;
the supervisor remains
`1dd2e70b74236b87f5192ea1d9129ccdaa059b14e47f4bdd8fc8ebe3046341f5`.
They are already staged together in
`F:/Dev/.bead-edit-20261111/final-installation-v9-20261125-1151`.
The accepted original request template is
`b532e85b0b36869c72032f9b02d3ab85fc3999c6d0d788162746807f0ad2eb35`.
`input-checklist.json` records full source identities and exact proposed paths.

## Stage the accepted inputs

Use these names for the two fixed roots:

- **C:** `F:/Dev/.bead-edit-20261111/coordination-20261124`
- **R:** `F:/Dev/.bead-edit-20261111/preservation-checkpoint-only-20261127-v1`

`pin()` accepts an ordinary JSON file strictly below C or R, verifies its exact
SHA-256, and reads that file. An execution result in another task output folder
must first be copied byte-for-byte into an allowed root, with source and
copy hashes compared. Keep both original execution records and their copies.
Do not replace a raw result with a reformatted version.

**Before `preserve`, put every pinned prerequisite under C.** R must remain
absent: the driver validates the initial accepted pins before creating R, and
refuses any existing R. The proposed new input directory is
`C/revision-9/checkpoint-only-inputs`; the templates name its two fixed runtime
receipts. Root should check the destination state before exclusive copies.

| Input | Exact source or destination | Readiness condition |
| --- | --- | --- |
| `runtime.qualification` | Copy `20261127/checkpoint-only-handoff/inputs/runtime-qualification-accepted.json` to `C/revision-9/checkpoint-only-inputs/runtime-qualification-accepted.json` | 1,857 bytes; SHA-256 `a0adc1eb5ca1707977eedcf42b084b0c55207410d2f8eba349572d68866ee3cc`. |
| `runtime.review` | Copy `20261127/checkpoint-only-handoff/inputs/runtime-review-accepted.json` to `C/revision-9/checkpoint-only-inputs/runtime-review-accepted.json` | 1,014 bytes; SHA-256 `9e2e68863cc3fa0442b88be4eec6ed0d6aec2e9235e4374658944d7103b44972`. |
| Plan, materialization, plan review | Existing `C/revision-9/plan.json`, `C/materialization-result-v9.json`, `C/revision-9/plan-review.json` | Exact fixed hashes in every template. Plan review has `status: "PASS"`, `accepted: true`, revision 9, complete 55-task/91-edge read, and the same plan hash in both required fields. |
| Original inventory | Existing `C/inventory-before-node-v3.json` | The 954-issue baseline. The driver records its actual hash in preserve and rechecks it thereafter. Keep the original file. |
| Install and configured launch | Accepted actual driver results copied under C | Lowercase `status: "passed"`; each actual operation must already be independently reconciled with its supervisor, source/runtime identities and cleanup. The templates await those exact accepted bytes. |
| Installed review; native/app text reviews | Accepted review files under C | Lowercase `status: "passed"`. Initial text reviews must bind the actual published/adopted handoff commits. Preparation reviews of unpublished drafts do not satisfy this condition. |
| Original Git baseline | Actual post-install, post-native-handoff `original-git-baseline.json` under C | Schema and timing below; retain its actual raw index copy under C too. |
| Cleanup results/text review and first checkpoint publication | Actual accepted records under C or R, added before `close` | Lowercase `status: "passed"`. Reuse the same accepted first-publication receipt in both final phases. |
| Prior phase results | Exact `R/phases/<phase>/result.json` | Successful actual result plus accepted supervisor; hash the complete unchanged bytes. The driver also rehashes referenced files through each result's `outputs` map. |

The two runtime receipts already have the consumer's required lowercase status,
final binary `0431a828bf95038641a0c55b4cf11c5800b52881940a13bd2f56b02f0b27177a`
and native source `2d801ba455b7a722daf644a7615445117d57e8e9`.
Their independent review is retained as
`20261127/checkpoint-only-handoff/inputs/runtime-consumer-receipts-review.json`
(SHA-256 `47cf4723541151a7db1aa580d0c0384fe86dda9e3a64f352fdab286b1907cd7e`).
That review is supporting provenance, not another field read by `pin()`.

For another original review using uppercase `PASS`, preserve the original
review unchanged. If its conclusion is already accepted, a separately reviewed
consumer receipt can express the same conclusion using lowercase `passed` and
cite the exact original bytes. No receipt can fill an unperformed operation or
turn a failure into acceptance.

## Post-handoff original Git baseline

Capture this after the successful installation and actual adoption/publication
of the reviewed initial native handoff descendant. It must describe the current
`F:/Dev/bead-rs` HEAD and raw index immediately before history preservation.
The new Git publisher's `documents` mode for native is designed to emit
`original-git-baseline.json` plus `index-after.raw` under its coordination
output. Use those actual files only after that publisher and its actual result
are independently accepted. The null receipt template here is a schema aid;
it does not replace the producer's result.

| Field | Exact consumer requirement |
| --- | --- |
| `status` | `"passed"`. |
| `head` | Actual 40-character original-repository HEAD after handoff. |
| `remote_repository` | `"YossiMH/bead-rs"`. |
| `remote_commit` | Exactly `head`, backed by the actual fork observation. |
| `checkpoint_tree`, `remote_checkpoint_tree` | Both `ff0759095a01edb38ca4bb8aa90fbdb84476e0f7`. |
| `remote_objects_verified` | `true`, backed by the retained exact checkpoint object observation. The original tree contains 53 blobs totaling 429,072,095 bytes. |
| `index_sha256` | Actual SHA-256 of the post-handoff original raw Git index. |
| `index_backup.path` | An ordinary raw copy strictly under C. R is insufficient for this one field. |
| `index_backup.sha256` | Exactly `index_sha256` and the actual hash of that copy. |
| `commit` | The producer additionally emits this equal to `head`; the history consumer checks `head` and `remote_commit`. |

The driver reopens and hashes the same index backup in **every phase**, even
after native checkpoint publication legitimately changes the live index. Keep
this baseline record and raw index unchanged throughout. `preserve`, `freeze`,
`source-restore` and the pre-publication part of `restore-original` require the
live HEAD/index to match it. A pre-install baseline, a proposed handoff commit,
or replacing it with a later checkpoint baseline cannot satisfy that contract.

## The eight phase requests

Every phase requires the first three root attestations to be true based on
actual observations: exclusive native writer window, accepted installed
reviews, and accepted initial handoff reviews. The templates leave all five
attestations false. The prerequisite results and source/plan/runtime pins are
checked again each time.

| Order and template | Prior results read directly by this phase | Phase-specific condition |
| --- | --- | --- |
| `01-preserve` | None | R absent; original DB and all three sidecars absent; unchanged original checkpoint/config/Git baseline. Retains selected checkpoint generations, raw index and original corpus; records the original inventory hash. |
| `02-freeze` | preserve | All 54 tasks other than cleanup closed; cleanup remains open, unassigned and unclaimed. Creates the recognized coordination freeze marker and flushes/retains the complete 1,009-issue source. |
| `03-source-restore` | preserve, freeze | Original remains untouched with no DB; restore frozen source into fresh `R/source-restore-check` and accept complete reconciliation. |
| `04-restore-original` | preserve, freeze, source-restore | Recheck DB/sidecar absence at the write boundary. Supported no-auto-flush init must be empty and preserve config/checkpoint/index; normal restore publishes and reconciles the full corpus before transferring authority. |
| `05-restore` | preserve, freeze, source-restore, restore-original | Fresh `R/restore-check`; original Git and DB must exactly match restore-original's saved state. Run before any root checkpoint Git commit. |
| `06-close` | preserve, freeze, source-restore, restore-original, restore | Root first publishes/verifies the initial checkpoint and completes accepted cleanup/handoff updates. Pin cleanup results, cleanup text review and first checkpoint publication. Both cleanup attestations true. Supply actual current cleanup revision and accepted reason. |
| `07-final-publish` | preserve, freeze, source-restore, restore-original, close | Reuse close's input revision and reason. Live DB/Git must exactly equal close's saved after-state. Flush only that close; no intervening Git commit or native write. |
| `08-final-restore` | preserve, freeze, source-restore, final-publish | Fresh `R/final-restore-check`; live DB/Git must exactly equal final-publish's saved state. Verify all 55 tasks closed before root's final Git publication. |

These are direct reads; keep the complete accepted predecessor chain and all
outputs, including indirectly used records. Future hashes remain null in the
templates. The checklist gives exact fixed prior paths; copies at another path
cannot replace them. No task revision is inferred from an older mapping.

`cleanup_revision` is the original store's actual **pre-close** revision of
`beadrs-3ec972f8`; `close_reason` must already be trimmed and 80–4096 characters.
The close result reports the incremented revision. For final-publish, reuse the
original request revision/reason: the driver checks it against the close result
minus one. Retain those same inputs in final-restore for a coherent chain.

## Root's publication boundary

After `restore-original` and `restore` both pass and are independently accepted,
root publishes the first verified checkpoint with a normal commit/push. The
actual publication receipt supplied to `accepted.checkpoint-publication` needs:

- `status: "passed"`;
- `generation_id` and `root_sha256` equal to restore-original's actual result;
- actual 40-character `commit` and identical observed `remote_commit`;
- actual `checkpoint_tree`, matching the live HEAD at `close`.

The checkpoint must be clean at close; the publication commit must remain an
ancestor of the current HEAD. Later documentation-only handoff commits can be
accepted between the first publication and close while retaining that same
checkpoint tree and unchanged task DB. `checkpoint-publication.receipt.template.json`
leaves all these future observations null. Pin the actual first publication
result; final publication happens only after phase 8 and cannot be a prerequisite
for its own execution.

## Complete and invoke one actual request

1. Inspect the preceding actual results and current attempt/output state. Copy
   any newly accepted raw result into C or R and verify exact source/copy hashes.
2. Copy the selected phase template to a new actual request under the task root.
   Fill future required pins from accepted results. Use a fresh immediate child
   of C whose name starts `checkpoint-only-supervision-` for `supervisor_output`;
   unclaimed suggestions are recorded in the checklist. Driver phase paths are
   fixed, so an existing `R/phases/<phase>` requires reconciliation, not a retry
   using a differently named supervisor output.
3. Root sets the relevant attestations only after observing their conditions.
   Check at least 3 GiB immediately free, exact executable/helper hashes, normal
   non-reparse paths and the allowed optional zero-byte publication lock. Keep
   only this task's native writer active. Retain and independently review the
   complete actual request, then hash its unchanged bytes.
4. Invoke the already accepted supervisor once with `-InputManifest` and
   `-InputSha256`, process-only ExecutionPolicy Bypass, and its existing limits:
   180 seconds, 12-second cleanup reserve, 512 MiB aggregate RSS, 1 GiB live floor,
   BelowNormal priority and 128 MiB Node heap. Collect driver and supervisor
   results plus their complete referenced logs before accepting the phase.

No task-store write is allowed in coordination after freeze. The original
becomes the sole writer only after restore-original's successful reconciliation.
Every later phase still reads the frozen coordination DB/checkpoint and verifies
it against the retained freeze snapshot. Keep C, its index backup and all pinned
inputs, R's complete phase outputs, the staged final native runtime, Node, Git
and Job/helper files through final-restore. Cleanup before close can remove only
other accepted exact owned artifacts and disposable restore targets whose
results are retained. Preserve the original recovery commit's reachability and
the private recovery material after final publication.

A missing or failed result, changed index/HEAD, initialized original after a
partial restore, or occupied phase path requires root's actual-state
reconciliation. Retain the attempt; never delete it to make the absence check
pass or silently replay a phase.
