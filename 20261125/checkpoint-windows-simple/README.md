# Windows native build packet

This packet builds the final native editing release and affected test executables on a disposable GitHub-hosted Windows runner. The user PC is outside this build path.

## Source and commands

The frozen input identifies the exact bead-rs commit and tree. The checkout must be clean, and the original scripts/build-from-archive.sh must have SHA-256 f51d6073336edf3f6f06834f28232f540aa9f268ea87de0918fd53808c9c5143.

The archive script runs unchanged with the selected commit, x86_64-pc-windows-msvc, a commit-derived executable name and fresh output directory. The resulting metadata remains unchanged. Rust 1.100.0 and one Cargo compiler job are selected. The installed Visual C++ x64 environment supplies an explicit Microsoft linker path because Git Bash also supplies an unrelated link.exe.

A separate git archive of the same commit supplies the test source. Every extracted file is checked against its Git blob and recorded with SHA-256. cargo fmt --check runs there, followed by cargo test --locked --no-run --lib and the test targets in build-inputs.json. Cargo's JSON output identifies each actual Windows executable; the packet validates its package, target directory and AMD64 PE32+ header.

The build command has a 40-minute work deadline inside a 45-minute workflow job. Ordinary Actions runner teardown owns descendant cleanup. The build does not impose the PC process limits or the earlier bespoke compiler Job membership assertion on the disposable hosted VM.

## Retained output

The artifact includes the release, original metadata and archive script, source.tar, source-files.json, build-inputs.json, raw command logs, Cargo JSON output, build-result.json and the compiled Windows executables. Release output is retained as soon as it is created, even if a later command fails.

build-result.json records the original source_root, target_root and each executable's compiled_path. A subsequent Windows execution job can recreate those paths from the retained archive and executable bytes, preserving CARGO_MANIFEST_DIR and CARGO_BIN_EXE references embedded by Rust. The build compiles test harnesses without executing them; archive-script --version verification is recorded in the original release metadata.

artifact-manifest.json records every retained file's length and SHA-256. A separate job downloads the producing job's exact artifact ID, checks the manifest against the producing job's SHA-256 output, and verifies every downloaded file. Both artifacts are retained for 14 days.

## Earlier failure

Run 45552623126 built the unchanged archive release successfully for source 515b503b24baf71737ff8fa6c879bd0752ef0fc6. The script exited 0 and printed release SHA-256 0205d054ab256202da0bb3bea5bc151c68113bbbda5733352a1c6c1988be222d. Its wrapper then failed on remaining owned child PID 7944 before test compilation or release retention. The retained receipt does not identify that process. prior-v5-failure.json preserves the actual failed receipts and artifact identity. The final build must produce its own retained and checked bytes.

## Cleanup

After final outputs and review evidence are retained, remove the task/checkpoint-windows-simple-packet-20261125 and task/checkpoint-windows-final-20261125 temporary branches along with the earlier task-owned build/proposal branches recorded in the parent handoff. If this session ends early, the next agent must reconcile any running workflow before cleanup or retry. This packet creates no PC worktree; hosted runner temporary files are discarded with the runner.
