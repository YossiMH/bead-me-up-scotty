# Remove the exact completed scheduled tasks

This helper removes the nineteen task registrations named in
`original-task-names.json` and the single configured-launch task
`ChatGPT-BeadEditing-Configured-20261127-2889282bfcec`. Root runs it after the
actual configured launch, its independent acceptance, and review of the complete
filled request. The input template remains blocked by null future hashes and
false root attestations.

The original definitions remain in the private PC file:

`F:/Dev/.bead-edit-20261111/coordination-20261124/scheduled-task-readback-20261127-v1/result.json`

It must be exactly 100,788 bytes with SHA-256
`97971b4fb451e6be8839d8ca7e37a8d49f486d1b3b81aaeaf754293d3e7cbd4f`.
Root's retained readback command establishes its schema: lowercase passed status
and nineteen `tasks` rows, each with `name`, `path`, idle state, action/principal/
settings metadata and the complete `xml` string. The compact cloud summary
omits that XML. This packet retains only the task names and the source-file hash;
full XML is read and copied privately on the PC.

## Fill the actual inputs

The helper fixes the two configured execution paths:

- Creation receipt:
  `F:/Dev/.bead-edit-20261111/configured-task-20261127-2889282bfcec.json`.
- Successful result:
  `F:/Dev/.bead-edit-20261111/configured-v9-final-20261125-1151/result.json`.

Fill their exact raw hashes in `configured.creation_sha256` and
`configured.result_sha256`. The creation record must be the durable
`registered_before_run` file from the accepted COM invocation. It binds the
Limited interactive user/session, create-only registration, RunEx session flag,
BelowNormal setting and the exact configured helper
`8db39140f935b690af58fc2c604ba7a0566945f7c4ea140d6f98637ead75c5ae`.
The result must be passed, use final pin
`0431a828bf95038641a0c55b4cf11c5800b52881940a13bd2f56b02f0b27177a`
and BUILD_ID `YIOHeRJTEdlOszyc4LyHr`, and show free port, no remaining Job members,
no cleanup errors, no assisted cleanup and no exceeded budget.

After the configured task finishes, retain a separate complete private task
readback under coordination and fill `configured.definition.path` and `sha256`.
Use the same existing readback schema with exactly one row in `tasks`, the fixed
configured task name/path, complete `xml`, state 3 and zero running instances.
Root may adapt the existing readback command to this one name and a fresh
`scheduled-task-configured-readback-20261127-v1` directory. Independently accept
that actual definition against the accepted creation before filling the pin.
The helper also checks its exact action path/arguments/working directory against
the creation receipt, plus Limited interactive settings, hidden state, priority
7, `PT2M30S` limit and multiple-instance policy 2. The full XML comparison covers
the remaining registration fields.

Fill `configured.review` with the actual independent configured-launch review
retained beneath the owned task root. Its accepted status is either lowercase
`passed`, or uppercase `PASS` with `accepted: true`. The final request review
must confirm that this exact review accepts the exact configured result and
private definition observation. Root sets the two attestations only when that
acceptance exists and root owns the exclusive task-registration window.

All input files stay open without write/delete sharing for the whole attempt.
Each input is bounded, read as exact bytes, hashed and decoded only after its
hash matches. No full XML is printed or written into the public result.

## Exact removal boundary

The helper requires an elevated root-owned session. Microsoft documents that
`GetInstances(0)` can otherwise omit instances running above the caller's
security context. It connects only to the root Task Scheduler folder through
`Schedule.Service` and uses the fixed list of names; it never selects deletion
candidates by a prefix or wildcard.

Before the first deletion, every original live task must match its original
complete XML code-unit-for-code-unit and as complete UTF-8 bytes. The configured
live task must match its independently accepted full XML observation. Each task
must be in ready state 3, with zero running instances and a second ready-state
read after the instance query. Missing or changed tasks cause refusal.

