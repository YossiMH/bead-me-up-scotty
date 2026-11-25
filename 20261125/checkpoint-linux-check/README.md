# Separate Linux execution after the accepted build

This prepared packet supplies task beadrs-0890de3c (the complete default Cargo suite) and beadrs-50ff08d3 (original-corpus release recovery). It uses the exact formatted source515b503b24baf71737ff8fa6c879bd0752ef0fc6/treeb7c196bb6b337bdc7503e28d3a600e860fa3b799. Root owns native task mutations.

The workflow template has two independent ordinary ubuntu-24.04 jobs, so full-suite execution and public recovery can run concurrently in separate hosted processes/fixtures after the same build is accepted. It has read-only contents/actions permissions and no deployment, secrets, user-PC access or main update.

## Pending actual bindings

The helper and execution design are complete. Actual successful build run/head, both build receipt hashes, complete bundle hash/size, and full/release artifact IDs must be filled from the accepted build. The null fields in full-suite-inputs.template.json and __TOKEN__ values in checkpoint-linux-check.workflow.template.yml are deliberately unusable.

The corpus input comes from the separately accepted portable verifier template, with the exact qualified release hash/size and adjacent metadata hash. Derive these from the successful build receipt and independently reconcile the release metadata. Never substitute a rebuilt or older native pin. The final binding, all input SHA values and rendered YAML require review before activation.

## Complete default suite

checkpoint-full-suite-20261125.py SHA-256b18148b8365a2c66bc57af736bac4ba1d7f3079ff5c5691f7154986da328963c imports the exact accepted Green helper94c4a9012f35326234cd0eb613017b22018f0679be2d4f53fce08c9f1d4af6ad and unchanged supportdb9b710e0b181a348d3a84602d37c1e4bad2f373a46940d0d40863c93b0081f0.

It verifies both successful build receipts, source/tree/toolchain/profiles, every predecessor command/cleanup result and the complete bundle hash. It recreates the original absolute build root under RUNNER_TEMP, safely extracts the exact bundle, verifies its complete member list, rehashes every source/target file and restores recorded modes/mtime_ns. It reparses the retained Cargo JSON against metadata and hashes every mapped executable before execution. The original build root must be absent; an interrupted invocation is never reused.

The exact command is:

    cargo test --locked --no-fail-fast -- --test-threads=1

CARGO_BUILD_JOBS remains1, and the compiling Rust/Cargo1.100.0 and recorded debug-zero/incremental-zero settings remain identical. CARGO_BIN_EXE_bead points to the verified ordinary debug/bead path so assert_cmd2.2.2 works with Cargo's current harness layout. Any additional Cargo compilation stays inside the restored owned target. The helper records before/after executable hashes and identifies any recompiled binaries; it does not mislabel changed bytes as the original compilation.

The entire helper has a5,400-second deadline, including extraction and verification. Native execution uses the reviewed owned process-group runner, with bounded termination/kill cleanup. The workflow permits setup and artifact retention around the separately bounded test phase.

Acceptance requires Cargo exit0, all expected default harnesses present exactly once in Cargo's execution lines, every complete unfiltered target result successful, zero failed/measured/filtered tests, complete passed/ignored name accounting, and all six new regression names passing. Existing ignored tests remain separately listed. Library doctests are required; each emitted Rust2024 doctest group must have a complete success summary. Rust's documented compatible/standalone doctest grouping is accounted for: https://doc.rust-lang.org/edition-guide/rust-2024/rustdoc-doctests.html .

Complete per-target names/results are retained in complete-target-results.json. result.json keeps the counts, ignored names, exact detail-file digest and all execution identities. executables-before.json and executables-after.json preserve the complete binary maps. Full source content/modes are rechecked after execution. A test failure, missing target, parser mismatch or cleanup failure leaves the result failed with complete streams available for diagnosis; no target is skipped.

## Public release recovery

The other job downloads only the separately retained release artifact. Its small preflight verifies the exact build and outer receipt hashes, producing run, source and helper/input identities, and the release binary/metadata bytes. GitHub artifact extraction does not preserve Linux executable permissions, so the preflight restores the qualified binary's recorded0755 mode only after its hash/size and fixed owned path match.

The portable verifier remains byte-identical to independent reviewa0c0faaaa023df054ca0b5949c833d238683070f8913f11b201df324d2b97a87: helper653ff9f382ca0dd069bf326106c0c088e4db576dc48ef0ee8274ddac39e82e52. It uses owned-process-groups, four fresh public-data workspaces and its own900-second phase/120-second native-command limits. The public input is only original current.json plus its selected8,569,277-byte object, obtained from the literal Git archive. No unselected historical tree or private canonical PC state is copied.

A successful result must have status passed, four verification restores, all413 original outcomes preserved, unchanged original source and checkpoint configuration, and successful complete-record comparisons for original restore, current before append, previous preservation, one isolated create, current after append and previous restore. Native stdout/stderr and full selected closure/index evidence are retained.

## Reviewable output and cleanup

Both jobs upload complete results/logs for at least seven days. Every small text stream is also emitted with its filename, byte count, SHA-256 and Base64. Large full result lists remain exact retained artifacts with their digests; no original corpus bodies or private state are printed.

Activation uses a fresh task/checkpoint-linux-check-20261125 branch and adds only the final reviewed YAML under .github/workflows/checkpoint-linux-check-20261125.yml. Read back exact workflow/head and record both actual job IDs. The previous failed build is retained as failed evidence; no preceding test is repeated merely for formatting.

If the session dies early, future agents must reconcile any uncertain action, retain actual evidence and finish cleanup of owned qualification branches and clean Riftri worktrees after accepted delivery. They must not force-remove user changes, reset canonical stores or infer a task closure from a prepared packet.
