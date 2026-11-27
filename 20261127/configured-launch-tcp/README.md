# Configured launch: bounded native TCP ownership lookup

Preparation for one fresh fourth configured-launch attempt. The previous Session attempt remains failed. This packet changes the operational check only; the installed app, native pin, production tray, runtime and user configuration stay at their accepted identities.

## Observed reason for this change

The Session attempt started at 11:32:44.8200843 UTC and failed after 4.8916348 seconds on 27 November 2026. Its exact result is 11,603 bytes, SHA256 `e9ebb93fc64c308a235219b267e7887667cc91587b3061877c026cbae49e3358`. The retained Job peak was 546,582,528 bytes against the unchanged 536,870,912-byte ceiling. The fixture init and interactive-session identity checks passed, and the actual batch, controller, tray host, tray and Next server started. No completed HTTP check or scalar edit was recorded. Forced cleanup stopped the owned descendants and the port was free; that assistance keeps the result failed.

The configured helper already runs in one PowerShell harness. The earlier successful tray wrapper saved a second smoke-driver host by using a runspace, so copying that mechanism here would not remove a current process. This packet instead avoids loading the NetTCPIP command module for the single listener-owner lookup. The actual failed result does not identify the precise instruction that crossed the limit. Memory savings and completion of the later HTTP route loads remain to be established by the fresh bounded configured run.

## Exact source change

