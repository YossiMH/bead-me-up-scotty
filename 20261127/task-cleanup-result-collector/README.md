# Exact cleanup receipt collector

This read-only collector retrieves two fixed result files after their respective cleanup attempts have settled:

| Role | Exact result path |
| --- | --- |
| Four failed-run cache directories | F:/Dev/.bead-edit-20261111/coordination-20261124/failed-tray-cache-cleanup4-20261127-2889282bfcec/result.json |
| Twenty-three task registrations | F:/Dev/.bead-edit-20261111/coordination-20261124/scheduled-task-cleanup23-20261127-2889282bfcec/result.json |

These names are constants in the independently accepted cleanup helpers. Each helper saves result.json in its own fixed fresh output. The collector reads no other receipt, backup, cache file, task definition or private store. It enumerates no directories, writes no files, and starts no child process.

## Exact derivation

The baseline is the accepted 5,474-byte configured/installed closure collector, SHA256 1598cd0fb37252f06790719079640b45835144d09019d5d2ceb2238bb37683df. Two substitution groups change only the two output-directory literals and the two fixed scope-label occurrences. Reversing them reconstructs every baseline byte. The variable named supervised is retained only to minimize the delta; it denotes the scheduled-task cleanup output directory here, not a separate supervisor process.

All seven helpers, the two offset/hash arguments, the six parent checks, held-file signature checks, final snapshot verification, raw packaging and error/resource behavior remain unchanged. Exact producer and source-review identities are in derivation.json.

## Bounds and transport

The process runs BelowNormal with a 64 MiB Node heap, requires 1 GiB initial/live free physical memory, caps its own RSS at 128 MiB, samples every 100 ms and has a 15-second internal and outer deadline. Each named raw file is bounded to 2 MiB and the pair to 4 MiB.

Every present file must be ordinary and unchanged across before/held/after/final checks. Parent identities are checked before and after. The raw file bytes are transmitted as base64 with exact length and SHA256; no result JSON is parsed or regenerated. This preserves 64-bit process creation ticks.

The inner stable package excludes changing time and memory fields. It uses the unchanged asynchronous level1 gzip and 37,500-byte compressed chunks, at most 50,000 base64 payload characters per response, with the 65,000-character whole-response ceiling. The invocation itself uses the previously accepted gzip/base64 source wrapper to stay small. It decodes to the adjacent exact reviewed source.

The initial command ends with the two arguments 0 and dash. If next_offset_bytes is nonnull, keep the same exact source and replace only the trailing arguments with that returned offset and package_sha256. Positive offsets require the exact package hash. Match all chunk identities, assemble and rehash the full gzip package, then rehash every decoded raw file.

## Missing or partial outcomes

A complete transport response can contain present:false or a raw failed/partial cleanup result. Neither means cleanup succeeded. The collector deliberately preserves those observations without interpreting or filtering them. A changing result file refuses the collection; wait for the exact attempt to settle before another read.

Root must reconcile each helper's actual request/source binding, retained backups, deletion intents and completion/absence records, resource limits and any failure. If a result is missing, malformed or records only partial work, retain the original outer execution and collect only the specifically needed additional owned evidence in a separately reviewed read. Do not replay either cleanup helper or delete its output to make a retry possible.

This source prepares evidence transport only. The concrete cleanup requests, exclusive-window attestations, actual helper executions and independent cleanup acceptance remain separate. Root owns all PC actions.

## Retention

This packet is an ordinary cloud author directory. Root retains its exact bytes and author/independent review in transfer history before final cloud cleanup. The collector creates no PC files.
