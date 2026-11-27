# Ready inputs for history and reviewed Git publication

This packet prepares installation of the already accepted CRLF helpers and the
small receipt set they consume. It adds no executor, product change, test suite,
task graph or actual acceptance. Root owns the PC, requests and all mutations.
The failed configured Session attempt cannot satisfy a successful launch gate.

## Fixed locations and what can be staged now

- **S**: `F:/Dev/.bead-edit-20261111/final-installation-v9-20261125-1151`
- **C**: `F:/Dev/.bead-edit-20261111/coordination-20261124`
- **I**: `C/revision-9/checkpoint-only-inputs`
- **R**: `F:/Dev/.bead-edit-20261111/preservation-checkpoint-only-20261127-v1`

The five entries in `source-stage-files.json` are exactly the existing root
`history-stage-items.json` proposal: four executable source files and the
independent review. They total **182,570 bytes** and come from immutable
`de71118c225936b8ca6eac4be5db306eff19219b/20261127/checkpoint-crlf-handoff`.
Keep both driver/supervisor pairs adjacent in S. The publisher also requires
the history driver at that exact S path, including in documents mode.

`receipt-stage-files.json` names six exact files totaling **45,412 bytes**.
Their raw payloads are included under `inputs/`. Copy them to the specified
I paths, retaining their original bytes and SHA-256. The two runtime consumer
receipts supply `runtime.qualification` and `runtime.review`; their separate
independent review is provenance. The actual successful install result supplies
`accepted.install`. Its independent review supports that completed operation;
it is not the later combined installed-review acceptance.

The source review appears in both manifests deliberately: S retains the
five-file source packet, while any copy used in publisher `reviews[]` must be
under C or R. One verified local copy from S to I is sufficient; no second
download is required. Before preserve, **R must remain absent**, so every
initial accepted pin belongs under C.

Create absent destinations exclusively. If an exact destination already
exists, inspect and compare it rather than replacing it. A mismatch requires
reconciliation. Preserve every old accepted helper and consumed attempt.
Stage only these small files; the original inventory and checkpoint data stay
on the PC.

## Small Windows staging and ordinary PS5.1 parse

Use root's existing bounded staging/readback envelope, a single hidden
BelowNormal Windows PowerShell 5.1 host, and its live resource guard. Keep the
operation serialized with other PC work. The readback below hashes only
182,570 bytes and parses the two approximately 20-KiB supervisors. It does not
dot-source a helper, compile embedded C#, import the history driver, invoke the
native CLI, or create phase output. No additional PowerShell child is needed.

After the exact files are staged, this is the complete source readback/AST
portion to place inside that existing bounded host:

