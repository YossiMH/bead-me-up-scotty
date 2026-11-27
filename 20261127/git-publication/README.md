# Reviewed Git publication for the 2026-11-27 continuation

This packet prepares the remaining Git operations on the two installed Windows
repositories. Root is the sole PC executor and repository writer. Source review,
the exact ordinary Windows PowerShell 5.1 parse, a reviewed request containing
actual observations, and accepted installation/configured-launch reviews must
precede execution. The templates contain null future observations and cannot be
run as supplied.

The driver has three fixed operations:

| Operation | Repository | Exact scope |
| --- | --- | --- |
| `documents` | native or Scotty | Fetch and adopt a reviewed descendant changing only native `.marathon/progress.md`, or Scotty `README.md` and `docs/backend-compatibility.md`; normally push main only if it is still at the reviewed prior tip. |
| `checkpoint` | native | Commit the exact staged checkpoint delta from accepted publication and disposable-restore phases, then normally push that commit to the user's fork main. |
| `delete-reviewed-task-refs` | native or Scotty | Atomically delete the fixed 2 native or 86 Scotty task refs after an independently accepted retention proof and exact remote-tip readback. |

All operations use explicit `https://github.com/YossiMH/<repository>.git` URLs.
There is no free-form command, repository, changed-path, or deletion-prefix
interface. Accepted source commits remain `2d801ba455b7a722daf644a7615445117d57e8e9`
for native and `0309539797fd7d016e2b8fd8bdc0ae9cefc20219` for Scotty. These must be
ancestors of the actual reviewed local main. No product source/build/test command
is part of this packet.

## Runtime and resource envelope

Run the outer script once with ordinary PowerShell 5.1. It reuses the accepted
checkpoint-only Job supervisor, with a fixed Git driver and fresh output paths.
The retained source comparison lists every adapter change; normalized Job/PID
identity, timer, stream, memory sampler and owned-process cleanup bodies are
unchanged. The additional scalar memory observation records the lowest free RAM.

The outer host is hidden and BelowNormal. It owns one Node process with a
128 MiB heap and sequential Git children. The entire owned group, including the
outer host, has a 512 MiB resident-memory ceiling, a 3 GiB immediate free-memory
start gate, a 1 GiB live free-memory floor, and a 180-second hard deadline with a
12-second cleanup reserve. The normal driver deadline leaves another ten seconds
before the outer work stop. Each Git command has at most 45 seconds within that
remaining deadline. Streams are retained directly to files and bounded to 16 MiB
per Git stream; the supervisor samples every 100 ms. A deadline, assisted cleanup,
remaining member, or missing exact result makes the attempt fail.

All Git invocations set command-local `gc.auto=0`, `maintenance.auto=false`, and
`pack.threads=1`. Child-only environment settings prevent prompts, lazy object
fetches and replacement-object substitution. Pushes explicitly disable implicit
tag following and submodule recursion. Stored Git/authentication configuration
and normal hooks remain in effect. Every operation pins the ordinary local
`.git/config`, actual raw index, required private configuration and native DB
sidecars before entering a mutation. Native `publish.lock`, when present, must
remain an ordinary non-reparse zero-byte file.

The exact Git executable is
`C:/Program Files/Git/cmd/git.exe` at SHA256
`20d0dde30a65afb6e5810a883700a94dcd77fbf3b44b32868d45bf7c9b30137c`.
Node is the observed v25.2.1 executable at SHA256
`91ec09dda8f20556f366110859f106ab189d45f8f6a2bd092e6785174ad4a0fa`.
The existing `windows-task-job.ps1` must hash to
`2758a6ff94c0eecdfa360363469069dfa8470efc1f91228812146919a978921f`.
The separately accepted history driver at
`F:/Dev/.bead-edit-20261111/final-installation-v9-20261125-1151/checkpoint-only-handoff-20261127.mjs`
must hash to
`ff1597b37c873888aef55af6c67b39cd29efeb025d007fe11659ccb81a32cc46`.
The new driver imports only its existing index parsers/verifier; importing it
does not run its Windows phase entry point or open a database.

## Turn a template into one reviewed request

`request-templates.json` contains six named requests: native and Scotty documents,
initial and final native checkpoint publication, and native and Scotty task-ref
cleanup. Copy only the selected inner request to a new file under the task root.
Complete every null field from retained actual evidence. The concrete request
must receive an independent review before root hashes and invokes it.

