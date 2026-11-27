<!-- delivery-state:start -->
## Delivery state — 2026-11-27

This section records the current delivery snapshot. Installation, the three
tray lifecycle cases, the installed default-launch check and the final installed
review have passed independent review. Documentation publication and the
original task-history handoff remain to be completed. The latest accepted
native task readback is 12:58:09 UTC, with 50 continuation tasks closed and
five open. The actual outcomes and remaining work are recorded below.
The dated sections below retain the earlier qualification and failed attempts.

### Installed source, pin and runtime

| Installed item | Accepted identity |
| --- | --- |
| Scotty source in `F:/Dev/bead-me-up-scotty` | `0309539797fd7d016e2b8fd8bdc0ae9cefc20219`, tree `84bb66cde1832ad8d30b63773efb77c952787b94` |
| Native source in `F:/Dev/bead-rs` | `2d801ba455b7a722daf644a7615445117d57e8e9`, tree `509d6222300b84b16041a8366a8b6ae4c28ccc98` |
| Selected native executable | `.scotty-local/bin/bead-0431a828bf95.exe`, 12,243,456 bytes; SHA-256 `0431a828bf95038641a0c55b4cf11c5800b52881940a13bd2f56b02f0b27177a` |
| Executable metadata | 2,058 bytes; SHA-256 `21ca90e29fc4588d23b31210cd5ffe6838c136ce70b76458b71370beeeff18f5` |
| Installed production runtime | BUILD_ID `YIOHeRJTEdlOszyc4LyHr`; 560 files, 27,426,391 bytes |
| Complete runtime manifest | SHA-256 `612790bc18617630f9257ab2a901f8e12a0cd6dda6bf566c414e646e1745f1c7` |

