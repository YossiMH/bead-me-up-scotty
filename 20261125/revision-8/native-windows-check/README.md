# Windows qualification revision 8

This is a dormant preparation draft on `task/windows-check-runner-v8-20261125`.
The final source is `c90f0cdbade93f9e9e6206e9a4d1999fa63afb1b`, tree
`13e8f57a4de57819dfe3f13cc71f6078ac27bba7`. The producer run, downloaded output and
release hashes remain explicit pending values. The active workflow directory
has no revision 8 workflow. Backend execution starts only after measured
bindings, two final author inspections and independent complete review.

The checker retains the prior ad41 source/archive/file verification, original
compile-time path restoration, native release checks and process supervision.
The existing build utility is imported only for those shared functions; its
historical build main is never called. The portable original-corpus verifier,
Windows Job helper and 55-command editing smoke stay unchanged.

| Partition | Required execution |
| --- | --- |
| core | Four selected library cases, complete attempt-receipt, tail and publication-lock targets, and all 12 ordinary conformance cases |
| editing | Complete attempt-outcome, verified-restore, editing, capabilities and type-file targets; original-corpus recovery; unchanged editing smoke |
| grid-1 | First two named scenarios, each under both fixtures |
| grid-2 | Middle two named scenarios, each under both fixtures |
| grid-3 | Last two named scenarios, each under both fixtures |

The five matrix entries run in separate hosted jobs. There are only three grid
entries, so at most three grid jobs can run together. Each ordinary conformance,
selected library or grid case is a fresh exact invocation with a distinct owned
temporary directory. Complete integration targets run with one test thread.
Each invocation gets at most 895 seconds of execution and a 900-second complete
case bound. Both OOB selectors are cleared for every other case. A caught OOB
RED is retained with its exact text; a missing, failed or timed-out required
invocation fails qualification.

One shared absolute 140-minute window covers the partitions and aggregation.
The Python runner and outer supervisor clamp their existing deadlines to that
window. The aggregate verifier rechecks full retained file inventories,
producer/source/release identities, command exits and selection, exact coverage,
the original-corpus and smoke results, and observed owned Job cleanup.

Before activation, populate all five input JSON files and the corpus input from
the accepted new Windows producer, bind their SHA-256 values in packet.json,
set its status to bound, and replace the workflow's pending packet SHA-256.
Publish the final reviewed workflow template unchanged to
`.github/workflows/native-final-windows-v8-20261125.yml`; the native execution
owner activates only `task/checkpoint-windows-v8-check-20261125`.
Keep every failed earlier run and all complete new outputs. PC installation,
actual tray behavior and canonical task-state materialization remain separate.
