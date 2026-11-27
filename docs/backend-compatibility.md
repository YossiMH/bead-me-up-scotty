# Backend compatibility

Scotty supports separate original Beads (`bd`) and native bead-rs (`bead`)
projects. The backend belongs to each registered project; a missing selection
means original bd. Selecting a backend does not convert between implementations
or initialize missing data. Registering or opening a native project runs the
selected CLI, which can upgrade an older native schema and change SQLite journal
or sidecar files. Add only stores already known to be current and compatible with
that exact executable. Review and explicitly approve any migration of an original
store before opening it.

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

## Versions and installation

| Backend | Compatibility target | Executable setting |
| --- | --- | --- |
| Original Beads | `bd` 1.1.0 | `BD_BIN`, or `bd` on `PATH` |
| Native bead-rs | 0.3.0 / `native-v1` with the required command and document capabilities; recorded baseline pins and the editing extension are described below | `BEAD_BIN`, or `bead` on `PATH` |

Native v0.2.6 is unsupported: it lacks the required comments, complete-list and
JSON-document interfaces. A 0.3.0 version string alone does not identify the
tested source. Use the pinned commit and retain its build metadata. Scotty checks
the public capability document and workspace identity, not the executable's hash.
Later bead-rs revisions need separate qualification. The earlier Linux baseline
was [commit `bf2aa10b5bb36898a8f7f73e60b3b61de9a4a2ec`](https://github.com/jedarden/bead-rs/tree/bf2aa10b5bb36898a8f7f73e60b3b61de9a4a2ec).
Its qualification, and the earlier Windows binary results below, predate the
editing extension.

### Editing-capable builds

The editing extension is implemented in the
[YossiMH/bead-rs fork](https://github.com/YossiMH/bead-rs), with implementation
commit `a168e27ef3f2eb476dddbd34d41f35e6539001e6`. Scotty reads the selected
executable's `capabilities` document before exposing the new fields. Within
`issue_editing`, it requires `version: 1`, `clear_description: true`,
`revision_guard: true` and `priority_reason_required: true`. Each new field must appear in
`issue_editing.fields`; priority additionally requires `priority_change: true`.

An executable without that optional contract keeps the existing native status
and assignment controls. Missing fields remain unavailable, and the API refuses
them before a write. Updating Scotty alone does not add editing to an older
binary. The older Windows pin documented below remains a rollback option for
its compatible stores.

The installed sources, production runtime and remaining delivery checks are
recorded in [Delivery state — 2026-11-27](#delivery-state--2026-11-27). The
[2026-11-25 continuation](#2026-11-25-continuation) retains the hosted qualification.
Earlier receipts below qualify their stated builds. Retain a new binary's source
commit, target and SHA-256 alongside its Windows execution results before
selecting it.

### Use a local bead-rs fork on Windows

Select the executable explicitly when another `bead` is installed on `PATH`.
From the Scotty checkout, for a sibling `bead-rs` checkout with an existing debug
build:

```powershell
npm ci
npm run build
node .\bin\bead-me-up-scotty.mjs --bead-bin ..\bead-rs\target\debug\bead.exe --host 127.0.0.1
```

`--bead-bin` takes a file path, resolves relative paths from the folder where the
command was invoked, and overrides `BEAD_BIN` for the launched server. It does
not install or replace an executable. In Add a project, select **bead-rs**.

The installed F: clone selects the final qualified pin through `.env.local`:

```dotenv
BEAD_BIN=F:/Dev/bead-me-up-scotty/.scotty-local/bin/bead-0431a828bf95.exe
```

From `F:\Dev\bead-me-up-scotty`, use the production batch launcher:

```powershell
.\launch-scotty.bat --no-open
```

The launcher uses `127.0.0.1` and the default port 3000 unless overridden; open
the URL it prints. `--no-open` keeps the browser closed and leaves the tray
enabled. The current acceptance state for this installed route is recorded in
[Delivery state — 2026-11-27](#delivery-state--2026-11-27). The installed build
can be launched directly; building again is a separate source-update operation.

Use **Add project**, choose **bead-rs**, and enter the repository root containing
`.beads`. Existing process environment settings take precedence over
`.env.local`. `--bead-bin` overrides the selected executable for that launch.

Scotty stores project registrations and acquired native claim credentials in its
configuration directory. Placing the binary in `.scotty-local/bin/` does not
change that directory. To deliberately use a separate configuration for this
clone, set `XDG_CONFIG_HOME=F:/Dev/bead-me-up-scotty/.scotty-local` before launch;
that optional setting is not part of the installed `BEAD_BIN` replacement.
Keep the chosen configuration directory private and preserve it across restarts.

Select an initialized workspace already known to be compatible with the selected
executable. Adding a project opens it through the public CLI and can upgrade an
older schema, including during the command's pre-dispatch connection. The
qualification fixtures are newly initialized disposable stores. For the original
native checkout, use the delivery section's accepted history state to determine
when registration is ready. Preserve its checkpoint and database state throughout
the approved handoff.

This installation pins a copy of the tested fork binary with neighboring
provenance metadata and its exact SHA-256. It does not follow future fork
rebuilds. Qualify a replacement on disposable data before changing the pin.
The earlier `bead-376537b7917f.exe` and its receipt remain available for the
[documented rollback](#return-to-the-previous-binary-pin).

### Earlier Windows qualification

On this Windows host, the earlier F: pin passed the full real-store tests
and headless browser registration, issue display, API create and CLI readback on
fresh F: Git workspaces. The current checkpoint's referenced files were staged
with matching bytes, while an unrelated file stayed unchanged and untracked.
The clone's `.env.local` defaults were also tested without `--bead-bin`; cleanup
leaves an empty clone-local project registry. After the user-approved Windows
Medium integrity-label repair, the unchanged executable passed the ordinary C:
Git-native suite and the C: headless browser's application checks. The browser
controller initially failed its five-second exit observation for two owned
headless-browser children despite an empty Job; a later identity check confirmed
both had exited. The original result and that reconciliation are retained. The
browser checks used an existing isolated Playwright headless browser. Earlier
failed fixtures are preserved. These results do not qualify original stores;
no existing live store was opened.

That local Windows binary has SHA-256
`376537b7917f18d33383a3e4bd3eb9e0955bb42d1a60b73aef5c81865662af28`.
Its public contract reports 0.3.0 / native-v1 with array list output and object
show/create output. The tests exercise complete listing, creation, comments,
labels, dependencies, closing, reopening, assignment and release using a fresh
disposable store. The binary hash identifies the tested file; the checkout's
Git revision does not establish that file's build provenance.

To check another local binary, set `BEAD_BIN` and `SCOTTY_TEST_ROOT` to absolute
paths, with the test root outside both source repositories. Set `HOME`,
`USERPROFILE`, `APPDATA`, `LOCALAPPDATA`, `XDG_CONFIG_HOME`, `TEMP` and `TMP` to a
disposable home before running `npm run test:bead-rs:local`. The browser check
uses `npm run test:bead-rs:browser` after a production build; optionally set
`SCOTTY_TEST_CHROME` to an installed isolated Playwright Chromium or headless-shell
executable. It launches a separate
browser session and verifies that the CLI flag overrides an invalid inherited
`BEAD_BIN`. Keep tests under an owned process controller on Windows so its
entire server process tree is reclaimed on exit.

Build Scotty from this checkout with `npm ci` and `npm run build`, then start it
with `npm run serve`. The upstream v0.3.2 release predates this adapter. The
Dockerfile bundles only bd; native mode in Docker is not qualified. The native
build procedure below uses Linux shell tools. A cross-built Windows executable
still needs execution checks on Windows before it becomes a qualified pin.

### Windows launch and shutdown

The production launchers `scotty`, `bead-me-up-scotty`, `npm run serve`,
`npm start` and `launch-scotty.bat` create one Windows Forms tray helper per
launcher. Its tooltip is **Bead Me Up, Scotty**, and its context menu contains
**Exit**. Exit stops that launcher's server and disposes the icon. Console
interrupts and server termination use the same shutdown owner. The supervised
`npm run serve` and `npm start` paths retain their icon while replacing a server
that requested a self-update restart.

`launch-scotty.bat` runs from its own checkout, binds to `127.0.0.1`, forwards
arguments to the CLI and returns its exit status. It pauses on failure so that
an error remains visible when launched from Explorer. Use
`launch-scotty.bat --no-open` to leave the browser closed. The global CLI's
`--no-open` option also keeps the tray active.

Set `BMUS_TRAY=0` in the launcher environment for headless use. The helper is
Windows-only and needs Windows PowerShell with Windows Forms in an interactive
desktop session and an absolute, usable `LOCALAPPDATA` directory. Each launcher
copies the bundled helper into a unique
`%LOCALAPPDATA%\bead-me-up-scotty\tray\session-*\` directory and executes that
copy with ordinary `-File`, retaining the host's PowerShell execution policy.
The controller removes its own copied helper and empty session on shutdown;
the helper also performs that cleanup if its launcher disappears. Shared cache
parents and unexpected files are preserved. If the helper cannot start, or
fails while the server runs, the launcher reports the error and shuts down.
The development server and direct
`next start` calls do not use this controller. No tray setting changes the
selected bead executable, project registrations or issue data.

### Return to the previous binary pin

Keep the previous executable and its receipt when qualifying a replacement.
Stop the current Scotty server, verify the previous file against its recorded
SHA-256, and select it with `--bead-bin` or the previous `BEAD_BIN` value. For the
earlier local pin shown above:

```powershell
Get-FileHash .\.scotty-local\bin\bead-376537b7917f.exe -Algorithm SHA256
node .\bin\bead-me-up-scotty.mjs --host 127.0.0.1 --no-open `
  --bead-bin .\.scotty-local\bin\bead-376537b7917f.exe
```

Compare the hash with the full earlier receipt in this document. The explicit
flag overrides `.env.local` and inherited `BEAD_BIN`; changing `.env.local`
affects subsequent launches that use those defaults. Native controls follow
the capabilities of the selected file, so an older pin hides unsupported edit
fields. Re-selecting an executable does not undo saved edits or downgrade a
database. Open only stores known to be compatible with that pin, and preserve
the matching Scotty configuration and source/build backup.

### Build the native CLI

The earlier qualified Linux build used Rust 1.99.1, Cargo, Git, Bash, Python 3
and GNU utilities. Install those prerequisites separately if needed. The upstream build
script requires at least 5 GiB free under `$HOME/scratch` and downloads locked
Cargo dependencies. It builds an archive of the requested commit without changing
the source checkout's HEAD, index or stash.

```sh
git clone https://github.com/jedarden/bead-rs.git
cd bead-rs
git cat-file -t bf2aa10b5bb36898a8f7f73e60b3b61de9a4a2ec
scripts/build-from-archive.sh bf2aa10b5bb36898a8f7f73e60b3b61de9a4a2ec \
  --name bead-scotty-bf2aa10 --out "$HOME/.local/bin"
"$HOME/.local/bin/bead-scotty-bf2aa10" --version
```

The script runs `cargo build --release --locked` with default features and refuses
to overwrite an existing pin. Keep the adjacent `.metadata.json`: archive builds
report commit `unknown`, while that file records the source commit and binary
hash. The qualified binary reported
`bead 0.3.0 (unknown 2026-10-20T06:48:57Z)` with SHA-256
`9a934a834b01c50d6211f19fff9eee9a436152e3ba51ead6947c535f13158e16`.
This baseline executable predates scalar editing. Build timestamps change the
hash, so a fresh build is not expected to reproduce those bytes. See the pinned
[upstream build procedure](https://github.com/jedarden/bead-rs/blob/bf2aa10b5bb36898a8f7f73e60b3b61de9a4a2ec/BUILD_PROCEDURE.md).

The fork's extended archive builder accepts `--target <Rust target>` and
`BEAD_BUILD_SCRATCH_ROOT`; its default target is the current Rust host. A Windows
target produces an `.exe` and a receipt identifying both the build host and the
requested target. A foreign target is recorded as
`execution_verification: "pending"` with a null embedded version because the
builder has not executed it on that target. Keep the receipt with the file and
complete Windows version, capability and behavior checks before selecting it.
Archive builds isolate Git discovery so an enclosing checkout cannot supply a
false source commit. The archive builder refuses to overwrite an existing pin.

### Add a native project

Use an existing initialized native workspace. For a new project only, run
`"$HOME/.local/bin/bead-scotty-bf2aa10" init --prefix <project-prefix>` in its
intended directory, replacing `<project-prefix>` with the project's ID prefix.
Do not run `bd init` over native data, or initialize either tool over an existing
store to resolve an error.

Start Scotty from its own checkout, not from the native project:

```sh
BEAD_BIN="$HOME/.local/bin/bead-scotty-bf2aa10" \
POSTHOG_KEY='' npm run serve
```

Open **Add a project**, choose **Backend → bead-rs (bead)**, then select the
directory containing that workspace's `.beads`. `BEADS_REPO` and legacy
registrations retain original-bd selection; they do not select native mode.
If the folder is already registered as bd, remove its registration and add it
again with bead-rs. Removing a registration leaves the issue store in place.

`BD_BIN` remains independent and can be set alongside `BEAD_BIN`. Do not point
`BD_BIN` at `bead`: the tools have different commands and formats. A missing
executable, unsupported contract or wrong workspace produces an error rather
than switching backends or showing demo data. Choose the Demo project explicitly
to use its in-memory dataset.

## Native workflow

Board, List, Focus, the detail drawer and the dependency graph use native records.
Reads request all issues and comments, including resolved comments, and join
issue type and close metadata through the public query interface. **Ready**
comes from bead-rs's ready query. Assigned or otherwise ineligible open work is
shown in **Open**, rather than being presented as ready.

| Action | Native behavior |
| --- | --- |
| Create | Title, description, priority, type, assignee and initial labels; start-in-backlog uses one manifest transaction |
| Edit after creation | With the editing extension: title, description, priority, custom type, notes, status and assignee; older executables retain status and assignee |
| Close | Requires a nonblank reason, retained with the completion time |
| Reopen or release | Dedicated lifecycle actions; moving in-progress work to open releases its assignment |
| Start | Move deferred work to open first; starting unassigned work assigns it to the configured actor |
| Comments | Create and display native comment text and recorded author |
| Labels | Add or remove one label per action; no replace-all or clear-all action |
| Dependencies | Exact native kinds `blocks`, `relates_to` and `verifies`; removal identifies the edge kind |

Scalar edits, status and assignment changes respect native revisions and
ownership. Scotty retains credentials only for claims it acquired itself, under
`$XDG_CONFIG_HOME/bead-me-up-scotty/native-claims` (default
`~/.config/bead-me-up-scotty/native-claims`). It does not adopt a visible token
from another process. If the original holder owns a protected claim, that holder
must release it with its original credential. Keep Scotty's configuration
directory private and preserve it across restarts.

Native projects cannot delete or archive issues, create parent-child hierarchy
or human approval gates, run Refine with AI, upload or serve attachments, or
publish a site. These actions are unavailable in the UI
and rejected by the API. Native issue creation authorship is unavailable, so
Scotty does not infer an origin badge or offer creation-attribution analytics,
including Activity, Insights and Achievements. Comment authorship remains visible.
Original bd and Demo keep their existing operations.

### Editing existing native beads

Open the bead's detail drawer. The pencil opens its content editor; the other
controls apply their own changes:

| Field or relationship | Control |
| --- | --- |
| Title | Pencil, then **Title** |
| Description | Pencil, then the Markdown description editor; checklist boxes also save description changes |
| Type | Pencil, then **Type**; native types can be custom nonempty strings |
| Notes | Pencil, then **Notes**; these are separate from comments |
| Priority | **Priority**, from 0 (Critical) to 4 (Backlog); also available in the command palette |
| Status and assignee | Their own **Status** and **Assignee** controls, subject to native claim and lifecycle rules |
| Labels | Add or remove individual labels in the drawer |
| Dependencies | **Add dependency**, search by bead ID or title, choose a type, then **Add**; use a relationship row's remove button to remove that exact edge |

**Save** submits the content draft; **Cancel** discards it. Read-only mode
disables these writes in both the UI and API. The selected executable's
capabilities determine which controls are available.

Scotty sends a scalar patch as one guarded native `update`, with the current
revision and a legitimate claim credential when required. A change to priority
uses the reason `Priority edited in Scotty`; bead-rs records a `priority_changed`
event with the old and new values, actor and reason. Sending the existing
priority leaves that audit history unchanged. A closed bead can receive scalar
metadata corrections without changing its completion time or close reason.
Reopening or releasing together with other scalar changes is rejected before
any write; use the lifecycle action separately.

Native titles may contain up to 4,096 UTF-8 bytes. Descriptions, notes and custom
types may each contain up to 4 MiB of UTF-8 text. Types must be nonempty; empty
descriptions and notes clear those fields. When the combined description, notes
and type exceed 8 KiB, Scotty uses temporary UTF-8 files and cleans them up after
the command.

Type files require `issue_editing.issue_type_file: true` in the selected
executable's capability document. With an older executable, types of at most
8 KiB stay inline while descriptions and notes can use files. Scotty refuses a
larger type before creating temporary files or sending the update. An absent,
false or malformed file capability preserves the other editing controls.

IDs, creation and completion timestamps, claim metadata, comments and other
managed fields are not arbitrary PATCH fields.

Dependency changes use the separate native dependency actions. The source
issue depends on the selected target, and an edge is identified by source,
target and kind: `blocks`, `relates_to` or `verifies`. Removing one kind preserves
other kinds between the same pair. An incoming blocker row removes its actual
underlying edge with the original direction. Labels likewise use individual
add/remove actions rather than replacement through the scalar patch.

### Label API and concurrency

Native projects expose `POST` and `DELETE` at
`/api/p/:projectId/beads/:id/labels`, accepting exactly `{"label":"name"}`.
Each request runs one public native label add or remove command. Blank labels,
extra properties and combined edits are rejected before a subprocess.
`PATCH` with a `labels` property is unsupported, including an empty array or a
body that also changes status. Original bd and Demo keep their existing label
replacement route.

An individual delta preserves unrelated labels. It is not an issue-revision
compare-and-swap or a fenced claim operation. Another writer can change the same
label before or after it; refreshed data represents the current state, not a
frozen label set. The pinned native service records label events as `system`,
not as Scotty's configured human actor.

### Live refresh

Native live notifications watch the public `.beads/checkpoint/` publication
directory, not the SQLite/WAL/SHM files touched by native reads. Successful
automatic checkpoint publication triggers refresh without a read/refetch loop.
If publication is suppressed, fails, or the checkpoint directory is unavailable,
the configured fallback refresh interval still discovers committed changes.
Original `bd` keeps its existing top-level `.beads` watcher.

### Write errors and refresh

A native command can commit before receipt parsing, readback, local credential
storage or checkpoint handling fails. An error is not evidence of rollback.
Scotty distinguishes `mutation_committed` from `mutation_uncertain` and retains
available issue/comment IDs. Do not resubmit a create, comment or edit just
because the response failed. Use **Refresh without resubmitting** and inspect the
identified record. An unknown outcome remains unresolved until read-only checks
establish what happened.

For a scalar edit, refresh reads the identified issue and a coherent project
snapshot, then compares the submitted fields with the current record. A failed
refresh or different current values retains the draft and recovery notice.
There is no automatic retry. A priority-only refresh preserves any separate
unsaved content editor. The native command palette retains an unverified
priority request and its recovery controls until reconciliation or explicit
discard; Escape and the palette shortcut cannot dismiss it in that state.
Readback equality confirms the current field values, not a unique audit receipt.

Native reads reject malformed or inconsistent output rather than returning an
empty board. A snapshot read makes up to three attempts if the workspace changes
during the read. Commands have a 60-second timeout and a 32 MiB output bound;
exceeding either is a failure, not a partial successful result.

## Checkpoints and source updates

bead-rs normally publishes local checkpoint files after successful writes and
may stage them in the workspace's Git index. Staging is not a Git commit or push,
but a later commit can include issue content. Inspect `git status` and the staged
diff before committing. Keep test workspaces outside Scotty's source tree, and
do not include private issue data, local configuration or claim credentials in
a source contribution. Scotty does not change the native auto-flush or auto-stage
settings. See the [native checkpoint staging contract](https://github.com/jedarden/bead-rs/blob/bf2aa10b5bb36898a8f7f73e60b3b61de9a4a2ec/docs/adr/018-auto-stage-published-checkpoint-fileset.md).

Scotty's own repository tracks issues locally under its existing
[repository rules](../AGENTS.md). Adding this adapter does not authorize syncing
that data. Keep the original MIT notice, attribution and design assets when
redistributing the source.

For a fork or unreadable/different `origin`, in-app upstream updates are disabled
before release discovery or fetch. Update manually from your chosen fork, inspect
the source changes, then run `npm ci` and `npm run build` and restart. Pointing
`origin` back at upstream removes that fork safeguard.

## Verification

Run checks from the Scotty checkout. The earlier baseline qualification used
Node 24.19.0 and npm 11.9.0. The unit tests use explicit subprocess doubles and
do not prove real CLI or browser behavior.

```sh
export POSTHOG_KEY='' NEXT_TELEMETRY_DISABLED=1
export BD_DISABLE_METRICS=1 BD_DISABLE_EVENT_FLUSH=1
export SCOTTY_TEST_ROOT="$(mktemp -d /tmp/scotty-backends.XXXXXX)"
node --test scripts/test-backend-contract.mjs \
  scripts/test-native-editing.mjs scripts/test-native-edit-ui.mjs \
  scripts/test-native-mutations.mjs scripts/test-native-ownership.mjs \
  scripts/test-native-route-guards.mjs scripts/test-native-label-revision.mjs \
  scripts/test-native-label-deltas.mjs scripts/test-native-mutation-outcomes.mjs \
  scripts/test-native-credential-tenures.mjs scripts/test-native-ui.mjs \
  scripts/test-native-graph-kinds.mjs scripts/test-native-label-ui.mjs \
  scripts/test-native-ui-outcomes.mjs scripts/test-beads-watch.mjs
node scripts/test-fork-updates.mjs
node node_modules/typescript/bin/tsc --noEmit --incremental false
npm run lint
npm run build
git diff --check
```

The integration runner requires absolute executable paths and a production build.
It creates a fresh Git workspace and isolated HOME/config inside
`SCOTTY_TEST_ROOT`, starts its own server and stops it after the checks. Run the
backends sequentially with port 3196 free. Browser checks require Playwright
Chromium installed separately; the runner does not install it. Set
`SCOTTY_TEST_CHROME` to select an installed isolated Chromium or headless shell.
Use an editing-capable native binary for the extended editing checks.

```sh
BD_BIN=/absolute/path/to/bd SCOTTY_TEST_PORT=3196 \
  node scripts/test-backend-integration.mjs bd --browser
BEAD_BIN=/absolute/path/to/editing-capable-bead SCOTTY_TEST_PORT=3196 \
  node scripts/test-backend-integration.mjs bead-rs --browser --native-ui
```

The runs retain `evidence.json`, server output, workspace fingerprints and browser
artifacts in their new fixture directories. Native UI recovery tests forward the
write to the real server, then inject a failed response; they check client
reconciliation, not native checkpoint failure. Keep those results distinct from
unintercepted CLI/API/browser checks.

The `--native-ui` run includes ordinary editing/lifecycle/dependency flows,
drawer recovery with a separate unsaved draft, and native palette priority
recovery. Launcher contract tests are `node --test scripts/test-windows-tray.mjs`
and `node --test scripts/test-serve.mjs`. These use synthetic child processes;
real Windows tray execution uses
`scripts/test-windows-tray-smoke.ps1` in an isolated test environment.

## 2026-11-11 editing and Windows tray work

This dated record describes the November 11 candidate and observations. Later
installation and acceptance are recorded in the delivery section above.

### Candidate and qualification recorded on 2026-11-11

At this checkpoint, the editing and tray implementation was integrated in the
following candidate. Its intended pin identified the exact cross-built Windows
file; installation and selection still depended on complete Windows results.

| Item | Candidate |
| --- | --- |
| Backend source | [`539cdd0b4c54665c2db01da08fdf9f3871f7148a`](https://github.com/YossiMH/bead-rs/commit/539cdd0b4c54665c2db01da08fdf9f3871f7148a) |
| Windows target | `x86_64-pc-windows-gnu`, release build from an isolated Git archive |
| Windows executable SHA-256 | `25a05bdfd8feaea92faf6827e9268e597d25432826f1082c7ebadc3af8658798` |
| Intended local pin | `F:/Dev/bead-me-up-scotty/.scotty-local/bin/bead-25a05bdfd8fe.exe` |
| Scotty source and production build | `fbb09312e43ec8094da6db04f126a16e8c5746f7` |

The Windows CLI smoke passed all 55 commands on 2026-11-11 with the exact binary
above, running BelowNormal against new disposable workspaces. It verified
compound scalar edits and priority audit, long UTF-8 description/notes files,
empty clears, labels, all three dependency kinds with their original direction,
stale-revision refusal without partial writes, and automatic checkpoint
publication followed by restore of fields, graph, labels and priority history.
The owned fixtures were removed. The receipt is
`F:/Dev/.bead-edit-20261111/native-results-v3/windows-native-smoke-5f2c9c6a00f24f4b8e803c81df22f3c9.json`.

At the November 11 checkpoint, tray lifecycle and installed-default launch
results were pending, and this candidate was not the recorded installed default.
Preserve the adjacent build metadata and execution receipts with the binary;
retain the earlier
`bead-376537b7917f.exe` and its receipt for the
[documented rollback](#return-to-the-previous-binary-pin).

### Worktree recovery and cleanup

Development then used the following cloud linked Git worktrees created through
Riftri. This is the historical inventory; establish current registrations and
retained contents before attempting recovery or removal:

- `/workspace/scratch/51bd923093d4/worktrees/bead-editing`: `feat/bead-editing-20261111`
- `/workspace/scratch/51bd923093d4/worktrees/bead-pinning`: `feat/bead-pinning-20261111`
- `/workspace/scratch/51bd923093d4/worktrees/scotty-editing`: `feat/scotty-editing-20261111`
- `/workspace/scratch/51bd923093d4/worktrees/scotty-tray`: `feat/scotty-tray-20261111`

Check Git status and remote commits before cleanup. Preserve any uncommitted or
unpublished changes. From the appropriate repository, use
`/workspace/scratch/51bd923093d4/tools/node_modules/.bin/riftri exec -- git worktree remove PATH`
with the exact listed directory, without force. The cloud filesystem does not
permit copy-on-write mounts; Riftri forwards these commands to ordinary linked
Git worktrees. Any completed removal requires its own observed result.

Backend source began at `afac9fa0ce9533a707d745018d16a25e4ccff492` from
`YossiMH/bead-rs`. Scotty's existing local source was preserved at
`55f17568be93442abc6e4725d3e159448e0c9ab5` before new code. The verified native
checkpoint supplied the isolated task-coordination checkout. Scotty's
machine-local task data stays on the PC.

## 2026-11-24 recovery after the cloud restart

This dated recovery record retains the source, failures and task plan known on
November 24. Its inventory and pending checks are historical; the delivery
section above records the subsequent revision 9 mapping and accepted PC work.

The recovered implementation is published in `YossiMH/bead-rs` on
`task/bead-finish-20261124` at `24979aec5d19a48ab145daf24e2399397d9b4814`
and `YossiMH/bead-me-up-scotty` on `task/scotty-finish-20261124` at
`f47fd7adef41e989072d5fa8c39160681aa6fd2a`, before this documentation append.
The staged Windows executable comes from
`539cdd0b4c54665c2db01da08fdf9f3871f7148a`, with SHA-256
`25a05bdfd8feaea92faf6827e9268e597d25432826f1082c7ebadc3af8658798`.
Its retained Windows receipt confirms all 55 native checks passed. The retained
tray run confirms the real Exit action disposed the icon and stopped its server;
the parent-loss check failed because the copied helper cache remained. That
failure required diagnosis and a passing rerun. Cloud runs passed all
32 launcher checks and all 161 adapter/editor checks, with raw output in the
paths below. At that checkpoint, the complete browser, Windows tray and
installed-default launcher checks were pending and installation had not run.
Scotty's original 15 modified source files and machine-local task store were
preserved on the PC.

The old `/workspace/scratch/51bd923093d4` worktrees and the later
`/var/tmp/beads-20261124-3160` worktrees are gone. The earlier 37-task graph was
never flushed and was not recovered; do not invent its IDs or cite deleted logs
as retained.
The independently reviewed continuation then had 16 tasks and 24 blocking
dependencies. Its materialization target was
`F:/Dev/.bead-edit-20261111/coordination-20261124`, using the original
954-issue, 11,264-event checkpoint with store UUID
`1c4f5d56-dcff-cbc5-ddf9-c536653c45f4`. Preserve the original source checkpoint
through installation. Future agents must finish cleanup if this session stops:
inspect Git status and remote commits, preserve uncommitted or unpublished work,
then remove each clean, fully published worktree through Riftri using the
commands below, without force. After retaining results, remove only task-owned
temporary files and this task's exact registered Windows diagnostic task; keep
rollback files and the shared parent directories. The task's Windows files are
under `F:/Dev/.bead-edit-20261111`.

| Location | Recorded use on 2026-11-24 |
| --- | --- |
| `/workspace/library-files/beads-build-temporary-3160/worktrees/bead-completion` | Physical backend worktree, detached; `/workspace/scratch/3160e3ba3d24/worktrees/bead-completion` is its symlink |
| `/workspace/scratch/3160e3ba3d24/worktrees/scotty-completion` | App worktree on `task/scotty-recovered-20261124`, published to `task/scotty-finish-20261124` |
| `/workspace/scratch/3160e3ba3d24/bead-rs` and `/workspace/scratch/3160e3ba3d24/bead-me-up-scotty` | Parent clones for the registered worktrees |
| `/workspace/scratch/3160e3ba3d24/coordination/plan.json` and `manifest.json` | Reviewed continuation instructions and native manifest |
| `/workspace/scratch/3160e3ba3d24/coordination/results/scotty-launchers.log` and `scotty-adapter-editor.log` | Complete new cloud check output |
| `F:/Dev/.bead-edit-20261111/native-results-v3/windows-native-smoke-5f2c9c6a00f24f4b8e803c81df22f3c9.json` | Retained passing native receipt |
| `F:/Dev/.bead-edit-20261111/tray-results-v2/result.json` | Retained failed tray result and child-log references |

```sh
/workspace/scratch/3160e3ba3d24/tools/node_modules/.bin/riftri exec -- git -C /workspace/scratch/3160e3ba3d24/bead-rs worktree remove /workspace/library-files/beads-build-temporary-3160/worktrees/bead-completion
/workspace/scratch/3160e3ba3d24/tools/node_modules/.bin/riftri exec -- git -C /workspace/scratch/3160e3ba3d24/bead-me-up-scotty worktree remove /workspace/scratch/3160e3ba3d24/worktrees/scotty-completion
```

## 2026-11-25 continuation

This dated checkpoint records the resumed editing and tray assignment after
hosted qualification. Actual PC installation and tray checks were pending at
that time. The subsequent accepted PC outcomes are in the delivery section
above. The accepted revision 9 plan and its qualification results are retained on
[the immutable revision 9 record](https://github.com/YossiMH/bead-me-up-scotty/tree/717acefc5bf677c8d18dcf16b692117042bae4ae/20261125/revision-9).
Plan commit `e97773b478bd0b916eb40c5d09bc79368bfd7522` has 55 tasks and
91 blocking dependencies. Its SHA-256 is
`18130e44ab27047dcb397de53caa0a9006c56cfd478d417f884e42452ff62582`;
the corrected independent review is retained at
`f5bd44970f4cbf5d76204aac3183fb8fcf3f5ea4`, SHA-256
`e26b5812b03c37f6183ed3182c67133df78cd17d74fe0b336324df7c849dece7`.
Native state at that checkpoint remained revision 6 with 32 tasks and 51
dependencies. The guarded update was prepared directly from revision 6 to 9:
23 creates, 15 description updates and 40 dependencies in 78 manifest operations,
plus three separately guarded reopens. The actual November 27 materialization
subsequently accepted all 55 tasks and 91 edges in the 1,009-issue store, preserving
the original 954. Revisions 7 and 8 were never materialized. Use the returned
revision 9 mapping and freshly observed revisions for subsequent task writes.

### Qualified source and production files

| Item | Identity |
| --- | --- |
| App source used for the fresh build | `0309539797fd7d016e2b8fd8bdc0ae9cefc20219` on `task/scotty-finish-20261124` |
| App source tree | `84bb66cde1832ad8d30b63773efb77c952787b94` |
| Qualified native source | `2d801ba455b7a722daf644a7615445117d57e8e9`, tree `509d6222300b84b16041a8366a8b6ae4c28ccc98` |
| Required native Windows target | `x86_64-pc-windows-msvc`, release from an isolated Git archive |
| Final native executable | `bead-checkpoint-2d801ba455b7.exe`, 12,243,456 bytes; SHA-256 `0431a828bf95038641a0c55b4cf11c5800b52881940a13bd2f56b02f0b27177a`; installed basename `bead-0431a828bf95.exe` |
| Fresh Next build ID | `YIOHeRJTEdlOszyc4LyHr` |
| Runtime manifest SHA-256 | `612790bc18617630f9257ab2a901f8e12a0cd6dda6bf566c414e646e1745f1c7` |
| Runtime ZIP SHA-256 | `a4da62f8feadadd6a510eb2d1b0c1ab17d4a769c65e346664ba4885087b7a220` |
| Runtime inventory | 560 files; ZIP size 7,137,798 bytes; expanded size 27,426,391 bytes |

The qualified native source adds optional `issue_editing.issue_type_file: true` and
`update --issue-type-file`. Scotty uses that grant for large custom types while
retaining the 4 MiB UTF-8 field limit, revision guards, acquired claim credentials
and priority reasons. Older editing-capable binaries retain short type edits;
a type above 8 KiB requires the file option. The combined type, description and
notes determine when Scotty writes request-owned input files.

The fresh runtime was built from the app source in the table. Download-only
recovery run 45594231069 retained the complete runtime manifest, original build
result and all eleven source-file records without another build. They are at
`6017082394446acf42722e1c503cc4a1130d2dd8`,
`20261125/revision-8/results/runtime-manifest-recovery-45594231069`.
The independent complete-inventory acceptance is
`a10c6eed3ab6c167ded7a12a817430a816a9672f`,
`20261125/revision-9/results/app-runtime-inventory-review.json`.
The outer Actions archive is output 15003467178 from run 45573503400:
7,056,005 bytes with SHA-256
`15a503c45ded58ea48fcce7dd293b563d741a3424b64a39a6bd05edf5b1d409d`.
Verify this complete inventory again while staging and installing. The earlier
230-file runtime belongs to `fbb09312e43ec8094da6db04f126a16e8c5746f7`; installation must use
the fresh runtime with the changed adapters. Preserve the original runtime and
`bead-376537b7917f.exe` for rollback.

### Hosted qualification and delivery preparation

[Linux run 45573503400](https://github.com/YossiMH/bead-me-up-scotty/actions/runs/45573503400)
passed all 115 checks in the five selected adapter suites, lint, both Git diff
checks, the production build and TypeScript. No tests were skipped or cancelled,
and no edit-input directories remained. Node was 24.22.3 and npm was 11.19.1.
The existing notification lint warning, Node development-version warning, npm
dependency notices and two Turbopack tracing warnings are retained with their
actual successful command exits. The complete log and source/build results are
in `20261125/revision-7/results/type-app-checks-45573503400.json` and
`20261125/revision-7/results/type-app-checks.json`.

The earlier native release from `9ffefad6bb3b21ac1362f54df245af82ed85ec6e`
has SHA-256
`fb791327c7711af44771cac7dc311fb1697c66bce63726504dbec329eb6d1c0e`.
The initial producer retained it before a `dumpbin` lookup failure; continuation
run 45576002037 completed the build and separate download verification. Actual
Windows run 45577891890 then passed three staging, four attempt-receipt and two
tail checks. It exposed ordinary lock contention being treated as an error and
backslashes in canonical checkpoint paths. Three conformance cases failed and
the combined target reached its 900-second deadline during the characterization
grid. Later targets in that attempt did not execute. Retain its complete result
at `58f9df0925f4a9943687e9b35fc3f62fff7d084b`,
`20261125/revision-7/results/native-windows-execution-45577891890`.

The historical c90 source repaired those two functions. Its release SHA-256 is
`cdd3b50d65504c52a27a8fd29c6494fe3847d512cbca1510aa74a6cc5da87a06`,
12,214,272 bytes. The type-file interface and Scotty runtime stayed unchanged.
Windows producer
[45586900986](https://github.com/YossiMH/bead-me-up-scotty/actions/runs/45586900986)
and its separate full/small download verification passed. Full output
`15009252879` contains the source and eleven support/test executables. Small
output `15010535371` contains the release and its original metadata; its manifest
SHA-256 is `843117f8f9f22da5053d9731610fc729c1e4dc744358d6f91506e843713f5181`.
The metadata SHA-256 is
`ed74ccf87b21972261434f8c628dea12cfb958a577ba686658d24ae8123dc97a`.
Complete producer and download evidence is retained at
`780716d93a61776e8653cfd0b67656b9239094ee`,
`20261125/revision-8/results/native-windows-build-45586900986`.

The historical revision 8 Windows qualification packet at
`ddc93993a810e100bbbd62059cae92d3b6c78a56`,
`20261125/revision-8/native-windows-check`, splits core checks,
editing/recovery and all twelve characterization cells into bounded hosted jobs.
All helper algorithms remain identical to the accepted draft. Two final author
inspections and independent review
`b35847d5c2884434b4aa2300510a5a630c0e663c` accepted the exact measured bindings.
The backend execution owner ran that packet as 45590705550. Its two ordinary
Windows concurrency failures were in the operation lock: one verified-restore
case and one guarded-edit case returned raw OS 33. Both permanent assertions
remain unchanged. Full type-file and capability targets passed. The core and
grid output also exposed two 40 KiB inline notes fixtures exceeding Windows
command-line limits, and a test reading an exclusively held publication lock.

The complete failed editing output is retained at
`4241fb5712d0e5aed7caf5368645a31146714384`; core/grid output is at
`7f911115b3a5c884e71609d221e1e5b63d5a069f`,
`20261125/revision-8/results/native-windows-qualification-45590705550`.
The c90 Linux qualification run 45590105450 passed all 89 affected checks and
the full suite with 1,913 passing tests, zero failures and eight pre-existing
ignored cases. Those complete historical results are retained at
`ddcf96024cdd44b91f52480c6a7a2f8f7288278c`,
`20261125/revision-8/results/native-linux-qualification-45590105450`.

Revision 9 addresses both remaining fs2 contention predicates, after an actual
maintenance-lock Red. The fixture-only parent uses the existing notes stdin
transport for the same large bytes and handles the exact empty held lock through
metadata; it preserves the checkpoint assertions. The qualified source in the
table contains those fixture changes and the two bounded production changes.
Its Windows producer packet is
`975d21cca470dbca61a9221391b98eeebcba9d1d`. Actual producer run 45600413942
and its separate full/small download verification passed. The full output
15016870072 contains all twelve test/support executables and the separate
release. Its manifest SHA-256 is
`51735e621189c914cdbe88a0a9d36f49c43cd5eb215cec3530e987f2ecdfe0f6`.
The small release output 15014634952 is 4,524,263 bytes with ZIP SHA-256
`6bdb10496f976621d0b5545a8ef3b591a317e4a07d7e1f9276eb42d5fa09bba8`.
Its 665-byte manifest has SHA-256
`dbe3aa25b165991f1590526a6a4b2c3083e263be65132b9bed713d51282009cf`.
The adjacent original executable metadata is 2,058 bytes with SHA-256
`21ca90e29fc4588d23b31210cd5ffe6838c136ce70b76458b71370beeeff18f5`.
Complete original producer, download and artifact evidence is retained at
`66d679b5fd3d190025068ad47167352fa5a90669`,
`20261125/revision-9/results/native-windows-build-45600413942`;
independent producer acceptance is
`2cd5ba1a4209d507e76ed7d1bb0a45419fe50c40`.

The final Linux affected checks passed in run 45603324487: nine targets and
95 tests, including all eleven type-file and six maintenance cases, with no
ignored or filtered cases. Formatting, Clippy, source identity and owned-process
cleanup also passed. Independent affected-result acceptance is
`3859355a8f0969af0d69bae894629a6226d134fb`,
`20261125/revision-9/results/type-backend-checks-review.json`, SHA-256
`66f8c9b060745de0947cdd92eafbe74aef723fee7e9e56896b616da3589c1f05`.
The complete final Linux suite also passed: 1,913 tests, zero failures and eight
unchanged pre-existing ignored cases across 145 default harnesses and the
doctests. Its independent acceptance is
`6e70133a8e70e374e6b0b7e1931f8c829b113021`,
`20261125/revision-9/results/native-linux-qualification-review.json`.
Final Windows run 45603696205 passed 25 core and 73 editing checks, including
all twelve ordinary conformance cases. Its twelve characterization invocations
recorded ten GREEN and two caught RED results after deliberate out-of-band
deletion of eight live issue rows. One publication added 1,789,455 bytes against
a 262,144-byte budget; one split comparison found 392 records against 400.
Both findings remain RED characterizations while ordinary conformance passes.
The former Windows command-line launch failures are absent. The complete partition and
aggregate acceptance is `60df4701ad68eafcf34f3f614087c41e57fa44f8`,
`20261125/revision-9/results/native-windows-qualification-review.json`.

On each platform, four original-corpus restores and six complete record
comparisons preserved 954 issues, 11,264 events, five provenance receipts and
413 attempt outcomes. The 55-command native smoke had 54 successful commands
and one expected stale-revision refusal at exit 4. All owned jobs/process groups
were empty after cleanup. The retained native smoke helper's four explicitly truncated stdout captures
remain identified in the complete native review; no unavailable underlying
stdout is claimed. The separate ordinary readbacks, audit and capability/type
checks passed.

Final independent source and hosted qualification acceptance is
`7d30c840514d318a4588d979a90c20bcf07d8734`,
`20261125/revision-9/results/native-final-review.json`, SHA-256
`2534363abac195e6f8e2ef91077381ec816dd68448315831bff2fa65fe878676`.
It accepts the exact source in the table and both complete author inspections.
The shared native task branch `task/bead-finish-20261124` was advanced to the
exact accepted `2d801ba455b7a722daf644a7615445117d57e8e9`. Its author performed
an ordinary fast-forward from `515b503b24baf71737ff8fa6c879bd0752ef0fc6`,
and the final ref and tree were independently read back. This publishes the
native source branch; its receipt did not itself establish PC installation. The exact
expected-head/nonforce publication and readback receipt is
`031d03594d88430a3019189b088d5998f7785d85`,
`20261125/revision-9/results/native-source-integration.json`, SHA-256
`ce2befe64ecd894b21ed111f5ddf63609312465cd000f419f7e6bb627556463e`.

The final revision 9 Windows runner at
`07ea5205bd8d11d753ada8c29ba2b483c7c8de0b`,
`20261125/revision-9/native-windows-check`, adds the complete six-case
`redaction_transaction` target to the editing partition. The independent
algorithm acceptance is `8e1adec64c1d517b67c433b671b7c3663ad3df7e`.
Its final measured bindings and two complete author inspections were accepted
at `082a9855fe5bd417ba66ee02c1538d7f5d53e40e`,
`20261125/revision-9/results/native-windows-runner-review.json`.
The backend executor activated it once after absence reconciliation. Its final
actual run 45603696205 and complete independent review are recorded above.
All twelve ordinary conformance cases and twelve unique characterization cells
completed. Original results, complete retained partition streams, the aggregate
and observed owned-job cleanup are retained at
`52bfafd7d9ad108bc54e523b6c3f3dc6b4bdb638`,
`20261125/revision-9/results/native-windows-qualification-45603696205`.

The app's real native-store and production HTTP long-type packet is
`f6679cad66ab1d280edcead8a7dc1f609e304c95`,
`20261125/revision-9/type-windows`. It retains the accepted app source, runtime
and entire test helper and changes only the final native identities and revision
paths. Independent packet acceptance is
`de88c383b5a6dcf66fb6e33651835a186a4937ce`,
`20261125/revision-9/results/type-windows-packet-review.json`.
After the accepted final affected-check result, the app executor confirmed an
absent activation branch and zero prior attempts, then activated this exact
packet once on `task/type-windows-roundtrip-20261125`.
[Windows run 45606372926](https://github.com/YossiMH/bead-me-up-scotty/actions/runs/45606372926)
passed both prescribed checks on its first attempt. The native-store and real
production HTTP paths preserved exact 40,000-character / 50,000-byte Unicode
types, claim ownership and priority audit data. The HTTP path made one PATCH,
advanced revision 2 to 3, retained claim epoch 1 and verified exact API/native
query text. Both fixtures retained unrelated files and complete checkpoint
references. The server exited, its loopback port was released and no request
input directory remained. All three commands exited zero within their bounds;
the existing Node/npm/action warnings remain in the complete output.

The complete 23-file result packet is retained at
`7109ae83d13585513bb46aef9009f24308dfe01a`. Its actual output directory is
`20261125/revision-9/results/type-windows-roundtrip-45606372926`, including
the full original job log and seventeen decoded text records.
The result and two complete author inspections are in
`20261125/revision-9/results/type-windows-roundtrip.json`, SHA-256
`3d7621aaae00d5ba0a141ef873ba431656a6ed5066b223c090a3950ed7c78894`.
The independent actual Windows acceptance is
`76a04b979a372b51bcb0d0bbffa52f4105b1a541`,
`20261125/revision-9/results/type-windows-roundtrip-review.json`, SHA-256
`856b14675fd669e5c30290ab8e1eca1e63cc55d9c73b34990ca5ab7cd9bb3b2b`.
Final independent app source/runtime and hosted integration acceptance is
`46785d535d046f044d6dc3c65487da6f3076953c`,
`20261125/revision-9/results/type-app-review.json`, SHA-256
`5586e296a78ddb91c5849cd591813196b6fd8ecb11ac6d49dcc042ae4638657e`.
It accepts the exact app source and fresh runtime in the table, the Linux checks,
the final native contract and actual Windows integration. The PC outcomes and
native task history remain separate required gates.

Earlier accepted results remain recorded for their original source identities:
the browser run 45517446104 at app `38c21a77b4e875d75e17ee68683846601df33591`
and native `539cdd0b4c54665c2db01da08fdf9f3871f7148a` covered 38 CLI commands,
37 HTTP calls and three browser flows. Hosted Windows tray run 45552507526 at
app `5232c8b94804064ab71af571ee28797667bd72bd` passed the real Forms helper's
STOP and parent-loss checks; 39 Linux launcher checks also passed. The three
adapter changes preserve the UI components and tray modules exercised there.

The installer and task-history preparation at
`17c3d498cf9d9970dfa157700216481428448a51` passed hosted Windows parsing,
embedded declaration compilation, nine installer refusal cases and eight
history-mapping cases in run 45577402715. The full result is retained at
`8d6d4a1c77b073b2573ee1dc2a29dd297a45d712`,
`20261125/revision-7/results/type-binding-checks-45577402715.json`; the author
status at `289263f1a91e455fd49bad602984ce918a9f2303` records the remaining
inputs. These earlier checks made no native task changes and did not run the
installer. The revision 8 preparation is
`98a2daa3ef411c0f986daee1794c130f025c49cd`, retained with its ancestry at
`8429932267eec426d67c1aa19dd4ffbfdc3e3cb2` under
`20261125/revision-8/install-binding`. It prepares the direct revision 6-to-8
update: 20 creates, 15 description updates and 35 dependencies in 70 manifest
operations. That 52-task/86-dependency mapping was never written to the PC.

The revision 8 helper checks subsequently passed in
[45586305325](https://github.com/YossiMH/bead-me-up-scotty/actions/runs/45586305325):
four PowerShell parses, two Node parses, two JSON reads, four embedded declaration
compilations, nine installer refusal cases and eight history-graph cases.
Complete outputs are at `1de67bc68c0011c2a39549df653d3df1a5355c44`,
`20261125/revision-8/results/type-binding-checks-45586305325.json`.
Final author status is retained at `f58f0edb02ca8e7614e04757672bf16790cf5598`;
the checks-only independent acceptance is
`b6bd9f060fedba0b180850b377a0494b49cb6227`,
`20261125/revision-8/results/type-install-binding-review.json`.
The revision 9 helper candidate `9e1adece7ff896ce1d6bfdbceed049421bda96af`
then passed the same complete parsing/declaration and nine installer/eight
history refusal checks in run 45596905174. Its actual result is
`b7dd3bfa6a09cab9e29b136303fce4e7a7309396`,
`20261125/revision-9/results/type-binding-checks-45596905174.json`.
Independent checks-only acceptance is
`3f62a2acf1e826a0202cf95bf1c0ae5a5a7384bf`,
`20261125/revision-9/results/type-binding-checks-review.json`.
These hosted checks preceded the actual 55-task/91-edge materialization recorded
in the November 27 delivery section.

The final fresh archive staging candidate is
`83a648b7cda046c9bcc47e3b79f908933499b866`,
`20261125/revision-9/artifact-stage`. It preserves the existing installer's
input contract and uses the recovered runtime with a new task-owned stage.
Hosted run 45604565295 passed all forty checks, including a complete verified
copy of the actual 560-file runtime and synthetic archive refusal cases. The
measured copied inventory contains exactly 27,426,391 bytes and has SHA-256
`6741bc56b4d8934edea7578d6d4ce54457c8bd2764d49bb515c3e89411949de2`.
The complete original job log, result, all 39 retained inventory parts and output
metadata are at `30ed1c2f7b44b307b023f62a76ad90aabe51e197`,
`20261125/revision-9/results/artifact-stage-checks-45604565295.json`.
Two final clean author inspections are retained at
`28749c89c3e6bf83cc224c26a3420693ede36e74`,
`20261125/revision-9/results/artifact-stage-author.json`.
Independent final source and actual staging-check acceptance is
`5715e8053dc33a299f89cbe4d048994d57c1e8f2`,
`20261125/revision-9/results/artifact-stage-review.json`, SHA-256
`ada3fe4533abafac60fc503bb8ef32cd4479a606781c1ce40e5e1ff853407633`.
The concrete measured binding and archive request are prepared at
`70819afe79e783d0db2b10a299155cbeda470d1e`,
`20261125/revision-9/final-installation`. The request SHA-256 is
`9908164d28852fdb0bdfc8fd33c0f0632620b7adbbfbb031f67d1bea8ffd67b9`;
`binding.json` has SHA-256
`4edf53508c5ffe296a78cb3e8d9b6e3c5aa5c9922fcfa46f5501dc211c19ba41`.
Only the 7,056,005-byte app archive and 4,524,263-byte native release archive
are needed on the PC, totaling 11,580,268 bytes. Their reserved local download,
stage and installation paths are recorded in that packet; existence/absence
must be observed before use. The fresh preservation manifest copy is planned at
`F:\Dev\.bead-edit-20261111\final-installation-v9-20261125-1151\pc-preservation-raw.json`,
with SHA-256 `70d934585d06c76787e5293a93f7960d6594e869cd719bf0f62ad46a532fa362`
and 5,232 bytes. Its original copies stay preserved. The exact four-file binding
is independently accepted at `289636cbaabf4410cf787f5bef5d44fe6a88ca9c`,
`20261125/revision-9/results/final-installation-binding-review.json`, SHA-256
`9d427fdae7f05e8ca873031630852e26a8e67f0fe859c03e101522c81dc116aa`.
Archive transfer/copy, observed ports and the actual native mapping were pending
at that checkpoint; their later accepted results are in the delivery section.
Three earlier failed attempts remain retained with
their exact results: the first exposed one archive-name expression in the helper;
the following two exposed PowerShell fixture variable scope collisions. All
forty check assertions were preserved. No additional hosted helper checks are
needed.
The previously applied 523 tray stage and the later successful final stage are
single recorded attempts. Retain their results and observe path state before
any further delivery operation.

At this November 25 checkpoint, actual tray Exit/restart, installation in both
requested repositories and the configured default launch were still required.
The November 27 delivery section records the subsequent tray, installation
and configured-launch acceptance. The original 15 raw app files,
indexes, private task data, configuration, previous native pin and runtime are
retained through that delivery.

PC execution stays with the root coordinator and uses the exact independently
reviewed inputs. Compilation and browser qualification stay in the cloud.
Copy-only archive staging requires at least 1 GiB free physical RAM before
and during work, hidden BelowNormal execution, at most 512 MiB aggregate owned
RSS and a 180-second total deadline with cleanup reserve. Partial attempts
remain retained for reconciliation before a new attempt is considered.
Application checks require fresh 3 GiB headroom, a 1 GiB live free-memory floor,
128 MiB Node heaps and at most 512 MiB aggregate resident memory for their owned
processes. Their deadline and ownership checks govern cleanup. Current exact
helper identities and accepted outcomes are recorded in the delivery section.

### Historical worktree recovery

Local execution became unavailable after this source and test work had been
published. The following table records the last known November 25 inventory.
Use it to locate retained work, then establish which registrations still exist.
Inspect current registrations and Git status, preserve unpublished or uncommitted
work, and reconcile remote commits before any removal:

| Worktree | Last known branch or state |
| --- | --- |
| `/tmp/beads-55c9/app-type-edit` | `task/type-file-20261125`; local tests commit `63e21e1e2911b36d23dbfcb51749f60484f7f432` has the same tree as published tests `3d3b0f3850e359bfb8d320d530f132a7e0d67469`; later app changes were published through GitHub |
| `/tmp/beads-55c9/coordination-type-edit` | `task/coordination-type-20261125`; last reconciled clean commit `907e1a6ebb3b9ce4d0f9936fb7adee7f3c913b9a`, retained in transfer commit `41d5b7ab2728ef00630ceff0c6f2126f1608329e` |
| `/tmp/beads-55c9/backend-type-edit` | Companion native worktree; reconcile its author's current files and published native commits before cleanup |

The recorded parent clones were `/tmp/beads-55c9/bead-me-up-scotty` and
`/tmp/beads-55c9/bead-rs`. The then-installed Riftri 0.7.0 at
`/tmp/beads-55c9/tools/node_modules/.bin/riftri` manages these ordinary linked
worktrees through its accepted command passthrough. From an accessible
environment, remove only clean worktrees whose complete work is retained:

```sh
/tmp/beads-55c9/tools/node_modules/.bin/riftri exec -- git -C /tmp/beads-55c9/bead-me-up-scotty worktree remove /tmp/beads-55c9/app-type-edit
/tmp/beads-55c9/tools/node_modules/.bin/riftri exec -- git -C /tmp/beads-55c9/bead-me-up-scotty worktree remove /tmp/beads-55c9/coordination-type-edit
/tmp/beads-55c9/tools/node_modules/.bin/riftri exec -- git -C /tmp/beads-55c9/bead-rs worktree remove /tmp/beads-55c9/backend-type-edit
```

Use no force option. If a directory is absent, inspect Git and Riftri records
before changing stale registrations. Remove only the task's temporary workflow
branches after their outputs are retained; preserve shared transfer branches,
other agents' work, private data and rollback copies. The later revision 7
helper `17c3d498cf9d9970dfa157700216481428448a51` and revision 8 helper
`98a2daa3ef411c0f986daee1794c130f025c49cd` were never materialized in the
coordination worktree. The November 27 delivery section identifies the accepted
revision 9 route and original-history preparation.
After root independently checked its exact ordered parents and zero-file diff,
transfer commit `02a22aeb7692ea8d6dc72c78f3f0f2fe45036c43` retained the final
staging, native Windows runner, app Windows runner, native Linux consumer,
runtime recovery, app Linux checks and maintenance-Red packet ancestry. Its first
parent is `90011ce652c09f61efd6ba4ca51e5c4329869574`; both commits have the
same tree, `464eed69a0ec94b198d97bbfdd1b6bda8ff83db0`. The expected-head
update succeeded with no force and was read back. The native Linux consumer
already contains final producers `b9ae02da940d7891f8b976e0403d3c408eb6ebe7`
and `975d21cca470dbca61a9221391b98eeebcba9d1d`; binding commit
`9e1adece7ff896ce1d6bfdbceed049421bda96af` was already retained. This archival
merge changed no file content and removed no branch. It preserves the final
packet commits even after their task-owned branch aliases are later removed.

Additional preparation branches are `task/windows-check-runner-v8-20261125`,
`task/windows-check-runner-v9-20261125`,
`task/type-windows-packet-v8-20261125`,
`task/type-windows-packet-v9-20261125`,
`task/runtime-manifest-packet-20261125` and
`task/artifact-stage-packet-20261125`. Reconcile their newest refs and dedicated
activation branches, retain accepted source ancestry and complete results, then
remove only the task-owned branches. Later remote helper, producer, runner and
review commits were not materialized in the inaccessible local worktrees.
