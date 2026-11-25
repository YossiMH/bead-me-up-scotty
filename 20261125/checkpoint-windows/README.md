# Hosted Windows checkpoint qualification

This packet prepares the separately authorized Windows build and Windows checks for native tasks beadrs-70721b6a and beadrs-cd3f5a63. Root owns workflow activation, task-state mutations, PC staging and final installation. These files contain no PC operations.

## Exact source

The qualified source candidate is YossiMH/bead-rs commit 515b503b24baf71737ff8fa6c879bd0752ef0fc6, tree b7c196bb6b337bdc7503e28d3a600e860fa3b799. Its reviewed linear ancestry is:

- 515b503b24baf71737ff8fa6c879bd0752ef0fc6: the exact six rustfmt layout corrections in three integration tests.
- cee3220b5e4b9a414c50379273c84759db645dbf: the reviewed two checkpoint repairs and specification change.
- a42d7dad5c3e2b31336c12c7c0f69a83db9a53b8: the reviewed tests-only source that exposed all six intended failures.
- 986f2a332aca9dd567eee41ce835917d56e29468: the preserved production baseline.

The build input binds all four commits, the final tree and the five exact cumulative changed-file hashes. Every parent edge, the cumulative five-file allowlist, Git whitespace validation and every archived Git blob are checked before test compilation. Source extraction is a literal Git archive with no .git and no ancestor Git workspace.

The previous cee3220b Linux preflight stopped at cargo fmt. It did not compile or execute product tests. This Windows packet binds the independently reviewed formatting descendant. No assertion or fixture was changed by that formatting correction.

## Build phase

The build workflow uses windows-2025, a 45-minute job deadline and one Cargo compiler job. It fetches four source commits. Rust/Cargo 1.100.0 is installed and verified under the owned Job; Git Bash, its Python3 command, native Python and Visual C++ are recorded.

The exact unchanged scripts/build-from-archive.sh has SHA-256 f51d6073336edf3f6f06834f28232f540aa9f268ea87de0918fd53808c9c5143. It runs first with the exact source commit, x86_64-pc-windows-msvc, a commit-derived executable name and fresh owned release/scratch directories. The script's built-in host --version check remains part of the build and is recorded as executed. Its metadata, source commit, target, default features, profile, binary hash/size, PE AMD64 header and dependency output are checked.

A separate archive of the same commit then runs:

    cargo test --locked --no-run --lib --test attempt_receipt_checkpoint_integrity --test checkpoint_tail_generation_integrity --test checkpoint_set_v2_conformance --test attempt_outcome_round_trip --test r036_verified_restore --target x86_64-pc-windows-msvc --message-format=json

The compile phase executes no tests. Cargo's actual executable records must identify the six expected Windows harnesses and target/debug/bead.exe beneath the selected target triple. All seven debug outputs must be unique AMD64 PE32+ files belonging to the exact archived Cargo.toml. Cargo 1.100's versioned build-unit layout is validated. The release is the eighth retained executable.

The full source tree is retained. Its known tracked content is roughly 465 MiB, mostly public historical checkpoints, so the archive bound is 1 GiB. This is hosted-runner work. Source Git mode, original archive mode and Windows stat mode are recorded separately. No symlink, reparse point, Windows device component or case-aliased file is accepted. The bundle's uncompressed bound is 3 GiB.

The Python phase has a 2400-second work deadline; the outer supervisor allows 2520 seconds, within the 45-minute workflow job. If the unchanged MSVC archive route fails, retain that exact failure. The accepted plan's separate Linux GNU fallback still needs a concrete reviewed invocation and actual Windows qualification. This packet does not silently switch targets or select a PC pin.

## Owned process lifecycle

The supervisor uses the unchanged windows-task-job.ps1 from transfer commit 6d40aacb49eba309f1f925e106cfbb9026cce744, SHA-256 2758a6ff94c0eecdfa360363469069dfa8470efc1f91228812146919a978921f. That helper creates the sole new Job and assigns the PowerShell supervisor before Python or product commands start. Its handle is non-inheritable and has Kill-on-close enabled.

The additional Python/C# APIs only query the immediate Job's process list. Each command begins and ends with exactly the supervisor and Python helper present. A timeout, unknown exit or remaining descendant aborts the phase; only its direct live process handle is killed, then the outer supervisor exits and its Job reclaims descendants.

After Python exits, the supervisor requires zero child members in its Job and records its PID and creation time. The outer driver observes that same supervisor exiting, checks its successful quiescence receipt, and records that the Job became empty when its sole remaining member and handle owner exited. The driver never terminates unrelated processes.

Ordinary PowerShell 5.1 parsing is recorded before execution. Python py_compile runs under the Job. Preparation here was static because the cloud execution environment was unavailable; no runtime parser/build/test pass is claimed by the author.

## Separate check phase

The check input template remains deliberately incomplete until the Windows build is accepted. Bind the producing repository/run/attempt/workflow commit, exact artifact ID, outer/build/supervisor/completion receipt hashes and bundle hash/size. Add the measured release and metadata pins to corpus-inputs.json. Update packet.json's check input binding and file hashes, then independently review the filled input and workflow before activation.

