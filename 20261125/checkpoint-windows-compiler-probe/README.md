# Bounded hosted MSVC child-lifecycle probe

The actual Windows v5 archive command compiled the exact 515b503b backend successfully and exited zero. Its Job still contained an unidentified process, PID 7944, after the existing five-second quiescence window; the supervisor later observed that same PID. The whole attempt remains failed. No test compilation ran. The retained artifact contains the complete receipts and logs but no release executable or metadata, so its printed executable hash cannot qualify reusable output.

That evidence is immutable at commit 297adf86be9b55de1202f2e69d92763a4cf1b7b5 in YossiMH/bead-me-up-scotty, directory 20261125/checkpoint-windows/results/v5-failed. The build run is 45552623126, job 138997085133. The full log SHA-256 is 26e4bc34e9b96941d0d60f84f223f18d8ca0ef94058aa0495f1166bb9bd9faf0.

## Scope

This proposal compiles a four-file, dependency-free Cargo fixture with an empty build script and empty main program. It uses the same verified MSVC x64 setup, explicit linker selection, Rust/Cargo 1.100.0, host/target tuple, cleaned environment, hidden Git Bash launch and one Cargo job as the failed build. Its two serial commands are `cargo build --release --locked --target x86_64-pc-windows-msvc` and `cargo test --locked --no-run --target x86_64-pc-windows-msvc`. Cargo executes its empty build script as part of normal compilation; neither the generated main executable nor any test harness is run. No bead-rs source is downloaded or compiled, and no application or PC command is run.

The original v5 build helper is imported only after its exact SHA-256 is verified. It supplies the already reviewed path, environment, MSVC, complete Job-query and retained-baseline utilities. Its bytes and its production quiescence guards remain unchanged. The new diagnostic records the actual fixture descendants without declaring any extra process acceptable for a production build.

## Observations and cleanup

Before each command the Job must equal the retained supervisor/Python/optional verified console-host baseline. During compilation and for five seconds afterward, the probe queries the same immediate Job through `QueryInformationJobObject(NULL, ...)`, using the accepted bounded complete-query routine. It captures each live observed descendant's non-inheritable query/synchronization/termination handle, PID, creation FILETIME, image path/hash, session and Toolhelp parent PID. Equal consecutive complete membership observations are grouped with first/last observation times and a read count. Processes that finish between snapshots are not assigned fabricated identities.

Each process must be a member of the caller's complete Job list through its held PID, with a creation time inside the specific compiler attempt. Cleanup can terminate only those captured non-baseline handles after rechecking PID, birth and complete Job membership. The diagnostic records every forced termination; it requires the original exact baseline restored and all captured handles exited. The unchanged outer Job then verifies zero children and caller-observed supervisor exit. A diagnostic PASS establishes complete observations and cleanup; it does not qualify a product binary or identify the historical PID 7944 by inference.

The Python phase has a 180-second total deadline, each compiler command at most 60 seconds, a five-second observation window and reserved cleanup time. The supervisor differs only by reducing its build deadline to 210 seconds. The workflow has a six-minute job and five-minute execution step. It uses the unchanged qualified Job helper, exact action pins, read-only permissions and a fresh branch/output root. Identity capture is bounded to 128 descendants, 32 simultaneous extras and 256 distinct membership groups per command; streams are limited to 4 MiB. Small exact receipts and raw streams are emitted as Base64/SHA records, and complete outputs are retained for seven days.

## Review and continuation

Read the full probe, all input/file hashes, the supervisor's one-line deadline diff and the full workflow before activation. The unchanged driver and original build helper retain their previously reviewed hashes. Both author inspections and the cloud AST/static comparisons are retained beside these files. Actual hosted output remains required. If no persistent child is reproduced, record that limited observation and preserve the production guard.

Before another product build, the root must receive a reviewed lifecycle correction supported by actual measured identities. Future build failure retention must also copy the bounded release directory even when a later guard fails. No compiler flags, product source or test assertions are changed by this proposal.

If this process dies early, future agents must reconcile started outputs before retrying, preserve the actual diagnostic and failed-build evidence, and clean only this task's temporary branches and worktrees after final acceptance. This packet creates no local worktree. The proposed scratch branch is task/checkpoint-windows-compiler-proposal-20261125; the separately activated branch is task/checkpoint-windows-compiler-probe-20261125.
