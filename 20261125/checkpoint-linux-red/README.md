# Checkpoint Red compilation in a hosted Linux runner

## Accepted task and source

This packet implements the compile-only output of
bead-edit-20261124:checkpoint-red-build. Root accepted the preceding provisional
tests-only candidate. Actual native task creation and guarded state updates remain
pending and will be reconciled by root before installation or delivery.

The accepted complete plan is YossiMH/bead-me-up-scotty commit
f496be34e8a99c9e97a2c714bdeaac66e18d8403 at
20261125/revision-5/plan.json, SHA-256
f078b507732c19d472ec2526baead24619e2503189888ccb6e4516da392dfb82.
Its dispatch clarification retains the same 32 tasks, 986 total records and
51 blocking edges. Every source, resource, review and prerequisite requirement
still applies to provisional outputs.

Tests-only source: YossiMH/bead-rs
a42d7dad5c3e2b31336c12c7c0f69a83db9a53b8,
tree c9707f7b58dd76826244719af018bf4c02a3e5fc,
direct parent 986f2a332aca9dd567eee41ce835917d56e29468.
Only the four exact files in build-inputs.json changed. The production prefix,
specification and all 647 other baseline blobs are unchanged. Independent static
review of the accepted scratch proposal carries forward to these identical bytes.

## Review and activation

The workflow is retained here as checkpoint-red-build.workflow.yml. That path is
ordinary coordination data and does not activate GitHub Actions. Independent
review must accept this whole packet before activation.

To activate the accepted packet, create a fresh temporary branch
task/checkpoint-red-build-20261125-v2 in YossiMH/bead-me-up-scotty with the exact
reviewed packet and an identical copy of the workflow at
.github/workflows/checkpoint-red-build-20261125-v2.yml. First check that this branch
is absent. Create it from the actual reviewed scratch commit by ordinary,
non-force ref creation. Do not change main or either product candidate branch.

The sole event is a push to that exact temporary branch. There is no automatic
Red execution or repair stage in this workflow. Record the actual workflow
commit, run ID, attempt, job ID and URL after GitHub reports the run. Verify the
reported event, branch and head commit before interpreting its status. If a
publication or trigger outcome is uncertain, inspect the ref and run metadata
before any further action.

## Execution and bounds

The runner is standard ubuntu-24.04 with a read-only contents token. Both official
Actions are pinned to full commit IDs. No secrets, deployment, self-hosted runner,
cache, policy override or PC execution is involved.

The job checks out its own packet at the actual workflow commit, then the exact
tests-only backend source with its one direct parent. It installs Rust 1.100.0
through the standard rustup toolchain command and parses the helper with
python3 -m py_compile. The helper validates its own and the input file's SHA-256
before any source operation.

The helper checks the clean checkout, full commit/tree/parent identities, exact
four-file delta, unchanged production prefix, and actual git diff --check. That
Git command must return zero before archive creation or compilation. Its complete
stdout, stderr, start and exit records are retained separately under logs with
the git-whitespace label.

It then uses git archive to create source.tar, verifies every archived file
against its exact Git blob and mode, and extracts all source without .git into a
fresh owned directory below RUNNER_TEMP. The observed baseline has 650 files and
487,304,516 bytes; tests add one file. The 1 GiB source guard includes the entire
repository archive and prevents an unbounded extraction. Data is copied and
hashed in streaming chunks.

The exact compilation command is:

    cargo test --locked --no-run --lib --test attempt_receipt_checkpoint_integrity --test checkpoint_tail_generation_integrity --test checkpoint_set_v2_conformance --message-format=json

CARGO_BUILD_JOBS is one. CARGO_TARGET_DIR and all temporary-directory variables
point into the fresh owned root. Inherited BEAD and Git workspace selectors and
compiler overrides are removed. The helper allows 1,790 seconds of work, then
reserves ten seconds for stopping and verifying only its own process group
within a 1,800-second phase deadline. The workflow's 32-minute step timeout
and 40-minute job timeout leave room for cleanup, setup and evidence upload.

Compilation must produce the library harness, all three requested integration
harnesses, and the real bead executable. Cargo's JSON artifact records supply
their exact paths; the helper checks package, target, mode, nonempty contents
and SHA-256. No harness or bead command is executed in this phase.