The pinned official download-artifact action selects one exact artifact ID from one exact run. merge-multiple:true places its files at the stated directory. The helper verifies all accepted receipts and bundle bytes before extraction. It recreates the original absolute build root, source and target paths under RUNNER_TEMP, refusing any existing destination. That preserves compiled-in manifest and test executable paths. CARGO_BIN_EXE_bead is explicitly set to the verified retained debug bead after inherited selectors are cleared.

All six required harnesses run serially with one test thread. Each target's list and execution share a 900-second total budget. The checker compares complete actual test listings and libtest counts, requires all expected new regressions, and refuses ignored or filtered integration cases. The current source contains 43 required tests across these selected targets; the library selection contains only its three staging regressions. Ordinary 101 failures are retained while the remaining independent harnesses are collected; timeout/setup/residue failures stop the phase.

The exact release then runs the independently accepted shared corpus verifier, SHA-256 653ff9f382ca0dd069bf326106c0c088e4db576dc48ef0ee8274ddac39e82e52. It verifies four public restores, current/previous generation preservation, unchanged configuration, one isolated create and all original 954 issues, 11,264 events, five receipts and 413 outcomes. The original pointer/root and all six comparison results are checked. Manifest-root and imported-record hashes remain distinct. The shared verifier's own 900-second phase/120-second native-call limits remain intact.

The final component fetches the unchanged windows-native-smoke.ps1 from a532a268df26cb719bf0411a9c36668e0c9f0b04, SHA-256 2a29faa7df3e9c04dd7543a5f8fd54552dd34c83248c1eda0d427e8f1a215a0b, and runs it through ordinary powershell.exe -NoLogo -NoProfile -NonInteractive -File. All 55 command expectations, its 20-second native-child limits and owned-fixture cleanup must pass. Full source, helper and executable identities are checked again afterward.

The check helper allows 8400 seconds and the outer supervisor 8460 seconds; the workflow cap is 150 minutes. The broader cap accommodates six separately bounded targets, corpus verification, smoke and artifact retention. It does not permit a target to exceed 900 seconds.

## Retained output and acceptance

The build artifact contains windows-build-bundle.tar.gz, result.json, build-result.json, supervisor-result.json, supervisor-completion.json and logs. The bundle includes the exact source.tar, full source-files.json, inputs, command records, release/metadata and all seven debug executables. Receipt hashes are external to the bundle to avoid circularity.

A successful build requires all four receipts to pass, the same exact source and helper pins throughout, all seven debug PE records, the release metadata and the successful supervisor completion. A successful check additionally requires six passed test targets, the complete corpus result, 55 smoke commands, unchanged inputs/source/executables and its own successful outer completion. Root records the resulting actual release SHA only after those checks and repair review pass.

Artifacts are retained for at least seven days, including failed results. All newly supervised command stdout/stderr bytes are retained exactly; the unchanged smoke keeps its existing per-command log format. The checked release and metadata are copied into release-under-test before the first test runs, so failed checks retain those exact bytes as well. Small receipt bytes are emitted as Base64 plus SHA-256. Each retained stdout/stderr/log of at most 256 KiB is also emitted with its root, filename, size, exact Base64 and SHA-256. Larger streams remain in the artifact with their hash/size. The driver copies only known result/log/release/evidence directories, validates copied bytes and rejects reparse traversal. Corpus fixture SQLite workspaces are excluded from upload.

No workflow is activated merely by publishing this packet beneath 20261125/checkpoint-windows. The build workflow is a fully bound proposal outside .github/workflows; the check workflow is a template. Root retains activation authority.

## Recovery and cleanup

Use a new GitHub run attempt and fresh owned directories after diagnosing a failed run. Never reuse a partially restored build root or treat setup errors as passed tests. Preserve actual failed receipts and streams before the next attempt.

After final evidence is retained and delivery is accepted, root removes only the task-owned temporary workflow branches and fully published clean worktrees through the selected Riftri workflow. Expected Windows activation branches are task/checkpoint-windows-build-20261125 and task/checkpoint-windows-check-20261125; only remove branches that were actually created for this task and whose current identity is reconciled.

If this process dies early, future agents must complete those worktree/temporary-branch cleanups after preserving unpublished work and final results. Do not force-delete user changes, remove the original data backups, or replay an uncertain canonical operation.

## Measured startup correction, revision 2

The first hosted build run45543077351 failed before compilation. The separate startup-only run45544207610 showed that ordinary PowerShell returned both the hosted Python3.12.10 and WindowsApps alias from Get-Command python.exe. Casting both Source values to a string produced an invalid two-drive path. Revision2 selects the first ApplicationInfo before the unchanged path, reparse, executable hash and supported-version checks. The sole supervisor source change is this two-line selection. Its SHA-256 is 74980acb2113be7b21c75a85a075b763b89ffceca6516cd3df814a6686cb94c5; packet SHA-256 is 10db15ed6732c9c8761e06ca164baf1599cefa426f89e5282fdb128c7efc34d7. The initial helper/static checks above remain historical and the new author-audits-v2.json binds this correction.

The build helper, check helper, driver, exact515 source, build input, Rust flags, MSVC-first archive route, test list and process bounds are unchanged. A fresh task/checkpoint-windows-build-20261125-v2 branch will run the corrected workflow only after independent review. Root/future agents must clean that active branch and task/checkpoint-windows-packet-20261125-v2 alongside the earlier Windows proposal/build/startup branches after retaining the results. No uncertain or failed attempt is replayed.
