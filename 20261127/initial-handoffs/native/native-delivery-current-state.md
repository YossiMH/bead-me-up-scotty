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
