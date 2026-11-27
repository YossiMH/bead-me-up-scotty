# App documentation publication request

This is a partially filled request for the accepted `documents` / `scotty`
publisher. It uses the observed installed repository guards and the accepted
configured/installed reviews. Complete its final document identities, target
commit, final text-review hash and root attestations before invoking it.

## Fixed operation and paths

- Repository: `F:/Dev/bead-me-up-scotty`, fork `YossiMH/bead-me-up-scotty`.
- Allowed changed paths: `README.md` and `docs/backend-compatibility.md`, both
  mode `100644`; the descendant must contain exactly these reviewed changes.
- Run ID: `scotty-documents-20261127-2889282bfcec`.
- Driver output: `F:/Dev/.bead-edit-20261111/coordination-20261124/git-publication-scotty-documents-20261127-2889282bfcec`.
- Supervisor output: `F:/Dev/.bead-edit-20261111/coordination-20261124/git-publication-scotty-documents-20261127-2889282bfcec.supervisor`.
- Planned completed request: `F:/Dev/.bead-edit-20261111/coordination-20261124/revision-9/checkpoint-only-inputs/publish-scotty-documents-20261127-2889282bfcec.request.json`.

Both output directories must be absent at actual admission. These are proposed
fresh paths; this preparation has not observed or created them on the PC.
Retain any failed or uncertain attempt and reconcile its recorded mutation
before selecting a later run ID.

## Observed repository guards

These values were supplied by root from the actual PC observation. The accepted
publisher checks them again and refuses a mismatch.

| Guard | Exact value |
| --- | --- |
| Local main HEAD | `0309539797fd7d016e2b8fd8bdc0ae9cefc20219` |
| Raw app index SHA-256 | `9886ccbe05b7e1b0b57ee91a9be1b833ebc1ca2044876387403a105ce6be7c7a` |
| Git configuration SHA-256 | `c819b572d0d46972e0b31de58d44762aea036f85a58dc81b45b514b0c28911be` |
| `.env.local` | Present, 131 bytes; SHA-256 `f9987d51bd7cf55417d085ec400e56b2cc338a523d4bbf45b908a55dde066cb0` |
| Built-in checkout mode | `core.autocrlf=true` |
| Accepted hooks | Empty; `hook_review` is inapplicable |

The app request's complete `private_state` list is the one `.env.local` record.
The publisher preserves its raw bytes and the stored Git configuration, checks
clean status and every unrelated index entry, and verifies the reviewed
canonical document blobs and expected working bytes before and after the
fast-forward. With this checkout mode, fill each `working_bytes` and
`working_sha256` from the exact reviewed CRLF working representation.

## Accepted helpers and reviews

