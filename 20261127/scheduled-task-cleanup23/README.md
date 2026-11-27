# Exact cleanup of twenty-three scheduled tasks

This preparation extends the accepted twenty-two-task helper to the exact
requested set: nineteen original diagnostic registrations, three failed
configured-launch registrations and the separately named configured TCP attempt.
It preserves the original helper and all prior attempts. Execution requires an
independently accepted successful fourth configured result.

The helper is `remove-exact-scheduled-tasks23-20261127.ps1`, SHA256
`4b5c57817efcbf019568dc1a6cfdc4868d8c1f99dda3d86cf077afc193385c93`.
The exact source baseline is
`3877d47abe9699e60061f738e1642f4122ef26c702a7bc1d90c7b41fddb88414`;
its independent source review is
`d7e63570b39ec31c12e7f6fde105d0df6204764b6b840d44fd5a3a77b07d840a`.
Both are retained under `20261127/scheduled-task-cleanup22` at immutable transfer
commit `2a62978c93befa9a08566765344320e45ffbcb2c`.
All complete function bodies, C# guard, XML comparison, deletion loop and
normal/failure cleanup logic remain unchanged apart from the final exact
removal count. The changes are fixed input/task bindings and their validations,
additional private input copies, task counts and a fresh output name.
`source-delta.json` records each exact substitution and its required count.

## Retained fixed inputs

The original nineteen names and order remain identical to the accepted
baseline. Their complete private XML file stays on the PC at:

`F:/Dev/.bead-edit-20261111/coordination-20261124/scheduled-task-readback-20261127-v1/result.json`

It is 100,788 bytes, SHA256
`97971b4fb451e6be8839d8ca7e37a8d49f486d1b3b81aaeaf754293d3e7cbd4f`.
The public names manifest contains no XML. The helper reads and locks the exact
private file, requires its passed status and nineteen ordered rows, and compares
each later live registration against its complete original XML.

The configured attempts have fixed, distinct identities:

| Order | Exact task | Required completed result |
| --- | --- | --- |
| 20 | `ChatGPT-BeadEditing-Configured-20261127-2889282bfcec` | Scheduler result 1; original output directory absent |
| 21 | `ChatGPT-BeadEditing-ConfiguredCRLF-20261127-2889282bfcec` | Scheduler result 1; exact retained failed result |
| 22 | `ChatGPT-BeadEditing-ConfiguredSession-20261127-2889282bfcec` | Scheduler result 1; exact retained failed result after the aggregate-memory stop |
| 23 | `ChatGPT-BeadEditing-ConfiguredTcp-20261127-2889282bfcec` | Scheduler result 0; independently accepted passed result |

The first creation receipt is
`F:/Dev/.bead-edit-20261111/configured-task-20261127-2889282bfcec.json`,
2,571 bytes, SHA256
`435f47d69b28b32107325aba9bf72fe5675402725a31120bd6092ebf87a06efd`.
It binds the original helper
`8db39140f935b690af58fc2c604ba7a0566945f7c4ea140d6f98637ead75c5ae`.
The first output directory
`F:/Dev/.bead-edit-20261111/configured-v9-final-20261125-1151`
must still be absent.

The second creation receipt is
`F:/Dev/.bead-edit-20261111/configured-task-crlf-20261127-2889282bfcec.json`,
3,868 bytes, SHA256
`dca8d968ad1df097eb56baf80bede0c1453894974a6cdea4b4f6b29f9d5164e6`.
Its helper is
`f15cdc8bf98d8565a111951cc6b6dac7200a890e47758971470b3cbbf1395880`.
The second result is
`F:/Dev/.bead-edit-20261111/configured-v9-crlf-20261127-2889282bfcec/result.json`,
4,404 bytes, SHA256
`4068f777aeb3e7b5d29cd9f7ce3918a4c0eda44b8a9a6f0344157d6b085ff183`.
The helper requires its recorded failure, exact session-observation error, free
port, no cleanup errors, no remaining Job members and no assisted cleanup.
Its independent failure review is
`82695323d385d933f650dfee0d3a92f80a37f595b8001d7a3402b8cdf6083a22`,
retained at commit
`42f540b0938b88abcefb3f37a0664ded7e2b6bcb` under
`20261127/configured-launch-crlf-actual`.

