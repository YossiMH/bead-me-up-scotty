# Separate checkpoint Red execution

## Prerequisite and exact bytes

Root accepted successful compile run45537110469, attempt1, job138946295563,
workflow3847da49b76a8526f3d9621d77be8f7e70d5334b, for this separate behavioral
check. Actual native task creation and guarded closure remain pending.
This output belongs to bead-edit-20261124:checkpoint-red-checks under the
accepted 32-task plan SHA-256
f078b507732c19d472ec2526baead24619e2503189888ccb6e4516da392dfb82.

The tests-only backend source is
a42d7dad5c3e2b31336c12c7c0f69a83db9a53b8, tree
c9707f7b58dd76826244719af018bf4c02a3e5fc, direct parent
986f2a332aca9dd567eee41ce835917d56e29468.
Production behavior is unchanged.

Artifact14986424212 contains the accepted 168,799,970-byte compilation bundle,
SHA-256 c8aa00fb46ba8722d8b9e054a782e2303910d547dbad98c7977abe11d2c47f70.
The exact outer and compile receipts are retained here. check-inputs.json binds
both receipt hashes, artifact/run/attempt/workflow identities, source/tree,
build helper/input hashes and bundle hash/size. The first failed build and its
diagnostic remain retained in the parent directory and their original runs.

## Reviewed activation

The workflow is ordinary coordination data at checkpoint-red-check.workflow.yml.
After independent acceptance, create a fresh temporary branch
task/checkpoint-red-check-20261125 from the exact reviewed packet commit and add
an identical copy at .github/workflows/checkpoint-red-check-20261125.yml.
Verify the branch is absent, use ordinary non-force ref creation, and read back
the exact ref and workflow. Main and product branches are unchanged by activation.

The only event is a push to this exact branch. The runner is ubuntu-24.04, with
read-only contents/actions permissions and pinned official checkout, download
and upload actions. Download uses the exact artifact ID and producing run.
merge-multiple:true puts that one artifact's files at the specified owned root,
as required by the pinned download action's artifact-ID route.

The workflow performs ordinary Python parsing of both exact helpers, then starts
the reviewed checker. It runs no compiler or Cargo command. The checker's import
of the hash-pinned compile helper loads definitions only.

## Reconstruction and execution

Before execution, the checker verifies the complete hash and identity chain,
the successful outer status, and the compile-only receipt. It recreates the
original absolute owned build root under RUNNER_TEMP only when that path is
absent. Both archives reject traversal, links, devices and duplicate files.
All archived source files are matched to their original Git blobs, SHA-256,
lengths and modes. Cargo's actual JSON output is reparsed to identify the same
four test harnesses and bead binary.

The exact absolute source/executable layout is required because the tail tests
embed CARGO_BIN_EXE_bead during compilation. After clearing inherited workspace
and compiler selectors, the checker also sets the child-only CARGO_BIN_EXE_bead
to the verified retained target/debug/bead for assert_cmd2.2.2 runtime discovery.
The complete source and all executable bytes/modes are rechecked afterward.

Only these three harness invocations run, serially:

- The recorded library harness with the set_v2_staging_ module filter.
- The recorded attempt-receipt harness with the exact public restore test.
- The recorded selected-tail harness with its complete two tests.

Every harness has one test thread and captured stdout/stderr. Each has295seconds
of work plus owned process-group cleanup within300seconds. The complete checker
has a1200second deadline. The workflow leaves additional time for setup and
evidence upload. A timeout, abnormal exit or leftover owned process cannot count
as an intended failure.

## Required observed failures

The checker requires normal libtest exit101, exactly six failed tests split3/1/2,
zero passes, zero ignored tests, the exact test names, and their exact panic sites
in the accepted source. It then matches the corresponding defect evidence:

- Distinct attempt receipts: attempt_outcome_count reports0 instead of2.
- Duplicate attempts in one shard: unwrap_err receives an unexpected Ok result
  containing the duplicate attempt identity.
- Duplicate attempts across shards: the same incorrectly accepted duplicate.
- Public restore: the command-success assertion receives the native pointer/
  staged count error with outcome count2 versus0 and every other count equal.
- Current-layout retained tail: the selected tail bytes changed after append.
- Legacy fixed-tail retained tail: the same exact post-append marker, reached
  after its earlier real legacy-fixture restore and inventory checks succeeded.

Wrong-site or setup panics do not satisfy these requirements. Safe unexpected
assertion outcomes are collected across all three harnesses; unsafe command
failures stop further execution. A successful qualification receipt is named
passed_expected_failures and explicitly records failed_test_count6 and
passed_test_count0. It does not describe failed tests as passing tests.

## Evidence and next step

The result and complete raw streams are uploaded on success or failure for at
least seven days. The checker also prints exact result bytes as base64 with a
SHA-256 so the read-only GitHub log connector can retain them. Record the actual
check workflow commit/run/attempt/job IDs and artifact identity. Compare its
reported source/helper/input bindings with this packet before accepting it.

Independent test review stays pending until the actual intended failures for
these exact bytes are accepted. Production repair then follows that acceptance
and the Red result. No source repair, weakened assertion, skipped case or
automatic rerun is part of this workflow.

Root owns final cleanup. Preserve accepted evidence before deleting the owned
temporary check, build-v1, build-v2, diagnostic and scratch-candidate branches.
If execution is interrupted, future agents must reconcile any uncertain
publication/run and clean only owned temporary branches/worktrees after the
assignment completes.