The exact app and native release archives were downloaded, hashed and staged.
The [actual stage review](https://github.com/YossiMH/bead-me-up-scotty/blob/717acefc5bf677c8d18dcf16b692117042bae4ae/20261127/results/artifact-stage-actual-review.json)
accepts both original ZIPs and every runtime file. Staging completed in 13.738
seconds with a sampled aggregate peak of 302,596,096 bytes and normal owned
cleanup. The app ZIP was 7,056,005 bytes, SHA-256
`15a503c45ded58ea48fcce7dd293b563d741a3424b64a39a6bd05edf5b1d409d`;
the native ZIP was 4,524,263 bytes, SHA-256
`6bdb10496f976621d0b5545a8ef3b591a317e4a07d7e1f9276eb42d5fa09bba8`.

The third installation attempt passed at 09:42 UTC and was independently
reconciled with the 09:52:16 UTC preservation readback. It installed the source
and runtime above, selected the final pin through the existing `BEAD_BIN` line,
and normally pushed both exact source commits to the user forks' `main` branches.
The [installation acceptance](https://github.com/YossiMH/bead-me-up-scotty/blob/717acefc5bf677c8d18dcf16b692117042bae4ae/20261127/installation-completed/actual-review.json)
has SHA-256 `f21530a4cadc045e1fa052fa29f187a866e6ae81610197a4e2ea93301f1d780e`.
Its inner result has SHA-256
`a2fe1009af72bbc776d8c4f7db46e0905d2a7d1e5ec18119b1d3abeef0798673`;
the supervisor result has SHA-256
`ab6141355b9b8b349ba40105cb6d6d23945aec0b5b556ea4db1cfeebcc384760`.
The 31.973-second attempt stayed below the 512 MiB aggregate limit, with a
418,521,088-byte peak, no assisted cleanup, no cleanup errors and no remaining
owned processes. The post-installation observation found both source checkouts
clean and the app stopped.

All 15 original raw app files, original index and environment copies, the old
`bead-376537b7917f.exe` pin and previous `.next` runtime remain retained for
recovery. The previous BUILD_ID is `YHFpYLvHE99qaExIBY8FL`. The two earlier
installation attempts remain failed records: the first refused the expected
origin's HTTPS spelling when the existing native origin used SSH, and its result
writer then failed on a null backup argument; the second refused a private index
whose stat cache Git refreshed during validation. Separate, qualified helper
corrections admitted the exact observed SSH origin, used the proper null-string
backup argument and disabled that refresh for the one private-index diff.
The original source/index checks and byte-exact publication guards stayed in
place. Repository configuration and explicit user-fork push destinations were
preserved. Scotty's private local task data remains on the PC.

### Tray behavior and installed launch

The [actual interactive tray review](https://github.com/YossiMH/bead-me-up-scotty/blob/717acefc5bf677c8d18dcf16b692117042bae4ae/20261127/results/tray-runspace-actual-review.json)
accepts three real Windows cases in the logged-in desktop session: **Exit**
stopped its server and disposed the icon; parent loss removed the copied helper
and empty session directory; and an exit-75 restart replaced the server while
retaining one icon, followed by a real **Exit**. All three passed in 15.483
seconds with a 518,172,672-byte sampled aggregate peak, below the 536,870,912-byte
limit. The outer controller reported normal cleanup and no remaining owned
processes. The parent-loss fixture deliberately ended its own controller/server;
that required action is distinct from assisted outer cleanup.

This tray run used the retained `5232c8b94804064ab71af571ee28797667bd72bd`
stage, its 230-file BUILD_ID `Eox2_s2VuIuWWAISvMqKK` and native pin `25a05bdf…`.
Its tray modules are unchanged in final app source `03095397…`. The final
560-file runtime and pin `0431a828…` have their own platform and installation
acceptance above. The fourth installed check exercised `launch-scotty.bat`
with its default selected pin, five scalar edits and real tray **Exit** on a
fresh disposable fixture at port 43972, as recorded below.

Three configured-launch attempts are retained as failed. The first task exited
before creating its result directory; its early error was not captured. A later
read verified that both installed tray module files contain CRLF while the
original observation helper expected their canonical LF hashes. A separately
named helper bound the observed CRLF bytes and their unchanged Git blobs.
The second attempt completed its native fixture initialization and then refused
a missing session value from a short-lived managed process object. Its retained
Job record already identified that exact PID and birth time in session 1 with
the expected executable and exit 0; app, HTTP and tray work had not started.
The [second failure review](https://github.com/YossiMH/bead-me-up-scotty/blob/717acefc5bf677c8d18dcf16b692117042bae4ae/20261127/configured-launch-crlf-actual/independent-review.json)
preserves that distinction.

The [reviewed session helper](https://github.com/YossiMH/bead-me-up-scotty/blob/717acefc5bf677c8d18dcf16b692117042bae4ae/20261127/configured-launch-session/source-review.json)
`windows-configured-launch-host-session-20261127.ps1`, SHA-256
`33c6aba33ba436a0bfac320f3518f9334d8ba9b808a6d8079248bc8ab44976a4`,
uses the already verified PID/birth Job snapshot and still requires the exact
interactive session. It refuses a child that exited before any validated
snapshot exists. An earlier admission check at 11:20:57 UTC recorded 3,017 MiB
free, below the required 3 GiB, and created no task or app process.

The later third attempt,
`ChatGPT-BeadEditing-ConfiguredSession-20261127-2889282bfcec`, started its
helper at 11:32:44.8200843 UTC. The native fixture initialization and session
identity checks passed, and the installed batch, controller, tray host, tray and
Next server started. After 4.8916348 seconds, aggregate Job resident memory
reached 546,582,528 bytes and exceeded the unchanged 536,870,912-byte ceiling.
No completed HTTP check or scalar edit was recorded. The exact instruction
that crossed the ceiling and whether an initial request had been sent are not
established by that result. The owned descendants were stopped, the port was
free and no Job members remained, with assisted cleanup recorded. The
[third failure review](https://github.com/YossiMH/bead-me-up-scotty/blob/cf462e43a1012a75112d943bb17edc84c35b8e67/20261127/configured-launch-session-actual/configured-session-failure-review.json)
preserves the failed outcome; its SHA-256 is
`dc3b886175ef051803f5f18073a0abccb1e275e08aaeba6657a36cb40aaabfd5`.
The raw result has SHA-256
`e9ebb93fc64c308a235219b267e7887667cc91587b3061877c026cbae49e3358`.

The [reviewed TCP helper and invocation](https://github.com/YossiMH/bead-me-up-scotty/blob/cf462e43a1012a75112d943bb17edc84c35b8e67/20261127/configured-launch-tcp/configured-tcp-source-review.json)
were used by the fourth task,
`ChatGPT-BeadEditing-ConfiguredTcp-20261127-2889282bfcec`.
The helper `windows-configured-launch-host-tcp-20261127.ps1` has SHA-256
`818b25d528f0c07b7a913ec6aa6611359cff0aca5d9a3f5c6d523e9577543bf1`;
its independent source review has SHA-256
`4c26f4fc6188dc141808c3b5597926eff3aa1d626f01c89a12251f43270643fe`.
It replaces the single NetTCPIP cmdlet lookup with a bounded native IPv4/IPv6
listener-owner query. All listeners at the test port must still belong to the
retained server identity, including duplicates and wildcard addresses. The
512 MiB aggregate ceiling, 120-second hard and 108-second work limits,
3 GiB launch admission, 1 GiB live free-memory floor, one harness host,
installed default launcher, five scalar edits and real tray Exit are unchanged.

The fourth check passed from 12:29:05.5483981 to 12:29:14.0648154 UTC,
an 8.5164173-second run using installed source `03095397…`, pin `0431a828…`
and BUILD_ID `YIOHeRJTEdlOszyc4LyHr`. Six completed HTTP requests returned
200 or 201. The check created an issue, changed and read back its title,
description, priority, issue type and notes, and recorded 28 native invocations.
The real visible tray menu's **Exit** item was clicked, the icon was disposed
and the copied tray helper was removed. Aggregate owned resident memory peaked
at 515,334,144 bytes, below the 536,870,912-byte ceiling; the lowest sampled
free physical memory was 2,253,275,136 bytes. Cleanup required no assistance,
recorded no errors, left no Job members and found port 43972 free. The
production Next server's exit 1 during the requested shutdown is retained in
the acceptance review; the batch, controller, tray host and tray exited zero.

The [exact passed result](https://github.com/YossiMH/bead-me-up-scotty/blob/cf1e018022086e0118aa76cd64cdd0d02317850d/20261127/configured-launch-tcp-actual/result.json)
is 17,558 bytes, SHA-256
`54e074ed3162fbae9a30deb0843733f918392264291c74f079c9676c3df13701`.
The [independent configured acceptance](https://github.com/YossiMH/bead-me-up-scotty/blob/3151657df5939a2756d504860d655c058b808828/20261127/configured-launch-tcp-actual/configured-tcp-actual-review.json)
has SHA-256
`ebe3a62e564a17568d6f7ae16596fe2809cc43782327057200d8406323771e8b`.
The [separate final installed review](https://github.com/YossiMH/bead-me-up-scotty/blob/3151657df5939a2756d504860d655c058b808828/20261127/configured-launch-tcp-actual/installed-final-review.json)
has SHA-256
`b3bdf0990e7513c9ea57f31b72aecaee582c1b284193dfb78a233c157f84703b`.
It combines the accepted installation and original preservation with this
configured run and the retained final product, browser and platform results.
Both acceptance requirements are satisfied. The corresponding native tasks
were closed in the independently accepted 12:58:09 UTC operation described
below. The fourth
output, creation receipt and both logs use the distinct
`configured-v9-tcp-20261127-2889282bfcec` /
`configured-task-tcp-20261127-2889282bfcec.json` paths. All three failed tasks
and their records remain retained.

### Native task mapping and remaining delivery

The [actual materialization review](https://github.com/YossiMH/bead-me-up-scotty/blob/717acefc5bf677c8d18dcf16b692117042bae4ae/20261127/results/materialization-v9-review.json)
accepts the direct revision 6-to-9 update: 55 continuation tasks, 91 blocking
edges and 1,009 total issues, including all original 954. Revisions 7 and 8 were
never materialized. The returned mapping has SHA-256
`6d1cca5e2495011ae3dac4320e622f67c6f871186ef112edd8f51f8c98d1e5b3`.
The retained closure sequence reached 42 closed/13 open after the 27 accepted
cloud tasks, 45/10 after the three tray/candidate tasks, 47/8 after the two
binding-preparation tasks, 48/7 after installation and **50 closed/5 open**
after the configured-launch and installed-review closures.

The [actual installation closure review](https://github.com/YossiMH/bead-me-up-scotty/blob/717acefc5bf677c8d18dcf16b692117042bae4ae/20261127/installation-completed/closure/actual-review.json)
accepts `install` (`beadrs-0bab2976`) moving from open revision 5 to closed
revision 6, with the other 54 continuation rows and original 954 issues
unchanged. The later [configured/installed closure acceptance](https://github.com/YossiMH/bead-me-up-scotty/blob/78dc8f4fe17df16a82c0063b9fbac7642fd53039/20261127/configured-installed-closure/configured-installed-closure-actual-review.json)
records `configured-launch` (`beadrs-c9526055`) moving from open revision 5
to closed revision 6 and `installed-review` (`beadrs-47da80ac`) from open
revision 3 to closed revision 4. That operation finished at
12:58:09.9490539 UTC. All other 53 returned task summaries stayed exact;
the unchanged executor's original 954-issue and stored-field preservation
checks passed, with configuration and checkpoint pointer unchanged.

The 5,964-byte raw closure result has SHA-256
`6b0cbed2c93a5e517a50fb6e10f98382ff8cc480edff2336c97c96ff332f8a73`;
the 7,947-byte supervisor receipt has SHA-256
`e06e2ee20a9eb2de44053808f25a8a89b180b7517d93744b40520f362b70c316`.
The independent closure review has SHA-256
`a158adc4bca44efcce1bcef152816b7ffd55790bc31526a99444ea57929447c5`.
The five remaining rows at the latest accepted readback are:

| Task key | Native ID | Status | Revision |
| --- | --- | --- | ---: |
| `backend-handoff` | `beadrs-1371879c` | open | 3 |
| `app-handoff` | `beadrs-f0039a6a` | open | 5 |
| `backend-text-review` | `beadrs-30f13b5b` | open | 3 |
| `app-text-review` | `beadrs-c62c1990` | open | 5 |
| `preserve-and-clean` | `beadrs-3ec972f8` | open | 5 |

The backend and app handoff tasks are ready at this observation. Their text
reviews and `preserve-and-clean` retain their dependencies and acceptance
requirements. Refresh the actual rows before each close, retain the accepted
publication/review records and reconcile the full task state afterward.
Publication of this prepared text and the remaining task closures each require
their own actual receipts.

### Original history, publication and cleanup

The original native checkout has checkpoint/configuration files and no SQLite
database or sidecars. Its existing `core.autocrlf=true` is preserved. The
[reviewed checkpoint-only handoff](https://github.com/YossiMH/bead-me-up-scotty/tree/de71118c225936b8ca6eac4be5db306eff19219b/20261127/checkpoint-crlf-handoff)
uses selected final pin `0431a828…` and native `--no-auto-flush` initialization
and verified restore. Its CRLF-compatible driver has SHA-256
`1015fa587954ecd1d0deddf8391789377b8c81cdf51ffa36994e7568df69c671`;
its supervisor has SHA-256
`c0c289a9bce78e761d6773ab59298b7e8c61ac9e9da4cefd52a9023497fd34e6`.
The exact 128 MiB cloud qualification passed. The ordinary Windows PowerShell
5.1 parses of both history/publication supervisors also passed in the same
accepted 12:22:50 UTC batch that parsed the configured TCP inputs. Each real
history phase still requires its own exact inputs, execution and acceptance.

Preserve the original raw selected checkpoint files and their canonical Git
bytes in separate retained directories. The source-restore phase first proves
the canonical original 954-issue corpus, then the complete frozen continuation.
The original Git baseline must be recorded after the accepted installation and
reviewed native handoff publication/adoption, with its exact raw index copy
under the coordination directory. It binds the user fork's actual main commit,
the unchanged original checkpoint tree
`ff0759095a01edb38ca4bb8aa90fbdb84476e0f7`, and all 53 original checkpoint
blobs. An earlier proposed or pre-installation baseline cannot fill that input.

The eight phases remain `preserve`, `freeze`, `source-restore`,
`restore-original`, `restore`, `close`, `final-publish` and `final-restore`.
Before freeze, every continuation task except `preserve-and-clean` must be
closed and that cleanup task must be unassigned and unclaimed. After the
reconciled restore into the original checkout, that checkout becomes the sole
writer; the coordination writer stays frozen. The two explicit Git publications
retain their own observed commits, index proofs and phase-result bindings.
The prepared phase requests keep their input pins unset. Fill them from exact
accepted installed/configured/handoff records and prior phase receipts staged
under the permitted roots; record commit/index values and the cleanup revision
and reason only from the corresponding actual observation. No original history
phase has been accepted in this snapshot.

Scheduled-task cleanup has a separate, exact 23-name preparation: 19 original
diagnostic tasks and the four configured-attempt names. Its helper
`remove-exact-scheduled-tasks23-20261127.ps1` has SHA-256
`4b5c57817efcbf019568dc1a6cfdc4868d8c1f99dda3d86cf077afc193385c93`.
Its independent source preparation review has SHA-256
`73c2982da883ac905a718c21f71195f4a6472e9b6e31a0232f413583e8ef87cc`.
It retains the three failed configured outcomes and requires Scheduler
results 1, 1, 1, 0 in that fixed order. Execution requires the passed fourth
result and its independent acceptance, exact creation
receipts, a fresh private four-task definition readback, whole-XML equality,
ready state and zero running instances before each exact deletion. The
actual private four-task readback is
`coordination-20261124/configured-task-readback-20261127-v3/result.json`,
21,481 bytes, SHA-256
`e3324f17e074de8af9fde5f726b5c57ebd25e28b183de74cb648d5999e859326`.
The [independent four-task metadata review](https://github.com/YossiMH/bead-me-up-scotty/blob/3151657df5939a2756d504860d655c058b808828/20261127/configured-launch-tcp-actual/configured-four-task-actual-review.json)
accepts all four exact creation actions/settings, ready state, zero instances
and outcomes 1, 1, 1, 0. The full XML stays private; the cleanup helper must
match it and the live idle state again. The third failure keeps its recorded
memory limit breach and assisted cleanup. Private definitions, inputs,
rollback copies and attempt records remain retained; the helper removes only
the named registrations. Ordinary Windows parsing, the filled request and
actual deletion remain separate required records. No such deletion is recorded as complete here.

The reviewed Git-ref cleanup preparation covers [86 exact app task refs](https://github.com/YossiMH/bead-me-up-scotty/blob/717acefc5bf677c8d18dcf16b692117042bae4ae/20261127/archive-preparation-recovered/reviewed-refs.json)
and two separately handled native task refs. Refresh all exact live app tips
after the final transfer publication and recompute their independent parents.
The reviewed archive shape uses
`refs/heads/archive/bead-editing-complete-20261127`, with the final transfer
commit first, its exact tree, and 31 additional independent app tips. A changed
parent count requires a reviewed adjustment. The approach review
`ef4cc2d9c01a1e2fcf6a36074f00b9bd7d3515d856fb5db213ce1a8a707e9d24`
accepts preparation only. Read back the created archive commit/ref and
independently prove that it retains all 86 final observed tips before deletion.
The two native tips must separately remain ancestors of accepted native `main`.
Only then may the bounded publisher delete the exact named refs atomically,
with each expected-tip lease. Preserve `main`, the archive and unrelated refs.
This conditional archive route governs final transfer-branch removal; the
historical instructions below describe earlier preservation checkpoints.
Actual archive creation, ancestry acceptance and deletions are still pending.

Worktree cleanup likewise requires current registrations, clean status and
published retained work, followed by ordinary Riftri removal without force.
The accepted checkpoint-only author worktree removal is separately recorded in
[its publication and cleanup receipt](https://github.com/YossiMH/bead-me-up-scotty/blob/717acefc5bf677c8d18dcf16b692117042bae4ae/20261127/checkpoint-only-handoff/worktree-publication-and-cleanup.json).
Cloud filesystem loss is not evidence of a verified worktree removal.
Final documentation publication, remaining task closures, original history
publication and complete cleanup acceptance are still pending.
<!-- delivery-state:end -->

