# Bounded final installation

`windows-install-supervisor-20261127.ps1` runs the accepted installer once in one hidden child PowerShell process. The installer changes source, runtime and the native pin and then publishes both source commits. It starts no app. Its original bytes, preservation checks, phase records and rollback copies remain unchanged.

The wrapper is derived from the accepted archive supervisor at `83a648b7cda046c9bcc47e3b79f908933499b866`, path `20261125/revision-9/artifact-stage/stage-artifacts-supervisor-20261125.ps1`, SHA-256 `616db975e60be07d5804975af2b2f2eb17b2e57eee91a97971fb931b36a038eb`. Its Job-member enumeration, retained process handles, priority handling, timer declaration and owned cleanup are retained. Both minimum-memory sentinels use the Windows PowerShell 5.1 `[uint64]` name.

The parent Job also contains the installer's nested Job and its Git descendants. Microsoft documents that a Job's process-ID list includes processes in its child Jobs: <https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-jobobject_basic_process_id_list>. The separate child process lets the immutable installer enter its own Job without colliding with the supervisor's static helper state.

## Required accepted inputs

The existing final installation directory is:

```text
F:\Dev\.bead-edit-20261111\final-installation-v9-20261125-1151
```

The exact installer there must hash to `3c7e2b5ccbe5d31b32a236d9b336feffa868ffc12bbf8ee2db2e9d9f3ad214c0`. Its sibling `windows-task-job.ps1` and the outer supplied Job helper both must hash to `2758a6ff94c0eecdfa360363469069dfa8470efc1f91228812146919a978921f`. The original 15-file preservation manifest must hash to `70d934585d06c76787e5293a93f7960d6594e869cd719bf0f62ad46a532fa362`.

The wrapper requires the actual independently accepted SHA-256 values for these two successful stage receipts:

```text
F:\Dev\.bead-edit-20261111\stage-artifacts-v9-final-20261125-1151\stage-result.json
F:\Dev\.bead-edit-20261111\stage-artifacts-v9-final-20261125-1151.supervisor\result.json
```

It verifies the exact stage request, final source identities, 560-file runtime, five installer inputs, successful driver exit and normal cleanup. The accepted stage supervisor is the separately named PowerShell 5.1 copy with SHA-256 `9c69f55d98c634013ec596398cae1c2c822d373647abd8c4cb863ca405b32d4d`; the stager remains `bdf5323e125e49193fdecd8e44d126a1f9e7746797a33c9fc0967b1546d69ea1`.

All final parameters are fixed except the current observed ports and the two actual receipt hashes:

| Parameter | Value |
| --- | --- |
| `ScottySourceCommit` | `0309539797fd7d016e2b8fd8bdc0ae9cefc20219` |
| `BackendSourceCommit` | `2d801ba455b7a722daf644a7615445117d57e8e9` |
| `PreservationManifest` | Final installation directory, `pc-preservation-raw.json` |
| `RuntimeManifest` | Stage directory, `manifests\scotty-runtime.json` |
| `StageNextDirectory` | Stage directory, `runtime\.next` |
| `BeadExe` | Stage directory, `native\release\bead-checkpoint-2d801ba455b7.exe` |
| `BeadSha256` | `0431a828bf95038641a0c55b4cf11c5800b52881940a13bd2f56b02f0b27177a` |
| `BeadProvenance` | Same native path with `.metadata.json` appended |
| `OutputDirectory` | `F:\Dev\.bead-edit-20261111\install-v9-final-20261125-1151` |
| `ScottyPorts` | Fresh observed unique integer ports, supplied by root |

The runtime manifest is fixed at SHA-256 `612790bc18617630f9257ab2a901f8e12a0cd6dda6bf566c414e646e1745f1c7`; metadata is fixed at `21ca90e29fc4588d23b31210cd5ffe6838c136ce70b76458b71370beeeff18f5`. Both source commits, all file identities and the unchanged installer contract are accepted in `20261125/revision-9/final-installation/binding.json` on the transfer branch.

## Source objects and current ports

The installer fetches no objects. Before invoking it, root checks that both final commits and their required ancestry/blobs are present locally. App ancestry must include `459a74537cbbe1dff521c6fc7ad1ce3ec2890683`, preserved baseline `55f17568be93442abc6e4725d3e159448e0c9ab5` and tray source `5232c8b94804064ab71af571ee28797667bd72bd`. Native ancestry must include `afac9fa0ce9533a707d745018d16a25e4ccff492`.

If final objects are absent, these exact source fetches belong in a separate sequential, hidden, BelowNormal operation with the existing resource and command bounds:

