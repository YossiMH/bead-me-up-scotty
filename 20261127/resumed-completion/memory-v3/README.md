# Bound the history driver's young generation

The candidate adds `--max-semi-space-size=4` to the history supervisor's Node
arguments and reports `node_semi_space_mib:4`. The history driver remains the
exact accepted `a137cfa1…` source. The old-space limit stays 128 MiB; the supervisor
keeps its 512 MiB aggregate RSS cap, 180-second deadline, 3 GiB initial free-memory
requirement, 1 GiB live floor, BelowNormal priority and owned-process cleanup.

## Measured cause and reduction

The pinned Node 25.2.1 runtime with the existing old-space argument reports a
320 MiB total V8 heap limit. At the pre-native boundary, the baseline's V8
`new_space` alone had 128 MiB resident while using about 12.7 MiB. The full
database snapshot comparison immediately before the native restore had expanded
the heap; the following synchronous child call gave the process no need to
allocate again and trigger further collection. The earlier generation-string
binding change made one graph collectible but did not constrain this capacity.

The original selected files, pinned Node and already-qualified Linux native
release were recovered by exact hash. The accepted cloud qualification's
200-operation manifest rebuilt the original 954 issues plus 55 task fixtures,
91 dependency additions and 54 closes. The resulting source had 1,009 issues,
11,465 events, six provenance receipts and 413 attempt outcomes. Its full SQLite
audit snapshot was 8,992,708 bytes. These generated fixture IDs/times are distinct
from the live PC store.

One baseline and one semi-space4 run exercised the unchanged checkpoint,
database, canonical equality, restored-corpus, restored-database, full inventory,
original raw promotion and selected-checkpoint retention functions. At the end,
the source/restored/retained checkpoint graphs, both database audit snapshots,
inventory, plan manifest and empty-init audit were deliberately all held live.
This resolves the risk that a smaller young generation might merely move an
allocation failure into post-restore validation.

| Measurement | Existing settings | Semi-space 4 MiB |
| --- | ---: | ---: |
| Total V8 heap allowance | 320 MiB | 140 MiB |
| RSS immediately before native restore | 355.2 MiB | 237.1 MiB |
| Peak Node RSS, external sampler | 384.0 MiB | 250.5 MiB |
| Peak Node plus native RSS | 412.9 MiB | 294.9 MiB |
| Maximum sampled V8 heap used | 160.9 MiB | 109.1 MiB |
| Elapsed outer time | 17.96 s | 18.36 s |
| Included validations | Passed | Passed |

The aggregate reduction was 123,785,216 bytes. External memory at the pre-native
boundary was only about 4.5 MiB in both runs, so explicit Buffer cleanup or GC
hooks are unnecessary for the observed cause. No additional benchmark, parser
rewrite, validation removal or heap-cap increase is proposed.

These measurements are Linux evidence. They omit Windows PowerShell/conhost and
are not an actual Windows restore receipt. The candidate preserves the existing
Windows aggregate enforcement. Git index/metadata operations were excluded from
the allocation reproduction; all allocation-bearing corpus and audit validation
functions were retained. The 1,009-row retained baseline inventory conservatively
stands in for the operational 954-row original inventory and task plan/mapping.

## Exact source and staging

Candidate: `checkpoint-only-handoff-crlf-supervisor-20261127-memory-v3.ps1`

- 19,243 bytes
- SHA256 `8bd43e176ce075d14cc9bf2f8a47f5fcecc91028066e5cddb3c63f558bd27553`
- Baseline supervisor SHA256 `c0c289a9bce78e761d6773ab59298b7e8c61ac9e9da4cefd52a9023497fd34e6`

Stage only this new filename under the existing
`F:/Dev/.bead-edit-20261111/coordination-20261124/revision-9/checkpoint-only-inputs`
directory. It resolves the unchanged history driver through `$PSScriptRoot` and
checks its own `$PSCommandPath` hash against the request. Its own basename is not
fixed by the source. This preserves the existing c0c supervisor and avoids a new
directory or replacement of accepted files.

The publisher 7db314/596abe pair remains coherent with the identical a137 driver
already in that directory; no publisher path/hash change is needed. Remaining
history requests name the new supervisor hash and use its new invocation path.
The command receipt gains one Node option and one explicitly reported bound.
`receipt-consumer-compatibility.json` records the accepted consumer checks.

## Source, evidence and retention

`supervisor.diff` is the complete two-line delta. `memory-comparison.json` pins
all raw profile results, external samples, instrumentation sources and fixture
inputs. The measurement import changes only three export declarations in a137;
the imported algorithm bodies are identical. Raw fixture snapshots remain in
the named cloud memory-engineering directory, with their identities retained.
Their fresh IDs/times are not represented as a recreation of the lost earlier
qualification's original bytes.

Node's exact-version documentation defines old-space separately and states the
young generation's relationship to the semi-space limit:
https://nodejs.org/download/release/v25.2.1/docs/api/cli.html#--max-semi-space-sizesize-in-mib

Root owns publication, staging and any subsequent live invocation. If the process
ends early, preserve this source/evidence packet before cleaning the exact
task-owned cloud memory-engineering directory. No worktree was created here;
continue the previously accepted Riftri cleanup for any separately registered
task worktree.
