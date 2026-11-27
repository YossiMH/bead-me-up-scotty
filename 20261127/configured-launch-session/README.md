# Configured launch with retained process session identity

This is a separate continuation of the accepted installed-launch check after the
second attempt stopped while recording a short native fixture process. It
changes the observation helper and the fresh task bindings. The final product,
runtime, native binary, existing failed attempts and their files remain the
same inputs to acceptance.

## Exact observed failure

The retained second result is 4,404 bytes, SHA256
`4068f777aeb3e7b5d29cd9f7ce3918a4c0eda44b8a9a6f0344157d6b085ff183`.
It reports failure at 2026-11-27T10:47:05.5389705Z with
`Owned fixture-cli is outside the interactive Explorer session.`
The direct role record for PID 45124 has a null session, while its already
retained Job record has the same birth time
`134402500253322259`, start time, exact installed executable, session 1 and
exit code 0. The native init completed; the command list and HTTP request list
were still empty because the role registration threw before their recording.
The source places the batch launch after this init, so the actual app/controller
and editing work had not started.

The result also reports no remaining Job members, no cleanup errors, no assisted
cleanup, a free port, 131,555,328 bytes peak Job resident memory and
4,103,970,816 bytes minimum observed free memory. These are the failed attempt's
retained observations; they do not establish configured-launch acceptance.

Its exact create-before-run receipt is 3,868 bytes, SHA256
`dca8d968ad1df097eb56baf80bede0c1453894974a6cdea4b4f6b29f9d5164e6`.
The independent failure review is 6,459 bytes, SHA256
`82695323d385d933f650dfee0d3a92f80a37f595b8001d7a3402b8cdf6083a22`,
retained with this actual result at commit
`42f540b0938b88abcefb3f37a0664ded7e2b6bcb` under
`20261127/configured-launch-crlf-actual`.
The first configured attempt and this second attempt remain failed. Keep both
registered task definitions, creation records, available results and logs for
the later fixed task cleanup and history handoff.

## Narrow source correction

The source baseline is the 48,944-byte CRLF-bound helper
`f15cdc8bf98d8565a111951cc6b6dac7200a890e47758971470b3cbbf1395880`,
retained at commit
`717667dd46d5d27cb6708120429927bbadd57b5e` in
`20261127/configured-launch-crlf/windows-configured-launch-host-crlf-20261127.ps1`.

The new helper is
`windows-configured-launch-host-session-20261127.ps1`, SHA256
`33c6aba33ba436a0bfac320f3518f9334d8ba9b808a6d8079248bc8ab44976a4`.

Exactly two function fragments change:

- `Register-JobProcess` captures the managed session value once, requires it
  to equal the existing interactive session, and retains that same validated
  value. A priority-set error is tolerated only when the exact retained process
  has exited. Its PID, birth, Job-membership, image, process-count and handle
  ownership checks remain in place.
- `Add-Owned` gets the birth time from the already retained original process
  handle through the existing C# `Birth(handle, expectedPid)` check. It requires
  exactly one Job record with the same PID and birth time, copies the validated
  start/session fields from that record and still requires exact equality with
  the interactive Explorer session. It no longer asks the original managed
  process for session metadata after the short child may have exited.

A child that exits before any validated Job record is retained causes an
explicit refusal. Missing or ambiguous records, changed identity, null session
or a different session cannot become success. The original process is added to
the owned list before registration so the existing failure cleanup retains
ownership even if this assertion refuses.

The complete C# inspector, JavaScript observer, product hashes, scalar editing
checks, tray action, Job accounting and cleanup bodies are unchanged.
`source-and-command-delta.json` gives the two exact source substitutions;
reversing them recovers the entire accepted baseline byte-for-byte.

The other rapid-child observation paths were read in full. Completed native
API calls already use their matching close records; live lookups retain the
existing exit-race handling. The new lookup applies to the direct fixture
commands, batch process and observed roles through their shared `Add-Owned`
function. Current helper and Explorer session observations refer to the
existing interactive processes and are unchanged.

## Fresh third attempt

Use the new fixed names below only after independent source review and an exact
ordinary Windows PowerShell 5.1 AST parse.

