# Fixed configured-session evidence collector

This is a read-only transport helper for the already-started configured-session attempt. Root alone invokes the exact command after reconciling any preceding uncertain read. It executes no product, child process, task action or write.

## Fixed scope and bounds

The source is `collect-configured-session-result-20261127.cjs`, SHA256 `19da30c5a7055c3fe3971ed7f609848f2bde86eba08c97c3b227b7d1c6889bad` (5,577 bytes). The invocation contains those complete source bytes as base64, with Node `--max-old-space-size=64`, initial offset `0` and no prior package hash (`-`). Its command is 7,551 characters.

The only content reads are these eleven fixed files:

1. `configured-v9-session-20261127-2889282bfcec/result.json`
2. `configured-v9-session-20261127-2889282bfcec/controller.json`
3. `configured-v9-session-20261127-2889282bfcec/processes.jsonl`
4. `configured-v9-session-20261127-2889282bfcec/native.jsonl`
5. `configured-v9-session-20261127-2889282bfcec/icon-receipt.json`
6. `configured-v9-session-20261127-2889282bfcec/memory-start.json`
7. `configured-v9-session-20261127-2889282bfcec/stdout.log`
8. `configured-v9-session-20261127-2889282bfcec/stderr.log`
9. `configured-v9-session-20261127-2889282bfcec.stdout.log`
10. `configured-v9-session-20261127-2889282bfcec.stderr.log`
11. `configured-task-session-20261127-2889282bfcec.json`

Every path is beneath `F:/Dev/.bead-edit-20261111`. Four fixed parent directories are checked by metadata only; there is no directory enumeration or recursive fixture/store read. The eight inner filenames come from accepted helper `33c6aba3` and its exact installed observer/Exit fixture at app commit `0309539797fd7d016e2b8fd8bdc0ae9cefc20219`.

One Node process sets and confirms BelowNormal priority before content reads. It requires at least 1 GiB free RAM initially and live, caps observed own RSS at 128 MiB, samples every 100 ms, and has a 15-second hard timer plus the same outer command timeout. Its process-only worker-pool limit is one. Deadline or resource failure stops only the collector.

Each raw file is capped at 2 MiB and the aggregate at 4 MiB. An exact pre-sized read loop cannot grow with the file. Regular-file, parent, device/inode, size and nanosecond timestamp checks surround reads and repeat before packaging. Changed files or paths refuse collection. Missing files are explicitly marked `present:false`; zero-byte files have their real empty hash/base64. Oversized raw input refuses rather than silently truncating it.

## Lossless bounded transport

Raw result JSON is never parsed or rewritten. Every present file enters the package as its exact bytes, length, SHA256 and base64. Large birth ticks therefore retain their original decimal text. The inner package has only fixed scope/order and file data; per-invocation times, memory, resource samples and Node version are in the outer transport record.

The package is UTF-8 JSON compressed with gzip level 1. On the exact Node25.2.1 used here, the small transport qualification verifies identical compressed output and a zero gzip-header mtime. Each response contains at most 37,500 compressed bytes, represented by at most 50,000 base64 characters. The complete output line must be at most 65,000 characters, below the relay's 65,536-character ceiling.

A complete response reports `status:complete`. A larger package reports `status:chunk`, its compressed total length/hash, the chunk offset/length/hash and the next byte offset. Reassemble compressed bytes by exact offset, verify each chunk and the complete package SHA256, decompress, verify the uncompressed length/hash, then decode and rehash every raw file. Do not derive original file hashes from a parsed/reformatted result object.

For a later chunk, root changes only the two final command arguments to the returned next offset and exact first `package_sha256`, preserving the embedded source. The collector rereads the same fixed files and refuses if the regenerated compressed package hash differs. Dynamic measurements cannot change that package. A separately reviewed actual later invocation remains required; there is no automatic replay or generic path argument.

The protocol statuses establish evidence transport only. They do not establish configured-launch success.

## Preparation evidence

`syntax-check.json` retains exact Node25.2.1 syntax acceptance. `transport-check.cjs` and its result retain a tiny cloud-only test of deterministic gzip, a two-chunk 66,324-byte package, the payload ceiling, lossless reassembly, Unicode, exact birth tick `134402500253322259`, empty files and missing files. The collector and Windows product were not executed in that check.

Two complete source inspections cover the final source, exact invocation binding, fixed scope, resource/deadline/exit paths, file-stability checks, output/chunk protocol and this runbook. Root independently reviews the final packet and executes the command once when the pending earlier read is reconciled.

