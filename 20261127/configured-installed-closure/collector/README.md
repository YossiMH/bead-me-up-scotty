# Configured and installed task closure receipt collector

This packet prepares one small read-only collection after root runs the accepted two-task closure. It reads exactly these two files, in order:

1. F:/Dev/.bead-edit-20261111/coordination-20261124/completed-20261127-configured-installed/result.json
2. F:/Dev/.bead-edit-20261111/coordination-20261124/completed-20261127-configured-installed-supervisor/result.json

The coordination root matches the retained accepted input staging paths. The two output names are the exact root-assigned names. The collector does not infer a result from staging; a missing file is returned as present:false.

## Unchanged accepted design

The source is derived from the accepted TCP result collector, SHA-256 98e491ed377436cdba7c8a65a634da4c108cf4510329a3944e6fd038e1503361. Three recorded substitution groups change only the two fixed paths, their complete parent list, and the scope string. Reversing those substitutions reproduces every original source byte. All resource checks, file reads, byte identity guards, gzip/chunk behavior and exit handling remain unchanged.

The command uses the known C:/Program Files/nodejs/node.exe, a 64 MiB V8 heap and one process. It sets and verifies BelowNormal priority, requires at least 1 GiB physical free memory initially and live, and refuses its own RSS above 128 MiB. A 100 ms sampler and checks around reads/encoding enforce the same 15-second internal deadline; the connector invocation also has a 15-second timeout. It opens no child process and performs no writes, directory enumeration, recursive traversal, product execution or task mutation.

All six fixed ancestors/output parents are checked for ordinary directory type when present. Either output directory or receipt may be absent. A present receipt must be an ordinary file, at most 2 MiB; both raw files total at most 4 MiB. The collector verifies device, inode, byte length, modification time and change time before opening, against the held file, after reading and at the final snapshot check. Parent identities are also rechecked. Any unexpected type, changed file or resource condition refuses the collection.

## Exact raw transport

The collector does not parse either result JSON. It embeds exact raw bytes as base64, with byte counts and SHA-256 values. This preserves large 64-bit process birth ticks without JavaScript-number rewriting. The inner package contains fixed scope and ordered raw-file records only; invocation time and resource measurements remain in the outer record.

The same deterministic gzip/chunk protocol limits each response to 37,500 compressed bytes / 50,000 payload characters, with a 65,000-character whole-response ceiling. The initial command ends in 0 -. For a multi-part response, a later root-reviewed command may replace only those arguments with the exact next offset and complete package hash from the first response. Every part must match the same total/package identity and its own chunk hash. A changed package refuses continuation.

invocation.json contains only the four supported tool fields: command, cwd, timeout_ms and expected_effects. Its embedded source base64 must decode byte-for-byte to the adjacent reviewed source. Metadata is kept in the separate derivation and author records.

## Acceptance and retention

Root independently reviews this packet and invokes it after resolving any uncertain prior action. A successful read establishes transport integrity only. Actual closure acceptance still requires driver/supervisor success, exact request/plan/mapping identities, configured revision 5 to 6 and installed-review revision 3 to 4, 50 closed / 5 open, the original 954 rows and all other task fields/edges preserved, and unassisted empty-owned cleanup.

This ordinary cloud packet directory is not a linked worktree. Preserve the final source, command and author record in transfer history before removing it. The collector creates no PC artifacts. Historical partial staging and failed configured attempts remain separate retained evidence.
