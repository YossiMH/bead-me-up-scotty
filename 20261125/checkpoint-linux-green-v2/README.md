# Linux checkpoint qualification: compilation and release

This packet implements native task beadrs-9c6d0088 using exact formatted source515b503b24baf71737ff8fa6c879bd0752ef0fc6, treeb7c196bb6b337bdc7503e28d3a600e860fa3b799. Its direct parent is repaircee3220b5e4b9a414c50379273c84759db645dbf, whose direct parent is accepted Red sourcea42d7dad5c3e2b31336c12c7c0f69a83db9a53b8. Root owns native task state. Actual build outputs are prerequisites for the separate complete-suite and release-corpus checks.

## Reviewed inputs

- checkpoint-linux-build-20261125.py SHA-256 94c4a9012f35326234cd0eb613017b22018f0679be2d4f53fce08c9f1d4af6ad
- checkpoint-build-support.py SHA-256 db9b710e0b181a348d3a84602d37c1e4bad2f373a46940d0d40863c93b0081f0, unchanged from the successful corrected Red compiler helper. Only its utility definitions are imported.
- build-inputs.json SHA-256 50af921e6fff03182d2a0c85663c4350150b12e0ffef046e922fa9540ba24bf8
- checkpoint-linux-build.workflow.yml SHA-256 4abffedf89a271dc353adf8a77f622d525851ae56e7d323fffcecc38ea95c9bd

The five complete file pins match the accepted candidate. The helper requires a clean exact checkout, the exact formatted-to-repair-to-tests ancestry, exactly two source/spec changes in the repair, exactly three formatting-only test changes and exactly five cumulative changes from986. It reads the entire Git file map, safely extracts Git archive bytes into owned scratch and verifies every archived Git blob.

## Build order and bounds

The actual repair diff check is git diff --check a42d7dad5c3e2b31336c12c7c0f69a83db9a53b8 515b503b24baf71737ff8fa6c879bd0752ef0fc6 --. Its exact command, exit and raw-stream hashes are written to repair-whitespace.json and emitted immediately, before any Cargo command. The cumulative baseline check follows. A successful cargo fmt also writes and immediately emits format-check.json before Clippy, supplying the final formatted producer's required preflight result.

The hosted runner is ordinary ubuntu-24.04 with a read-only token and Rust/Cargo1.100.0. Required rustfmt and Clippy components are installed into that hosted toolchain. Inherited Bead/Git/Cargo/Rust selectors are cleared. All compiler commands use one Cargo build job, owned target/tmp paths and these recorded settings:

    CARGO_PROFILE_DEV_DEBUG=0
    CARGO_PROFILE_TEST_DEBUG=0
    CARGO_INCREMENTAL=0

The commands, in order, are:

    cargo fmt --all -- --check
    cargo clippy --locked --all-targets -- -D warnings
    cargo metadata --locked --no-deps --format-version 1
    cargo test --locked --no-run --message-format=json

The emitted Cargo executable records are authoritative. The mapping requires every default lib/bin/integration test target reported by Cargo metadata; it does not infer harness locations from the old debug/deps layout. The ordinary debug/bead executable is retained for assert_cmd's explicit CARGO_BIN_EXE_bead binding in later test execution.

The pinned release uses unchanged bash scripts/build-from-archive.sh with the exact commit, x86_64-unknown-linux-gnu, the measured seven-character source name and an owned output. The script performs a second immutable extraction and default release build, executes --version on its host target, and emits its standard adjacent metadata. The wrapper verifies that metadata, the release hash/size and a second --version output.

The build phase has a1,800-second outer limit, with1,790 seconds for work and bounded owned process-group cleanup. The workflow allows40 minutes including installation and artifact retention. The build never executes Rust test harnesses. One release --version verification is part of the required archive-build contract.

## Retained outputs and next tasks

Successful build-result.json records exact source/archive/toolchain/profiles, the full executable mapping, release metadata, every command and cleanup result. Successful result.json separately binds the complete qualification-bundle.tar.gz and build-result hash. Both must pass; a successful compiler command alone is insufficient.

The bundle includes the immutable source tar, all extracted source hashes/modes/mtime_ns, the complete target directory and its hashes/modes/mtime_ns, logs, inputs and release bytes. Full-suite execution recreates the exact original absolute source/target paths and restores those mtimes before Cargo runs, keeping compile-time CARGO_BIN_EXE paths valid. Any additional Cargo work remains confined to those owned paths and one job.

A smaller release artifact includes the exact release/metadata, both build receipts and only the original public pointer plus its selected8.6MB object. It is sufficient for the separately reviewed portable corpus verifier. It does not copy the unselected409MiB checkpoint history into each fixture.

The separate full-suite task beadrs-0890de3c must run cargo test --locked --no-fail-fast -- --test-threads=1 within90 minutes with the same profiles/toolchain, retaining every target summary, actual test names, ignored tests and zero-failure acceptance. It supplies the existing affected-target coverage without duplicate complete-target runs in the release-corpus task beadrs-50ff08d3. That task checks the qualified release against the original954/11264/5/413 corpus in four fresh restores. Neither follow-up is claimed complete by this compile-only packet.

All result metadata and complete raw logs are retained for at least seven days. Text streams up to256KiB are also emitted as filename/byte-count/SHA-256/Base64 records, enabling independent review without another test execution. Large compiler JSON remains an exact retained artifact with its hash; checkpoint record bodies are not printed.

## Publication and cleanup

This YAML is initially a scratch proposal. After independent acceptance, add its exact blob under .github/workflows/checkpoint-linux-build-20261125.yml on a fresh task/checkpoint-linux-build-20261125-v2 branch, using an ordinary descendant commit. Verify the one-file activation delta and actual run/head identities. Failed attempts remain retained; diagnose before a new invocation.

Root or a future agent must retain the successful reports/artifacts, reconcile uncertain operations and remove owned temporary qualification branches and clean Riftri worktrees after delivery. Never force-delete changed user work or move main during qualification.

## Preserved first build and formatting correction

Run45540821169 at workflow36a86233907052b4e22f49f5ab570a4f0dacf5c6 remains failed. Its parent diff check passed (receiptc8f7af7a0a01306524d4f30c62cce558e51b9dede1b85cbfd222270a95e99d1e); cargo fmt then exited1, with no Clippy, test compilation, release or test execution. All owned process groups finished empty. The exact failed receipts and complete formatter output remain in20261125/checkpoint-format-only.

The six formatter hunks were independently accepted at review58b141abde4fec0bf519d3d8628ced94d6e2fd3d35bfd3f6058c7fd2c95b665a. Five change whitespace; one additionally inserts an optional trailing comma in a method argument. Every assertion, fixture, test name and production/spec byte is unchanged semantically. The formatted descendant was published normally and all five candidate files read back. Accepted Red evidence remains tied to its actuala42 source; no Red rerun is required solely for formatting.
