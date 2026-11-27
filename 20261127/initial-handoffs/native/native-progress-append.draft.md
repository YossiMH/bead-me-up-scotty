## 2026-11-27 editing delivery and Windows handoff

### Native source and transport

The qualified production source is
[`2d801ba455b7a722daf644a7615445117d57e8e9`](https://github.com/YossiMH/bead-rs/commit/2d801ba455b7a722daf644a7615445117d57e8e9),
tree `509d6222300b84b16041a8366a8b6ae4c28ccc98`. The accepted
2026-11-27 installation placed that source in the original native repository
and published the same commit to the user's fork main. It descends from the
recovered `515b503b` checkpoint implementation through the type-file tests
and implementation (`14051553`, `9ffefad6`), the test/spec exit-code
correction (`7adb497b`), the publication/path repair (`c90f0cdb`), the
test-only Windows fixture corrections (`b492aa51`), and the final
operation/maintenance lock predicates. The earlier task branches and
`native-source-integration.json` remain historical source-integration
evidence. Subsequent documentation commits must preserve this exact product
tree outside the reviewed handoff path.

This appendix is a newly regenerated draft based on the complete immutable
`2d801ba4:.marathon/progress.md` and the retained revision-9 draft. Its
publication and the actual original-store history phases require the separate
receipts described below. No unavailable earlier draft is claimed to have
been recovered byte-for-byte.

`bead update --issue-type-file PATH` and `--issue-type-file -` carry the same
UTF-8 issue-type value as the inline option without putting large text in the
Windows command line. The transport reuses the existing UTF-8 text reader,
resolves the supplied text before secret scanning, and reaches the existing
guarded atomic edit service. Inline/file conflicts and competing stdin inputs
fail before mutation. Empty issue types retain the established usage exit code
2. The additive capability is optional for older readers; Scotty requires its
literal true declaration before choosing the new transport. The native closed
capability schema, field guide, help, man page and editing specification agree
with that declaration.

All three workspace lock acquisition loops now recognize the platform's fs2
contention error while preserving the existing default 30-second wait, 10-ms
polling interval, unrelated-error policy and guard release. Checkpoint artifact
enumeration joins relative path components with `/` for structural references;
literal Unix backslashes still reach the existing rejection rule. The Windows
fixture changes preserve the original assertions: the exact root
`publish.lock` must have length zero and contributes empty bytes to the
snapshot, and the two 40-KiB note payloads use the already existing stdin
helper.

The final static source review and the complete actual Windows tests/Red review
are retained under `20261125/revision-9/results` in the app transfer branch:
`native-lock-repair-source-review.json` at `e7fcc03c` and
`windows-checkpoint-tests-review.json` at `7f671379`. The two final post-check
author inspections are retained at `90011ce6` in
`native-final-author-inspections.json` (SHA-256
`f680978702a816b3fe86e82e5c993238566b36a34ba54f154cad72c0d61cff23`).
Independent final source and hosted qualification acceptance is
`7d30c840514d318a4588d979a90c20bcf07d8734`,
`native-final-review.json`, SHA-256
`2534363abac195e6f8e2ef91077381ec816dd68448315831bff2fa65fe878676`.
The later installation and history observations are recorded separately below.

### Exact final builds

Both hosted producers completed successfully from the same production source.
Linux run `45600748319`, workflow `b9ae02da`, passed formatting, Clippy,
whitespace, complete default compilation and the original archive release
build. It compiled 145 test harnesses and 147 total test/support executables.
Windows run `45600413942`, workflow `975d21cc`, built the original archive
release, the library harness, ten integration harnesses and ordinary debug
bead. Those 12 test/support executables are separate from the release executable.

Both producers preserved the original `scripts/build-from-archive.sh` and used
one Cargo compiler job. The Linux generated-man comparison retained the raw
5,251-byte output and allowed exactly the previously reviewed single ASCII
space before LF on SYNOPSIS line 7; all other bytes match the tracked man page.
All required source-stability checks passed. The separate Windows download job
`139163782606` verified both the complete artifact and the small release
package against their producing manifests.

| Windows release record | Exact identity |
| --- | --- |
| Executable | `release/bead-checkpoint-2d801ba455b7.exe`, 12,243,456 bytes |
| Executable SHA-256 | `0431a828bf95038641a0c55b4cf11c5800b52881940a13bd2f56b02f0b27177a` |
| Adjacent metadata | `release/bead-checkpoint-2d801ba455b7.exe.metadata.json`, 2,058 bytes |
| Metadata SHA-256 | `21ca90e29fc4588d23b31210cd5ffe6838c136ce70b76458b71370beeeff18f5` |
| Small release artifact | `15014634952`, ZIP 4,524,263 bytes |
| Small ZIP SHA-256 | `6bdb10496f976621d0b5545a8ef3b591a317e4a07d7e1f9276eb42d5fa09bba8` |
| Small manifest | 665 bytes, SHA-256 `dbe3aa25b165991f1590526a6a4b2c3083e263be65132b9bed713d51282009cf` |
| Build receipt | 16,950 bytes, SHA-256 `1baf52e88962dde76a536102c10e40c2a915adc15dadd9a13f233a7677f94c9c` |
| Complete test/support artifact | `15016870072`; retain it in the cloud |

| Linux release record | Exact identity |
| --- | --- |
| Executable | `release/bead-editing-2d801ba-linux-20261125`, 13,618,928 bytes |
| Executable SHA-256 | `fa0514a3d105d8951d2bc302c1f4ce46fb9e6ed4be21a2a89300d16b77a1ac1c` |
| Adjacent metadata | `release/bead-editing-2d801ba-linux-20261125.metadata.json`, 2,085 bytes |
| Metadata SHA-256 | `866c10c4909ad736c06e0c44c7955033179134165f157be6b054c4a0b55510cf` |
| Complete compilation artifact | `15015039880` |
| Release and original-corpus artifact | `15016141673` |

Complete original build logs, receipts, artifact metadata and the exact small
Windows manifest are retained in
[the final build evidence](https://github.com/YossiMH/bead-me-up-scotty/tree/66d679b5fd3d190025068ad47167352fa5a90669/20261125/revision-9/results).
The independent actual-build review is `2cd5ba1a`,
`native-final-build-results-review.json`. The accepted PC installation used
the small Windows release package and separately qualified app runtime. The
large native test/support artifact remains hosted qualification evidence.

### Qualification and retained earlier outcomes

Final Linux qualification run `45603324487` uses reviewed packet `41a1bcb1`.
Its recovery job `139167619794` passed four native restores and six complete
record comparisons. It preserved all 954 original issues, 11,264 events, five
provenance receipts and 413 attempt outcomes, the original source input and
checkpoint configuration. Every owned process group finished cleanly.
The result SHA-256 is
`d469b67903adc4e7f9201de32cae1f1129f96984670112c5d0626c74ceab5536`;
the complete result and all 20 native streams are retained at `20ec82d2`
under `20261125/revision-9/results/native-linux-corpus-45603324487`.

The final Linux affected/full-suite job `139167619928` passed. The affected
nine-target command passed 95 tests with no failures or ignores, including all
eleven type-file cases and all six maintenance cases. The complete default
suite passed 1,913 tests, with zero failures and eight unchanged existing
ignores, across all 145 default harnesses and one doctest group. Cargo exited
zero, all 652 source files remained unchanged, and all 20 owned process groups
were empty after cleanup. Both executable inventories preserve the six outputs
Cargo refreshed from that unchanged source.

Complete Linux evidence is retained at `cca7eb97` under
`20261125/revision-9/results/native-linux-qualification-45603324487`.
The affected receipt SHA-256 is
`2b04eca466288c46d2351c021f6cedfe3ecd6ff8b97b1aa4e90bc6159c03a40f`;
the full-suite receipt SHA-256 is
`7516c4d9bda3146d19d7b24f7acab5c4bd7ee1cdb2eab5f41ca4b432aaa66dd0`.
Independent affected acceptance is `3859355a`, full Linux acceptance is
`6e70133a`, and original-corpus acceptance is `b3222f53`, respectively
`type-backend-checks-review.json`, `native-linux-qualification-review.json`
and `native-linux-corpus-review.json` in the revision-9 results directory.

Final Windows run `45603696205`, reviewed packet `07ea5205`, passed every
core, editing, grid and aggregate job. Core passed 25 selected assertions;
editing passed 73, with zero ordinary failures or ignores. The 55-command
public CLI smoke verified scalar edits, labels and all three dependency kinds,
Unicode file input, clears, stale refusal, priority audit and checkpoint
restoration. Its one expected stale edit exited 4; the other 54 commands exited
zero. The original smoke JSON remains in artifact `15016629803`, with SHA-256
`c19040230536a4834c2ac30225317024933515713375e1bfcd6a6a4e1f5d1d98`.
The unchanged helper's saved command logs retain its explicit stdout capture
bounds; full long-type regression streams are separately retained.

Windows also passed four original-corpus restores and six full-record
comparisons, preserving the same 954 issues, 11,264 events, five provenance
receipts and 413 attempt outcomes. Its source/configuration stayed unchanged.
Every partition preserved its source and input bindings, returned to the owned
Job baseline, and ended with zero owned children. All parts completed inside
the shared 140-minute bound.

The destructive characterization grid completed all twelve unique
scenario/fixture invocations with harness exit zero: ten classifications were
GREEN and two were caught RED. Both REDs use `StoreDeletion { count: 8 }`,
which directly removes eight live issue rows without events:

Budget/store-deletion:

```text
publication 0 added 1789455 new blob bytes, budget is 262144
```

Split/store-deletion:

```text
assertion `left == right` failed: shard coverage lost records
  left: 392
 right: 400
```

The grid's existing oracle records every classification and exact assertion
text; it does not require every destructive scenario to remain GREEN. The
392-versus-400 count follows the deliberate eight-row deletion. All twelve
ordinary conformance assertions and both full original-corpus gates pass
separately. Preserve these findings; do not reinterpret a caught RED as a
missing test invocation or repeat the completed grid.

Complete Windows evidence is retained at `52bfafd7` under
`20261125/revision-9/results/native-windows-qualification-45603696205`,
including the earlier retained grid files. The aggregate receipt SHA-256 is
`ac65894f80215aed7ddc03f72935c91095ab9717e0a07a7e66196900129abc1d`;
Windows corpus SHA-256 is
`791c4616775dfd2da3e83c645428e2a9f55f861078b236a2f177c85fdf6ae57e`.
Independent Windows acceptance is `60df4701`,
`native-windows-qualification-review.json`. Scotty's native-store/production
HTTP qualification and final installation bindings are retained separately in
the app continuation. No native producer or qualification job remains active.

Earlier outcomes remain evidence for their own source revisions. The c90 Linux
run passed 89 affected tests and the complete suite with 1,913 passes, no
failures and eight existing ignores; those counts do not qualify the final
2d801 source. The earlier Windows c90 run preserved the operation-lock failures
and the locked-file/oversized-argv fixture failures. The separate maintenance
run `45597738356` compiled the unchanged c90 target, verified its downloaded
bytes, and executed its six cases once: five passed and only
`concurrent_identical_requests_commit_once_and_replay_once` failed for the
expected maintenance-lock error. Its complete evidence is `31c4751e` under
`20261125/revision-9/results/maintenance-red-45597738356`. The prior successful
Cargo compile with an incomplete collector receipt remains retained separately
at `0a8d8ce8`; no test ran in that attempt. The earlier intentionally caught
out-of-band results remain historical characterization evidence. The final
grid's exact two RED findings are recorded above.

### Installed source, runtime and preserved private work

The exact archive staging was independently accepted before installation:
560 runtime files (27,426,391 bytes) and the three native payload files
(12,262,464 bytes) matched their producing manifests. The 13.738-second
bounded copy peaked at 302,596,096 bytes aggregate resident memory and left
no owned processes or cleanup errors. The native download's disk receipt
also matched the already accepted exact result bytes. These actual records
remain in [the staging review](https://github.com/YossiMH/bead-me-up-scotty/blob/717acefc5bf677c8d18dcf16b692117042bae4ae/20261127/results/artifact-stage-actual-review.json).

A separate bounded read-only reconciliation at 08:20:38 UTC established both
required product commit objects, all four pinned ancestry relationships and
the preserved original source/index/private-file state. The prior fetch
attempt reached its hard deadline. Its intermediate progress writes
serialized live process objects; the attempt remains failed. The
[source-readiness acceptance](https://github.com/YossiMH/bead-me-up-scotty/blob/717acefc5bf677c8d18dcf16b692117042bae4ae/20261127/source-fetch/source-readiness-actual-review.json)
binds the later independent observation and required no repeated fetch.

The third one-shot installer completed at
`2026-11-27T09:42:00.9455636Z`. Independent acceptance is
[the actual installation review](https://github.com/YossiMH/bead-me-up-scotty/blob/717acefc5bf677c8d18dcf16b692117042bae4ae/20261127/installation-completed/actual-review.json),
SHA-256 `f21530a4cadc045e1fa052fa29f187a866e6ae81610197a4e2ea93301f1d780e`.
Fresh PC readback and separate cloud remote readback agree on native
`2d801ba455b7a722daf644a7615445117d57e8e9` and Scotty
`0309539797fd7d016e2b8fd8bdc0ae9cefc20219`, both published to the user's
fork main. The installed native pin is
`F:/Dev/bead-me-up-scotty/.scotty-local/bin/bead-0431a828bf95.exe`,
with the exact 12,243,456-byte release hash above. The runtime BUILD_ID is
`YIOHeRJTEdlOszyc4LyHr`. All 560 runtime files were checked against the
accepted manifest immediately before the same-volume installation move.

The installer preserved all 15 original app source files (four modified and
eleven untracked) as exact raw-byte backups, the original raw index and
private environment bytes, the previous native pin and previous runtime. Only the validated `BEAD_BIN`
selection changed in the private environment file. Both repositories'
Git configuration hashes remained unchanged, final source worktrees were
clean, and no index lock remained. Preserve the raw backups, rollback
receipts and previous runtime/pin through the final cleanup acceptance.
The later metadata readback confirms the installed BUILD_ID and preserved
backups; the installer receipt supplies the complete 560-file hash check.

The accepted run took 31.973 seconds, peaked at 418,521,088 bytes aggregate
owned resident memory, and observed at least 2,436,792,320 bytes free physical
memory during execution. Cleanup reported no assistance, errors, killed
children or remaining Job members. Of 115 retained process identities,
114 exited zero; the accepted optional Git `core.hooksPath` lookup
accounts for the one allowed exit 1. The two earlier failed installation
attempts remain retained. The first refused the observed SSH spelling of the
native upstream origin because its fixed guard expected the same repository's
HTTPS spelling. A secondary PowerShell `File.Replace` null-backup binding
failure obscured that primary refusal during result recording. The second
safely refused after a private-index working-tree diff refreshed stat bytes. The successful
copy adds command-local `-c diff.autoRefreshIndex=false` to that diff;
the exact private-index byte guards and stored Git configuration remain
intact.

### Actual revision-9 task state

Revision 9 was materialized in the isolated native coordination store. Its
55 task IDs and 91 blocking edges are real native records, with 1,009 total
issues including the unchanged original 954. The accepted plan SHA-256 is
`18130e44ab27047dcb397de53caa0a9006c56cfd478d417f884e42452ff62582`;
the actual mapping/result SHA-256 is
`6d1cca5e2495011ae3dac4320e622f67c6f871186ef112edd8f51f8c98d1e5b3`.
The plan, mapping, earlier closures and their reviews remain retained in
[the immutable continuation evidence](https://github.com/YossiMH/bead-me-up-scotty/tree/717acefc5bf677c8d18dcf16b692117042bae4ae/20261127).

The accepted installation closure at
`2026-11-27T10:01:48.7668499Z` changed only
`beadrs-0bab2976` from open revision 5 to closed revision 6. It left the
other 54 continuation rows, original 954 issues, configuration and checkpoint
pointer unchanged. The resulting observed state was **48 closed and seven
open**. The exact result SHA-256 is
`040aa7c5fc0c149c9551f9f4d44842bd624a5374e6e43109c47a6106736552b0`;
[its independent reconciliation](https://github.com/YossiMH/bead-me-up-scotty/blob/717acefc5bf677c8d18dcf16b692117042bae4ae/20261127/installation-completed/closure/actual-review.json)
has SHA-256
`5fe7cfb2ed7466d339c455d33417796ee175d89b73abef7cd438fa0e343662f9`.

| Open task at that accepted observation | Native ID | Revision |
| --- | --- | --- |
| Configured launch | `beadrs-c9526055` | 5 |
| Installed-result review | `beadrs-47da80ac` | 3 |
| Native handoff | `beadrs-1371879c` | 3 |
| App handoff | `beadrs-f0039a6a` | 5 |
| Native handoff text review | `beadrs-30f13b5b` | 3 |
| App handoff text review | `beadrs-c62c1990` | 5 |
| Preserve and clean | `beadrs-3ec972f8` | 5 |

Graph readiness does not establish completion of a task's acceptance criteria.
Root is the sole PC and native task-state writer. Before each remaining close,
read the actual current revision and dependencies, use retained accepted
evidence, and reconcile the full task state afterward. The original repository
becomes the sole task writer only after the supported restoration and its
complete comparison pass.

### Tray qualification and configured-launch observations

[The actual tray review](https://github.com/YossiMH/bead-me-up-scotty/blob/717acefc5bf677c8d18dcf16b692117042bae4ae/20261127/results/tray-runspace-actual-review.json)
accepted the real Windows NotifyIcon lifecycle: context-menu Exit was invoked
and the icon disposed; parent loss cleaned up the tray; server exit code 75
created one replacement server with one tray; Exit after restart stopped it
without a further restart. The actual result is 37,543 bytes, SHA-256
`c625cb7ceb2b5b5e5c4bf1fea55d132353da0fa9fca650ee1d6ba5fde6c6fa36`.
All eight exercised source/fixture files are byte-identical at the installed
Scotty production commit. That run used its own earlier staged native/runtime
fixture; acceptance of the installed 560-file runtime and final native pin
through the ordinary configured batch remains a separate gate.

The accepted tray wrapper executed the unchanged smoke driver in an isolated
runspace within the outer PowerShell process. Its 15.483-second run peaked at
518,172,672 bytes aggregate owned resident memory, below the 512-MiB cap, and
observed a minimum 4,348,432,384 bytes free physical memory. It left no owned
Job members or cleanup errors. Its expected parent-termination and restart
exit codes are retained. The heavier failed wrapper exceeded the cap and
required assisted cleanup; that failed receipt remains historical evidence.

The first final configured attempt, launched at `2026-11-27T10:10:39Z`,
finished with task result 1 before its output directory existed. The early
error was not captured. A later byte comparison found that the helper's fixed
module bindings did not match the actual Windows CRLF checkout. The separately
named CRLF-bound helper preserved the same product and launch assertions. The first attempt's
[readback](https://github.com/YossiMH/bead-me-up-scotty/blob/717acefc5bf677c8d18dcf16b692117042bae4ae/20261127/configured-launch-first-attempt/readback.json)
remains retained.

The second attempt failed at `2026-11-27T10:47:05.5389705Z` with
`Owned fixture-cli is outside the interactive Explorer session.`
The completed short native fixture process had a null session in a later
managed-process query, while its already retained Job record had the same PID
and birth identity, the exact installed native image, session 1 and exit 0.
This evidence identifies the observation race; it does not show execution in
another session. The command and HTTP-request lists were still empty because
registration threw before their recording. The installed batch, app server,
tray and editing requests had not started. The 1.043-second failed check
peaked at 131,555,328 bytes, observed at least 4,103,970,816 bytes free, and
reported normal owned cleanup with a free port and no remaining Job members.
The exact [failed result and independent review](https://github.com/YossiMH/bead-me-up-scotty/tree/717acefc5bf677c8d18dcf16b692117042bae4ae/20261127/configured-launch-crlf-actual)
remain retained; neither attempt supplies configured-launch acceptance.

The separately reviewed
[session-observation repair](https://github.com/YossiMH/bead-me-up-scotty/tree/717acefc5bf677c8d18dcf16b692117042bae4ae/20261127/configured-launch-session)
has helper SHA-256
`33c6aba33ba436a0bfac320f3518f9334d8ba9b808a6d8079248bc8ab44976a4`.
It retains a validated session together with exact PID, birth and Job identity
before a short-lived process exits, and only tolerates a priority-set exception
when that exact retained process has already exited. Its fresh task/output
names are distinct from both consumed attempts. Product hashes, five scalar
editing checks, actual tray action, Job accounting and cleanup assertions are
unchanged. The helper retains its 120-second total bound, 12-second cleanup
reserve, 512-MiB aggregate owned resident cap, 128-MiB Node heap, 3-GiB
admission and immediate launch checks, and 1-GiB live free-memory floor.
Root binds the ordinary Windows PowerShell 5.1 parse and any actual third-run
result separately.

### Original checkpoint preservation and supported history route

The original native repository was observed with checkpoint files,
configuration, pinned binaries and ignore rules, but no SQLite database,
WAL, SHM or journal. The [actual original-byte observations and source trace](https://github.com/YossiMH/bead-me-up-scotty/tree/717acefc5bf677c8d18dcf16b692117042bae4ae/20261127/handoff-compatibility)
therefore require the checkpoint-only route.
Both actual Git configurations have `core.autocrlf=true`. A bounded
2026-11-27 raw-file observation confirmed that all four selected original
checkpoint files are exact CRLF checkout variants of their immutable Git
blobs: 17,088,721 raw bytes versus 17,063,501 canonical bytes. The immutable
original checkpoint tree is
`ff0759095a01edb38ca4bb8aa90fbdb84476e0f7`; its 53 tracked blob entries
and remote ancestry retain the complete original Git checkpoint history.

The selected original current generation has 954 issues, 11,264 events, five
provenance receipts and 413 attempt outcomes, with snapshot sequence 29,609.
Its raw CRLF object does not satisfy the canonical hash declared by its pointer.
Native restore correctly refuses that raw source. Preserve both representations:
exact original bytes under owned raw retention, and the four exact canonical
Git blobs under a separately verified retention directory. The canonical
copy is the source for native old-generation restore qualification. No
out-of-band original pointer rewrite, SQL edit, invented backup or stored Git
configuration change is part of the route.

The separately named compatibility history helper has SHA-256
`1015fa587954ecd1d0deddf8391789377b8c81cdf51ffa36994e7568df69c671`,
its supervisor
`c0c289a9bce78e761d6773ab59298b7e8c61ac9e9da4cefd52a9023497fd34e6`,
and the corresponding publication helper
`7d8be7200885652d7be1f15034574ebed128fd36724804e0764ab9c0a0259a13`.
The earlier `ff1597b3` history helper remains unchanged and is inapplicable
to these observed raw checkout bytes. Complete source comparison and actual
cloud qualification acceptance is retained with the
[exact compatibility packet](https://github.com/YossiMH/bead-me-up-scotty/tree/de71118c225936b8ca6eac4be5db306eff19219b/20261127/checkpoint-crlf-handoff)
in `independent-review.json`, SHA-256
`8b05fa674dc1f5a04f284fe17b9072c155a3ad2d9690df9c0691a160bb993f1c`.
Actual Windows phases retain their own execution gates and receipts.

The eight phases remain `preserve`, `freeze`, `source-restore`,
`restore-original`, `restore`, `close`, `final-publish` and
`final-restore`. Root first retains exact original raw/canonical selected
files, configuration, raw index and absence observations, then freezes the
complete 1,009-record continuation. Fresh disposable native restores prove
the canonical original corpus and full incoming continuation. At the original
mutation boundary, database/sidecar absence is checked again. Supported
`bead --no-auto-flush init` creates an empty native store while preserving
configuration and checkpoint bytes; one normal native `restore` then uses
the existing explicit-recovery publication path. This route handles the old
29,609 high-water mark without editing the SQLite sequence or bypassing
native refusal checks.

Native publication promotes the old raw `current.json` bytes exactly to
`previous.json` and retains its old raw object. The resulting previous
generation remains unsuitable as a direct native restore source; the
canonical retained original has its own proven restore. The first Git
publication therefore permits one exact, source-bound normalization case:
that preserved CRLF `previous.json` must stage as the original current
pointer's exact canonical Git blob. Its original tree/index identity and
both retained byte representations are checked. Every other changed raw
checkpoint file and all unrelated index entries retain strict equality.
The later final native publication produces canonical current/previous bytes
and uses the strict staged-byte rule throughout.

The accepted disposable compatibility run used the exact qualified Linux
native and Node 25.2.1 with `--max-old-space-size=128`. It exited zero in
57.545 seconds overall, recorded all 66 commands and ten focused refusals,
compared every one of the 1,009 issue scopes, preserved the full original
history and all 413 outcomes, and verified all three reconstructed resource
locks. It checked the single legitimate new native restore event and receipt,
both publication/index deltas, the final cleanup-task-only change and a
fresh final native restore. The actual result SHA-256 is
`fe2056c92c6cc1946550fd7215341e40cb8b7fec9af766ca6b32523c49059f03`.
These fixture results establish compatibility of the prepared execution
route; actual PC outcomes are recorded independently.

The compact retained evidence embeds 215 actual records and accounts for all
198 command stream/exit files; two large stdout records are exact immutable
original Git blobs. Its complete 1,671-file manifest also hashes the local
fixture databases and checkpoint snapshots. Those full snapshots stay local
through independent review; reproducibility of the scenario does not promise
the same fresh timestamps, IDs or receipt bytes. Preserve the successful
fixture until the exact evidence/review publication is reconciled. Earlier
failed qualification attempts and cloud filesystem losses remain accurately
recorded in the packet's recovery provenance.

The post-handoff original Git baseline must be captured after the reviewed
documentation descendants are adopted. It must bind the actual local and
remote main commit, unchanged original checkpoint tree, all required remote
objects, current raw index and a raw-index backup under the coordination root.
Each phase pins its direct prior results under the coordination or preservation
root. The first checkpoint commit/normal fork push follows accepted
`restore-original` and disposable `restore` receipts; the final one follows
`final-publish` and `final-restore`. The original repository becomes the
sole writer only after the restored complete corpus, audit additions and
index/byte reconciliation pass. A later close must not resume the frozen
isolated store.

### Worktree, evidence and successor cleanup

The original 11-file checkpoint-only helper packet was published at
`473530433d66206ec6ba8a9980c9ed4bd0e12848`; its author commit is
`dad3688ea00e5829d91fdd952d9c7c0f1c467a1e`. Its clean Riftri worktree
`/tmp/beads-2889282bfcec/history-checkpoint-only` was removed without
force, and the corrected authored-file comparison subsequently verified all
11 exact published files, path absence and registration absence. The complete
[publication and cleanup record](https://github.com/YossiMH/bead-me-up-scotty/blob/717acefc5bf677c8d18dcf16b692117042bae4ae/20261127/checkpoint-only-handoff/worktree-publication-and-cleanup.json)
retains the initial overbroad subtree-comparison failure and the actual
ordering. That removal applies to this named historical worktree.

Cloud filesystem resets are separately recorded events. Missing old paths
after a reset do not establish a reviewed cleanup operation or durable
retention of unpublished evidence. The former
`/tmp/beads-55c9/backend-type-edit` description in the retained old draft is
historical; do not treat it as a current registration inventory. The current
compatibility and regenerated handoff packets are ordinary named directories
and create no worktree registrations.

During this preparation, the app clone still registered root's active
`/tmp/beads-2889282bfcec/continuation` worktree. A successor must inspect
fresh Git status and registration, preserve any later unpublished work, verify
exact durable publication, then remove only the clean owned worktree through
the installed Riftri command, without force. If this process dies early,
finish those checks and cleanup; do not infer completion from an unavailable
temporary directory.

Final branch cleanup uses the [reviewed exact inventory](https://github.com/YossiMH/bead-me-up-scotty/blob/717acefc5bf677c8d18dcf16b692117042bae4ae/20261127/archive-preparation-recovered/reviewed-refs.json)
of 86 app task refs and two native task refs. The planned app archive ref is
`refs/heads/archive/bead-editing-complete-20261127`. Before deletion,
retain the final transfer tree and commit as the archive's first parent/tree,
include the other 31 independent tips as parents, and verify ancestry
coverage for every reviewed app task tip. Refresh all 86 live tips and the
independent parent set/tree after the final transfer publication. The current
approach review covers preparation only; actual archive coverage must receive
independent acceptance before any leased deletion. The two native task tips must
remain ancestors of the actual native main. Only then may the exact task refs
be deleted by ordinary atomic Git push with an expected-SHA lease per ref.
Main, the archive, and unrelated feature/recovery refs are excluded.
Archive/publication/deletion receipts stay pinned separately so they do not
create a transfer-tip self-reference loop.

The earlier scheduled-task cleanup preparation covered a fixed 22-name set.
Use the current execution section below for the later accepted preparation
and its exact definition, outcome and idle-state requirements. Keep
the failed attempts' receipts and logs and verify the relevant tasks are
stopped before deletion. Preserve original repositories, configuration,
checkpoint/raw-index recovery bytes and installer rollback artifacts according
to the accepted final retention contract. All links in this appendix use
immutable commit permalinks so removing temporary branch names cannot break
the evidence trail.

### Current execution state

<!-- native-delivery-current-state:start -->
The independently accepted two-task closure finished at 12:58:09 UTC on
2026-11-27. Its readback has **50 of 55 continuation tasks closed and five
open**. `configured-launch` (`beadrs-c9526055`) closed at revision 6 and
`installed-review` (`beadrs-47da80ac`) at revision 4. The original 954
issues, other stored fields, configuration and checkpoint pointer were
preserved. The [actual closure result](https://github.com/YossiMH/bead-me-up-scotty/blob/78dc8f4fe17df16a82c0063b9fbac7642fd53039/20261127/configured-installed-closure/result.json)
has SHA-256
`6b0cbed2c93a5e517a50fb6e10f98382ff8cc480edff2336c97c96ff332f8a73`;
[its independent reconciliation](https://github.com/YossiMH/bead-me-up-scotty/blob/78dc8f4fe17df16a82c0063b9fbac7642fd53039/20261127/configured-installed-closure/configured-installed-closure-actual-review.json)
has SHA-256
`a158adc4bca44efcce1bcef152816b7ffd55790bc31526a99444ea57929447c5`.

| Remaining open task at this readback | Native ID | Revision |
| --- | --- | ---: |
| Native handoff | `beadrs-1371879c` | 3 |
| App handoff | `beadrs-f0039a6a` | 5 |
| Native handoff text review | `beadrs-30f13b5b` | 3 |
| App handoff text review | `beadrs-c62c1990` | 5 |
| Preserve and clean | `beadrs-3ec972f8` | 5 |

Installation, preservation, the configured default launch and the combined
installed review are accepted. Actual documentation publication and the
original-history and cleanup phases remain separate work.

The third configured attempt used the reviewed session-observation repair
and began at 11:32:44.8200843 UTC. Native fixture initialization and the
interactive-session identity check passed; the installed batch, controller,
tray host, tray and Next server started. After 4.8916348 seconds, the
complete Job sample reached 546,582,528 resident bytes, exceeding the
unchanged 536,870,912-byte ceiling. No completed HTTP check or scalar edit
was recorded. The retained result does not establish whether an initial
request had been sent or which instruction was active when the limit was
crossed. Assisted cleanup stopped the owned descendants; the port was free
and no Job members remained. This attempt remains failed in the
[actual Session failure review](https://github.com/YossiMH/bead-me-up-scotty/blob/cf462e43a1012a75112d943bb17edc84c35b8e67/20261127/configured-launch-session-actual/configured-session-failure-review.json),
SHA-256 `dc3b886175ef051803f5f18073a0abccb1e275e08aaeba6657a36cb40aaabfd5`.

The [accepted TCP helper preparation](https://github.com/YossiMH/bead-me-up-scotty/blob/cf462e43a1012a75112d943bb17edc84c35b8e67/20261127/configured-launch-tcp/configured-tcp-source-review.json)
uses `windows-configured-launch-host-tcp-20261127.ps1`, SHA-256
`818b25d528f0c07b7a913ec6aa6611359cff0aca5d9a3f5c6d523e9577543bf1`,
for the `ChatGPT-BeadEditing-ConfiguredTcp-20261127-2889282bfcec`
task. Its source review has SHA-256
`4c26f4fc6188dc141808c3b5597926eff3aa1d626f01c89a12251f43270643fe`.
It replaces the single NetTCPIP cmdlet lookup with a bounded native
IPv4/IPv6 listener-owner query. Exact server ownership, the 512 MiB
aggregate ceiling, 3 GiB launch admission, 1 GiB live free-memory floor,
120-second total limit, installed default launcher, five scalar edits and
real tray Exit remain required.

The fourth attempt's [actual TCP result](https://github.com/YossiMH/bead-me-up-scotty/blob/cf1e018022086e0118aa76cd64cdd0d02317850d/20261127/configured-launch-tcp-actual/result.json)
records a pass. It ran from 12:29:05.5483981 to 12:29:14.0648154 UTC, completing
six HTTP requests with status 200 or 201, five field roundtrips
(`title`, `description`, `priority`, `issue_type` and `notes`) and
28 recorded native invocations. It used the installed default launcher,
native pin SHA-256
`0431a828bf95038641a0c55b4cf11c5800b52881940a13bd2f56b02f0b27177a`
and BUILD_ID `YIOHeRJTEdlOszyc4LyHr`. The visible tray icon's real
Exit command was clicked and the icon was disposed; the task-owned helper
cache was removed. The result records no assisted cleanup, cleanup errors
or remaining Job members, and the port was free. Across 35 Job samples,
peak aggregate resident memory was 515,334,144 bytes, below the unchanged
536,870,912-byte ceiling; the minimum observed free physical memory was
2,253,275,136 bytes, above the 1 GiB live floor. The 17,558-byte raw result
has SHA-256
`54e074ed3162fbae9a30deb0843733f918392264291c74f079c9676c3df13701`.
The [independent configured acceptance](https://github.com/YossiMH/bead-me-up-scotty/blob/3151657df5939a2756d504860d655c058b808828/20261127/configured-launch-tcp-actual/configured-tcp-actual-review.json)
and [combined installed review](https://github.com/YossiMH/bead-me-up-scotty/blob/3151657df5939a2756d504860d655c058b808828/20261127/configured-launch-tcp-actual/installed-final-review.json)
both passed. Their SHA-256 values are
`ebe3a62e564a17568d6f7ae16596fe2809cc43782327057200d8406323771e8b`
and `b3bdf0990e7513c9ea57f31b72aecaee582c1b284193dfb78a233c157f84703b`,
respectively. They accept `configured-launch` (`beadrs-c9526055`) and
`installed-review` (`beadrs-47da80ac`), which closed in the actual two-task
operation recorded above. The earlier 48/7 table preserves the dated
installation checkpoint.

Scheduled-task cleanup has accepted preparation for 23 exact names:
the original 19 diagnostic names and four configured-attempt names.
The helper `remove-exact-scheduled-tasks23-20261127.ps1` has SHA-256
`4b5c57817efcbf019568dc1a6cfdc4868d8c1f99dda3d86cf077afc193385c93`;
its source review has SHA-256
`73c2982da883ac905a718c21f71195f4a6472e9b6e31a0232f413583e8ef87cc`.
Execution requires the three retained failed Scheduler outcomes 1, 1, 1
and the accepted TCP outcome 0, exact creation receipts, a fresh
private four-task definition readback, whole-XML equality, ready state and
zero running instances. The failed attempts, definitions, input bytes and
rollback records remain retained. No scheduled-task deletion is accepted
in this snapshot.

The CRLF-compatible history source and its 128 MiB cloud qualification
remain accepted preparation. Publication and review of both handoff
descendants, the actual original-store history phases, both checkpoint
publications and final worktree/ref cleanup still require their retained
actual receipts. The final transfer tips and archive parent set/tree must
be refreshed and actual archive coverage independently accepted before
the exact leased ref deletions. Root updates this marked current-state
section only after the corresponding outcomes and native task revisions
have been independently reconciled.
<!-- native-delivery-current-state:end -->
