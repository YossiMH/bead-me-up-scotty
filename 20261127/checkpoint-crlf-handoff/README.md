# Checkpoint-only handoff for the observed CRLF checkout

This separately named compatibility packet preserves the accepted native release,
revision-9 task graph, actual mapping, phase order, supported restore commands
and resource limits. The original LF-only history helper ff1597b3 and Git
publisher 3c464a11 remain unchanged.

The original native repository has no SQLite database or sidecars. Its effective
`core.autocrlf=true` checkout expanded the four selected checkpoint files to
CRLF. Their pointers parse, but the raw JSONL bytes differ from the canonical
hashes recorded by those pointers. This packet preserves both representations.

## Exact original preservation

| Selected path | Canonical Git bytes | Original CRLF bytes |
| --- | ---: | ---: |
| current.json | 893 | 920 |
| previous.json | 892 | 919 |
| objects/4f5571a1823810366d4a3274c9231604913905c6334c380bf116b110ae5d486d.jsonl | 8,569,277 | 8,581,913 |
| objects/5711cb1301c4de33554b7df0ea3c9fb7bec4b9cc8108b47108b2fb53fac1936f.jsonl | 8,492,439 | 8,504,969 |
| Total | 17,063,501 | 17,088,721 |

The source pins every observed length, SHA256 and canonical Git blob ID. The
actual selected-file observation is dated 2026-11-27T10:17:26.6178952Z and was
retained in `configured-and-closure-readback.json` with SHA256
`75449d6ad9adddbd73538e3f2a75dd74429d8dfa5204d7180bf562f660b7765d`.
The independent original source trace was retained with SHA256
`3f9e45b3e2776f6a1b98a74009fef103cfd27307781ec6a68d6890dea75fe54d`.
These are historical evidence identities, not claims that a later recreated
metadata file has those same bytes.

Under the unchanged preservation root
`F:/Dev/.bead-edit-20261111/preservation-checkpoint-only-20261127-v1`,
the `preserve` phase creates:

- `original-files/checkpoint-raw`, containing the four exact original working
  files, totaling 17,088,721 bytes.
- `original-files/checkpoint`, containing their canonical Git counterparts,
  totaling 17,063,501 bytes, obtained through exact `git cat-file blob` reads.

The helper verifies the raw copies, canonical SHA256 and Git blob identities,
and exact LF-to-CRLF equivalence. It streams the fixed-file checks; the exact
pointer hashes establish the selected closure. Complete canonical record
validation and native restore checks still inspect the actual corpus.

Every original boundary retains the raw index, HEAD, original checkpoint tree,
all 53 immutable checkpoint Git entries, attribute refusals and clean checkpoint
status. The historical tree remains
`ff0759095a01edb38ca4bb8aa90fbdb84476e0f7`, with 53 blobs totaling 429,072,095 bytes.
Their remote reachability is established by the accepted post-handoff Git
baseline. The helper preserves that existing immutable-object recovery contract
without repeatedly reading all inactive working generations.

Original native config/ignore bytes and database absence remain guarded.
Separate receipts hash the Git configuration before and after each phase and
compare every later phase against the preserve-phase Git config hash. Effective
`core.autocrlf=true` is checked at every Git-state boundary. Persistent
configuration is never changed.

## Unchanged eight-phase order

| Phase | Compatibility behavior |
| --- | --- |
| preserve | Retain raw and canonical selected files; validate the canonical original 954-issue corpus and previous generation; retain all historical Git identities. |
| freeze | Freeze coordination as a writer and retain its complete current continuation checkpoint; prove it contains every canonical original record. |
| source-restore | Restore the retained canonical original into a fresh disposable target, verifying its full corpus plus exactly one new restore event/receipt. Then restore and verify the complete frozen continuation as before. |
| restore-original | Recheck DB/sidecar absence; initialize the empty original with no auto flush; restore the complete continuation with normal native publication; reconcile all 1,009 issues and full history. |
| restore | Restore and verify the newly published original generation in another disposable target. |
| close | After actual cleanup, text acceptance and first Git publication, close only the guarded cleanup bead. |
| final-publish | Flush the cleanup change through the original native authority and use strict staged-byte verification. |
| final-restore | Restore and verify the final generation before its final normal Git commit/push. |

The extra original verification target is
`original-canonical-restore-check` immediately under the preservation root.
Its source is canonical Git retention. Its large temporary snapshot graphs are
explicitly released before the full continuation verification, retaining the
128 MiB Node heap limit and every completed assertion/receipt. No prior original
SQLite state is invented.

The supported original mutation commands remain:

    bead --no-auto-flush init --prefix beadrs
    bead restore --source <frozen retained checkpoint> --generation <verified generation> --actor chatgpt-bead-edit-20261127 --prefix beadrs --format json

These are descriptive shapes. Root executes the reviewed helper through its
supervisor using a complete, separately reviewed and hash-pinned actual request.

## First publication's exact previous-pointer rule

The native release copies the old raw current pointer to previous.json and
retains its old root by path. The helper proves byte-exact CRLF promotion and
explicitly records that this raw previous generation is not directly restorable
by native. The separately retained canonical generation has already been
restored and verified in source-restore.

Normal Git staging under unchanged autocrlf=true cleans that old pointer back
to its canonical LF Git blob. The new initial-only verifier accepts precisely:

