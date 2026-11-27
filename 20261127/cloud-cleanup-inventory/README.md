# Current cloud cleanup inventory

Observed through **2026-11-27 11:32:31 UTC**. This is a read-only inventory of recorded task-owned paths. Root owns later cleanup. It includes no PC action or product execution.

## Current Git registrations

| Path | Observed state | Cleanup dependency |
| --- | --- | --- |
| `/tmp/beads-2889282bfcec/continuation` | Sole linked worktree; detached at `de71118c225936b8ca6eac4be5db306eff19219b`. Initially clean, then 15 root publication additions were staged. | Finish and verify exact publication, then obtain a fresh clean status before removal. |
| `/tmp/beads-2889282bfcec/scotty` | Parent clone; local branch `task/build-transfer-20261111` at `717667dd46d5d27cb6708120429927bbadd57b5e`. Only Git metadata exists; no index or checked-out files. Its 1,598 staged-deletion entries are the no-checkout representation. | Keep while the linked worktree or archive/publication work needs its object store. |
| `/tmp/beads-2889282bfcec/native` | Parent clone; local `main` at `2d801ba455b7a722daf644a7615445117d57e8e9`. Only Git metadata exists; no index or checked-out files. Its 652 staged-deletion entries are the no-checkout representation. No linked worktree is registered. | The successful qualification fixture uses this object store through Git alternates. Native handoff/object work remains active. |

The active continuation's 15 staged files are the archive preparation reviews, review-cache cleanup receipt, configured-session staging/parser/memory-deferred records, and the eight cleanup22 publication files. Their exact paths are retained in `continuation-final-observation.json`. They were left untouched.

### Exact Riftri route

The installed task-owned executable exists at:

`/tmp/beads-2889282bfcec/tools/node_modules/.bin/riftri`

It resolves to the recorded package's `bin/riftri.js`; package version is **0.7.1**. Once the current worktree is fully published and clean, root can use the established non-force route:

```sh
/tmp/beads-2889282bfcec/tools/node_modules/.bin/riftri exec -- git -C /tmp/beads-2889282bfcec/scotty worktree remove /tmp/beads-2889282bfcec/continuation
```

Afterward, record both path absence and registration absence. Keep the parent clone and Riftri tools until this verification completes. A successor must recheck the worktree because the inventory is a dated observation of active publication.

## Qualification and tools still present

| Exact path | Current retention | Cleanup condition |
| --- | --- | --- |
| `/tmp/checkpoint-crlf-qualification-5` | The complete 1,671-file fixture remains local. Its result, source, all 198 command records and selected audits are retained through the accepted packet. Full database/checkpoint snapshots are locally reviewed and hash-indexed, but are not remotely embedded. | Root can remove this exact fixture after accepting that explicitly documented local-only snapshot disposition. Remove it before its shared native object store. |
| `/tmp/qualified-linux-final-recovery` | Qualified artifact ZIP: 22,283,030 bytes; extracted native executable: 13,618,928 bytes, SHA256 `fa0514a3d105d8951d2bc302c1f4ce46fb9e6ed4be21a2a89300d16b77a1ac1c`. The complete binaries remain local downloads. | Confirm no remaining qualified-binary use and retain the small recovery/identity receipts. |
| `/tmp/qualified-node25-recovery` | Official Node 25.2.1 executable: 123,759,744 bytes; archive: 28,628,292 bytes. Exact executable SHA256 `ff2d367cbba86845f4634df2197955188549a129f486b88e955fac037ab29950` is bound by the successful invocation. | Confirm no remaining exact-Node qualification use. Leave system/runtime Node installations alone. |
| `/tmp/beads-2889282bfcec/tools` | Current Riftri installation. | Retain until all worktree removal checks finish. |

The fixture's actual alternates file is:

`/tmp/checkpoint-crlf-qualification-5/checkpoint-only-original/.git/objects/info/alternates`

