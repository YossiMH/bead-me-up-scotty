# Windows qualification revision 9

This is the measured final qualification packet on `task/windows-check-runner-v9-20261125`.
Source `2d801ba455b7a722daf644a7615445117d57e8e9`, tree `509d6222300b84b16041a8366a8b6ae4c28ccc98`,
was built by run 45600413942, attempt 1, workflow `975d21cca470dbca61a9221391b98eeebcba9d1d`.
The build and separate full/small download verification succeeded; complete
original records are retained at `66d679b5fd3d190025068ad47167352fa5a90669`,
`20261125/revision-9/results/native-windows-build-45600413942`.

Full output 15016870072 contains all twelve test/support executables: lib, ten
integration targets and debug bead. The separate release has SHA-256
`0431a828bf95038641a0c55b4cf11c5800b52881940a13bd2f56b02f0b27177a`,
12,243,456 bytes, with its original metadata retained. The packet and every
partition bind the same actual source, build receipt, output manifest and release.

The algorithm preparation at `b49156a00d1d92385b8e62ea67277272a9caf7ea`
was independently accepted at `8e1adec64c1d517b67c433b671b7c3663ad3df7e`.
No helper algorithm changed during final binding. Relative to the accepted
revision 8 runner, the checker adds the complete six-test redaction_transaction
target and exact listing equality, and the aggregate uses the v9 output prefix.
The two PowerShell controllers, imported build utility and original-corpus
verifier remain byte-identical to revision 8.

| Partition | Required execution |
| --- | --- |
| core | Four selected library cases; complete attempt-receipt, tail and publication-lock targets; all twelve ordinary conformance cases |
| editing | Complete attempt-outcome, verified-restore, editing, capabilities, type-file and six-case redaction targets; original-corpus recovery; unchanged 55-command editing smoke |
| grid-1 | First two named scenarios, each under both fixtures |
| grid-2 | Middle two named scenarios, each under both fixtures |
| grid-3 | Last two named scenarios, each under both fixtures |

Every ordinary conformance, selected library and grid case is a fresh exact
invocation. Complete integration targets use one test thread. Each command has
at most 895 seconds inside its 900-second complete-case bound. The selectors
are absent for other cases. All twelve unique grid cells, the complete retained
streams and observed owned Job cleanup are required. A caught characterization
RED retains its full report; a failed, missing or timed-out required invocation
fails qualification. One shared 140-minute window covers all partitions and
aggregation. At most three grid jobs run together.

The workflow copy is `.github/workflows/native-final-windows-v9-20261125.yml`.
The native execution owner alone activates `task/checkpoint-windows-v9-check-20261125`,
after both final author inspections and independent acceptance of this exact
bound packet. This source preparation does not claim final native execution,
app Windows success, PC installation or canonical task-state completion.