| Item | Exact value |
| --- | --- |
| Task | `ChatGPT-BeadEditing-ConfiguredSession-20261127-2889282bfcec` |
| Helper directory | `F:/Dev/.bead-edit-20261111/final-installation-v9-20261125-1151` |
| Output directory | `F:/Dev/.bead-edit-20261111/configured-v9-session-20261127-2889282bfcec` |
| Creation receipt | `F:/Dev/.bead-edit-20261111/configured-task-session-20261127-2889282bfcec.json` |
| Standard output | Output-directory path plus `.stdout.log` |
| Standard error | Output-directory path plus `.stderr.log` |
| Loopback port | `43972` |

The new command is 7,770 characters. Reversing its five substitutions recovers
the entire previous command. The readable body adds only LF separators after
unquoted semicolons; removing those LF characters recovers the compact command
body. The two other command fields, working directory and 30-second outer
registration timeout, are unchanged. The prose describing the command now
identifies this helper and both failed predecessors.

The command preserves the accepted COM registration and one-host output capture:
create-only flag 2, Limited interactive user `DESKTOP-NRIGAJU\YossiMH`, session 1,
RunEx flag 4, hidden BelowNormal action, no scheduled trigger, and a durable
exclusive creation receipt flushed before the single launch request.
The same PowerShell process calls the script with `&`, preserves its exit
status and writes its streams to fresh sibling logs, including pre-output
failures. The helper's normal result encoding and paths remain unchanged.

The command checks exact helper, Job, pin, both actual CRLF module hashes and
successful installation receipts. It requires fresh task/output/receipt/log
names, the logged-in user and Explorer session, free port 43972, and at least
3 GiB free physical memory twice before registration. The helper retains its
120-second total bound, 12-second cleanup reserve, 512 MiB aggregate owned
resident-memory ceiling, 1 GiB live free-memory floor, 128 MiB Node heap and
3 GiB check immediately before app launch. No limit is raised.

The accepted installed inputs remain:

| Input | SHA256 or identity |
| --- | --- |
| Native pin | `0431a828bf95038641a0c55b4cf11c5800b52881940a13bd2f56b02f0b27177a` |
| Runtime BUILD_ID | `YIOHeRJTEdlOszyc4LyHr` |
| Installer result | `a2fe1009af72bbc776d8c4f7db46e0905d2a7d1e5ec18119b1d3abeef0798673` |
| Installer supervisor result | `ab6141355b9b8b349ba40105cb6d6d23945aec0b5b556ea4db1cfeebcc384760` |
| Job helper | `2758a6ff94c0eecdfa360363469069dfa8470efc1f91228812146919a978921f` |

The actual third result, ordinary parser acceptance, fresh task definition and
independent execution review remain pending. Root supplies these records and
executes the reviewed command once. Any uncertain registration or outcome
requires observation of the exact state; an occupied attempt is never replayed.

Later cleanup will require a separately reviewed fixed set of twenty-two task
registrations: the nineteen original tasks, both failed configured attempts and
this new configured attempt. The existing twenty-task cleanup preparation is
retained as its baseline and is inapplicable to this task set.

## Recovery and verification

The baseline helper and invocation were recovered through immutable GitHub
content, rehashed against their accepted identities, and retained both in the
fresh cloud filesystem and in the session's serializable source store.
This packet has new identities. No unavailable app draft or previous temporary
file is claimed to have been recovered.

Two full author inspections cover final source, invocation, delta and prose.
They check the complete inverse comparisons, exact C# and observer equality,
all unchanged functions, the actual failed result's PID/birth/session relation,
fresh names and logs, output capture, resource/cleanup ownership and remaining
execution gates. No product tests or builds are needed for this observation
correction. Root owns the exact staged parse and actual installed-launch check.

Retained primary contracts used by the unchanged code are
[GetProcessTimes](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-getprocesstimes),
[GetProcessId](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-getprocessid),
[Process.SessionId](https://learn.microsoft.com/en-us/dotnet/api/system.diagnostics.process.sessionid?view=netframework-4.8.1)
and [Process.HasExited](https://learn.microsoft.com/en-us/dotnet/api/system.diagnostics.process.hasexited?view=netframework-4.8.1).
The actual retained records establish the specific failure being corrected.
