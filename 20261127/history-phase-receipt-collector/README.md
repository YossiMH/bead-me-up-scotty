# History phase raw receipt collector

This small read-only collector accepts one fixed phase name and reads exactly that phase's two result files. The driver result is under:

`F:/Dev/.bead-edit-20261111/preservation-checkpoint-only-20261127-v1/phases/<phase>/result.json`

The supervisor result is under the corresponding fixed coordination directory:

| Phase argument | Supervisor directory under coordination |
| --- | --- |
| `preserve` | `checkpoint-only-supervision-preserve-20261127-v1` |
| `freeze` | `checkpoint-only-supervision-freeze-20261127-v1` |
| `source-restore` | `checkpoint-only-supervision-source-restore-20261127-v1` |
| `restore-original` | `checkpoint-only-supervision-restore-original-20261127-v1` |
| `restore` | `checkpoint-only-supervision-restore-20261127-v1` |
| `close` | `checkpoint-only-supervision-close-20261127-v1` |
| `final-publish` | `checkpoint-only-supervision-final-publish-20261127-v1` |
| `final-restore` | `checkpoint-only-supervision-final-restore-20261127-v1` |

Coordination is `F:/Dev/.bead-edit-20261111/coordination-20261124`. Each supervisor receipt path ends in `/result.json`. The complete fixed paths are also recorded in `derivation.json`. These supervisor names match the accepted supervisor's required `checkpoint-only-supervision-` prefix. The executable source accepts no arbitrary path or output-name argument.

## Existing collector contract

The baseline is the independently accepted configured/installed closure collector, 5,474 bytes, SHA-256 `1598cd0fb37252f06790719079640b45835144d09019d5d2ceb2238bb37683df`. Five exact substitution groups add the validated phase selection, fixed path map, the extra fixed ancestors and phase identity in the inner and outer transport records. Their inverse recovers every baseline byte.

The read algorithm, held-file checks, byte signatures, gzip level, chunk protocol, timer, resource checks and exit handling are unchanged. The collector uses one Node process with a 64 MiB heap, sets and verifies BelowNormal priority, requires 1 GiB free physical memory at admission and live, caps its own RSS at 128 MiB, samples every 100 ms and enforces 15 seconds internally and in the connector command. Each raw file is capped at 2 MiB and the pair at 4 MiB.

All eight fixed ancestor/output paths are checked for ordinary directory type when present, with their identities rechecked. Every present receipt must be an ordinary file. Device, inode, size, nanosecond timestamps and the held descriptor are reconciled before, during and after the read, then at the final snapshot check. Missing directories or receipts remain explicit `present:false` records.

## Invoke only after the selected phase has settled

Root owns execution. `invocation.json` contains exactly the existing supported connector fields: `command`, `cwd`, `timeout_ms` and `expected_effects`. The embedded source decodes exactly to the adjacent reviewed collector. The initial command ends in:

```text
preserve 0 -
```

For another phase, replace only the first trailing argument with one name from the table. The first request for that phase uses offset 0 and dash. The source requires exactly three trailing arguments: phase, canonical nonnegative decimal offset and lowercase 64-hex package hash or dash. A positive offset requires the exact package SHA-256.

For a chunked response, keep the phase unchanged and use the returned `next_offset_bytes` and `package_sha256`. Match every part's total/package identity and its own chunk hash before assembling and decompressing it. The current invocation is 7776 characters; the longest accepted phase, safe-integer offset and full hash remain below the 8,191-character command boundary.

The stable compressed package contains the fixed scope, phase and raw-file records. Timing and memory observations stay outside it. No receipt JSON is parsed or regenerated, preserving exact 64-bit process birth ticks. Each response carries at most 37,500 compressed payload bytes / 50,000 base64 characters with the existing 65,000-character whole-response ceiling.

## Acceptance

This packet prepares transport only. A complete read can contain missing or failed receipts. Root must independently accept the selected phase's actual result, exact request/source bindings, supervisor result, resource measurements and owned cleanup before advancing the history sequence. Preserve failed or uncertain attempts and reconcile their actual state before another mutation.

The collector writes no PC files and starts no child process. Retain this source, its exact invocation and the author/reviewer records with the phase evidence.
