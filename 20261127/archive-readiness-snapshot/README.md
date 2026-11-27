# Exact task-ref archive readiness: provisional snapshot

This read-only snapshot covers the fixed 86 app and two native task refs in
the accepted publisher. It prepares the final retention operation.
No archive object/ref or deletion result is created by this packet.

## Observed state

| Item | Observation |
| --- | --- |
| App transfer tip | `9d34662501095f50536221c9850478f5f65fa9e3` — provisional |
| Exact transfer tree | `8d9692cc4f4e3dad57d3b84c4baef1543d6c1eb5` |
| Other app task refs | All 85 tips match the retained exact inventory |
| App main | `b8caabf90652598f889f0b0bbc4e66d1b20a1877` |
| Native task refs | Both remain `2d801ba455b7a722daf644a7615445117d57e8e9` |
| Native main | `025ebc6a38013402b1936e932c104348aec06fd4` |
| Planned app archive | `refs/heads/archive/bead-editing-complete-20261127` was absent |

The matching-ref responses contain exactly the allowed names, with no missing
or additional task-prefixed names. Main/archive/feature/recovery refs are not
deletion targets. The raw GET bodies are retained in `remote-readback.json`;
the exact compact lists are in `observed-refs.json`.

## Parent and coverage proof

The existing Scotty object clone contained all observed task-tip objects.
With lazy fetch and replacement objects disabled, Git returned 32 independent
tips: the provisional transfer first, plus the same 31 additional parents from
the earlier reviewed preparation. The complete 640-commit parent closure
covers all 86 observed app refs. Every selected parent is outside the ancestry
of every other selected parent, establishing the minimal parent set among
these observed tips. The old transfer 42f540 remains an ancestor of 9d346625.

`graph-proof.json` retains the exact independent-tip/tree commands, complete
compressed parent graph, every ref-to-parent coverage witness and native proof.
Its compressed stdout has an explicit uncompressed size and SHA-256.
The clone is not shallow and has no grafts. `local-object-availability.json`
records the initial commit-object check.

The native clone lacked the new main commit. Its exact immutable GitHub
Git-commit response was read instead: main 025ebc6a has sole parent 2d801ba,
which is both observed native task tips. No native object fetch or ref update
was needed. This proof concerns the observed main; later checkpoint/doc
descendants need fresh ancestry confirmation.

## Replace before actual archive creation

1. Finish all intended transfer publications and select the actual final tip T.
   Replace the provisional tip, tree, ref-list digest and parent proof in a
   separate final preparation. Do not assume T remains 9d346625.
2. Repeat the five exact GET URLs retained in `remote-readback.json`: app
   task refs, native task refs, both mains and the planned app archive prefix.
   Require the fixed 86/2 name sets, exact observed tips, expected mains and
   absence of the planned archive. Compare all other 85 app tips again; review
   any change explicitly rather than restoring an older value.
3. Recompute independent parents from final T and the other exact app tips,
   verify complete ancestry coverage and obtain T's exact tree. The accepted
   publisher requires exactly 32 unique parents, with T first; a different
   recomputed count requires separate review before creation or deletion.
   Recheck both native task tips against the actual native main. Use current cloud objects
   or narrowly retrieved immutable commit ancestry; the PC does not need the
   31 unrelated diagnostic histories.
4. Root creates one archive-only commit whose first parent is T, whose tree
   is exactly T's tree, and whose remaining parents are the freshly verified
   minimal additional set. It then creates the single fixed archive ref.
   The commit does not merge the parents' file trees.
5. Retain actual commit/ref readback and independently accept exact parents,
   tree, all 86 ancestry witnesses, final reviewed-ref digest and archive
   reachability. Only those actual accepted receipts may fill the existing
   publisher's retention fields. This preparation is not that receipt.
6. Immediately before each ordinary atomic deletion, the accepted publisher
   rechecks the exact task tips, main and retained archive/main. Its per-ref
   expected-SHA leases apply only to the fixed reviewed list. Retain exact
   push results and post-deletion remote readback for both repositories.

The canonical ref-list digests in `readiness.json` use the publisher's sorted
`[{ref,sha}]` JSON convention. They must be regenerated from the final live
snapshot; raw file SHA-256 and canonical list digest are different identities.

Once final T has been archived, keep actual archive/deletion receipts in the
owned coordination retention and publish completion evidence at a separately
chosen durable location. Advancing transfer after archive and before deletion
would invalidate its frozen lease/coverage binding and require reconciliation.

This packet creates no worktree and changes no Git refs. Retain it until root
verifies durable publication. If interrupted, preserve unpublished evidence
and inspect fresh status/registration before removing clean owned worktrees
through Riftri without force. Original repositories and retained recovery
artifacts remain governed by their separate accepted cleanup inventory.
