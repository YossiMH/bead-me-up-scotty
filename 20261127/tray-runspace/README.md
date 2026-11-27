# Tray smoke in one PowerShell host

`windows-tray-smoke-runspace-20261127.ps1` removes the separate PowerShell
process that previously ran the repository smoke driver. It executes the exact
reviewed driver in an isolated asynchronous runspace inside the existing
wrapper. The wrapper's main thread continues to sample the complete owned Job
while the driver performs its real Exit and parent-loss cases. The existing
restart-and-Exit case then runs unchanged.

The prior attempt stopped at 557,076,480 aggregate resident bytes before any
case passed. Its separate smoke-runner PowerShell reached 123,723,776 bytes and
its console host reached 8,658,944 bytes. Combining the two script hosts removes
those two processes. Runspace memory remains included in the wrapper's resident
measurement; the actual reduction needs the bounded Windows execution result.

## Preserved behavior and limits

The product files, smoke driver, observer, click fixture and accepted original
wrapper are unchanged. The copied driver must have SHA-256
`4e13d7172c8f520c17ae1698cc9428b5b5a87aaa3ed30e2bcc7a2dcbad870279`.
It has no `exit` statement. The new wrapper requires normal runspace completion,
successful `EndInvoke`, the complete two-case pass JSON, and the existing
independent process/session/exit checks. A JSON result emitted before a failure
in the driver's `finally` cannot pass. Expected silent process-lookup errors
retain ordinary script behavior; `HadErrors` is recorded rather than treated
as a substitute for completion and the actual case results.

The complete accepted Job inspector, process ownership checks, launch headroom
check, restart case, and owned cleanup remain unchanged. Execution stays hidden
and BelowNormal, with a 128 MiB Node heap, a 512 MiB aggregate owned resident
limit, a 3 GiB immediate controller-launch gate, a 168-second work deadline and
a 180-second hard Job deadline. The wrapper additionally checks the requested
1 GiB live free-memory threshold at every ordinary budget sample.

On interruption, the wrapper requests asynchronous runspace cancellation,
reclaims the exact owned Job descendants, and allows up to three seconds for
the invocation to finish within the existing cleanup reserve. A runspace that
does not finish cannot pass and keeps the hard deadline armed. Its local driver
copy remains recorded for reconciliation. The wrapper restores the temporary
process environment and Console.Error only after the invocation has completed;
environment values are read back without recording them.

## Execution and evidence

Root stages this new file beside the existing exact `windows-task-job.ps1`
whose SHA-256 is
`2758a6ff94c0eecdfa360363469069dfa8470efc1f91228812146919a978921f`.
Root owns the independent source review, the Windows PowerShell 5.1 parser
check, and one real bounded run in the existing interactive Explorer session.
Use the current approved process-only launch option. Keep the old wrapper and
failed attempt intact.

The parameters retain the accepted values:

| Parameter | Value |
| --- | --- |
| `RepositoryPath` | `F:\Dev\.bead-edit-20261111\stage-v6\scotty` |
| `NodePath` | `C:\Program Files\nodejs\node.exe` |
| `BeadBin` | The same exact qualified binary path from the original stage receipt |
| `SourceRevision` | `5232c8b94804064ab71af571ee28797667bd72bd` |
| `Port` | `43971`, freshly verified free |
| `TimeoutSeconds` | `180` |
| `NodeHeapMiB` | `128` |
| `MaxOwnedResidentMiB` | `512` |
| `EvidenceDirectory` | A fresh task-owned path, preserved on failure |

The final `result.json` retains the existing case and cleanup fields. The new
`driver_runspace` record identifies the hosting PID, exact driver hash,
invocation state, cancellation, disposal and restoration results. The original
driver stdout and Console.Error are retained under `existing-smoke`; its
PowerShell error stream is retained separately as `pipeline-errors.log`.

Pass requires exit zero, all three real cases, normal driver completion,
restored environment/Console.Error, disposed runspace, no cleanup errors or
assisted cleanup, an unexceeded resource budget, and no remaining owned Job
members. Actual runtime and syntax acceptance remain pending.

## Worktree handoff

The isolated branch is `task/tray-runspace-2889282bfcec`, created from
`5614839e9e6c47dfcf923f1ceabb708bd752ebbb`. Its worktree is
`/tmp/beads-2889282bfcec/tray-runspace`, with Git metadata shared by
`/tmp/beads-2889282bfcec/scotty`. Creation used the existing Riftri executable's
process-scoped `exec` route with a sparse ordinary Git worktree because the
cloud filesystem has no usable COW backend. No mount helper was installed.

Root must retain the reviewed packet before removing this worktree. Future
agents must finish that cleanup if this process ends: inspect its status and
branch, preserve unpublished or uncommitted work, then use the same Riftri
executable to run `git -C /tmp/beads-2889282bfcec/scotty worktree remove
/tmp/beads-2889282bfcec/tray-runspace` without force. Preserve the branch until
the reviewed changes have a durable retained commit. The author does not push.

The asynchronous hosting contract follows Microsoft's
[BeginInvoke](https://learn.microsoft.com/dotnet/api/system.management.automation.powershell.begininvoke),
[EndInvoke](https://learn.microsoft.com/dotnet/api/system.management.automation.powershell.endinvoke),
and [BeginStop](https://learn.microsoft.com/dotnet/api/system.management.automation.powershell.beginstop)
APIs available in Windows PowerShell 5.1.
