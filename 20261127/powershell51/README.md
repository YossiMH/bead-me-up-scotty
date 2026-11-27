# Final archive delivery

`download-qualified-artifacts-20261127-ps51.ps1` retrieves the two raw GitHub Actions
ZIPs named in the accepted final-installation binding. It checks each artifact's
ID, name, producer run and workflow commit, size, digest and current expiry
before transferring its bytes. It uses the installed authenticated `gh.exe`.

The process inherits its existing authentication. Its command line and retained
receipts contain no credentials or signed download URLs. It suppresses GitHub
CLI debug output in the child environment, keeps stderr in fixed pipe buffers,
and retains stderr byte counts. A failed CLI call therefore requires inspecting
the exit code and metadata receipts before choosing any next operation.

## Inputs and outputs

The only parameter is the existing accepted Job helper:

```text
C:\Users\YossiMH\AppData\Local\bead-edit-20261111\tray-host-execution-20261125\windows-task-job.ps1
```

The download directory is fixed by the accepted staging request:

```text
F:\Dev\.bead-edit-20261111\downloads-v9-final-20261125-1151
```

The directory, its sibling `.claim`, and its sibling `.supervisor` must all be
absent. The downloader creates an exclusive claim, retains failed `.partial`
files, and refuses replay. Only a complete raw ZIP with the exact byte count,
SHA-256, successful CLI exit and closed pipes moves to its final filename.

| Filename | Bytes | SHA-256 |
| --- | ---: | --- |
| scotty-15003467178.zip | 7,056,005 | 15a503c45ded58ea48fcce7dd293b563d741a3424b64a39a6bd05edf5b1d409d |
| bead-15014634952.zip | 4,524,263 | 6bdb10496f976621d0b5545a8ef3b591a317e4a07d7e1f9276eb42d5fa09bba8 |

Each file's metadata/result receipt and the combined `result.json` live in the
sibling `.supervisor` directory. A pass requires exit zero, `status: passed`,
both file records passed, no cleanup errors, no assisted cleanup, and no
remaining owned Job members. The script leaves complete and partial evidence
in place for reconciliation.

## Execution limits

The Job helper, process ownership checks, aggregate resident-memory sampler,
physical-memory check, hard deadline and owned cleanup come from the accepted
copy-only archive supervisor. `borrowed-methods.json` records that source.

Transfer is sequential, hidden and BelowNormal. It requires 1 GiB free physical
memory initially and while running, caps aggregate owned resident memory at
512 MiB, stops work at 168 seconds and enforces a 180-second total deadline.
The reusable stdout buffer is 64 KiB; metadata is limited to 64 KiB and stderr
to 64 KiB per command. Every stdout chunk is checked against its exact response
bound before writing. Pending pipe reads remain under resource/deadline
sampling. No product/native binary, browser, package installation or build runs.

## Root execution

Stage the independently reviewed downloader as an exact hash-checked file at:

```text
F:\Dev\.bead-edit-20261111\final-installation-v9-20261125-1151\download-qualified-artifacts-20261127-ps51.ps1
```

After review, parse this file with the existing Windows PowerShell parser
before launching it. Root owns the PC reservation and verifies that the
current approved process-only execution-policy option applies. The expected
invocation is:

```powershell
& 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe' `
  -NoLogo -NoProfile -NonInteractive -WindowStyle Hidden `
  -ExecutionPolicy Bypass `
  -File 'F:\Dev\.bead-edit-20261111\final-installation-v9-20261125-1151\download-qualified-artifacts-20261127-ps51.ps1' `
  -JobHelperPath 'C:\Users\YossiMH\AppData\Local\bead-edit-20261111\tray-host-execution-20261125\windows-task-job.ps1'
```

The current cloud environment has no PowerShell runtime. Its syntax and actual
Windows transfer remain pending until root obtains those results. Source
inspection is separate from execution evidence.

`immutable-staging-manifest.json` supplies the six unchanged accepted remote
files and the existing local Job helper copy, totaling 132,403 bytes. It gives
their immutable raw GitHub URLs, exact destinations, sizes and hashes. The
original `windows-fetch-artifacts.ps1` fetches and archives the historical
transfer branch and does not implement this narrow Actions-archive transfer.

After successful download, run `stage-artifacts-supervisor-20261127.ps1` with the
exact arguments and hash in `accepted-invocations.json`. This separately named
copy changes the accepted supervisor's two PowerShell `[ulong]` references to
`[uint64]` for Windows PowerShell 5.1. Its embedded C# and all remaining bytes
match the accepted supervisor. The original accepted file remains unchanged.
Check both its result and the stager
result and compare all five installer inputs with the accepted binding. The
installer still requires actual task/tray acceptance and a freshly observed
port inventory. Configured launch still requires installed acceptance inputs
and the immediate 3 GiB app-launch memory gate.

## Windows PowerShell compatibility correction

The downloader uses `[uint64]` for the same two minimum-memory sentinel
references. The previous `[ulong]` initialization failed before the script's
try block, Job entry, claim creation or output-directory creation. Root must
reconcile the actual attempt state before launching the corrected bytes.
The original downloader filename and bytes remain retained; the corrected
script uses the separate `-ps51` filename.
`powershell51-compatibility-author.json` binds both corrected files and records
the complete source comparison and author inspections. The archive IDs,
digests, destinations, request, resource limits and cleanup behavior are unchanged.