1. Set a fresh `run_id` of 4–81 lowercase letters/digits/hyphens, beginning with a
   letter. Set `output_directory` to the exact immediate child
   `F:/Dev/.bead-edit-20261111/coordination-20261124/git-publication-<run_id>` and
   `supervisor_output` to that same string plus `.supervisor`. Neither may exist.
2. Set the hash-verified Job-helper path and confirm the staged sibling driver
   and supervisor hashes already present in the template. Record the actual
   installed native/app and configured-launch reviews in `reviews`, together
   with this packet's source/parse review and the operation-specific review.
   Each review pin is `{path,sha256}` under the coordination or history-retention
   directory; retain its exact bytes there before invoking the driver.
3. Read actual local branch/HEAD, actual raw index SHA256, ordinary local
   `.git/config` SHA256, and explicit fork main. Fill `expected_head`,
   `expected_index_sha256`, `expected_git_config_sha256`, and
   `expected_remote_commit` from that observation. Local branch must be main.
4. Populate every `private_state` entry with the exact observed
   `{path,exists,bytes,sha256}`. Absent DB/sidecar files use `exists:false` and null
   size/hash; present files require their actual size/hash. Native configuration
   and `.beads/.gitignore`, and Scotty `.env.local`, must exist. Checkpoint
   publication additionally requires the accepted restored native DB. Stop the
   application/native writers before observations and retain sole-writer
   authority throughout the attempt.
5. Inspect the effective `core.hooksPath` (or the ordinary hooks directory) and
   these named hook files: `post-index-change`, `reference-transaction`,
   `post-merge`, `pre-push`, `pre-commit`, `prepare-commit-msg`, `commit-msg`, and
   `post-commit`. Populate `accepted_hooks` with exact `{name,path,sha256}` rows,
   or `[]` only after proving they are absent. Any present hook requires an
   accepted, retained `hook_review` covering its behavior and resource use.
   Git 2.56 also supports hooks defined through configuration. The driver queries
   effective `hook.*` key names with includes and all normal scopes, and refuses
   any such definition pending separate reviewed execution. A filesystem hook
   review cannot implicitly authorize a configuration-defined hook. The query
   retains key names only; it does not expose hook command values. The driver
   repeats these checks before and after mutations, and refuses a configured
   fsmonitor.
   It never passes `--no-verify` or overrides `core.hooksPath`.
6. Replace the null attestations with `true` only after their named actual
   conditions and reviews hold. Fill the mode-specific fields below. Retain
   the final request bytes and their SHA256; any edit requires a new hash/review.

The outer script must be parsed from its exact staged bytes using ordinary
PowerShell 5.1 before the first mutation. Use the already approved process-only
execution-policy setting in the explicit launch:

```powershell
powershell.exe -NoProfile -NoLogo -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File 'F:\Dev\.bead-edit-20261111\final-installation-v9-20261125-1151\publish-reviewed-git-supervisor-20261127.ps1' -InputManifest '<ACTUAL_REVIEWED_REQUEST_PATH>' -InputSha256 '<ACTUAL_REQUEST_SHA256>' -TimeoutSeconds 180 -MaxOwnedResidentMiB 512
```

The angle-bracket values are deliberately non-executable placeholders. Root's
serialized connector action owns the actual launch and retains its command and
result. The driver and supervisor must be siblings. Keep exact source, request,
reviews, stdout/stderr, command receipts and both result files through final
independent reconciliation and durable retention.

## Documentation descendants and the native history baseline

Set `target_commit` to the actual independently reviewed doc-only commit already
published on the user's fork. For each changed document, fill its actual Git blob
ID, raw Git-blob byte count and SHA256, plus separate `working_bytes` and
`working_sha256` for the exact expected checkout bytes. Set
`document_autocrlf` from the actual effective setting. These are content
identities, not a promise that a proposed draft will later be published. Use immutable commit permalinks
for links into the transfer history so removing task branches will not break
the installed documentation.

The actual PC observation at 09:54 UTC found `core.autocrlf=true` in both
repositories, with no attributes for the three document paths and no configured
or filesystem hooks. Preserve that stored setting. The two byte identities let
reviewed LF Git objects become their exact built-in CRLF working representation.
The driver supports explicitly reviewed `false`, `input` or `true`; it never
overrides `core.autocrlf` on a merge or changes persistent configuration.