- The original checkpoint tree and original current pointer's index blob.
- Both fixed four-file raw/canonical retention sets, including LF-to-CRLF proof.
- Previous.json raw bytes equal to the preserved original current pointer:
  920 bytes, SHA256
  `ccb1abde721af7a7fedbf3302d0143bd12e332cee47530d05f6c3515b3338b0a`.
- Its staged blob equal to the original canonical current blob
  `fb204445a6a7b15f494b189839dddde2b84b139f`.
- The old root unchanged, all other changed files checked by their raw Git
  object hash, and all unrelated index entries preserved exactly.

There is no request-provided normalization allowlist. The strict exported
verifier keeps its former behavior. The final native publication promotes the
new LF current pointer and therefore uses only that strict verifier.

The separately named publisher imports the exact compatibility helper, invokes
this rule only for the initial checkpoint stage, and checks the helper identity
in both actual native publication/verification requests. Ordinary commit/push,
hook/config checks, expected tree and full index verification, and remote
readback remain inherited.

First Git publication follows successful restore-original plus restore and
precedes close. Final Git publication follows final-publish plus final-restore.
Git receipts continue to use `generation_id`; native phase results use
`generation`.

## Requests and launch

The inert history template changes only its helper and supervisor hashes.
Future runtime qualification/review pins, actual install/configured/text
acceptance, original Git baseline, prior phases, cleanup state and attestations
remain unset. Its phase/output fields are null, so it is not executable.

Use actual retained bytes for every future pin. The consumer accepts evidence
only below coordination or preservation. Before preserve, the preservation root
must be absent; therefore its prerequisites and post-handoff raw-index backup
must already be below coordination. Capture that baseline after native source
installation and native documentation adoption. Its HEAD/remote main must
match, both checkpoint-tree fields must be the immutable original tree, and
its remote-object attestation must be backed by actual fetch/object/readback
receipts.

Ordinary Windows PowerShell 5.1 must parse both exact supervisor copies before
execution. Root supplies their actual required parameters using the accepted
process-only launch flags:

    powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File <exact supervisor> -InputManifest <reviewed actual request> -InputSha256 <actual hash>

The borrowed envelope remains hidden BelowNormal, 3 GiB free at entry, 1 GiB
live free-memory floor, 512 MiB aggregate owned-process working set, Node
128 MiB old space, 180-second overall budget and 12-second owned-job cleanup.
The history supervisor changes only its driver filename. The publisher
supervisor changes its driver filename and the exact history dependency's
filename/hash. No process layer is added.

A preexisting phase directory, supervisor output or mutation receipt identifies
a consumed attempt. Retain it and reconcile actual state before any next
reviewed action. There is no automatic replay or rollback.

## Qualification and reset provenance

The cloud-only qualification uses the exact already-qualified native Linux
release and official Node 25.2.1 with --max-old-space-size=128. Its disposable Git
checkout contains the exact original 53-object checkpoint tree and uses
autocrlf=true. It demonstrates the actual raw-source refusal, canonical original
restore, complete 1,009-record synthetic continuation recovery, pointer-only
first staging, strict final publication and final restore. All original records,
all 1,009 issue scopes and the reconstructed resource locks retain their checks.
Synthetic task closes do not represent acceptance of live tasks.

The fixture explicitly releases large snapshots after their last assertions,
matching the actual phase process boundaries. It copies only the event map
needed for its one-event corruption refusal. Future actual PC phase results
remain separate from cloud qualification.

The current run 5 completed with exit 0 in 57.545 seconds under that exact 128 MiB
invocation. Its result reports 66 commands, 10 focused refusals, all 1,009 issue
scopes, three reconstructed resource locks, and recovered local sequence 11,466
against the original pointer's covered sequence 29,609. The successful result is
retained as qualification-result.json with SHA256
fe2056c92c6cc1946550fd7215341e40cb8b7fec9af766ca6b32523c49059f03.

Durable raw retention is scoped explicitly: the six-part compressed packet
contains 215 actual files, including 196 command stdout/stderr/exit records. The
other two command stdout records are byte-identical original canonical Git blobs
and are pinned to their immutable repository/commit/path/blob identities. The
entire 1,671-file fixture closure is hash-indexed and stays available locally
through independent review. Its full database/checkpoint snapshots are not
embedded in that smaller packet. Reproduction means the scenario can be rerun;
fresh timestamps, receipt IDs and task IDs are not promised byte-identical.

Earlier unsuccessful pre-reset attempts remain unsuccessful:

1. The first negative fixture omitted required actor and rejected the wrong
   failure reason. Actual runtime commands already supplied actor.
2. The second negative fixture replaced literal escape text instead of LF,
   producing no intended mutation; its expected refusal correctly failed.
3. The third reached final native restore/status, then its retained stderr
   showed a 128 MiB heap failure in the final whole-object test clone.
4. The fourth returned exit -6 before cloud access changed. Its exit metadata
   and stderr hash were observed, but its stderr text/last commands were not
   recovered; no cause or successful final phase is inferred.

The second reset removed their on-disk raw streams and unpublished candidates.
Historical process metadata is marked explicitly in the recovery record.
The current source was reconstructed from accepted originals and retained
derivation text, with new identities; it is not represented as byte-identical
to those earlier WIP candidates. Parts and derivation source are checkpointed
in V8 as well as files. Current actual qualification/raw records and independent
review determine acceptance.

See CLEANUP.md for exact ownership and successor cleanup.
