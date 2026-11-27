# Eight history requests: fixed outputs and remaining actual inputs

This packet prepares the eight requests for the accepted CRLF-compatible
history driver. It assigns the exact supervisor paths shared with delivery's
fixed raw receipt collector, fills the already accepted installed/configured
records, and preserves the original qualified runtime path. Actual document
adoption, baseline and phase-result hashes remain pending.

Every prepared request deliberately has `phase:null`. The accepted supervisor
rejects that selector before publication-lock checks or output creation.
The intended phase is fixed by its numbered filename and
`phase-supervisor-map.json`. These preparation files must remain unchanged;
create a separate completed request when its actual prerequisites are accepted.

## Exact roots and outputs

- C: `F:/Dev/.bead-edit-20261111/coordination-20261124`
- I: `C/revision-9/checkpoint-only-inputs`
- R: `F:/Dev/.bead-edit-20261111/preservation-checkpoint-only-20261127-v1`
- S: `F:/Dev/.bead-edit-20261111/final-installation-v9-20261125-1151`

Here C/I/R/S are explanatory abbreviations; every JSON path is fully expanded.

| Phase | Supervisor output directly under C | Direct prior results |
| --- | --- | --- |
| preserve | checkpoint-only-supervision-preserve-20261127-v1 | none |
| freeze | checkpoint-only-supervision-freeze-20261127-v1 | preserve |
| source-restore | checkpoint-only-supervision-source-restore-20261127-v1 | preserve, freeze |
| restore-original | checkpoint-only-supervision-restore-original-20261127-v1 | preserve, freeze, source-restore |
| restore | checkpoint-only-supervision-restore-20261127-v1 | preserve, freeze, source-restore, restore-original |
| close | checkpoint-only-supervision-close-20261127-v1 | preserve, freeze, source-restore, restore-original, restore |
| final-publish | checkpoint-only-supervision-final-publish-20261127-v1 | preserve, freeze, source-restore, restore-original, close |
| final-restore | checkpoint-only-supervision-final-restore-20261127-v1 | preserve, freeze, source-restore, final-publish |

The supervisor writes `result.json` inside its mapped directory. The driver
writes `R/phases/<phase>/result.json`. The collector uses those two exact files
for each fixed phase; it accepts no arbitrary path override. The supervisor
requires each output to be a fresh immediate C child with the
`checkpoint-only-supervision-` prefix. No path absence or actual phase execution
has been observed by this preparation.

The first native checkpoint Git publication follows accepted
`restore-original` and `restore` results, before `close`. The final Git
publication follows `final-publish` and `final-restore`. Those two publications
use the separately accepted publisher and retain their own actual receipts.

## Exact existing bindings

The driver remains `checkpoint-only-handoff-crlf-20261127.mjs`,
SHA-256 `1015fa587954ecd1d0deddf8391789377b8c81cdf51ffa36994e7568df69c671`.
Its supervisor remains
`checkpoint-only-handoff-crlf-supervisor-20261127.ps1`,
SHA-256 `c0c289a9bce78e761d6773ab59298b7e8c61ac9e9da4cefd52a9023497fd34e6`.
Both use their already staged S copies. The requests use the actual final-directory
`windows-task-job.ps1` copy with hash
`2758a6ff94c0eecdfa360363469069dfa8470efc1f91228812146919a978921f`,
as recorded in the accepted TCP result.

The native executable stays at the observed path
`F:/Dev/.bead-edit-20261111/stage-artifacts-v9-final-20261125-1151/native/release/bead-checkpoint-2d801ba455b7.exe`.
Its hash `0431a828bf95038641a0c55b4cf11c5800b52881940a13bd2f56b02f0b27177a`
and source `2d801ba455b7a722daf644a7615445117d57e8e9` remain exact.
The installed app's same-byte pin is outside the history driver's allowed
runtime root. Node, Git, plan, actual revision-9 mapping, plan review and both
runtime consumer receipts retain their accepted paths and hashes.

Already filled accepted roles under I:

| Role | File | SHA-256 |
| --- | --- | --- |
| install | install-result-accepted.json | a2fe1009af72bbc776d8c4f7db46e0905d2a7d1e5ec18119b1d3abeef0798673 |
| configured-launch | configured-launch-result.json | 54e074ed3162fbae9a30deb0843733f918392264291c74f079c9676c3df13701 |
| installed-review | installed-final-review.json | b3bdf0990e7513c9ea57f31b72aecaee582c1b284193dfb78a233c157f84703b |

