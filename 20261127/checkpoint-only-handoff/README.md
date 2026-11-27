# Checkpoint-only history handoff

This packet handles the observed original repository at `F:/Dev/bead-rs`:
its committed config and checkpoint exist, and `beads.db`, `beads.db-wal`,
`beads.db-shm`, and `beads.db-journal` are absent. The driver requires that
absence again immediately before initialization. The original generation is
`gen-a569f746bbb268015d996c8ed4c76f57`, with snapshot sequence 29609 and exactly
954 issues, 11264 events, 5 provenance receipts, and 413 attempt outcomes.
`original-checkpoint-only-observation.json` is the unchanged root-observed
metadata result from `2026-11-27T08:18:46.3563406Z` (SHA-256
`e85b13c68ed63cf6408f6dfacb137fb526240e808bc87aa0dc76a5b1a20e4491`).
It records only checkpoint/pinned-binary directories, the 136-byte ignore file,
the 123-byte config, and all four absent database/sidecar paths. Runtime absence
checks remain required even after this preparation observation.

The existing-database helper remains byte-identical at
`20261125/revision-9/install-binding/checkpoint-handoff-20261125.mjs`
(SHA-256 `179d21533c64ac39783ddc556056d249f8100b10743f82e8f7a33f72a83a1341`),
with supervisor
`56e89ba3bf1ecca995dbdb2c992d2baa6167d0271d2bbcbc28852552cdb81161`.
Its database-backup and merge assumptions do not apply to this observed state.
This packet neither supplies a fabricated backup nor edits SQLite or checkpoint
pointers directly. The native CLI owns every semantic write and publication.

## Supported recovery and preserved state

The transfer uses two supported native commands in one claimed phase:

```text
bead --no-auto-flush init --prefix beadrs
bead restore --source <frozen-checkpoint> --generation <exact-generation> --actor chatgpt-bead-edit-20261127 --prefix beadrs --format json
```

Initialization creates the schema and workspace with zero issues, events,
receipts, or other semantic records. The driver proves the original config,
ignore file, selected checkpoint bytes, Git HEAD, tree, and raw index remain
unchanged at that point. The second command starts with a Ready workspace and
therefore uses the native explicit-recovery publisher. That supported path
publishes the restored corpus even when its rebuilt local ingestion sequence
is below the original checkpoint's 29609. A single uninitialized restore or a
no-auto-flush restore followed by ordinary flush does not provide this behavior.
The helper retains those native guardrails.

Before either command, the source is frozen and a disposable restore of its
complete generation must pass. All 54 continuation tasks preceding cleanup must
already be closed. The driver verifies the exact 55-task/91-edge plan and all
954 original issue fields, then retains the full 1009-issue source generation.
It compares every original record and every incoming canonical event, receipt,
and attempt outcome. Recovery adds exactly one native `checkpoint_restored`
event and one restore receipt, with the actual source identity, root hash,
counts, actor, local summary identity, and receipt hash fully reconciled.

The original current pointer becomes `previous.json` byte-for-byte, with its
selected objects preserved. Before publication, the driver retains the original
current and previous closures (4 files, 17063501 bytes), config, ignore file,
and raw index under the new retention root. The complete original checkpoint
tree remains recoverable through its verified remote Git commit: 53 raw blobs,
429072095 bytes, tree `ff0759095a01edb38ca4bb8aa90fbdb84476e0f7`.
The preserved commit must remain reachable after later publication and cleanup.

Normal native publication stages checkpoint changes. The new driver records
that index transition, requires every unrelated index entry to remain exact,
checks staged checkpoint blob identities against the actual published files,
checks deleted files are absent, and refuses unstaged or untracked checkpoint
changes. It never rewrites an index to hide this expected staging. Root performs
the later Git commits and normal pushes after independent result acceptance.

