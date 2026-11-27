# Complete the missing native archive

`continue-native-artifact-20261127.ps1` completes one recorded partial delivery.
The original downloader verified and promoted the app archive, then the native
ZIP command exited with code 1 before writing any bytes. The original attempt
finished with no cleanup errors, assisted cleanup, or remaining owned processes.

The continuation requires the exact 11,444-byte failure receipt with SHA-256
`a8219c011bdf2abe056679efefc100f6967ec67139a9ac12109e8c78da243778`
at the original `downloads-v9-final-20261125-1151.supervisor/result.json` path.
It also requires the original download directory to contain exactly these two
regular files:

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `scotty-15003467178.zip` | 7,056,005 | `15a503c45ded58ea48fcce7dd293b563d741a3424b64a39a6bd05edf5b1d409d` |
| `bead-15014634952.zip.partial` | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

The fixed original directory is
`F:\Dev\.bead-edit-20261111\downloads-v9-final-20261125-1151`.
The continuation opens the receipt, completed app ZIP, and old empty native
partial read-only with sharing that prevents writes or replacement. It retains
those handles until cleanup. It checks the previous downloader identity,
verified app result, exact native failure command and zero-byte result, and
clean process cleanup before creating any continuation attempt files.

## Transfer and output

The existing authenticated `gh.exe` queries current metadata and downloads only
native artifact `15014634952`. Its ID, name, producer run/head, expiry, byte
count, and raw ZIP SHA-256 remain bound to the accepted final installation.
The app ZIP is reused from its verified local bytes.

The fresh continuation locations are fixed:

- Attempt directory:
  `F:\Dev\.bead-edit-20261111\native-download-continuation-20261127-2889282bfcec`
- Exclusive claim: the attempt directory name plus `.claim`
- Supervisor evidence: the attempt directory name plus `.supervisor`
- New partial: `bead-15014634952.zip.partial` inside the attempt directory

All three attempt locations must be absent. The existing claim, supervisor
files and zero-byte native partial are preserved. An interrupted continuation
retains its own evidence and cannot be replayed.

The new native partial must contain exactly 4,524,263 bytes with SHA-256
`6bdb10496f976621d0b5545a8ef3b591a317e4a07d7e1f9276eb42d5fa09bba8`.
After verifying it, the script rechecks the complete original two-file state,
then moves the new native file to the original missing final ZIP path without
overwriting a destination. It finally requires exactly three files in that
directory: both complete ZIPs and the untouched old zero-byte partial. Both
final ZIPs and the predecessor receipt/partial are hashed again.

The unchanged staging request can then use its original two final ZIP paths.
The new supervisor's `result.json` records the previous receipt pin, reused app
archive, new native transfer, fresh partial path and final combined verification.
Acceptance requires exit zero, `status: passed`,
`both_final_archives_verified: true`, a passed native record, the app verified
before and after transfer, and clean owned-process cleanup. A per-file result
alone does not establish overall acceptance.

## Preserved execution contract

The source comes from the accepted PowerShell 5.1 downloader with SHA-256
`a5ba9dbfc7a56816a447d17e75131127d1e327d73b3dfd1fe158545e794e6555`.
All nine existing functions, including the complete asynchronous byte-stream
transfer, are unchanged. The embedded Job inspector, current metadata checks,
resource controls and existing process cleanup remain unchanged.

Execution is sequential, hidden and BelowNormal. It requires 1 GiB free
physical memory initially and throughout ordinary work, caps aggregate owned
resident memory at 512 MiB, stops work at 168 seconds and enforces a 180-second
hard Job deadline. Each stdout chunk is bounded before writing. Error streams
are counted and discarded; credentials and redirect URLs remain outside the
retained receipts. The script uses Windows PowerShell 5.1-compatible unsigned
type names.

The only parameter remains `JobHelperPath`, pointing to the existing helper
with SHA-256
`2758a6ff94c0eecdfa360363469069dfa8470efc1f91228812146919a978921f`.
Root owns independent source review, exact-file Windows parsing and the single
bounded execution under the current approved process-only launch option.
Runtime acceptance remains pending.

## Retention and cleanup

The isolated branch is `task/native-download-continuation-2889282bfcec`, based
on `60e5181d1f3b92983dd24e9533b85daa4124cc5c`. Its worktree is
`/tmp/beads-2889282bfcec/native-download-continuation`; the parent repository is
`/tmp/beads-2889282bfcec/scotty`. It was created through the existing Riftri
executable's process-scoped `exec` route with a sparse ordinary Git worktree,
using the already established fallback for this cloud filesystem.

Retain the reviewed packet before cleanup. Future agents must finish cleanup
if this process ends: inspect the exact worktree and branch, preserve any
unpublished or uncommitted work, then run the same Riftri executable with
`exec -- git -C /tmp/beads-2889282bfcec/scotty worktree remove
/tmp/beads-2889282bfcec/native-download-continuation` without force. Preserve
the local branch until the packet has a durable retained commit. No push is
performed by the author.
