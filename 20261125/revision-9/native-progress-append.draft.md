## 2026-11-25 editing and Windows portability continuation

### Native source and transport

The production source is `2d801ba455b7a722daf644a7615445117d57e8e9`,
tree `509d6222300b84b16041a8366a8b6ae4c28ccc98`, published on
`task/type-file-20261125`. It descends from the recovered `515b503b`
checkpoint implementation through the type-file tests and implementation
(`14051553`, `9ffefad6`), the test/spec exit-code correction (`7adb497b`),
the publication/path repair (`c90f0cdb`), the test-only Windows fixture
corrections (`b492aa51`), and the final operation/maintenance lock predicates.
The shared publication target is `task/bead-finish-20261124`, at the exact
qualified production source `2d801ba4`. The separate integration receipt under
`20261125/revision-9/results/native-source-integration.json` records the
ordinary fast-forward and verified remote ref. This measured continuation is
retained as a transfer draft for independent review while the actual PC
installation and history gates remain pending; it has not been appended to the native
`.marathon/progress.md`.

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
The actual PC gates below remain pending.

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
`native-final-build-results-review.json`. Staging should use the small Windows
release package and the separately qualified app runtime. The large native
test/support artifact is for hosted qualification.

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

### Actual native task state and PC access

The actual coordination store remains revision 6: 32 continuation tasks and
51 blocking edges, 18 closed and 14 open, with 986 total issues including the
954 original issues. Accepted revision 9 has 55 tasks and 91 edges; its 23 new
native IDs, complete task mapping and actual expanded edge set have not been
materialized. Cloud execution uses explicitly accepted provisional task keys.
Do not invent native IDs, claims or closures.

The accepted plan is `e97773b478bd0b916eb40c5d09bc79368bfd7522`,
`20261125/revision-9/plan.json`, SHA-256
`18130e44ab27047dcb397de53caa0a9006c56cfd478d417f884e42452ff62582`.
Its current complete review is `f5bd44970f4cbf5d76204aac3183fb8fcf3f5ea4`,
SHA-256 `e26b5812b03c37f6183ed3182c67133df78cd17d74fe0b336324df7c849dece7`.
One owner must reconcile current state, materialize this accepted revision
directly from revision 6 with the reviewed guarded operations, then reconcile
the retained cloud results in dependency order before installation.

The last successful PC memory observation was
`2026-11-25T07:38:27.0544240Z`: 702 MiB free of 31,905 MiB. The next
BelowNormal read-only memory proposal returned `not-started`,
`ADMIN_BROKER_DENIED`, `replay_allowed:false` for proposal
`6Tf4AjmM58-pk_qxj6LCoJD5wKqr7rW-ZV8MRLKxHS0`, job
`j1795593147532-37324-2134047166569034316`. No PC operation followed that
denial. That observation is historical, not a current headroom measurement.
The existing gates still require at least 1 GiB free for the reserved native
mutation and at least 3 GiB free for the full app/tray launch, with the 512-MiB
owned resident cap and below-normal hidden sequential execution.

Installation, configured-launch/tray acceptance, final actual task-state
persistence and PC cleanup remain pending. Preserve Scotty's original
15 modified source files, private configuration, rollback artifacts and the
original checkpoint. Earlier staged binaries and tray receipts do not replace
acceptance of the final installed source and runtime.

### Worktree preservation and successor cleanup

Riftri 0.7.0 created the current cloud worktree
`/tmp/beads-55c9/backend-type-edit`, registered in
`/tmp/beads-55c9/bead-rs`. Its last locally observed state was clean at
`9ffefad6`; the published remote branch has since advanced through
`7adb497b`, `c90f0cdb`, `b492aa51` and `2d801ba4`.
Local cloud execution is currently unavailable, so removal has not run.

Future agents must finish this cleanup if the process dies or the session ends
early. First inspect current registration and Git status, reconcile the exact
remote publication and preserve any later uncommitted or unpublished work.
Remove only the clean, fully published task worktree through Riftri, without
force:

```sh
/tmp/beads-55c9/tools/node_modules/.bin/riftri exec -- git -C /tmp/beads-55c9/bead-rs worktree remove /tmp/beads-55c9/backend-type-edit
```

The preceding entries' worktree, task-owned temporary file and Windows cleanup
instructions remain applicable until their actual removal is recorded. Hosted
runner teardown owns the disposable cloud checkouts; retained evidence and
rollback files must remain available through final review.