All 1009 issue scopes are compared after restoration. Native recovery recreates
resource-lock acquisition timestamps: the three original held keys must retain
their exact owners and null fencing tokens, and their new timestamps must fall
within the actual restore command. Portable resource declarations and extensions
remain exact. Incoming outcomes remain exact; the isolated source already has
the native reconstructed `prior_attempt_tier` values, which the scoped-row check
also preserves. Raw event ingestion sequence columns are local bookkeeping;
complete canonical event identities and content are the preservation contract.
The driver proves zero initialized events and contiguous same-UUID source event
origins, so its new local and canonical event sequences both equal E+1 in this
specific route.

## Preparation acceptance and actual execution

The two binding tasks concern a concrete prepared candidate and its independent
review. Their preparation can be accepted before installation, which depends on
that review. This packet supplies the missing observed-state recovery route,
its bounded supervisor, an actual disposable qualification, and the exact
request template. Acceptance of this preparation requires both source/runtime
review and task-plan review of these final bytes and author inspections.

Preparation acceptance does not represent successful installation, configured
launch, installed review, handoff publication, history transfer, or cleanup.
Those operations still require their own real retained results. The template
has a null phase, null future evidence fields, and false attestations; the
supervisor rejects it before creating an output directory. Each actual phase
uses a separately reviewed request made from the actual retained bytes.

Existing accepted components remain applicable: final native source and release
qualification, final app/native-HTTP behavior, actual revision-9 materialization,
the bound task closer and actual closures, the unchanged installer and its
bounded supervisor, configured launcher, runtime inventories, and accepted
tray behavior. The older history-template review remains a faithful-template
review with its absent-database limitation. This route resolves that limitation
through separately reviewed supported recovery.

## Qualification

`qualify-checkpoint-only.mjs` uses the previously qualified Linux release from
run 45600748319, artifact 15016141673, without rebuilding the product. Its binary
is SHA-256
`fa0514a3d105d8951d2bc302c1f4ce46fb9e6ed4be21a2a89300d16b77a1ac1c`,
from source `2d801ba455b7a722daf644a7615445117d57e8e9`.
The initial retained run passed in 43.658 seconds. It used the exact public
original corpus plus synthetic task IDs carrying the accepted 55-task/91-edge
plan shape, with 54 fixture closures. The incoming fixture contained 1009 issues,
11465 events, 6 receipts, and 413 outcomes. Recovery published local sequence
11466 while retaining the original 29609 pointer as previous. The run reconciled
all 1009 issue scopes and all three reconstructed locks, checked native staging,
then closed only fixture cleanup, flushed, and restored the final generation.
Four focused refusal checks covered an existing DB, a stray WAL, an unrelated
index change, and a changed original event. A second run of those same driver
and qualifier bytes passed in 40.611 seconds with the supervisor's exact
`--max-old-space-size=128` limit, resolving the initial 256 MiB harness's memory
compatibility question. `qualification-command.json` retains that observed
invocation and exit; `qualification-result.json` is its unchanged actual result.
`qualification-evidence.json` retains all command stdout/stderr/exit bytes and
hashes of the remaining snapshots. Fixture operations do not close or accept
real tasks. Actual Windows execution remains separately supervised.

## Fixed inputs

The complete exact paths and hashes are in `request.template.json`. Both driver
and supervisor bind final Windows native SHA-256
`0431a828bf95038641a0c55b4cf11c5800b52881940a13bd2f56b02f0b27177a`
and source `2d801ba455b7a722daf644a7615445117d57e8e9`. The driver binds plan
`18130e44ab27047dcb397de53caa0a9006c56cfd478d417f884e42452ff62582`
and actual mapping
`6d1cca5e2495011ae3dac4320e622f67c6f871186ef112edd8f51f8c98d1e5b3`.
The mapping's original task revisions are historical; later close operations
must use current observed revisions.

