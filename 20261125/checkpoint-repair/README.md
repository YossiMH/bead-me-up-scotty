# Checkpoint recovery repair proposal

This package retains a scratch candidate for two checkpoint defects found while preparing the final workspace-history handoff. Apply and execute it only through the accepted, materialized revision-5 tasks. The product source baseline is [YossiMH/bead-rs at 986f2a332aca9dd567eee41ce835917d56e29468](https://github.com/YossiMH/bead-rs/tree/986f2a332aca9dd567eee41ce835917d56e29468).

## Package

- `tests-first.patch` adds six regressions and changes three existing tail-file reads to follow their manifest.
- `repair-only.patch` applies after the tests-first state. It changes the two production behaviors and the corresponding set-v2 specification.
- `candidate.patch` is the complete baseline-to-candidate diff for review.
- `candidate/` contains the complete five candidate files. `tests-first/` contains the four changed test-stage files.
- `candidate-manifest.json` records baseline Git blobs, each stage's SHA-256, patch hashes, commands' scope, and pending gates.
- `regression-design.md` explains the assertions, expected baseline failures, and qualification sequence.
- `author-audits.json` and `static-checks.json` record the two final author inspections and the performed checks.
- `provenance/tail-retention.patch` preserves the original, independently authored tail proposal at its exact retained digest.

The production change inserts attempt identities into the existing shared set during staging, refusing duplicate identities. Tail publication uses the existing content-addressed object writer so a retained generation keeps its selected bytes. The checkpoint configuration, schema versions, sealing threshold, and logical segment boundaries remain the same.

## Recovery and verification state

The cloud filesystem became unavailable during composition. The four existing baseline files were fetched from the exact published commit. The original tail patch was recovered from its author's retained text and matched SHA-256 `9a19e6c724790fdb429ecd702ef02d5795bc5db4b44ea813adce1cdc27c9713a`. The attempt patch was reconstructed from the retained design and checked against the published implementation; this package's hashes supersede its earlier scratch identities.

The tail test's layout assertions now follow the preservation and public-restore assertions. Both baseline cases therefore reach the retained-byte invariant before checking the new path layout. The tail author agreed to this refinement.

Exact in-memory unified-patch parsing reproduced every full candidate file from the pinned baseline, and the two-stage composition produced the same bytes as the complete patch. Compiler, formatter, red/green execution, immutable release builds, and replacement Windows pin qualification remain pending. The local Rust formatter was unavailable before the filesystem outage.

## Execution order

1. Complete independent review and materialize the accepted revision-5 tasks.
2. Apply and format the tests-first changes in the assigned product worktree, inspect the final diff, and record the exact tests commit.
3. Build and run the named regressions from an immutable archive of that tests commit with one Cargo job and one test thread. Retain each actual baseline failure.
4. Apply the repair only after the accepted red results. Record the repaired source commit and run the same regressions plus the affected existing suites from an immutable archive.
5. Complete the required formatting, lint, full-test and release-build gates recorded by the accepted plan. Build the Windows executable from the exact qualified commit; record its own hash and metadata, then perform the bounded Windows qualification.
6. Update installation and preservation helpers from the qualified replacement pin and actual task mapping. The original store remains untouched until its independently reviewed backup, merge, preservation, and recovery checks can run.

Existing editing/browser evidence remains evidence for the unchanged editing behavior. These new checks establish checkpoint recovery behavior for the replacement native pin.

## Cleanup

This package is published only on the temporary transfer branch `task/checkpoint-candidate-20261125` in `YossiMH/bead-me-up-scotty`, based on `a532a268df26cb719bf0411a9c36668e0c9f0b04`. The parent tree contains no workflows, and this package adds none.

After final evidence is retained and the product changes are published, root must remove this exact temporary branch through the accepted cleanup procedure, checking its actual current head and ownership first. Preserve the recorded branch head in the final handoff until deletion is verified.

If a process dies early, future agents must first reconcile any committed task or source operations, recover the actual authority and results, then clean up this branch and the task-owned Riftri worktrees/build directories. Remove only clean, published worktrees through Riftri and retain the evidence before deleting their directories. Do not assume a failed connector response means a mutation did not commit.