The unchanged helper pair and history verifier are retained in the
[accepted compatibility packet](https://github.com/YossiMH/bead-me-up-scotty/tree/de71118c225936b8ca6eac4be5db306eff19219b/20261127/checkpoint-crlf-handoff).

| Component | SHA-256 |
| --- | --- |
| `publish-reviewed-git-crlf-20261127.mjs` | `7d8be7200885652d7be1f15034574ebed128fd36724804e0764ab9c0a0259a13` |
| `publish-reviewed-git-crlf-supervisor-20261127.ps1` | `b86a74ad4d01e4f77dad554eda951cc0859122cf7a9ccf70dfb2892a1c0f2d52` |
| `checkpoint-only-handoff-crlf-20261127.mjs` | `1015fa587954ecd1d0deddf8391789377b8c81cdf51ffa36994e7568df69c671` |
| Independent source/qualification review | `8b05fa674dc1f5a04f284fe17b9072c155a3ad2d9690df9c0691a160bb993f1c` |
| `windows-task-job.ps1` | `2758a6ff94c0eecdfa360363469069dfa8470efc1f91228812146919a978921f` |

The three executable files and the Job helper use
`F:/Dev/.bead-edit-20261111/final-installation-v9-20261125-1151`.
The Job helper path is the same exact copy recorded in the passed TCP result.
The existing supervisor binds Git `C:/Program Files/Git/cmd/git.exe` /
`20d0dde30a65afb6e5810a883700a94dcd77fbf3b44b32868d45bf7c9b30137c` and Node `C:/Program Files/nodejs/node.exe` /
`91ec09dda8f20556f366110859f106ab189d45f8f6a2bd092e6785174ad4a0fa`.

Review JSON inputs stay below
`F:/Dev/.bead-edit-20261111/coordination-20261124/revision-9/checkpoint-only-inputs`:

| Review file | SHA-256 |
| --- | --- |
| `configured-tcp-actual-review.json` | `ebe3a62e564a17568d6f7ae16596fe2809cc43782327057200d8406323771e8b` |
| `installed-final-review.json` | `b3bdf0990e7513c9ea57f31b72aecaee582c1b284193dfb78a233c157f84703b` |
| `app-handoff-final-text-review.json` | Pending final text acceptance |

The two actual reviews are exact immutable objects in
[the accepted installed-result packet](https://github.com/YossiMH/bead-me-up-scotty/tree/3151657df5939a2756d504860d655c058b808828/20261127/configured-launch-tcp-actual).
Root's existing acceptance stager targets the first two paths above.
Hash-read the actual PC copies before final request acceptance. The final
text review must be separately written and staged at the third path with its
exact final hash. Each review must have accepted status and no open findings.

## Complete the remaining fields

1. Freeze the final app document and unchanged production-launch README after
   the actual configured/installed task closures have been reconciled. Complete
   both final author inspections and the independent final text review.
2. Create the exact documentation descendant in the cloud and publish it through
   the authorized GitHub-first main workflow. Verify its parent ancestry, the
   exact two changed paths, modes and document blobs, and remote main identity.
3. Set both `target_commit` and `expected_remote_commit` to that same actual
   published descendant. `expected_head` remains the observed local built HEAD
   until this PC adoption. Using the old built remote HEAD after cloud main has
   advanced would correctly fail the publisher's remote-before check.
4. Fill both `document_files` records with final canonical byte length, SHA-256,
   Git blob ID and separately reviewed CRLF working length/SHA-256. Fill the
   final review hash. Retain the complete actual review files below the
   coordination root, then independently review the completed request.
5. Root confirms a fresh exclusive repository-writer window and the observed
   guards, then sets the four attestations to true. Save and hash the completed
   request exactly. All null execution fields in this template must be resolved.

`hook_review:null` remains intentional because `accepted_hooks` is empty.
Root must reconcile any changed local HEAD/index/configuration/environment
or unexpected source changes before issuing a differently bound request.
The accepted helper performs an exact immutable commit fetch, fast-forward
adoption and remote-main equality check; the already-published target needs
no additional main push.

## Existing bounded invocation

After the completed request is independently accepted and staged:

```powershell
& 'C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe' `
  -NoLogo -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass `
  -File 'F:/Dev/.bead-edit-20261111/final-installation-v9-20261125-1151/publish-reviewed-git-crlf-supervisor-20261127.ps1' `
  -InputManifest 'F:/Dev/.bead-edit-20261111/coordination-20261124/revision-9/checkpoint-only-inputs/publish-scotty-documents-20261127-2889282bfcec.request.json' `
  -InputSha256 'FINAL_COMPLETED_REQUEST_SHA256' `
  -TimeoutSeconds 180 -MaxOwnedResidentMiB 512
```

Replace the single hash placeholder with the exact reviewed completed request
hash. The retained supervisor keeps BelowNormal priority, the 128 MiB Node
heap, 3 GiB start admission, 1 GiB live free-memory floor, 512 MiB aggregate
cap, owned Job accounting and 180-second hard limit. Its existing work deadline
and cleanup reserve are unchanged.

Do not invoke this incomplete template. The supervisor can create its own
attempt directory before the Node driver's missing-attestation checks; a
template refusal would therefore consume an attempt. Final result acceptance
must reconcile both the driver's result and supervisor receipt, actual main
and remote equality, exact changed-document and unrelated-index proofs,
preserved configuration/environment and normal owned cleanup.

## Preparation scope

This packet derives the existing Scotty inner request schema and changes only
the accepted compatibility helper bindings, proposed fresh paths, known guards,
review locations and explicitly observed checkout/hook state. It adds no
executable helper. Its final text identities, commit, review and attestations
remain future inputs. Root owns staging, publication, PC adoption and task-state
writes. Preserve this prepared packet and the completed accepted request with
their later actual receipts.