```powershell
if ($PSVersionTable.PSVersion.Major -ne 5 -or $PSVersionTable.PSVersion.Minor -ne 1) {
    throw 'Use ordinary Windows PowerShell 5.1 for this parse receipt.'
}
$sourceRoot = 'F:\Dev\.bead-edit-20261111\final-installation-v9-20261125-1151'
$checks = @(
    @{ Name='checkpoint-only-handoff-crlf-20261127.mjs'; Bytes=84410; Sha='1015fa587954ecd1d0deddf8391789377b8c81cdf51ffa36994e7568df69c671' },
    @{ Name='checkpoint-only-handoff-crlf-supervisor-20261127.ps1'; Bytes=19195; Sha='c0c289a9bce78e761d6773ab59298b7e8c61ac9e9da4cefd52a9023497fd34e6' },
    @{ Name='publish-reviewed-git-crlf-20261127.mjs'; Bytes=45087; Sha='7d8be7200885652d7be1f15034574ebed128fd36724804e0764ab9c0a0259a13' },
    @{ Name='publish-reviewed-git-crlf-supervisor-20261127.ps1'; Bytes=20108; Sha='b86a74ad4d01e4f77dad554eda951cc0859122cf7a9ccf70dfb2892a1c0f2d52' },
    @{ Name='checkpoint-crlf-source-and-qualification-review.json'; Bytes=13770; Sha='8b05fa674dc1f5a04f284fe17b9072c155a3ad2d9690df9c0691a160bb993f1c' }
)
$checked = foreach ($entry in $checks) {
    $file = Join-Path $sourceRoot $entry.Name
    $item = Get-Item -LiteralPath $file -Force -ErrorAction Stop
    if ($item.PSIsContainer -or
        (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) -or
        $item.Length -ne $entry.Bytes) { throw 'Source shape or length differs.' }
    $actual = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $entry.Sha) { throw 'Source hash differs.' }
    $parsed = $false
    if ($entry.Name.EndsWith('.ps1')) {
        $tokens = $null
        $parseErrors = $null
        $null = [Management.Automation.Language.Parser]::ParseFile(
            $file, [ref]$tokens, [ref]$parseErrors)
        if ($parseErrors.Count -ne 0) { throw ($parseErrors | Out-String) }
        $parsed = $true
    }
    [pscustomobject]@{
        path=$file; bytes=$item.Length; sha256=$actual
        powershell51_ast_parsed=$parsed; parse_errors=0
    }
}
[pscustomobject]@{
    status='passed'; utc=[DateTime]::UtcNow.ToString('o')
    powershell_version=$PSVersionTable.PSVersion.ToString()
    files=@($checked)
} | ConvertTo-Json -Depth 5 -Compress
```

Retain the exact outer command/exit/stdout/stderr and five-file readback.
A successful AST parse is a source-staging gate, not a phase result. Root's
existing process-only `-ExecutionPolicy Bypass` remains confined to the
individual PowerShell invocation; do not alter stored execution policy.
Hash/parse the two supervisors again only if their staged bytes change.

Each actual helper invocation later uses exactly one of these already reviewed
supervisors with `-InputManifest`, its exact `-InputSha256`,
`-TimeoutSeconds 180`, and `-MaxOwnedResidentMiB 512`. Invoke that supervisor
directly as the single PowerShell host. It starts one bounded Node process with
a 128-MiB heap and sequential native/Git children. Preserve the 3-GiB immediate
start floor, 1-GiB live floor, 512-MiB aggregate cap, 180-second total and
12-second cleanup reserve. It owns its exact Job; no extra generic runner or
nested PowerShell layer is needed.

## Existing inputs to verify, without re-materializing tasks

`prerequisite-map.json` gives the exact plan, mapping, plan-review, runtime,
Git, Node and Job-helper identities. Keep the existing files:

- `C/revision-9/plan.json`: SHA-256 `18130e44…`, 55 tasks/91 edges.
- `C/materialization-result-v9.json`: SHA-256 `6d1cca5e…`, the accepted original mapping.
- `C/revision-9/plan-review.json`: SHA-256 `e26b5812…`, uppercase PASS and accepted revision 9.
- `C/inventory-before-node-v3.json`: the existing original 954-issue inventory.
  Preserve records its actual hash and every later phase rechecks it.

The history runtime must remain the qualified staged executable at
`F:/Dev/.bead-edit-20261111/stage-artifacts-v9-final-20261125-1151/native/release/bead-checkpoint-2d801ba455b7.exe`.
The same-byte installed app pin is outside the driver's allowed runtime root.
Do not discard the staged native, Node/Git bindings or qualified Job helper
during cleanup while later phases still depend on them.

## Document adoption and the original Git baseline

The accepted CRLF publisher supports the revised app and native documentation
with **normal fast-forward integration**. The inert two-request file in this
packet derives from the accepted publisher templates; only the driver and
supervisor hash fields change to the accepted CRLF pair.

Fill both requests from fresh observations and the final reviewed document
descendants. The fixed allowlists are:

| Repository | Changed paths |
| --- | --- |
| Native | `.marathon/progress.md` |
| Scotty | `README.md`, `docs/backend-compatibility.md` |