## Evidence and separate Red execution

Both success and failure retain the complete logs and metadata for at least
seven days through upload-artifact. A successful compile-bundle.tar.gz contains
source.tar, its complete file/hash/mode/Git-blob manifest, exact inputs, build
receipt, logs, and all five compiled executables. Tar preserves executable modes
and compile-time absolute paths for the later checker. The outer result.json
records the exact bundle hash and size without a circular self-hash.

The helper also prints the exact build-result.json and result.json as bounded
base64 text, each accompanied by its SHA-256. This permits the read-only GitHub
log connector to retain metadata while the separate checker downloads the exact
binary artifact through the official artifact API. Verify the job's actual
conclusion, both receipts, helper/input/source identities and git-whitespace
exit zero before accepting compilation.

Root accepts the actual successful compile output before a separate
checkpoint-red-checks workflow may execute the retained binaries. Bind that
checker's input to the observed run ID, attempt, workflow commit, artifact ID,
outer receipt hash, compile receipt hash and bundle hash/size. Recreate the
original owned absolute build root only if it is absent. Verify every source
file and executable before executing the three requested harnesses serially.
Setup, compiler, timeout or cleanup failures cannot count as expected Red.

The six new expected failures are three set_v2_staging_ unit cases, the public
attempt-outcome restore case, and the two selected-tail recovery cases. Final
test acceptance depends on the separate actual expected-failure evidence.
Production repair follows accepted tests and that actual Red result.

## Cleanup and continuation

Retain immutable source commits, accepted reports and downloadable logs before
cleanup. Root owns cleanup of this temporary workflow branch, the scratch
checkpoint-candidate branch and the session's worktrees. Verify the exact
current ref and task ownership, then delete only the owned temporary branch
after the evidence is durable. Keep ordinary Git hooks and publication controls.

If the process stops early, a future agent must first reconcile any uncertain
publication or run, preserve its result, and clean the owned temporary branches
and worktrees when the assignment is complete. Do not replay an uncertain action
or infer a native task closure from a hosted result.

## Retained first-run result and mapping correction

The first compile job was run45535362756/job138940518590 at workflow commit
1b2f9a2da3d5f4a64d71e58bc159b0ae22f27f6d. Every source guard and actual
git diff --check returned zero, and the exact Cargo no-run command returned
zero. The helper then failed with Unexpected test executable path while
validating the compiled output. That run remains failed because it did not
produce an accepted executable map or successful bundle.

The failed build/outer receipts and compiler-path diagnostic are retained in
this packet with their original hashes. A separate five-minute hosted job,
run45536239392/job138943405404 at e86bd323a010fd3b7825472306d6f80c954b5764,
read the exact failed-run artifact14985844517, verified both receipts, and
reported the original compiler-artifact records. Its own artifact is14987277839.
That diagnostic executed no compiler, test or product command.

Cargo1.100 emitted each test harness below
target/debug/build/bead-rs/<16-hex-build-unit>/out/<target-name>-<same-build-unit>.
The native bead executable remains target/debug/bead. The helper previously
required target/debug/deps. The correction replaces only that stale harness
parent assertion with the exact observed Cargo1.100 structure and expected
target name. All existing package, manifest, owned-target containment,
regular-file, executable-mode, uniqueness and SHA-256 checks remain.

The source, test assertions, Cargo invocation, compiler version, job count,
deadlines and bundle schema are unchanged. The new branch has its own fresh
run/root and retains the first failed run. Successful compilation acceptance
still requires the complete new executable mapping and bundle, followed by
the separately authorized expected-failure checks.

Primary Cargo documentation:
https://doc.rust-lang.org/cargo/reference/build-cache.html
https://doc.rust-lang.org/stable/nightly-rustc/cargo/compiler/layout/index.html
https://blog.rust-lang.org/2026/03/13/call-for-testing-build-dir-layout-v2/

Keep task/checkpoint-red-build-20261125 and
task/checkpoint-red-diagnose-20261125 on the final owned-branch cleanup list
alongside this v2 branch. Preserve their accepted evidence before deletion.