The third creation receipt is
`F:/Dev/.bead-edit-20261111/configured-task-session-20261127-2889282bfcec.json`,
3,901 bytes, SHA256
`c86cf9a2fadf5958ebf4c126c30321bb87373bd6d9971370ab74a3a151a00cc9`.
Its accepted helper is
`33c6aba33ba436a0bfac320f3518f9334d8ba9b808a6d8079248bc8ab44976a4`.
The third result is
`F:/Dev/.bead-edit-20261111/configured-v9-session-20261127-2889282bfcec/result.json`,
11,603 bytes, SHA256
`e9ebb93fc64c308a235219b267e7887667cc91587b3061877c026cbae49e3358`.
The helper requires its exact aggregate-memory failure, free port, no remaining
Job members, and the recorded assisted cleanup and exceeded-budget flags.
Its independent failure reconciliation is
`dc3b886175ef051803f5f18073a0abccb1e275e08aaeba6657a36cb40aaabfd5`.
The retained failed result and its cleanup assistance are never converted into
a successful configured check.

These failed outcomes remain historical facts in the new cleanup result.
Removing their registrations does not change their status or delete their
creation records, logs, results, native fixtures or definitions.

## Future actual inputs

The supplied request is intentionally incomplete. Root fills the exact raw
SHA256 values only after the fourth configured attempt and its independent
acceptance:

- `configured.creation_sha256` pins
  `F:/Dev/.bead-edit-20261111/configured-task-tcp-20261127-2889282bfcec.json`.
- `configured.result_sha256` pins
  `F:/Dev/.bead-edit-20261111/configured-v9-tcp-20261127-2889282bfcec/result.json`.
- `configured.definition` pins one complete private JSON observation under
  `coordination-20261124`, containing exactly the four configured task rows
  in the order above. The planned path is
  `F:/Dev/.bead-edit-20261111/coordination-20261124/configured-task-readback-20261127-v3/result.json`;
  its actual bytes and SHA256 remain pending.
- `configured.review` pins the independent successful configured-launch review
  retained under the owned task root.

The fourth creation must bind helper
`818b25d528f0c07b7a913ec6aa6611359cff0aca5d9a3f5c6d523e9577543bf1`
at the fixed final-helper directory. Every creation must have the same accepted
user/session-1, Limited interactive token, create-only flag 2, RunEx flag 4 and
priority 7 contract. Each private definition must match that attempt's exact
creation action path, arguments and working directory, plus hidden/enabled
settings, priority 7, `PT2M30S` limit and multiple-instance policy 2.

The private definition readback uses the existing schema:
`status: "passed"`, with a `tasks` array. Each row contains
`name`, `path`, `state`, `running_instances`, `last_result`,
`actions`, `principal`, `settings` and the entire `xml` string.
Each row must be ready state 3 with zero instances. Its last result must be 1,
1, 1 and 0 respectively. Keep the complete private JSON and raw task XML on the
PC; outward review may retain only hashes, lengths and reconciled scalar facts.

The final passed result must use native pin
`0431a828bf95038641a0c55b4cf11c5800b52881940a13bd2f56b02f0b27177a`
and BUILD_ID `YIOHeRJTEdlOszyc4LyHr`, with free port, no remaining Job members,
no cleanup errors, no assisted cleanup and no exceeded budget. The independent
review must have accepted status `passed`, or `PASS` with `accepted: true`.
The separate final filled-request review must establish that the supplied
review, result, creation and complete four-task definition observation refer
to these exact attempts.

