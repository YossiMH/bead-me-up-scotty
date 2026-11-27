# Final installation retry after preflight reconciliation

This packet gives root one fresh installation attempt after the first attempt stopped before product mutation. It changes two exact driver literals and the supervisor's three matching execution bindings. The accepted original scripts and failed output directories remain available at their existing paths.

## Reason for this correction

The first installer reached the native repository's exact-origin check and refused because it expected the HTTPS spelling of the upstream repository. The actual origin is `git@github.com:jedarden/bead-rs.git`; the same SSH value is used for fetch and push. The app origin is already the expected HTTPS URL. The separately accepted failure review confirms that both repository HEADs and raw indexes, all fifteen app source files and dirty statuses, both Git configurations, `.env.local` and the old native pin were unchanged afterward. The failed directory contains only its owner marker and two result files. It contains no source/environment/index backup or mutation-phase record.

While reporting the refusal, `Save-Result` passed PowerShell `$null` to the string backup-name argument of `File.Replace`. Windows PowerShell 5.1 converted that value to an invalid path. The exact `.next` file retains the primary `Repository origin differs.` message.

The new driver has exactly these changes:

1. Expect the observed native origin `git@github.com:jedarden/bead-rs.git` with the original strict equality check.
2. Pass `[System.Management.Automation.Language.NullString]::Value` to the result writer's third `File.Replace` argument. The first-result `Move` branch and both index/environment replacements with real backup paths are unchanged.

Root's actual Windows PowerShell 5.1.26100.9818 check at 2026-11-27 08:59:32 UTC reproduced the old illegal-path failure, then passed the exact full-name correction and three successive JSON replacements. The complete stdout hashes to `f71476f3269000faa4ca6eb62345b9591292f8e0905c2e295504151172180ac3`. Its independent review is `4be3ab740a2201af0b1ec065750f339d27f9cabeccadca17eb46432aa6fbbded`.

Microsoft documents `NullString` as the value used to pass a true null to a .NET string parameter, including Windows PowerShell 5.1: <https://learn.microsoft.com/en-us/dotnet/api/system.management.automation.language.nullstring?view=powershellsdk-7.6.0>. `File.Replace` permits a null backup filename: <https://learn.microsoft.com/en-us/dotnet/api/system.io.file.replace?view=netframework-4.8.1>.

The native origin remains unchanged on disk. The driver's explicit publication targets remain `https://github.com/YossiMH/bead-rs.git` and `https://github.com/YossiMH/bead-me-up-scotty.git`. Remote-main checks and ordinary pushes continue to use those exact user-fork URLs.

## Exact files and staging

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `windows-install-tray-host-retry-20261127.ps1` | 34680 | `c3c61ad33112ead3746325a32446b1aa786ee622532c69b9dad846838f721638` |
| `windows-install-supervisor-retry-20261127.ps1` | 23767 | `719f352cc46a8d23bdf3dd3df1f8f9d662d1f4b9ef1985191000fceb80018e4d` |

Both scripts belong beside the existing `windows-task-job.ps1` and preservation manifest in:

```text
F:\Dev\.bead-edit-20261111\final-installation-v9-20261125-1151
```

The original installer is `20261125/revision-9/install-binding/windows-install-tray-host-20261125.ps1`, SHA-256 `3c7e2b5ccbe5d31b32a236d9b336feffa868ffc12bbf8ee2db2e9d9f3ad214c0`; the original supervisor is `20261127/installation-execution/windows-install-supervisor-20261127.ps1`, SHA-256 `d6c96c814c3b92cba0ec3cf10f9342bf0d80e17f599bb14067a753fc15e33751`. Inverting only the specified substitutions reproduces each complete original byte sequence. The wrapper changes only the driver filename, its required SHA-256, and this fresh output basename:

```text
F:\Dev\.bead-edit-20261111\install-v9-retry-20261127-2889282bfcec
F:\Dev\.bead-edit-20261111\install-v9-retry-20261127-2889282bfcec.supervisor
```

Root verifies the two new staged file hashes and performs an ordinary Windows PowerShell 5.1 AST parse before execution. The old failed attempt stays at `F:\Dev\.bead-edit-20261111\install-v9-final-20261125-1151` and its `.supervisor` sibling. Both new output paths must be absent; the wrapper independently enforces this condition.

## Accepted inputs and fresh observations

The accepted final product and build identities remain unchanged:

| Input | Identity |
| --- | --- |
| App source | `0309539797fd7d016e2b8fd8bdc0ae9cefc20219` |
| Native source | `2d801ba455b7a722daf644a7615445117d57e8e9` |
| Native executable | `0431a828bf95038641a0c55b4cf11c5800b52881940a13bd2f56b02f0b27177a` |
| Native provenance | `21ca90e29fc4588d23b31210cd5ffe6838c136ce70b76458b71370beeeff18f5` |
| Runtime manifest | `612790bc18617630f9257ab2a901f8e12a0cd6dda6bf566c414e646e1745f1c7` |
| Runtime | 560 files, 27,426,391 bytes; BUILD_ID `YIOHeRJTEdlOszyc4LyHr` |
| Original fifteen-file preservation manifest | `70d934585d06c76787e5293a93f7960d6594e869cd719bf0f62ad46a532fa362` |
| Inner and outer Job helper | `2758a6ff94c0eecdfa360363469069dfa8470efc1f91228812146919a978921f` |
| Actual stage driver result | `63b718e5a84b679496fbfea68320248181c230ece667b1043ea4f98c9c41b93c` |
| Actual stage supervisor result | `c75506863b6aadd827f04584345865671d56a0a136b11dc95e3cc4def329827f` |

The unchanged final stage directory is `F:\Dev\.bead-edit-20261111\stage-artifacts-v9-final-20261125-1151`. The wrapper still checks its exact request, final source/runtime/native identities, accepted successful result, original stager and PS5.1 supervisor hashes, normal cleanup and fixed input hashes. The stage runtime must still be present at `runtime\.next` before installation.

Root refreshes the repository/source/index/old-pin/environment observations, absence of both new outputs and new pin/provenance, absence of relevant processes and the current configured/listening ports before execution. The latest retained reconciliation found ports 3000 and 43972 free; use that two-port array only after the fresh observation confirms it. Both user-fork main refs must still equal the original app `459a74537cbbe1dff521c6fc7ad1ce3ec2890683` and native `afac9fa0ce9533a707d745018d16a25e4ccff492` baselines. The final source objects and required ancestry were already accepted locally; the installer fetches no objects.

## One invocation

After source review, exact staging and AST parsing, invoke the new supervisor in a fresh hidden Windows PowerShell 5.1 process with the already approved process-only `-ExecutionPolicy Bypass`. If the fresh port inventory remains 3000 and 43972, the exact body is:

```powershell
& 'F:\Dev\.bead-edit-20261111\final-installation-v9-20261125-1151\windows-install-supervisor-retry-20261127.ps1' `
  -JobHelperPath 'C:\Users\YossiMH\AppData\Local\bead-edit-20261111\tray-host-execution-20261125\windows-task-job.ps1' `
  -StageResultSha256 '63b718e5a84b679496fbfea68320248181c230ece667b1043ea4f98c9c41b93c' `
  -StageSupervisorResultSha256 'c75506863b6aadd827f04584345865671d56a0a136b11dc95e3cc4def329827f' `
  -ScottyPorts @(3000,43972)
```

The wrapper retains 3 GiB baseline and immediate free-memory checks, a live 1 GiB floor, 512 MiB aggregate owned resident limit, 100 ms sampling, BelowNormal priority, a 168-second work deadline and a 180-second hard deadline with 12 seconds reserved for cleanup. It retains the same Job declarations, safe-handle ownership, stream bounds, process accounting and cleanup. The inner installer keeps its 45-second native-command limit and all original source, index, environment, runtime, pin, backup, publication and final stopped-app checks.

A successful actual installation requires connector exit 0, supervisor `passed`, driver exit 0, the exact successful driver result hash, unchanged accepted inputs, final source heads and user-fork refs, installed runtime and new pin, a stopped application, no assisted cleanup or cleanup errors and no remaining owned Job member. Root collects the exact driver/supervisor results and both logs for independent acceptance. Any failure retains its new output and phase records for reconciliation.

Configured launch follows installation acceptance using the separately accepted memory-corrected helper `windows-configured-launch-host-memory-20261127.ps1`, SHA-256 `8db39140f935b690af58fc2c604ba7a0566945f7c4ea140d6f98637ead75c5ae`. Its actual result, installed review, final handoff text and checkpoint-history phases remain future tasks.

## Review and retention

The accompanying author record binds the originals, these exact new bytes, the actual failure reconciliation and the Windows null-string check. It records two complete clean source inspections. Independent source review and root's exact Windows AST parse must follow before the new execution.

This is a private operational packet prepared outside all product repositories. Root publishes the reviewed packet and receipts on the existing transfer branch. There is no new linked worktree. Preserve the failed first attempt, tiny compatibility fixture, accepted input packet and any new rollback/result files until the existing final cleanup task reconciles their ownership and required retention.
