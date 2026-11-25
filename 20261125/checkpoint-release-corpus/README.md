# Portable public checkpoint recovery qualification

This helper supplies the same original-corpus recovery check for the accepted Linux and Windows release-check tasks. It reads only the public original checkpoint and creates four fresh hosted fixture workspaces. Root retains canonical PC authority and installation.

## Frozen files and pending bindings

- checkpoint-release-corpus-20261125.py: SHA-256 653ff9f382ca0dd069bf326106c0c088e4db576dc48ef0ee8274ddac39e82e52, 42,736 bytes.
- corpus-inputs.template.json: bind source_commit, source_tree, release_sha256, release_bytes, metadata_sha256 and target from the actual separately accepted release build. The template nulls are not executable inputs.
- Original public source: YossiMH/bead-rs at afac9fa0ce9533a707d745018d16a25e4ccff492. The current pointer SHA-256 is f1a2009037599216140c8a6832480e4d869d596f8001c29a6fc0f1788f42aa43; its selected 8,569,277-byte object is objects/4f5571a1823810366d4a3274c9231604913905c6334c380bf116b110ae5d486d.jsonl.
- The original pointer and selected object also remain unchanged in the qualified source archive. Supply them from a Git archive extraction, preserving literal LF bytes. A Windows checkout with automatic line-ending conversion is not a substitute.
- The outer build receipt must prove the accepted source tree. The unchanged release metadata embeds the source commit, target, binary hash/size and archive/default-feature/release provenance; it does not independently encode the Git tree.
- Python 3.11 or newer is required. Ordinary py_compile is a prerequisite. The author could not parse or execute the draft in the unavailable cloud runtime; those checks remain pending in hosted qualification.

## Invocation and isolation

Invoke with absolute paths:

    python checkpoint-release-corpus-20261125.py --binary ABS --metadata ABS --original-checkpoint ABS --output FRESH_DIRECT_CHILD_OF_RUNNER_TEMP --inputs ABS --inputs-sha256 ACTUAL_INPUT_SHA --helper-sha256 653ff9f382ca0dd069bf326106c0c088e4db576dc48ef0ee8274ddac39e82e52 --supervision MODE

MODE is owned-process-groups on Linux and outer-windows-job on Windows. The helper requires GITHUB_ACTIONS=true and a fresh output directory directly under RUNNER_TEMP, without an ancestor Git workspace. It clears inherited Bead/Git/Cargo/Rust workspace selectors, uses its own temporary directory and executes native commands serially with 120-second command deadlines inside a 900-second phase.

Linux processes have independent owned process groups and bounded TERM/KILL cleanup. The Windows wrapper must enter the existing reviewed Kill-on-close Job before Python, using windows-task-job.ps1 SHA-256 2758a6ff94c0eecdfa360363469069dfa8470efc1f91228812146919a978921f. The wrapper must provide the hard outer deadline and prove the Job is empty after completion. A Windows timeout aborts the whole qualification; the helper does not implement a second Job mechanism.

The helper uses only public CLI commands against its fresh fixtures. It does not open SQLite directly or write checkpoint configuration. Original input handling copies only the exact current pointer and its complete selected monolithic closure; historical unselected files are unnecessary. New selected set-v2 closures are read through their manifests, including oversize record references.

## Assertions

The original corpus must contain exactly 954 issue records, 11,264 event records, five provenance receipts and 413 attempt outcomes. Every original event belongs to store UUID 1c4f5d56-dcff-cbc5-ddf9-c536653c45f4 and canonical origin sequence 1 through 11,264. The original SQLite snapshot sequence is separately 29,609; it is not treated as an origin identity.

Complete record values are hashed with JSON object keys sorted. No fields are removed, normalized, defaulted or rewritten. Duplicate record identities and duplicate attempt receipt identities fail. Every selected pointer/root, manifest artifact and oversize object has its actual SHA-256 and count checked. Manifest-root hashes and the imported-record corpus digest are retained as separate fields.

The four fresh public restores are:

1. Original selected generation to restored-original.
2. Its published current generation to verify-current-before.
3. Current after one isolated create to verify-current-after.
4. The retained previous generation after that create to verify-previous-after.

Each restore fingerprints its entire source checkpoint tree before and after. It compares all original records and separately verifies exactly one new restore summary event and receipt against the actual report, canonical identity, source root, actor and receipt hash. Explicit publication preserves the complete record inventory and unchanged configuration.

One native create adds the isolated fixture issue and one created event. The next publication must promote the exact previous pointer bytes, preserve every selected previous object, publish content-addressed new tails and keep current/previous generations independently recoverable. The isolated issue is expected only in the new current generation. All 413 original outcomes must survive every comparison.

## Result and retained evidence

The authoritative result is OUTPUT/result.json. Successful status is passed and operation is public-original-checkpoint-recovery. The helper emits its exact bytes as CHECKPOINT_CORPUS_RESULT_BASE64 with CHECKPOINT_CORPUS_RESULT_SHA256.

A successful platform check requires:

- verification_restores = 4;
- all_original_attempt_outcomes_preserved = 413;
- original_public_input_unchanged = true;
- checkpoint_configuration_unchanged = true;
- all six result.comparisons entries have status passed: original_restore, published_current_restore, previous_preserved, isolated_create, current_restore_after_append and previous_restore_after_append;
- the expected original counts in original_public_source.counts;
- every process_cleanup entry has remaining false; Linux entries have no cleanup signals;
- for Windows, cleanup.outer_windows_job_verification_required = true and the separately retained outer wrapper's successful empty-Job proof.

Each comparison includes the full original record-index digest and per-class original_members_checked, missing, changed and added_ids. Retain result.json, attempt-started.json and all files under evidence/, reports/ and logs/ for at least seven days. These include selected checkpoint bytes, full record-hash indexes, before/after source-tree inventories, actual restore reports and complete native stdout/stderr. The temporary public fixture SQLite files under workspaces/ need not be uploaded. Failed results and streams remain failed evidence and must be retained before any diagnosed retry.

## Handoff and cleanup

The executable release/source pins remain pending until the accepted production repair has passed its separate build task. This packet is preparation only and does not alter product branches or canonical native task state.

After durable result retention and accepted delivery, root removes the owned temporary workflow branches and clean task worktrees. If this process dies early, future agents must reconcile any uncertain operation, preserve actual outputs and clean those owned branches/worktrees through the already selected Riftri workflow. They must not force-delete user changes or reuse an incomplete fixture directory.