Its exact content is `/tmp/beads-2889282bfcec/native/.git/objects`.

All **37 authored CRLF packet files** were independently checked against immutable commit `de71118c225936b8ca6eac4be5db306eff19219b`, directory `20261127/checkpoint-crlf-handoff`. Local lengths and SHA256 identities match the frozen author manifest, and every published Git blob identity matches the local bytes. The published source comparison, evidence integrity proof and independent review complete that packet. This retention does not imply that the complete fixture snapshots or downloaded tool binaries were embedded in Git.

## Active ordinary packet directories

These directories have no linked-worktree registrations and remain in use:

- `recovery/checkpoint-crlf-compatibility`: published source and future Windows phase/request dependency.
- `recovery/native-handoff-regenerated` and `recovery/delivery/app-handoff-regenerated`: current handoff preparation.
- `recovery/delivery/history-phase-inputs-crlf`: future actual history inputs.
- `recovery/delivery/configured-session`: reviewed configured source and actual-run dependency.
- `recovery/delivery/scheduled-task-cleanup22`: reviewed source awaiting future actual configured/XML/request inputs.
- `recovery/git-publication-packet`: accepted baseline for the CRLF derivative.
- `recovery/delivery/app-handoff-baselines`, `baseline-configured-crlf` and `baseline-cleanup20`: comparison and provenance inputs.
- `recovery/root`, `recovery/frontend` and `recovery/qualified-linux-final`: active raw receipts, independent reviews, baselines and small tool-recovery metadata.

All relative paths above are beneath `/workspace/scratch/2889282bfcec`. Preserve each until exact publication and downstream use are complete; these active roots are not blanket deletion targets.

## Historical removal versus reset absence

The exact historical worktree removal that is independently supported by a retained receipt is:

`/tmp/beads-2889282bfcec/history-checkpoint-only`

The 3,390-byte receipt is retained at `de71118c`, path `20261127/checkpoint-only-handoff/worktree-publication-and-cleanup.json`, SHA256 `1518bcfd3e2d596c806608901da5b80d9003b9fa77db0b5f375d19715bf06e2f`. It records a successful non-force Riftri removal, exact path/registration absence, and reconciliation of the eleven authored files to published commit `473530433d66206ec6ba8a9980c9ed4bd0e12848`. Its actual ordering is preserved: the initial whole-subtree comparison found two added review files; removal preceded the corrected authored-file-only comparison.

The former tray-runspace, native-download-continuation and closure-v9 paths are absent and unregistered in the current parent clone. Their specific removal receipts were not recovered for this inventory. Backend's report of an earlier closure-v9 removal remains a reported historical fact, separate from the independently reread removal above.

The recorded 51bd, 3160, 3af and 55c9 worktree/clone/tool paths are absent. The first four CRLF qualification roots and older checkpoint-only fixture roots are absent after the documented resets. Those observations establish current absence, not successful cleanup or complete evidence retention. Their exact checked paths are in `path-observations.json`.

The reviewer cache `/tmp/frontend-crlf-review-cache` was separately removed by exact file verification and empty-directory removal at 11:23:18 UTC, after its review became durable. Its receipt is `../reviews/review-cache-cleanup.json`; this was not a worktree operation.

## Successor order

1. Finish the active actual-result, handoff and history work; preserve exact accepted and failed receipts.
2. Publish the continuation's staged files and all later changes. Refresh local status, registrations and remote ancestry.
3. Remove the exact clean continuation through Riftri without force and verify both forms of absence.
4. Resolve the explicitly local-only qualification snapshots, then remove the exact fixture before its shared native object store.
5. Once source/object work ends, remove only the named cloud clones and downloaded tools whose retention gates are satisfied.
6. Retain final recovery, review and cleanup receipts durably. Reconcile any interrupted attempt before continuing.

No path was deleted, no ref/index/checkout changed, and no cleanup command was executed during this inventory.