The source baseline is [the accepted Session helper at commit 717acefc](https://github.com/YossiMH/bead-me-up-scotty/blob/717acefc5bf677c8d18dcf16b692117042bae4ae/20261127/configured-launch-session/windows-configured-launch-host-session-20261127.ps1), SHA256 `33c6aba33ba436a0bfac320f3518f9334d8ba9b808a6d8079248bc8ab44976a4`.

`windows-configured-launch-host-tcp-20261127.ps1` adds a small read-only `GetExtendedTcpTable` adapter to the existing C# inspector. The original two-line `Get-NetTCPConnection` lookup/assertion is replaced by the returned owner-PID array and the same all-owners-equal assertion. `source-and-command-delta.json` records both exact source replacements. Reversing them must recover the complete accepted baseline.

The adapter requests `TCP_TABLE_OWNER_PID_LISTENER` (3) for `AF_INET` (2) and `AF_INET6` (23). Sequential structures reproduce the documented DWORD and inline 16-byte address fields. `Marshal.SizeOf` and `Marshal.OffsetOf` derive row stride, first-row alignment and selected offsets, and explicit expected-layout checks refuse any different representation. IPv4 rows are 24 bytes with port/state/owner offsets 8/0/20; IPv6 rows are 56 bytes with offsets 20/48/52; both first rows begin after the 4-byte count. Ports are read as their first two network-order bytes.

Each family starts with the documented insufficient-buffer size query, allows at most three fill attempts, and allocates at most 1 MiB at a time. The whole two-family read must finish within 500 ms; the existing independent hard Job deadline remains active. Every allocation is freed in `finally`, including a resize or failure. Returned lengths and the full row count must fit the allocation. API errors, non-listening rows, invalid owners, partial rows and a changing table that does not settle all fail the attempt. No address filter or deduplication is applied: wildcard, concrete-address, duplicate and dual-family listeners at the requested port are all included. At least one must exist and every returned owner must equal the exact retained server PID.

All 20 other PowerShell functions, the existing C# process/Job/deadline methods, the full JavaScript observer, source/pin checks, readiness sequence, five scalar HTTP edits, native readbacks, actual NotifyIcon Exit, and complete cleanup tail remain byte-identical. The retained Session identity repair is unchanged. Parent and command-line CIM checks remain unchanged.

## Fresh invocation and parsing

Stage the exact helper beside the accepted `windows-task-job.ps1` in `F:\Dev\.bead-edit-20261111\final-installation-v9-20261125-1151`. The final helper hash is pinned in `configured-launch-com-command.json`. Root first obtains independent source acceptance and an ordinary Windows PowerShell 5.1 AST parse of all three inputs: the helper, `configured-launch-com-body.ps1`, and `inner-action-parser-input.ps1`. The latter is the exact no-newline action text rendered inside the scheduled action's `-Command` quotes. AST parsing alone does not execute or qualify the new native lookup; the fresh configured attempt does.

The compact outer command is 7,754 characters and retains its 30,000 ms registration-command timeout. Only five binding substitutions change its executable text: helper filename/hash, task name, output/log stem and creation-receipt path. Removing LF characters from the readable body recovers the compact text between the unchanged outer command quotes. The exact inner action is also retained for a single staging/parser operation.

| Item | Fresh identity |
| --- | --- |
| Helper | `windows-configured-launch-host-tcp-20261127.ps1` |
| Task | `ChatGPT-BeadEditing-ConfiguredTcp-20261127-2889282bfcec` |
| Output | `F:\Dev\.bead-edit-20261111\configured-v9-tcp-20261127-2889282bfcec` |
| Creation receipt | `F:\Dev\.bead-edit-20261111\configured-task-tcp-20261127-2889282bfcec.json` |
| Standard output/error | Fresh output path plus `.stdout.log` / `.stderr.log` |
| Selected native pin | `F:\Dev\bead-me-up-scotty\.scotty-local\bin\bead-0431a828bf95.exe` |
| Port | `43972` |

The command verifies the exact helper, qualified Job helper, selected native pin, observed CRLF tray modules and successful installation result/supervisor before registration. It requires fresh task/output/receipt/log paths, the expected logged-in Yossi account and Explorer session 1, a free port, and at least 3 GiB free physical memory twice. It uses Schedule.Service COM create-only flag 2, Limited run level 0, interactive token 3, priority 7, and one RunEx call with session flag 4. The exclusive creation receipt is saved before that call. A registered task or uncertain launch is reconciled, never replayed.

The scheduled action retains one PowerShell host; `&` invokes the helper in that same process, redirects both streams to fresh sibling logs, and propagates failure. There is no extra child PowerShell harness. The task keeps its 150-second Scheduler backstop. The helper keeps 120 seconds total, 108 seconds of work plus 12 seconds for cleanup, 512 MiB aggregate Job resident memory, a 1 GiB live physical-memory floor, 3 GiB immediately before app launch, BelowNormal priority and 128 MiB Node heaps. The installed batch uses its actual `.env.local` default pin, an isolated owned workspace/registry, the five required scalar edits and real tray Exit.

## Remaining actual gates and retention

Source acceptance, exact Windows parsing, fresh state/headroom checks and the actual fourth run are separate records. Accept success only when its result and Task Scheduler outcome agree, all required HTTP/native/tray checks pass, resource bounds hold, every owned process exits naturally, and the port and helper caches are released without assisted cleanup. Root then independently reconciles the exact creation/result/log/readback bytes before task closure.

Retain all three failed configured tasks, their creation receipts, results and logs. Cleanup preparation must extend the fixed task inventory from 22 to 23: Session now expects its observed failure result 1, and Tcp requires a future accepted result 0. No cleanup is executable until the exact four configured XML definitions and actual final success/review are available.

## Primary API references

- [GetExtendedTcpTable: families, table selection, return values and size contract](https://learn.microsoft.com/en-us/windows/win32/api/iphlpapi/nf-iphlpapi-getextendedtcptable)
- [TCP_TABLE_CLASS enumeration](https://learn.microsoft.com/en-us/windows/win32/api/iprtrmib/ne-iprtrmib-tcp_table_class)
- [IPv4 owner-PID row fields and network-order port](https://learn.microsoft.com/en-us/windows/win32/api/tcpmib/ns-tcpmib-mib_tcprow_owner_pid)
- [IPv6 owner-PID row fields and network-order port](https://learn.microsoft.com/en-us/windows/win32/api/tcpmib/ns-tcpmib-mib_tcp6row_owner_pid)
- [IPv4 table count and alignment contract](https://learn.microsoft.com/en-us/windows/win32/api/tcpmib/ns-tcpmib-mib_tcptable_owner_pid)
- [IPv6 table count and alignment contract](https://learn.microsoft.com/en-us/windows/win32/api/tcpmib/ns-tcpmib-mib_tcp6table_owner_pid)