The observed PC Node is `C:/Program Files/nodejs/node.exe`, version `v25.2.1`,
SHA-256 `91ec09dda8f20556f366110859f106ab189d45f8f6a2bd092e6785174ad4a0fa`.
Git is `C:/Program Files/Git/cmd/git.exe`, SHA-256
`20d0dde30a65afb6e5810a883700a94dcd77fbf3b44b32868d45bf7c9b30137c`.
The pinned Git directory is placed first in the native child's PATH, so native
auto-staging uses the same observed executable. The existing qualified Job
helper remains SHA-256
`2758a6ff94c0eecdfa360363469069dfa8470efc1f91228812146919a978921f`.
The old installed native pin is retained by the accepted installer.

## Populate each actual request

The driver's `pin()` accepts ordinary files strictly beneath the coordination
directory `F:/Dev/.bead-edit-20261111/coordination-20261124` or the new retention
root `F:/Dev/.bead-edit-20261111/preservation-checkpoint-only-20261127-v1`.
Copy accepted raw results into owned retention when their execution directory is
outside those roots; compare the original and copied hashes. Never substitute
a reserialized version for a raw result. Keep database, config, and index bytes
private on the PC.

| Request field | Actual source and required contents |
| --- | --- |
| `phase` | One phase below, after inspecting its attempt state and prerequisites. |
| `supervisor_output` | A fresh immediate coordination child whose name begins `checkpoint-only-supervision-`; use a unique name per phase. |
| `runtime.qualification` and `runtime.review` | Separately accepted retained receipts with `status: "passed"`, `binary_sha256` equal to the final Windows binary, and `source_commit` equal to final native source. Cite original qualification/review bytes and immutable remote paths. |
| `accepted.plan-review` | The existing exact revision-9 review, with `status: "PASS"`, `accepted: true`, complete 55-task/91-edge reading and the accepted plan hash. |
| `accepted.install` | Actual passed installer result, reconciled with its supervisor and exact installed paths/source/binary/runtime identities. |
| `accepted.configured-launch` | Actual passed configured launch and its owned-process cleanup result. |
| `accepted.installed-review` | Independent acceptance of the actual install and configured-launch evidence. |
| `accepted.backend-text-review`, `accepted.app-text-review` | Accepted initial repository handoff-text reviews tied to their published actual commits. |
| `accepted.original-git-baseline` | The actual post-install, post-initial-handoff original Git baseline described below. |
| `prior.<phase>` | Exact retained `phases/<phase>/result.json` bytes and SHA-256 from a previously passed phase. All prior results recheck runtime, plan, mapping, phase, and output hashes. |
| `accepted.cleanup-results`, `accepted.cleanup-text-review` | Actual accepted cleanup results and final cleanup handoff review, required by close and final phases. |
| `accepted.checkpoint-publication` | Actual accepted first checkpoint publication with generation/root, local commit/tree, and matching observed remote commit. |
| `cleanup_revision`, `close_reason` | Current original-store cleanup revision and the concrete accepted reason, 80–4096 trimmed characters. Reuse those exact input values for final phases. |
| `attestations` | Root sets each true only after observing its condition. The first three guard every phase; cleanup completion/publication attestations guard the close. |

Existing cloud reviews with `status: "PASS"` keep their original schema and
bytes. A separately reviewed compatibility receipt may cite those originals
and state the consumer's required `status: "passed"` conclusion. Its author
cannot convert a pending or failed review into acceptance. Future fields remain
null until the actual source bytes and decision exist.

The original Git baseline is captured after the accepted source installation
and initial handoff publication. It must contain `status: "passed"`, actual
`head`, `checkpoint_tree` equal to
`ff0759095a01edb38ca4bb8aa90fbdb84476e0f7`, actual `index_sha256`, and an
`index_backup: {path, sha256}` copied under coordination. It also requires
`remote_repository: "YossiMH/bead-rs"`, `remote_commit` equal to that head,
`remote_checkpoint_tree` equal to the same checkpoint tree, and
`remote_objects_verified: true` backed by the retained remote observation.
The copy's hash must equal `index_sha256`. Reusing a pre-install Git baseline
would fail the driver's current-HEAD/index checks.

## Phase order