```powershell
git.exe -C F:\Dev\bead-me-up-scotty -c gc.auto=0 -c maintenance.auto=false fetch --no-tags --no-recurse-submodules --no-write-fetch-head https://github.com/YossiMH/bead-me-up-scotty.git 0309539797fd7d016e2b8fd8bdc0ae9cefc20219
git.exe -C F:\Dev\bead-rs -c gc.auto=0 -c maintenance.auto=false fetch --no-tags --no-recurse-submodules --no-write-fetch-head https://github.com/YossiMH/bead-rs.git 2d801ba455b7a722daf644a7615445117d57e8e9
```

Resolve each final `^{commit}` and run the required `merge-base --is-ancestor` checks after fetching. The app repository's origin remains `https://github.com/YossiMH/bead-me-up-scotty.git`; the backend origin remains `https://github.com/jedarden/bead-rs.git`. Local and user-fork remote main must remain at the original app `459a7453` and native `afac9fa0` baselines until the accepted installer updates them. Preserve the app's exact 15 dirty paths, original index and old `bead-376537b7917f.exe` pin; the native worktree must remain clean.

Root derives `ScottyPorts` from fresh configured/source/process observations and TCP listeners. The accepted CLI uses explicit `--port`, otherwise a valid process `PORT` value or 3000, and can choose the next 50 ports when its implicit default is occupied. The batch file forwards its arguments. These source rules alone do not establish the PC's actual current port inventory. The installer separately refuses every matching active Scotty process and every occupied supplied port. Configured launch later uses its explicit checked port 43972.

## Limits and invocation

The wrapper requires 3 GiB free physical memory at baseline and immediately before starting the installer, keeps a live 1 GiB floor, and counts its own resident memory plus all owned descendants against 512 MiB. Sampling runs every 100 milliseconds. Work stops at 168 seconds; the retained hard timer bounds the whole invocation to 180 seconds and preserves 12 seconds for cleanup. All owned processes run BelowNormal and hidden. The original installer retains its 45-second per-command limit.

The installation output directory and its sibling `.supervisor` must both be absent. The supervisor retains its input identities and exact generated child invocation before starting. A failed or interrupted run preserves its directories, result/phase records, original source/index/environment copies and previous runtime. Root must reconcile the recorded phase before considering another mutation.

After independent review and ordinary PowerShell parsing, stage the new supervisor in the final installation directory. In a fresh hidden Windows PowerShell 5.1 process with root's approved process-only execution policy, call it with the accepted hashes and observed integer array:

```powershell
& 'F:\Dev\.bead-edit-20261111\final-installation-v9-20261125-1151\windows-install-supervisor-20261127.ps1' `
  -JobHelperPath 'C:\Users\YossiMH\AppData\Local\bead-edit-20261111\tray-host-execution-20261125\windows-task-job.ps1' `
  -StageResultSha256 $acceptedStageResultSha256 `
  -StageSupervisorResultSha256 $acceptedStageSupervisorResultSha256 `
  -ScottyPorts $observedScottyPorts
```

The three variables come from the accepted actual stage records and fresh PC observations. Supply them before invocation. The wrapper validates the integer array and generates a literal array for its single child, avoiding `powershell.exe -File` array-conversion ambiguity.

Require connector exit 0, supervisor `passed`, child exit 0, no assisted cleanup or cleanup errors, and no remaining owned member. Its result must bind the exact `install-result.json` hash, requested/final source heads, final pin, runtime BUILD_ID and preserved input hashes. The original installer performs its source/index/runtime/pin/publication checks and leaves the app stopped.

The configured-launch helper already contains its own Job, resident-memory sampler, immediate 3 GiB check and 120-second deadline. Invoke that immutable helper directly in one fresh hidden PowerShell process after installation acceptance. Its parameters are the installed final pin and SHA above, output `F:\Dev\.bead-edit-20261111\configured-v9-final-20261125-1151`, port 43972, timeout 120 and maximum owned resident memory 512 MiB.

## Verification and cleanup

Cloud comparisons verify the inherited declaration and process-management functions, every fixed source/path/hash against the accepted final binding, and unchanged installer bytes. This cloud environment has no PowerShell runtime. Ordinary parsing and actual Windows execution remain required before accepting installation; prior product checks stay valid for their unchanged source.

This work shares the existing Riftri worktree `/tmp/beads-2889282bfcec/closure-v9`, branch `task/closure-v9-20261127`. After all its exact files are published and no longer needed, remove that clean worktree through Riftri. If the process ends early, a future agent must reconcile unpublished work and complete this cleanup. Keep existing rollback files and other workers' worktrees intact.