The driver requires a clean source/index, source ancestry, the exact changed-path
set, ordinary `100644` document modes and no active filter/encoding/ident/text/eol
attributes. It fetches
only the named target with tags/submodule recursion/FETCH_HEAD writes, automatic
maintenance and commit-graph writes explicitly disabled,
verifies every reviewed raw Git object, and uses `git cat-file --filters` to
produce the exact built-in checkout bytes for that path before any fast-forward.
The actual checkout mode and attributes are checked again before and after
`merge --ff-only`; external smudge/encoding/ident transformations stay refused.
The filtered output must match the independently reviewed working size/hash.
Obtain those expected working identities from the same Git built-in conversion
in a private cloud fixture under the observed mode, retaining its input object
and output identities; do not substitute a normalized-content-only comparison.
After the normal fast-forward, the driver checks the complete index against the
Git blob identities, actual working files against the separate working identities,
source cleanliness, private
state, and native checkpoint tree/entry preservation. If remote main is already
the target, it verifies that outcome. If main is the reviewed old HEAD, it makes
one normal explicit push. Any other remote value refuses the operation.

For native documents while the checkpoint tree is still
`ff0759095a01edb38ca4bb8aa90fbdb84476e0f7`, the same result additionally verifies
all 53 original checkpoint blob identities/types/sizes totaling 429,072,095
bytes. The exact target fetch, remote-main equality, immutable checkpoint tree,
and full batched object observation are retained behind
`remote_objects_verified:true`. This emits `original-git-baseline.json` with
lowercase `status:passed`, actual post-handoff HEAD/remote commit, both original
checkpoint-tree fields, and an exact raw-index backup under coordination.

Pin that actual baseline in the unchanged history request's
`accepted.original-git-baseline` field. The baseline must be captured **after**
installed source and the reviewed native handoff descendant are adopted. An
old preinstallation index or a proposed GitHub commit is insufficient. The driver
does not fetch unrelated histories to manufacture this evidence.

## Native checkpoint commits

Initial publication binds actual accepted `restore-original/result.json` and
`restore/result.json`; final publication binds `final-publish/result.json` and
`final-restore/result.json`. The request pins these files at their exact existing
history-retention phase paths. Each has to be passed, use the final native,
revision-9 plan/mapping, and identify the original repository as authority.
Their associated source/runtime reviews belong in `reviews`.

The driver pins both verification-phase Git snapshots to the corresponding
publication's `original-git-after.json`, checks the current complete index and
source state, and reuses the accepted `verifyPublicationIndex` against the exact
retained reconciliation. It permits precisely the reconciled checkpoint-only
staging, including both current and previous pointers. It rehashes the selected
published manifest and matches the verified generation/root before and after the
commit. This keeps every unrelated stage-0 entry and all pinned private bytes.

Expected `write-tree` runs on a fresh copy of the staged index inside this
attempt's output. This allows Git's legitimate cache-tree bookkeeping in that
copy while the actual accepted index remains byte-pinned until ordinary
`git commit --file`. The resulting commit must have exactly the old HEAD as its
single parent, the expected whole tree, and precisely the validated path delta.
Normal hooks remain enabled; any hook/concurrent-writer tree, index, source,
private-state or configuration change is rejected before the normal main push.

`git diff` is used only between immutable commits or with `--cached`. There is
no working-tree diff that would silently refresh stat data between raw-index
checks. The earlier installer's stat-refresh failure remains a failed historical
attempt; this helper does not weaken any byte guard or replay that installer.

An accepted checkpoint publication result has the unchanged history consumer's
fields: lowercase `status:passed`, `generation_id`, `root_sha256`,
`commit == remote_commit`, and the actual HEAD `checkpoint_tree`. Pin the initial
actual result as `accepted.checkpoint-publication` before the history `close`
phase. After closing cleanup and obtaining accepted final publish/restore
receipts, use a fresh final request and retain its actual commit result too.

## Exact remote task-ref deletion

The fixed ref-name sets come from the retained cleanup inventory SHA256
`246a1e5473c4a55cf9c1861faae0ec828b4c0dfaf519fbf5877e56589823db7a`.
The runtime accepts no additional name and no missing name. Main, archive,
feature and recovery refs are outside those sets. All actual current tip SHAs
come from the accepted retention receipt and are checked again by `ls-remote`.

