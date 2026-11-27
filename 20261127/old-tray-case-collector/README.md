# Old TrayHost case-log collector

## Scope and basis

This is a read-only evidence collector for the already failed original TrayHost attempt. It is not a new tray or product check.

The exact observed result is 14,492 bytes with SHA-256 0974b117a9586541024de04f1d2b4c87db59362dfd37556d57f355dbee815370, recovered from F:/Dev/.bead-edit-20261111/tray-host-check-20261127-2889282bfcec/result.json. The accepted wrapper set TEMP/TMP to that attempt's temp directory. Its exact smoke driver (SHA-256 4e13d7172c8f520c17ae1698cc9428b5b5a87aaa3ed30e2bcc7a2dcbad870279) creates a scotty-tray-smoke- directory followed by a lowercase 32-digit hexadecimal GUID, then fixed exit and parent-loss case directories. The failed outer result did not retain the chosen GUID.

The collector reads immediate entry names only from:

F:/Dev/.bead-edit-20261111/tray-host-check-20261127-2889282bfcec/temp

It permits at most 32 entries and 4,096 total UTF-16 name characters, sorts them, and requires exactly one name matching scotty-tray-smoke-[0-9a-f]{32}. All fixed ancestors and that selected directory must exist as ordinary directories under the inherited lstat/symlink guards. It then reads only:

- selected directory / exit/processes.jsonl
- selected directory / parent-loss/processes.jsonl

Either case directory or log may be missing; that is retained explicitly. Existing logs must be ordinary files. Each is limited to 32 KiB, both to 64 KiB. The collector does not enumerate any other directory, recurse, read fixture stores, parse the log JSON, create children, write files, start a product, or delete anything. It rechecks the exact immediate names, directory identities and each file's device/inode/size/mtime/ctime after the reads. A change, size violation or ambiguous selected directory refuses the collection.

## Derivation and transport

Seven explicit substitutions in transformations.json invert the complete 6,161-byte collector to the accepted 5,561-byte TCP fixed-file collector, SHA-256 98e491ed377436cdba7c8a65a634da4c108cf4510329a3944e6fd038e1503361. The resource checks, bounded exact-size file reads, stable file identities, raw base64 fields, gzip response, chunk continuation checks and exit/error behavior are inherited unchanged. The new behavior is the bounded exact-directory selection, stricter required ancestors, smaller raw limits and scope/package fields.

The retained invocation embeds a deterministic gzip of the exact UTF-8 source. Its source payload is 2,670 bytes, SHA-256 9b6ca4b070b4e41b98590dee01db64d54c95b09a45e9901f41fa9e000b7faad1, with zero gzip modification time. Decoding and decompressing it reproduces the reviewed source exactly. The command is 3,708 characters; direct uncompressed source base64 would be 8,331. The compressed input is fixed small source text, not data fetched at runtime.

The single process is the known C:/Program Files/nodejs/node.exe with a 64 MiB V8 heap. It sets and verifies BelowNormal priority, requires at least 1 GiB physical free RAM before reading and during execution, samples every 100 ms and around operations, refuses own RSS above 128 MiB, and has a 15-second deadline. The connector invocation also has a 15-second bound. The fixed source decoding occurs within the outer invocation bound before the inherited internal timer starts.

The result preserves raw bytes, exact byte counts and SHA-256 values. It never parses and rewrites birth ticks. Its stable inner package contains only fixed scope/path information, the sorted immediate names, selected directory and raw file records. Invocation time, memory and sample counts appear only in the outer transport record. Thus unchanged raw inputs produce the same package for continuation. Each response carries at most 37,500 compressed bytes / 50,000 base64 payload characters, with a 65,000-character whole-line ceiling.

The frozen invocation requests offset 0 with expected package identity "-". If it returns a chunk, root may prepare a later invocation that changes only the two trailing arguments to the returned next_offset_bytes and exact package_sha256. Each chunk must verify its offset, byte count, hash, total compressed size and full package identity. A changed package refuses; never combine chunks from different package identities.

## Ownership and cleanup

Root independently reviews and invokes the exact command after any uncertain PC action is reconciled. This packet records preparation only; it does not claim that the old logs exist or that any cache is safe to remove. Actual log contents must be reconciled with the old attempt's retained process identities before any later narrowly authorized cleanup.

The collector is an ordinary cloud packet directory, not a linked worktree. Preserve its final source/command/inspection record through the task's transfer branch before removing this directory. It creates no PC artifacts and requires no PC collector cleanup.

