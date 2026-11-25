# Fresh archive staging for revision 9

This packet prepares the existing installer's `RuntimeManifest`, `StageNextDirectory`, `BeadExe`, `BeadSha256` and `BeadProvenance` inputs. It copies locally downloaded archives into a new child of `F:\Dev\.bead-edit-20261111`. It does not fetch source, install packages, start Scotty or bead, or change either original repository.

## Inputs and current gate

The app archive is the already-built output 15003467178 from run 45573503400 at app source 0309539797fd7d016e2b8fd8bdc0ae9cefc20219. Its 560 runtime files expand to 27,426,391 bytes. The complete runtime and eleven-file source inventory were recovered in run 45594231069 and independently accepted at a10c6eed3ab6c167ded7a12a817430a816a9672f.

The request template deliberately has no final native identity. Bind its source, tree, producer run/workflow, small artifact, ZIP, manifest, executable, original metadata and build-result records to the final revision 9 producer after independent review. Keep the original metadata bytes. The c90 release and its failed Windows operation-lock results remain historical; they are not a final installation selection.

Use a fresh lowercase stage name such as `stage-artifacts-v9-final-<unique-nonce>`. Replace the template's uppercase marker. Downloading the two ZIPs is a separate bounded preparation. Supply the original Actions ZIPs, including the app output's inner `scotty-runtime.zip`; do not repack them. Archive paths must stay in the task-owned root.

## Copy and resource controls

Run `stage-artifacts-supervisor-20261125.ps1` in a fresh hidden Windows PowerShell 5.1 process, with the exact reviewed helper/request SHA-256 values and the existing `windows-task-job.ps1` (SHA-256 2758a6ff94c0eecdfa360363469069dfa8470efc1f91228812146919a978921f). The recorded helper at `C:\Users\YossiMH\AppData\Local\bead-edit-20261111\tray-host-execution-20261125\windows-task-job.ps1` is accepted by the original absolute-path/reparse checks and its exact hash; no extra copy is required. Its parameters are `JobHelperPath`, `StagerPath`, `StagerSha256`, `RequestPath` and `RequestSha256`.

The supervisor retains the accepted materializer controller's Job membership, PID/birth identity, bounded output, owned cleanup and hard deadline algorithms. It checks at least 1 GiB free physical RAM immediately before copying and every 100 ms while work continues, limits aggregate owned RSS to 512 MiB, and uses BelowNormal priority. Work stops at 168 seconds, the copy helper's deadline is 158 seconds from supervisor start, and the owned Job has a 180-second hard deadline. The later application/tray/configured checks retain their separate 3 GiB gate.

The helper holds input archives open without write/delete sharing, verifies their exact outer sizes/hashes, checks unique safe ZIP paths, and verifies all runtime/native payload hashes and sizes before creating the stage. It uses 64 KiB copy buffers and a bounded memory stream for the existing 7,137,798-byte inner runtime ZIP. It reuses the installer's complete runtime hash/size/count/BUILD_ID validation after copying.

The stage, its exclusive sibling `.claim`, and its sibling `.supervisor` directory must be absent at the beginning of an attempt. A failed or interrupted copy preserves all three locations and any partial files for reconciliation; the controller refuses replay. A successful `stage-result.json` and successful supervisor `result.json`, with exit 0 and observed owned-process cleanup, are required together.

## Review status

This is a dormant preparation. Focused hosted parsing, actual existing app archive copying with a synthetic native package, archive refusal/copy checks, two final author inspections and independent source/results review are required before PC invocation. This packet does not complete installation or final task-history work.

The helper derives from the count-independent `Verify-Runtime` function in the accepted installer at 98a2daa3ef411c0f986daee1794c130f025c49cd. The supervisor is a narrow descendant of that commit's `materialize-v8-supervisor.ps1`. Their original files remain unchanged. The previously applied 523 tray stage must not be replayed.

Microsoft's [ZIP external attribute documentation](https://learn.microsoft.com/en-us/dotnet/api/system.io.compression.ziparchiveentry.externalattributes) defines the host-dependent field used to reject links/nonregular entries. Its [file sharing documentation](https://learn.microsoft.com/en-us/dotnet/api/system.io.fileshare) describes the read-only sharing used while both archive inventories are verified and copied.