The helper retains all six raw inputs privately, plus a complete XML backup for
each task. XML backup files use UTF-16LE with BOM so the original XML encoding
declaration remains appropriate. Each is read back as text for exact equality;
the receipt separately records the original XML's UTF-8 hash and the raw backup
file's hash and length. The existing raw definition file is preserved too.

For each fixed task, the helper saves a durable `delete-intended-NN.json`, repeats
its full live XML and ready/zero-instance checks, and calls only
`DeleteTask(exactName, 0)`. It records the successful COM return before checking
that the exact name is absent, then writes `deleted-NN.json`. Absence accepts
only the precise file-not-found HRESULT `0x80070002`; another COM error remains a
failure. A final pass checks all twenty exact names are absent.

Task Scheduler has no atomic compare-definition-and-delete operation. The
exclusive writer window and immediate rechecks minimize that gap. Any concurrent
change, uncertain COM return, guard interruption or partial deletion must be
reconciled from the actual service state and retained per-task records. Existing
output blocks replay, even when some tasks were successfully removed.

## Bounds and invocation

The helper runs BelowNormal. It requires 1 GiB free before setup and again before
work, keeps a 1 GiB live floor and a 256 MiB resident-memory ceiling for its own
PowerShell process, stops new work at 48 seconds, and has a 60-second hard limit.
A retained C# timer samples its own process and free physical memory every
100 ms, including while a COM call is pending. It uses `Environment.Exit` only
for this helper. All process monitoring and hard exits apply to the current
helper; Task Scheduler calls are limited to reads and exact deletion. PowerShell's `Add-Type` setup
occurs before the timer; the prepared outer invocation has a 70-second bound
covering setup too.

Guard exit codes are 124 for deadline, 125 for foreground memory pressure, 126
for helper resident memory, and 127 for an unavailable guard observation. A
best-effort private `guard-interrupted.json` records the code. A hard exit does
not execute PowerShell finally blocks and cannot prove the outcome of an
in-flight COM call; the durable intended/returned records are the reconciliation
boundary. A successful result requires all twenty absence checks and ordinary
completion without a reported error.

The output is the fresh exact directory:

`F:/Dev/.bead-edit-20261111/coordination-20261124/scheduled-task-cleanup-20261127-2889282bfcec`

After source review, verify the staged script hash and parse its exact bytes with
ordinary Windows PowerShell 5.1. The code has not run in this preparation.
Create a separate fully populated request from `request.template.json`, retain
and review its bytes, and replace only the two placeholders in
`invocation.template.json`. Root supplies the actual request path/hash and
executes once through the existing bounded administrator route.

The public result records names, definition/backup hashes, timestamps, counts
and resource measurements. Keep original definition JSON, configured creation/
result/review, all XML backups and per-task attempt records privately for final
history and any recovery. Only the registrations are removed; retained files
are inputs to later history acceptance and cleanup decisions.

## Primary API references

- [ITaskFolder.DeleteTask](https://learn.microsoft.com/en-us/windows/win32/api/taskschd/nf-taskschd-itaskfolder-deletetask): exact registered task name and unsupported flags.
- [IRegisteredTask.GetInstances](https://learn.microsoft.com/en-us/windows/win32/api/taskschd/nf-taskschd-iregisteredtask-getinstances): flag zero and caller-security visibility.
- [IRegisteredTask.Xml](https://learn.microsoft.com/en-us/windows/win32/api/taskschd/nf-taskschd-iregisteredtask-get_xml): complete read-only registration XML.
- [RegisteredTask.State](https://learn.microsoft.com/en-us/windows/win32/taskschd/registeredtask-state): state 3 means ready with no queued/running instances.
- [Environment.Exit](https://learn.microsoft.com/dotnet/api/system.environment.exit): ends only the current process and skips finally blocks.
- [System.Threading.Timer](https://learn.microsoft.com/en-us/dotnet/api/system.threading.timer?view=netframework-4.8): periodic callback ownership and disposal.