| Phase | Actual work and resulting gate |
| --- | --- |
| `preserve` | Require absent DB/sidecars, verify original counts/Git/raw selected bytes, and retain both selected generations, config, ignore file, raw index and complete raw Git object inventory. |
| `freeze` | Verify all 54 prior tasks closed, freeze coordination, flush and retain the complete 1009-issue generation, compare all original corpus records, and prove the original remains untouched. |
| `source-restore` | Restore that exact frozen source into a fresh disposable directory; reconcile all issue scopes and added audit records while original DB remains absent. |
| `restore-original` | Claim one attempt, recheck absence, initialize zero semantic state, recheck preserved bytes, restore the full frozen generation with normal publication, reconcile the complete corpus/audit/previous pointer/index delta, then record authority transfer. |
| `restore` | Independently restore the original-owned published generation into another fresh disposable directory and prove the live original and frozen source remain unchanged. |
| Root publication/cleanup | After review, commit and normally push the verified checkpoint and handoff updates, verify the remote objects, and clean exact owned worktrees/disposable artifacts while retaining required receipts and recovery material. |
| `close` | Require accepted cleanup, handoff and publication receipts; dry-run and revision-guarded commit close only `beadrs-3ec972f8`, with automatic flush suppressed. |
| `final-publish` | Ordinary native flush publishes that single close, preserves its outgoing generation, proves all unrelated rows unchanged, and reconciles only checkpoint staging changes. |
| `final-restore` | Restore and verify the final generation, all 55 closed tasks, complete corpus and one additional disposable restore audit. Root then publishes and verifies this final checkpoint commit. |

The original becomes the sole task writer only after the restore-original
receipt succeeds and its full reconciliation passes. The coordination freeze
marker is retained at its existing recognized name
`checkpoint-authority-freeze-20261125.json`. No later task closure may target the
isolated database. If any command, memory/time guard, publication, or readback
fails, retain all attempt files and frozen source and inspect actual state.
An initialized or partially restored original does not meet this route's absent
DB precondition; never remove it or replay the phase automatically. Root must
review a concrete reconciliation before another mutation.

## Bounded invocation

After the exact phase request has been reviewed, retain its bytes and SHA-256
and invoke the exact staged supervisor once. The placeholder names here must be
replaced with the actual retained request path and hash; they are not executable
request values.

```powershell
powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "<staged-packet>/checkpoint-only-handoff-supervisor-20261127.ps1" -InputManifest "<actual-reviewed-phase-request.json>" -InputSha256 "<actual-64-character-sha256>"
```

This reuses the accepted single-PowerShell/single-Node Job supervision, with
sequential native/Git children: hidden windows, BelowNormal priority, at least
3 GiB immediately available before work, a 1 GiB live floor, at most 512 MiB
aggregate owned RSS, 180 seconds overall, and 12 seconds reserved for cleanup.
The native driver receives the earlier work deadline and uses a 128 MiB Node
heap. Output, descendant membership, process identity, and the zero-byte
publication lock are bounded and checked. The wrapper stops only its exact Job
members and requires normal exit with no leftover descendants or assisted
cleanup for a passing receipt. ExecutionPolicy Bypass is process-scoped, as
already approved for these downloaded task wrappers.

The wrapper is derived from the accepted previous supervisor. Its changes are
limited to the new phase names, driver/retention/output paths, distinct inspector
type name, and exact final runtime/Node bindings. It retains the reviewed member
inspection, native memory probe, hard timer, stream handling and cleanup logic.

## Cleanup and interruption handoff

`CLEANUP.md` identifies the exact cloud Riftri worktree and its recovery/removal
instructions. Qualification fixtures live only under their explicit fresh
output directory. Retain the accepted small reports/logs and their hashes before
removing those fixtures. On the PC, preserve the new retention tree, original
selected bytes/index, reachable original Git commit, and complete accepted
phase receipts. Future agents must inspect interrupted attempt receipts before
writing either task store and clean only the exact owned worktrees and
disposable directories after their evidence has been retained.