Only then may root set the three attestations:
`exclusive_task_registration_window`, `configured_launch_accepted` and
`failed_configured_attempts_retained`. The template identifies that planned definition path, keeps every future
actual hash null and every attestation false, so it refuses before creating
cleanup output.

## Exact deletion and retained records

The source requires an elevated root-owned session to see all task instances.
It selects only its fixed names in the root Task Scheduler folder. Before any
deletion, all twenty-three live tasks must match their pinned complete XML
code-unit-for-code-unit and by UTF-8 SHA256. Each live task must be ready, have
zero instances, and still be ready immediately after the instance query.

The helper holds all accepted input files open without write/delete sharing.
It saves eleven exclusive, durably flushed raw input copies: the request,
original definitions, three failed creation records, second and third failed
results, successful fourth creation, four-task definition readback, successful
fourth result and independent successful review. It also saves a full UTF-16LE XML
backup with BOM for each of the twenty-three registrations and reads each back
to the identical original text. It records both the XML text's UTF-8 hash and
the backup file's raw hash and length.

For each fixed name, the unchanged deletion loop saves
`delete-intended-NN.json`, repeats complete XML and ready/zero-instance checks,
calls `DeleteTask(exactName, 0)`, records a successful return, requires exact
file-not-found HRESULT `0x80070002`, then saves `deleted-NN.json`.
A final pass requires every exact name absent and twenty-three completed
removal records. No task is started or stopped, and no other process is killed.

Task Scheduler has no atomic comparison-and-deletion operation. Root's
exclusive registration window and immediate rechecks remain required. A changed
or missing registration, uncertain return, hard interruption or partial result
requires reconciliation from actual service state and retained intent/return
records. Existing output blocks replay.

## Bounds and invocation

The current helper runs BelowNormal with at least 1 GiB free before setup and
before work, a 1 GiB live free-memory floor, a 256 MiB own-process resident
ceiling, a 48-second work stop and a 60-second hard deadline. Its unchanged
100 ms C# timer observes only its own process and free physical memory,
including during a blocked COM call. It exits only this helper when a hard
guard fails. The outer invocation remains bounded to 70 seconds to cover
input and Add-Type setup as well.

The fresh output is:

`F:/Dev/.bead-edit-20261111/coordination-20261124/scheduled-task-cleanup23-20261127-2889282bfcec`

Stage the exact source, complete independent source review and ordinary
Windows PowerShell 5.1 AST parsing, fill and review a separate actual request,
then replace only the request path/hash placeholders in
`invocation.template.json`. Root alone executes once.

Hard guard exit codes remain 124 for deadline, 125 for memory pressure, 126 for
own-process RSS and 127 for an unavailable observation. A hard exit skips
PowerShell finally blocks; the private interruption and intended/returned
records remain necessary for reconciliation. Success requires matching raw
result, ordinary outer exit and all twenty-three actual absence checks.

Complete original/private inputs and XML backups stay retained for final
history. This helper removes only registrations. Exact parser acceptance,
four-task definition observation, filled-request review and actual removal
remain pending.

## Source recovery and inspection

The accepted baseline was recovered from immutable GitHub bytes and rehashed
against its complete original identity. This separately named derivative and
its templates are retained in the fresh cloud filesystem and serializable
session store. Two full author inspections compare the whole inverse source,
every unchanged function, C# monitor, deletion/finally path, fixed names and
all actual/future input bindings.

The existing primary API contracts are
[DeleteTask](https://learn.microsoft.com/en-us/windows/win32/api/taskschd/nf-taskschd-itaskfolder-deletetask),
[GetInstances](https://learn.microsoft.com/en-us/windows/win32/api/taskschd/nf-taskschd-iregisteredtask-getinstances),
[RegisteredTask.Xml](https://learn.microsoft.com/en-us/windows/win32/api/taskschd/nf-taskschd-iregisteredtask-get_xml)
and [RegisteredTask.State](https://learn.microsoft.com/en-us/windows/win32/taskschd/registeredtask-state).
