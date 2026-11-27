# Configured launch with the installed Windows line endings

This packet prepares one fresh configured-launch attempt after the first task returned exit code 1 before creating its output directory. It keeps the accepted runtime, executable, product source and resource limits. Execution remains conditional on root reconciling the actual installed module hashes and obtaining an ordinary Windows PowerShell 5.1 parser result for the final helper and invocation.

## What changes

`windows-configured-launch-host-crlf-20261127.ps1` differs from the accepted 48,944-byte helper `windows-configured-launch-host-memory-20261127.ps1` by exactly two SHA-256 literals. Reversing those literals reproduces the entire accepted file with SHA-256 `8db39140f935b690af58fc2c604ba7a0566945f7c4ea140d6f98637ead75c5ae`. Every function, embedded C# and JavaScript body, process-ownership check, launch and cleanup operation, timeout, and memory check is unchanged. The new file's SHA-256 is `f15cdc8bf98d8565a111951cc6b6dac7200a890e47758971470b3cbbf1395880`.

The two fixed hashes now identify the complete CRLF working files produced from the accepted canonical Git blobs. They do not accept arbitrary normalization or a choice of hashes at runtime. The helper still hashes the actual installed files and refuses any other bytes. Its later observer-to-host checks continue to compare those same actual working-file hashes.

| Module | Canonical Git blob | LF bytes and SHA-256 | CRLF bytes and SHA-256 |
| --- | --- | --- | --- |
| `bin/windows-tray.mjs` | `329e2379c0dc72b396d9fa12872c7db39700451f` | 6,214; `4205c86aab176cd394c528221d946bcf920f854d26e539164e62cc109c747446` | 6,385; `8ae12c3708ed9b1fda8b3f919605a22adccec8c406d9114fb0733a2314158396` |
| `bin/windows-tray-host.mjs` | `c3a31c8bd8b73f21ab15573080794198b12934dc` | 3,571; `39d1f1e609a787f862cdc21d6fef7aa3c768d981233a12e22c0d2108e93cf0dd` | 3,661; `4775f6ed906e042da3ca0bf7995b2d52658b8e70dfbfcb884088e15f95b99ec9` |

The source proof uses the immutable final app commit `0309539797fd7d016e2b8fd8bdc0ae9cefc20219`. Both canonical blobs contain LF line endings with no CRLF pairs. Replacing each LF byte with CRLF gives the exact lengths and hashes above; reversing that replacement recovers the complete canonical files. The accepted installation result also records these original canonical blob IDs and LF SHA-256 values in `external_tray_modules`, alongside the final app and native source heads. Its complete raw bytes remain pinned by the registration command.

## Preserve the first attempt

The first task is `ChatGPT-BeadEditing-Configured-20261127-2889282bfcec`. Its durable creation receipt is `F:\Dev\.bead-edit-20261111\configured-task-20261127-2889282bfcec.json`, 2,571 bytes, SHA-256 `435f47d69b28b32107325aba9bf72fe5675402725a31120bd6092ebf87a06efd`.

Root's 10:17:26 UTC readback records its last result as 1, state 3 and zero running instances. The original configured output directory is absent. The source contains a deterministic pre-output hash refusal for CRLF working files: the old helper checks the two module hashes before assigning `ArtifactRoot`. Its catch emits the failed JSON to the PowerShell success stream, but writes `result.json` only when `ArtifactRoot` exists. The first task did not retain those streams. Its precise executed error therefore remains unrecorded; the candidate addresses the identified source mismatch after actual-byte reconciliation.

Keep that task and receipt as the failed attempt. The new command uses a different task, output, receipt and two log paths. It never starts or alters the first task.

## Exact new attempt

| Item | Value |
| --- | --- |
| Task | `ChatGPT-BeadEditing-ConfiguredCRLF-20261127-2889282bfcec` |
| Output | `F:\Dev\.bead-edit-20261111\configured-v9-crlf-20261127-2889282bfcec` |
| Creation receipt | `F:\Dev\.bead-edit-20261111\configured-task-crlf-20261127-2889282bfcec.json` |
| Success-stream log | `F:\Dev\.bead-edit-20261111\configured-v9-crlf-20261127-2889282bfcec.stdout.log` |
| Error-stream log | `F:\Dev\.bead-edit-20261111\configured-v9-crlf-20261127-2889282bfcec.stderr.log` |
| Staged helper | `F:\Dev\.bead-edit-20261111\final-installation-v9-20261125-1151\windows-configured-launch-host-crlf-20261127.ps1` |
| Port | `43972` |
| User and session | `DESKTOP-NRIGAJU\YossiMH`, existing Explorer session 1 |

