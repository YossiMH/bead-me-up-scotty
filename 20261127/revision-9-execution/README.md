# Record accepted revision 9 tasks

This runner records completed work in the existing isolated coordination store. The concrete request closes 27 tasks whose accepted results are retained on `YossiMH/bead-me-up-scotty` at commit `650f88b5233d94ee732ce7585a51bb8514321541`. It uses the actual mapping returned by the successful revision 6 to revision 9 transition.

## Fixed inputs

| Input | SHA-256 |
| --- | --- |
| Accepted revision 9 plan | `18130e44ab27047dcb397de53caa0a9006c56cfd478d417f884e42452ff62582` |
| Accepted plan review | `e26b5812b03c37f6183ed3182c67133df78cd17d74fe0b336324df7c849dece7` |
| Actual revision 9 mapping | `6d1cca5e2495011ae3dac4320e622f67c6f871186ef112edd8f51f8c98d1e5b3` |
| Existing coordination executable | `25a05bdfd8feaea92faf6827e9268e597d25432826f1082c7ebadc3af8658798` |
| Existing Windows task Job helper | `2758a6ff94c0eecdfa360363469069dfa8470efc1f91228812146919a978921f` |

The mapping contains 55 continuation tasks, 91 blocking edges and 1009 total issues, including the preserved 954 original issues. The 27 requested tasks are open at the exact revisions recorded in that mapping. `close-accepted-cloud-basis-20261127.json` records each actual ID, revision, prerequisite and accepted result path/hash. Its order distinguishes prerequisites already closed by earlier accepted work from prerequisites closed earlier in this same request.

Successful execution leaves 42 continuation tasks closed and 13 open, assuming no other task transition occurs first. The open tasks include the logged-in Windows tray check, both combined tray/candidate reviews, both installation-binding tasks, installation/configured checks, final repository handoffs and cleanup. Their additional results must be accepted before a later request can close them.

## Preservation and refusal behavior

The runner derives from the accepted revision 6 closer with SHA-256 `597dfe7c65dd135fcc446a54d11385cc64ceac6fc816e2a2469cef7c43589637`. The supervisor derives from the accepted revision 9 materializer supervisor with SHA-256 `bdf8faffeaed5c3294dbe4daf7ed9cee21e49ecc6870aaaab82e075a39dd57e3`. Those original files remain unchanged.

The new runner verifies the exact plan, actual mapping and request bytes before creating an output directory or starting native commands. The request must also name the same plan and mapping hashes. A complete live inventory must match all original rows and all continuation titles, descriptions, resource keys and directed edges. Every requested task must remain open, unassigned and at its supplied revision; every prerequisite must already be closed or occur earlier in the request.

One native manifest contains all requested close operations with revision guards. Its dry-run must report exactly 27 semantic changes. A second complete inventory must match the first before the single commit. The runner rechecks immutable inputs and the manifest, retains a commit-intent record, then commits once with automatic checkpoint flushing disabled. Its post-commit comparison allows only each requested status, revision and update timestamp to change. The original inventory file, configuration and current checkpoint pointer must remain unchanged.

An existing output directory refuses replay. An existing authority-freeze marker refuses isolated-store writes after final history transfer begins. Any interrupted or failed execution needs reconciliation of its retained command starts, outputs, exit records and commit intent before another mutation. Root remains the sole task-state writer. Final cleanup belongs to the accepted original-store history helper and cannot be selected by this closer.

The supervisor retains the accepted hidden process launch, BelowNormal priority, 128 MiB Node heap, 512 MiB total resident limit, 1 GiB free physical RAM start condition, 180-second bound and owned Job cleanup. Its embedded C# declaration is byte-identical to the already qualified materializer supervisor. Every native command also has a 15-second bound. The existing coordination executable is retained for this task-store operation; application installation uses the separately accepted final native executable.

## Stage and invoke

After independent review and ordinary PowerShell parsing pass, root stages only these three new files into `F:\Dev\.bead-edit-20261111\coordination-20261124` and verifies their exact hashes:

| File | SHA-256 |
| --- | --- |
| `record-accepted-tasks-v9.mjs` | `906ac53c59f612da14c93eaff723f1a59b27273128dee5a7030a2901acef62b3` |
| `record-accepted-tasks-v9-supervisor.ps1` | `d2bb536208688ce70d9a3b5493fca3271d09b98ae37828ff339853c081535426` |
| `close-accepted-cloud-20261127.json` | `f22148bb1f58fac237ce9935e72ca98592aaa6a36a2df3f29b58e9d855cc363e` |

The existing `revision-9/plan.json`, `revision-9/plan-review.json`, `materialization-result-v9.json`, `inventory-before-node-v3.json`, task store and `temp-materialize-v9` directory remain the inputs. Immediately before execution, root verifies the current task rows, memory availability and absence of both proposed output directories and the authority-freeze marker. The supervisor repeats these file/path/start-condition checks and the runner verifies current rows before mutation.

Use root's approved invocation in a hidden Windows PowerShell 5.1 process through the approved PC connector. The execution-policy setting applies only to this wrapper process:

```powershell
powershell.exe -NoLogo -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File F:\Dev\.bead-edit-20261111\coordination-20261124\record-accepted-tasks-v9-supervisor.ps1 -JobHelperPath C:\Users\YossiMH\AppData\Local\bead-edit-20261111\tray-host-execution-20261125\windows-task-job.ps1 -RequestPath F:\Dev\.bead-edit-20261111\coordination-20261124\close-accepted-cloud-20261127.json -RequestSha256 f22148bb1f58fac237ce9935e72ca98592aaa6a36a2df3f29b58e9d855cc363e -OutputName completed-20261127-cloud
```

The two new result directories are `completed-20261127-cloud` and `completed-20261127-cloud-supervisor`. Require connector exit 0, supervisor status `passed`, driver exit 0, no assisted cleanup or remaining Job member, and the exact native result bound by its recorded SHA-256. The native result must name all 27 requested task IDs, show exactly one revision increment for each, preserve every other continuation task state/revision and report unchanged original rows and stored fields. Retrieve the original result bytes for independent reconciliation before advancing dependent work.

## Cloud checks

The permanent test imports the runner's actual byte validation and operation-selection functions. It supplies a synthetic original inventory in memory while using the accepted plan and actual mapping bytes. It does not execute native commands.

```sh
node --check 20261127/revision-9-execution/record-accepted-tasks-v9.mjs
node --check 20261127/revision-9-execution/test-record-accepted-tasks-v9.mjs
BEAD_COMPLETION_PLAN_PATH=/absolute/path/to/accepted/plan.json \
BEAD_COMPLETION_MAPPING_PATH=/absolute/path/to/materialization-result-v9.json \
node --test 20261127/revision-9-execution/test-record-accepted-tasks-v9.mjs
```

The recorded run used Node v24.22.3 and passed all 13 tests with zero failures or skips. It checks the concrete 27-task request, mapping/request/plan byte changes, missing or wrong request mapping hash, invalid tasks or metadata, stale revisions, claimed or already-closed tasks, unfinished prerequisites, original-row changes, incomplete inventories, changed edges and changed task text/resource keys. Both successful and refused inspection leave all input values unchanged.

The current cloud environment has no PowerShell runtime. Ordinary parsing of the new wrapper remains required before execution; the existing accepted embedded-declaration compile result is reusable because that declaration has not changed. The test result and author inspection record describe these limits separately from actual PC execution.

## Worktree cleanup

This candidate uses branch `task/closure-v9-20261127` in Riftri worktree `/tmp/beads-2889282bfcec/closure-v9`. After its exact contents are retained on the permitted transfer branch and its work is complete, verify it is clean and remove this exact worktree through Riftri. If the current process ends early, a future agent must reconcile any unpublished changes and finish that cleanup. Keep other workers' worktrees and retained historical results intact.