For Scotty, first finish and retain the final transfer tip **T**. The reviewed
archive procedure creates one archive-only commit whose first parent and tree
are T, with the other 31 independent retained tips as additional parents. It
then publishes the fresh fixed
`refs/heads/archive/bead-editing-complete-20261127` and independently proves that
all 86 task tips are ancestors of that archive commit. Its actual receipt/review
schema is in `retention-receipt-templates.json`; every future value is null until
observed. The receipt has 32 distinct actual parents, T first, and T must equal
the receipt's `task/build-transfer-20261111` tip. The independent actual review
binds the receipt hash, archive commit, exact task-ref digest and coverage.

`reviewed_refs_sha256` is SHA256 of the UTF-8 canonical JSON array: sort rows by
`ref` using ASCII string order, sort each object's keys, and add no trailing LF.
The module exports `reviewedRefsDigest(rows)` so the cloud archive reviewer can
calculate the exact same value. Each row has only `ref` and `sha`.

For native, the receipt and independent actual review instead bind the exact
current main and prove that both named task tips are retained by that main.
The two source tips, main readback and coverage must be actual; the template
does not assert ancestry in advance.

The deletion invocation requires clean local source/index, accepted installed
reviews, and local main equal to retained remote main. It reads main, archive
(for Scotty) and every named task ref, then uses one ordinary atomic push with
explicit `--force-with-lease=<exact-ref>:<expected-tip>` and deletion refspecs
only. It neither force-rewrites a commit nor fetches diagnostic histories. The
server must support atomic pushes. The complete 86-ref command remains below
the Windows command-line bound. Readback must prove all requested task refs
absent and every retained main/archive ref unchanged; the complete local
source/index/private state must also remain unchanged.

Do not advance T after its final archive and before deletion. Save the actual
archive/deletion receipts in PC coordination, then publish completion records
separately after the deletion outcome is independently accepted. This avoids a
receipt/self-reference loop. Local worktrees and local branches have their own
reviewed cleanup inventory; this remote operation does not remove them.

## Failure and reconciliation

Every attempt claims new output paths and retains each intended command before
launching it. Existing output refuses replay. A missing/nonzero command exit,
timeout, resource limit, unexpected ref/index/private byte, or failed receipt
leaves the attempt failed. A failed push may already have reached the remote;
a failed post-commit check may already have created the local commit. The driver
never restores an old index, resets a ref, repeats a mutation, or claims rollback.

Before any separately reviewed recovery, root must retain the failed streams and
observe actual branch/HEAD, raw/logical index, source/private state, selected
checkpoint generation and relevant remote refs. If a normal main push completed
before interruption, reconcile that exact commit and its retained pre-push
checks. If an atomic deletion's result is uncertain, inspect all exact target and
retained refs. A partially changed set cannot be treated as success or repaired
by replaying the old request. Prepare the smallest reviewed next action from
actual state; the successful-path helper is deliberately one-shot.

## Qualification and sources

The retained cloud check record covers syntax and nine focused boundary/refusal
tests under a 128 MiB heap, including the effective Git-config query against an
included global config in a disposable directory. A second disposable Git fixture
proves that `core.autocrlf=true` leaves the pinned Git blob intact while both
`cat-file --filters` and ordinary checkout produce the exact separate CRLF bytes.
Neither fixture touches a product repository or invokes a hook. The checks do not represent a Windows execution or an
actual Git publication. The ordinary Windows parser receipt, independent source
review and actual operation/result reconciliation remain separate gates.

The exact hook and push behavior was checked against the primary Git manuals:

- [Git hooks](https://git-scm.com/docs/githooks): normal merge/commit/push and
  reference/index hooks remain observable and require review when present.
- [Git 2.56 configuration](https://git-scm.com/docs/git-config/2.56.0.html):
  configuration-defined hooks also require explicit observation; this packet
  refuses any effective `hook.*` definition without changing that configuration.
- [Git cat-file](https://git-scm.com/docs/git-cat-file): `--filters` applies the
  path's current checkout conversion; external transformations are refused before
  this packet uses it to verify the separate working-byte identity.
- [Git push](https://git-scm.com/docs/git-push): atomic remote transactions and
  per-ref leases with explicit expected tips supply the deletion contract.
- [Git diff configuration](https://git-scm.com/docs/diff-config.html): a porcelain
  working-tree diff may refresh cached stat data; this driver avoids that path.

Read `CLEANUP.md` before removing any packet, attempt, worktree or task ref.