The helper fetches the explicit immutable commit from the appropriate user-fork
HTTPS URL, checks exact ancestry and changed paths, verifies the canonical Git
blobs and built-in checkout bytes, and runs `git merge --ff-only`. With the
observed unchanged `core.autocrlf=true`, provide both canonical LF hashes and
the separately reviewed CRLF working hashes. The helper verifies
`git cat-file --filters` output against the latter before adoption and hashes
the actual working files afterward. Stored Git configuration is not changed.

Use final document bytes after the actual configured/installed review updates.
The current draft hashes and predicted CRLF values are preparation; they must
not be used if that final text changes. Root's usual GitHub publication can put
the descendant on remote main first: then request
`expected_remote_commit == target_commit`, and the PC helper fetches/adopts
and verifies that remote main without pushing again. If remote main is still
the exact expected local baseline, the helper's ordinary push publishes the
already reviewed descendant. Any other remote value is refused.

The helper preserves every unrelated index entry, checks both Git configs
throughout, and directly rehashes app `.env.local` or the six native private
paths. It invokes only Git. Dynamic import exposes the history verifier
functions; it does not call history main. No command reads, initializes,
uploads or replaces Scotty's private `.beads` store. Preservation of that
store follows the exact document-only Git operation and hook/config guards;
the publisher does not claim a full private app database byte audit.
Unexpected configured hooks, filesystem hooks, fsmonitor or external document
transformations require separate inspection; none are silently suppressed.

The native document operation emits
`C/git-publication-<run_id>/original-git-baseline.json` and
`index-after.raw`. After actual publication acceptance, use those exact files
for history. They bind the post-handoff local/remote main, unchanged original
checkpoint tree, all 53 checkpoint object identities and raw index backup.
Keep that original baseline and raw index unchanged throughout all eight phases.

## Remaining accepted inputs and order

Before preserve, these five still-future inputs must be actual accepted
records under C: successful configured driver result, combined installed
review, final native text/publication review, final app text/publication review,
and the generated original Git baseline. All history prerequisite status
values must be lowercase `passed`, except the fixed plan review's uppercase
PASS. Preserve accepted originals; a consumer translation may describe an
already accepted result but cannot supply an unperformed operation.

The prepared handoff reviews are not final publication evidence. The failed
configured Session result is not eligible. The map leaves these future pins
null. Publisher reviews may use passed or PASS, but every referenced file must
still be beneath C or R and pinned to its exact bytes.

The main order remains:

1. Accept actual configured/installed results; finish and review both handoffs.
2. Publish and adopt the exact document descendants; retain native Git baseline.
3. Close the remaining noncleanup tasks from their actual accepted evidence.
4. Run preserve, freeze, source-restore, restore-original and restore, one phase
   at a time with complete raw result/supervisor reconciliation.
5. Publish the initial checkpoint using accepted restore-original and restore
   receipts. Retain its actual `generation_id`, root, commit/remote equality
   and checkpoint tree.
6. Finish accepted cleanup and its handoff text. Run close, final-publish and
   final-restore; reuse the original pre-close revision/reason and the initial
   checkpoint publication pin.
7. Publish the verified final checkpoint through the same bounded publisher.

The map lists every direct prior phase and fixed result path. Retain indirect
outputs too. R and each phase output are one-shot directories; occupied paths,
timeouts or uncertain mutation outcomes require retained-state reconciliation.
Keep frozen coordination, its raw-index baseline and all source receipts
through final restore and final publication.

## Retention and successor work

This is a named cloud packet, not a new Git worktree. Exact input source
receipts are already durable in the immutable commits listed in the manifests.
Root can publish this small preparation and install the small payloads while
the configured harness is repaired. Its existence makes no actual PC staging,
parsing, publication or task-state claim. If the process ends early, retain
later uncommitted preparation, complete the exact pending phase reconciliation,
and remove only clean task-owned worktrees through Riftri after durable
publication equality and fresh registration checks.