The immutable source locations and exact original template identities are
recorded in `input-bindings.json`. These are existing accepted results,
not predictions about the coming history phases.

## Actual fields still needed

The two handoff pins have their agreed I paths:
`native-documents-adoption-review.json` and
`scotty-documents-adoption-review.json`. Fill their hashes only from the
independent lowercase-`passed` reviews that reconcile final text acceptance
with the actual Windows adoptions. A source-only candidate review does not
substitute for those combined reviews.

The original Git baseline is pinned directly at
`C/git-publication-native-documents-20261127-v1/original-git-baseline.json`.
Fill its hash from the accepted actual native adoption. The baseline must bind
the actual post-document local/remote main, original checkpoint tree
`ff0759095a01edb38ca4bb8aa90fbdb84476e0f7`, all 53 original Git objects,
`remote_objects_verified:true`, and the exact raw index hash and
`index-after.raw` backup beneath C. Retain the same baseline through every
phase; never substitute a pre-installation or pre-document index.

For each required direct prior, the exact result path is already filled.
Fill its SHA-256 only after its raw driver/supervisor results are retained and
independently accepted. Unused prior records remain null. The accepted driver
also verifies the prior phase, runtime, plan/mapping identities and its
referenced output hashes.

The `close`, `final-publish` and `final-restore` phases additionally require
actual `cleanup-results`, `cleanup-text-review` and initial
`checkpoint-publication` accepted pins. Their future paths/hashes remain null.
The first publication receipt must identify the restored generation/root,
matching local/remote commit and actual checkpoint tree. The close request also
needs the live unassigned/unclaimed cleanup issue revision and an accepted
trimmed 80–4,096-character reason. For `final-publish`, reuse the accepted close
request's original pre-close `cleanup_revision` and exact `close_reason`.
The helper requires that revision to equal the accepted close result's
`cleanup_revision` minus one and checks the published closed issue against
that revision and reason. Keep those same two values in the `final-restore`
request, following the accepted phase-input procedure. No future revision or
successful result is synthesized here.

All root attestations remain false in this preparation. Root confirms the
exclusive writer window, accepted installed reviews and actual initial handoffs
for each completed request. Closing cleanup additionally requires the two
cleanup attestations. Freeze requires all other 54 tasks closed. Keep the
isolated store frozen afterward; the original becomes the sole writer only
after the complete supported restore and reconciliation.

## Completing and running one phase

After the actual inputs are accepted, copy the mapped preparation to a separate
completed request, insert its exact mapped phase, fill only the required actual
hashes and root attestations, and independently review the completed bytes.
Retain the new request under its exact `request_destination` from the map.
The supervisor's InputSha256 is derived last from those complete raw bytes.

Use the existing ordinary PowerShell supervisor with
`-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden`,
the exact S supervisor path, `-InputManifest` pointing to the completed request,
its exact `-InputSha256`, `-TimeoutSeconds 180` and
`-MaxOwnedResidentMiB 512`. Its existing BelowNormal priority, Node 128 MiB heap,
3 GiB admission, 1 GiB live free-memory floor, 512 MiB aggregate cap and
12-second cleanup reserve remain unchanged. Root serializes all PC execution.

Before preserve, R must remain absent and every required accepted record must
already be under C. The helper creates R exclusively. Preserve original raw
selected checkpoint files and their canonical Git representations separately;
keep the original configuration, raw index and baseline, all phase outputs,
the frozen coordination data and mapped source until final restoration and
publication acceptance. The full original corpus and native audit additions
remain governed by the unchanged accepted helper.

A failed, interrupted or ambiguous phase requires inspection of its retained
attempt and live state before any repeated mutation. Do not rename a failed
output to permit blind replay.

## Retention and ownership

This is an ordinary named cloud file packet, with no worktree registration.
Root owns actual staging, task-state changes, execution and publication.
Preserve the published original templates and this separate preparation.
If the process stops early, a successor must retain unpublished evidence,
verify durable publication and inspect any active worktree registration before
removing only clean task-owned worktrees through Riftri without force.
