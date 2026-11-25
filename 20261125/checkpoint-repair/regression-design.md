# Regression and qualification design

## Defects and contract

The set-v2 stager allocates one `seen_attempt_ids` set and passes it to every artifact parser, but the baseline closure ignores the argument. It appends the decoded outcome records and finally reports the empty set's length. The shared record parser delegates global duplicate-attempt checking to the stager. The proposed loop implements that existing responsibility, matching the monolithic and sharded staging contract.

The tail publisher writes every unsealed event tail to `set/tail.jsonl`. A retained manifest selects the digest of an earlier version of that same path. A later append can therefore leave the previous generation unable to verify. The existing object writer, manifest readers, and retention logic already support selected content-addressed paths. The proposed change uses `set/tail/<sha256>.jsonl` for the logical open tail and lets ordinary pointer-based retention release old objects.

Primary source and specifications:

- [Pinned set-v2 implementation](https://github.com/YossiMH/bead-rs/blob/986f2a332aca9dd567eee41ce835917d56e29468/src/service/checkpoint/set_v2.rs)
- [Pinned shared checkpoint staging and verified restore](https://github.com/YossiMH/bead-rs/blob/986f2a332aca9dd567eee41ce835917d56e29468/src/service/checkpoint.rs)
- [Attempt-outcome contract](https://github.com/YossiMH/bead-rs/blob/986f2a332aca9dd567eee41ce835917d56e29468/research/specs/attempt-outcome-v1.md)
- [Set-v2 specification](https://github.com/YossiMH/bead-rs/blob/986f2a332aca9dd567eee41ce835917d56e29468/research/specs/checkpoint-set-v2.md)
- [Verified restore specification](https://github.com/YossiMH/bead-rs/blob/986f2a332aca9dd567eee41ce835917d56e29468/research/specs/verified-restore-v1.md)

## New regressions

| Test | Invariant | Expected baseline failure |
| --- | --- | --- |
| `set_v2_staging_counts_attempt_outcomes_across_shards` | Two distinct attempts in separate real shard files produce count 2 and preserve the complete payload, including an additive field, in canonical receipt order. | Reported count is 0. |
| `set_v2_staging_rejects_duplicate_attempts_within_a_shard` | The same attempt identity with distinct receipt IDs is refused within one shard. | Staging incorrectly succeeds. |
| `set_v2_staging_rejects_duplicate_attempts_across_shards` | The same attempt identity is refused across separate shard files. | Staging incorrectly succeeds. |
| `verified_restore_preserves_all_attempt_outcomes_from_set_v2` | A real published set-v2 generation with two outcomes restores into a fresh directory, retains all stored outcome columns, reports the selected generation/root/store, and republishes count 2. | First-class restore rejects the staged zero outcome count against the pointer count 2. |
| `selected_set_v2_generation_remains_restorable_after_tail_append` | A small real append preserves the exact prior pointer, manifest and selected tail bytes; a public restore of that generation recovers the prior inventory. | The selected tail bytes change after the append. |
| `legacy_fixed_tail_generation_remains_restorable_after_upgrade` | A generation selecting the legacy fixed tail remains intact and restorable after the next publication. | The selected legacy tail bytes change after the append. |

The unit staging fixture writes real JSONL files and their exact manifest digests. Its minimal pointer/manifest is intended to exercise staging directly. Public checkpoint and restore behavior is covered separately by real CLI integration tests.

The outcome integration fixture reuses the existing helper's portable columns and zero prior attempt tier. The checkpoint wire contract does not store the prior tier, so this test does not assert a new nonzero-tier preservation contract. Full SQL row comparison covers every column in these fixture outcomes, and the source rows are checked again after recovery.

The tail integration test uses real init, create, flush, list and selected-generation restore commands. Only its legacy-compatibility setup writes fixture metadata: it changes the selected tail path to the observed legacy layout and updates the manifest digest in the pointer and live checkpoint bookkeeping. Before the append, a real restore into a separate fresh directory proves that the edited legacy generation is valid and recovers the exact source inventory. The fixture's pointer, manifest and tail bytes are rechecked after that probe. The test retains the source configuration bytes and checks that a small append did not introduce a sealing boundary. The final recovered inventory must exclude the later issue. Its post-append byte assertion has a specific failure message so the Red checker can distinguish the demonstrated defect from an earlier setup failure.

The existing conformance assertions still verify actual tail digests. Their three path reads now use the selected manifest's path, so they cover both supported tail layouts.

## Tests-first execution

Apply `tests-first.patch` against the exact baseline and review/format the resulting test files before freezing the tests commit. Its production functions remain byte-identical to the baseline. Execute from an immutable archive of that tests commit; do not compile in a worktree another agent is editing.

Run each command with `CARGO_BUILD_JOBS=1`:

```text
cargo test --locked --lib service::checkpoint::set_v2::tests::set_v2_staging_ -- --test-threads=1
cargo test --locked --test attempt_receipt_checkpoint_integrity verified_restore_preserves_all_attempt_outcomes_from_set_v2 -- --exact --test-threads=1
cargo test --locked --test checkpoint_tail_generation_integrity -- --test-threads=1
```

Retain the exact source commit, command, output, exit status, test count, and specific assertion for every run. A compile error or unrelated setup failure does not establish a red regression. If a fixture or compile correction is needed, review and freeze that correction before repeating the baseline run; do not alter assertions after accepting the baseline failure to manufacture a green result.

## Repair and green execution

After the accepted red results, apply `repair-only.patch` to that exact tests state. If formatting changed the frozen test-stage file bytes, inspect and bind the equivalent production hunks explicitly instead of silently applying stale preconditions. Keep the accepted regression assertions unchanged.

Run the same three commands against an immutable archive of the repaired source commit. Then run the affected existing suites, serially:

```text
cargo test --locked --test attempt_receipt_checkpoint_integrity -- --test-threads=1
cargo test --locked --test attempt_outcome_round_trip -- --test-threads=1
cargo test --locked --test r036_verified_restore -- --test-threads=1
cargo test --locked --test checkpoint_set_v2_conformance -- --test-threads=1
cargo test --locked --lib set_v2_staging_matches_monolithic_staging_on_a_fixture_store -- --test-threads=1
```

If the accepted plan schedules the two directly affected conformance cases as distinct checks, their exact commands are:

```text
cargo test --locked --test checkpoint_set_v2_conformance set_v2_tail_seal_and_immutability -- --exact --test-threads=1
cargo test --locked --test checkpoint_set_v2_conformance set_v2_crash_ordering -- --exact --test-threads=1
```

Complete the repository's required formatting and warnings-denied lint gates during the Linux build task. The corrected revision-5 plan also requires compilation of all default test targets and a separate complete default native cargo test task. Preserve that full-suite result alongside the focused checks; none of these gates is waived. No additional product behavior or configuration workaround belongs in this repair.

## Immutable release builds and Windows qualification

Use the repository's existing immutable-archive build procedure from the qualified repaired commit. Build the Linux host executable and first use the hosted Windows `x86_64-pc-windows-msvc` route with the unchanged archive script. If that route actually fails, retain the failure and use the previously verified Linux cross-build route for `x86_64-pc-windows-gnu`. Each build uses one Cargo job, task-owned output paths, and metadata recording the exact source commit, tree, target, toolchain, command, and resulting binary SHA-256.

A cross-compiled Windows artifact needs its own bounded native Windows execution evidence. It must not inherit the historical `539cdd0` runtime hash or claim that the old Windows test qualified new bytes. Root will bind the replacement executable hash to the revised Windows check, installer preflight and preservation/restore helper. Existing editing/browser results remain applicable to their unchanged behavior; the new qualification is explicit about the native checkpoint changes.

Compilation and automated tests run in cloud. Windows execution retains the established headroom, process ownership, aggregate memory and time limits; the user's foreground workloads take priority. A failed resource gate leaves the operation pending. No helper may lower that gate or replay an uncertain mutation.

## Author verification boundary

The combined files and patches were inspected and validated in memory while the filesystem was unavailable. All patch contexts and line counts were checked against the exact fetched baseline, and both patch paths reconstructed the recorded full candidate bytes. SHA-256 calculations passed three standard known-answer vectors and recovered the tail author's already recorded digest.

These checks establish artifact identity and patch consistency. Rust parsing, formatting, compilation, regression results, complete historical restoration, new native artifact hashes and Windows execution results remain required qualification evidence.