`configured-launch-com-command.json` is the complete concrete registration request. `configured-launch-com-body.ps1` presents exactly the same command body with additional line breaks after unquoted semicolons; removing those line breaks recovers the original body byte for byte. It is a review copy, and root executes the JSON command once. `command-delta.json` records every command substitution relative to the accepted `20261127/configured-launch-invocation/command.json`; reversing those substitutions recovers its complete command string.

The command retains the accepted successful installation result SHA-256 `a2fe1009af72bbc776d8c4f7db46e0905d2a7d1e5ec18119b1d3abeef0798673` and supervisor result `ab6141355b9b8b349ba40105cb6d6d23945aec0b5b556ea4db1cfeebcc384760`. It checks the final source commits, stopped application, selected executable `0431a828bf95038641a0c55b4cf11c5800b52881940a13bd2f56b02f0b27177a`, build ID `YIOHeRJTEdlOszyc4LyHr`, normal cleanup and exact installer pair. The input array additionally hashes both actual installed CRLF modules before registration. The qualified Job helper remains `2758a6ff94c0eecdfa360363469069dfa8470efc1f91228812146919a978921f`.

Admission still requires at least 3 GiB available physical memory twice, the expected interactive user and Explorer session, free port 43972 and absent output/receipt/task. Both new log files must also be absent at each output check and again inside the scheduled action before redirection opens them. Task registration remains create-only flag 2, interactive token 3, Limited run level 0, hidden, priority 7, no trigger, multiple-instances policy 2 and a 150-second scheduler limit. The exclusive durable receipt is saved before the single `RunEx` call with session flag 4 and session 1.

The task action changes from `-File` to `-Command` so its one fresh PowerShell host can call the helper with `&` and redirect success and error streams to the new sibling files. It initializes `LASTEXITCODE`, immediately checks command success and explicitly exits with the helper's code. An unhandled terminating error remains a failing PowerShell process. The helper's hard Job deadline retains its existing exit behavior. No second PowerShell host or forwarding process is introduced. The helper's original introductory `-File` wording describes the baseline launch; this invocation uses the same fresh-host isolation with in-process script invocation for stream capture.

These are PowerShell text streams. Windows PowerShell 5.1 redirection uses its ordinary `Out-File` formatting and encoding; the logs are retained and hashed as their original bytes. The helper's normal `result.json` remains UTF-8 without BOM. A JSON record printed before `ArtifactRoot` exists will now be available in the success-stream log even though no output directory was created. Redirection never makes a failed helper result acceptable.

The outer registration command is 7,758 characters and keeps the accepted 30-second call limit. The separately running helper retains 120 seconds total, 12 seconds reserved for cleanup, a 512 MiB aggregate Job resident-memory limit, 128 MiB Node heap, a 1 GiB live free-memory floor and immediate 3 GiB checks before application launch. All original recorded process identity, session, parent, exact Job membership, real Exit, cache-removal and port-free acceptance checks remain intact.

## Required root sequence

1. Reconcile the already-started diagnostic read without replay. Require the actual installed files to match the two exact CRLF hashes above and their LF forms to match the accepted canonical source. Preserve the failed task's completed/idle observation and original output absence.
2. Obtain independent source/invocation review for these frozen bytes. Stage the separately named helper beside the unchanged qualified Job helper. Verify the complete staged hash and perform the ordinary PowerShell 5.1 AST parse, including the concrete scheduled action string. Parsing must not execute the helper or register a task.
3. Execute the exact JSON command once when its live admission conditions pass. A `waiting_for_memory` response before registration is a no-action result. Any registered task, created receipt/log/output, uncertain transport outcome or task-name collision requires state reconciliation before further action.
4. Collect the durable creation receipt, exact task definition and final scheduler state/result, both complete stream logs, helper `result.json` and its relevant process/HTTP/tray receipts. Independently accept the actual configured behavior and resource/cleanup results before closing its task or updating the installed handoff.
5. Preserve both configured task definitions and attempts. Extend the separately reviewed cleanup request to include the exact failed first task and successful new task, with each actual full XML and creation receipt. The earlier fixed-20-task cleanup preparation cannot be executed unchanged for this two-attempt state.

The actual installed-module observation, new parser result, new execution result and actual configured acceptance are explicitly pending in the author record. This packet changes preparation only; root remains the sole PC and task-state writer.

## PowerShell references

- [Windows PowerShell 5.1 command and exit behavior](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_powershell_exe?view=powershell-5.1)
- [Windows PowerShell 5.1 redirection](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_redirection?view=powershell-5.1)
- [Windows PowerShell 5.1 script exit codes](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_scripts?view=powershell-5.1)
