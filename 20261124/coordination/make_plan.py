from pathlib import Path
import hashlib
import json
import re

ROOT = Path('/workspace/scratch/3160e3ba3d24')
OUT = ROOT / 'coordination'
BUILD_ROOT = '/workspace/library-files/beads-build-temporary-3160'
BACKEND = str(ROOT / 'worktrees/bead-completion')
APP = str(ROOT / 'worktrees/scotty-completion')
BIN_SHA = '25a05bdfd8feaea92faf6827e9268e597d25432826f1082c7ebadc3af8658798'
BACKEND_SOURCE = '24979aec5d19a48ab145daf24e2399397d9b4814'
APP_SOURCE = 'f47fd7adef41e989072d5fa8c39160681aa6fd2a'
BACKEND_RUNTIME = '539cdd0b4c54665c2db01da08fdf9f3871f7148a'
APP_RUNTIME = 'fbb09312e43ec8094da6db04f126a16e8c5746f7'
DIAGNOSTIC_COMMIT = '6e3dab68353b5bb447b42670bf7e9007b5463f2d'
DIAGNOSTIC_SHA = 'b78714c0602852d5eea9e1e72fbc3250392626a3e9d644043b2a9a41318c2683'
TASKS = []


def add(key, title, purpose, start, locations, steps, required, deps=(), role='executor', resources=()):
    description = f'''Result: {purpose}

Starting condition: {start}

Locations and inputs: {locations}

Prerequisites: {'; '.join(deps) if deps else 'The reviewed continuation plan has been accepted before this task is stored or assigned.'}

Required behavior: Native editing covers title, description, priority with a reason, issue type, notes, status and assignee, plus the existing label and dependency actions. Keep ID, timestamps, claims, recorded history and unrelated records intact. Use the accepted issue-editing-v1 contract in {BACKEND}/research/specs/issue-editing-v1.md. Windows production launchers must have one tray icon with Exit and stop only their own server processes.

Steps:
'''
    description += '\n'.join(f'{index}. {step}' for index, step in enumerate(steps, 1))
    description += f'''

Required checks and completion: {required}

Permissions and limits: Work in the cloud where possible. Root alone uses Emergency Maintenance on the PC and writes canonical task state. Keep the PC free for the user's Unreal/VR work: no PC builds, GPU use, visible browser or other UI control, service restarts, broad process termination, or changes to unrelated projects. Ordinary PC app runs are sequential, hidden, BelowNormal, with a 256 MiB Node heap and a 512 MiB total owned-process resident-memory cap. Read free RAM first and require at least 3 GiB before starting an app run; stop this task's processes if their memory cap is exceeded or foreground work shows resource pressure. The small helper diagnostic has its stricter 200 MiB total cap and 90-second maximum. Browser checks belong in the cloud. Preserve the existing PC native checkpoint and all Scotty machine-local task data. Do not initialize, replace, or upload the Scotty task store. Protect other workers' files. Reviewers inspect files and supplied results; they do not execute product tests or builds. On a new failed check, retain the exact error and stop the affected acceptance; send the concrete defect to root for a reviewed repair. Never repeat a mutation after a timeout until its result is reconciled. Do not obtain another process's claim credential.

Return {OUT}/results/{key}.json with status, source_commits, binary_sha256 when relevant, checks and their exits, output_paths, changed_files, open_items, and git_result. State which requirement each check established and its limits. Mark lost earlier cloud output as unavailable; do not cite a deleted log as retained. Later work may proceed only after its listed prerequisites pass; a candidate record alone is not acceptance.

Git completion: Commit only this task's authorized repository changes. Before the checked installation, push backend changes to YossiMH/bead-rs task/bead-finish-20261124 and app changes to YossiMH/bead-me-up-scotty task/scotty-finish-20261124, keeping main at the installer's verified baseline. The recovered app working branch is task/scotty-recovered-20261124; use ordinary descendant publication to its named remote task branch. After installation, publish completed changes to main by ordinary fast-forward integration. Never force-push or include private local task data. Report the commit and verified remote ref. With no changes, check for this task's unpublished commits and otherwise report no changes; do not create an empty commit. If pushing fails, try another independently permitted Git route, record the failure and next permitted retry, and continue useful authorized work. A failed push alone does not prevent task closure or the next task.
'''
    TASKS.append({'key': key, 'title': title, 'description': description, 'prerequisites': list(deps), 'role': role, 'resource_keys': list(resources)})


add('plan-review', 'Review the complete continuation plan',
    'Independently accept or return the complete continuation plan and every expanded task before any proposed task or dependency is written.',
    'The implementation and prior accepted work already exist. This draft recovers unfinished delivery after the earlier cloud sessions disappeared; it does not recreate the earlier 37 tasks. The previous complete review found one blocking command error, now corrected, and must not be presented as acceptance of this reconstructed version.',
    f'{OUT}/plan.json and {OUT}/manifest.json; the original user request; {ROOT}/references/workflow.md, planner.md, execution.md, zcf.md and language.md. Read both product handoffs at {BACKEND}/.marathon/progress.md and {APP}/docs/backend-compatibility.md, and {OUT}/original-plan-review.json.',
    [
        'Read the entire exact plan and every expanded description. Compare all requested fields, dependency editing, tray Exit, installed use, preservation, parallel work, Git publication, task records and cleanup against the user request and accepted contract.',
        'Trace every required result to task keys and actual blocking edges. Verify that independent cloud work can proceed while PC work is serialized, and static review can start before execution completes.',
        'Check every instruction for concrete inputs, commands or input-acquisition steps, pass/fail criteria, return records and Git completion. Check the whole text against the current language exclusions. Confirm old failures remain visible and passing prior work is not unnecessarily repeated.',
        'Verify R1 from original-plan-review.json: cloud-checks no longer invokes the real priority browser flow as a standalone node test; browser-check retains that coverage through the native-ui integration runner. Check changed storage/build/session conditions and unavailable old logs.',
        'Return pass, fail or pending with concrete corrections and exact SHA-256 hashes of both reviewed files. On a correction, review the complete revised plan again. Root may materialize only the accepted revision, then record this passed review in the resulting task.'
    ],
    'Pass requires a complete, independently executable, acyclic graph with all user results covered and a route through actual Windows installation and final cleanup. Do not accept sampled task descriptions. No test execution or task-store write is allowed in this review.',
    role='independent reviewer')

add('reconcile', 'Reconcile retained source and Windows results',
    'Establish the exact recovered candidate, valid previous results, current PC baseline and unchanged task history so the remaining work proceeds without losing or repeating changes.',
    f'Backend source {BACKEND_SOURCE} and app source {APP_SOURCE} are verified on their remote task branches. PC backend main is afac9fa0ce9533a707d745018d16a25e4ccff492 and clean; PC app main is 459a74537cbbe1dff521c6fc7ad1ce3ec2890683 with the same 15 preserved source files. Stage-v6 and transfer-v6 exist. The native smoke receipt passed 55 commands; tray-results-v2 failed and cleaned its children. The later cloud restart erased /var/tmp results and the earlier plan copies.',
    f'Cloud worktrees {BACKEND} and {APP}; {ROOT}/transfer/delivery-manifest.json and pc-preservation-raw.json, recoverable from YossiMH/bead-me-up-scotty transfer commit55a733db99f8ae4200766738af273f97e9d2b27b. PC repositories F:/Dev/bead-rs and F:/Dev/bead-me-up-scotty; task directory F:/Dev/.bead-edit-20261111, stage-v6, transfer-v6, native-results-v3 and tray-results-v2. Native history has UUID1c4f5d56-dcff-cbc5-ddf9-c536653c45f4,954 issues and11264 events.',
    [
        'Read source Git status and exact heads, the two current product handoffs, transfer manifest and bundle receipts. Verify source hashes and that changes after each runtime commit are only the documented tests or text. Record actual remote main refs. Recover absent reference/transfer files from their verified Git commits before using them. If a cloud checkout is absent, use the already-published task ref and Riftri to create the named worktree; do not use absent temporary paths.',
        f'Read F:/Dev/.bead-edit-20261111/native-results-v3/windows-native-smoke-5f2c9c6a00f24f4b8e803c81df22f3c9.json. Credit its 55 successful commands only after matching executable hash {BIN_SHA}, successful exit and cleanup. Read the tray-results-v2 result and referenced logs without rerunning the failed command. Record old lost cloud logs as unavailable; retained conversation observations are separate from raw file output.',
        'Read stage-v6/stage-result.json and resolve its existing app_directory and bead_exe; verify each against the transferred manifest and runtime metadata. Find the adjacent executable metadata and retain its full path. Read current .env.local only as needed to confirm the selected local executable; do not print unrelated settings.',
        'Verify the 15 local source-file hashes and original Git index against pc-preservation-raw.json. Preserve every changed or unexpected file. Confirm no Scotty process is running using exact executable, command and directory identity; a listening port alone does not authorize stopping a process.',
        'The PC source repository has config and a valid checkpoint but no initialized live beads.db; list --all --json returned exit3. Preserve those source files. After this plan passes independent review, root creates only F:/Dev/.bead-edit-20261111/coordination-20261124, initializes its empty Git directory and copies the verified .beads/config.json there. From that isolated directory use the verified staged bead executable: restore --source F:/Dev/bead-rs/.beads/checkpoint --generation gen-a569f746bbb268015d996c8ed4c76f57 --actor chatgpt-bead-edit-20261124. Verify help before execution, retain the restore receipt and require UUID1c4f5d56-dcff-cbc5-ddf9-c536653c45f4,954 issues and11264 events. Do not use bead init or overwrite an existing different store. The original checkpoint stays untouched through installer preflight. Root may perform this accepted restore before manifest materialization, then associate its result with this task. Inspect complete native inventory and unique references before creating continuation tasks. The old37-task cloud graph was never flushed; record that loss without fabricating IDs.',
        f'Append a short current recovery entry to both product handoffs identifying {ROOT}/worktrees/bead-completion and {ROOT}/worktrees/scotty-completion, their actual task branches, preserved PC directories and the exact Riftri cleanup command. Say removal follows Git status and remote checks. Retain all historical entries and record any missing receipt honestly.'
    ],
    'Return exact source, runtime, executable, metadata, local-file and checkpoint identities; native55 receipt status; tray failure location; existing application state; live task-store location and binary path; missing-result list. Completion does not mean the failed tray check or installed app has passed.',
    deps=('plan-review',), resources=('bead-edit-pc',))

add('cloud-checks', 'Run the recovered app and launcher checks',
    'Check the existing editing adapter and launcher behavior in the cloud without consuming PC resources.',
    f'App source {APP_SOURCE} is recovered and has no reported blocking static finding. Before the cloud restart, launcher tests reported29 passes and adapter tests reported145 passes plus one worker SIGKILL without an assertion failure. Their raw temporary logs were lost. The affected adapter rerun remains pending, and these observations do not resolve the Windows Forms failure.',
    f'{APP}; package.json, package-lock.json, bin/server-controller.mjs, bin/windows-tray.mjs, lib/native-edit.ts and the existing scripts listed below. Read nearby Next documentation from node_modules before any source change; this task normally changes no source. Preserve current results under {OUT}/results.',
    [
        'Record node --version and installed dependency versions. Reuse matching dependencies; if absent run npm ci only in the cloud checkout with POSTHOG_KEY empty and NEXT_TELEMETRY_DISABLED=1. Keep the lockfile unchanged. Do not repeat already accepted unchanged checks solely because a temporary log disappeared; record the retained tool/conversation basis and unavailable file honestly.',
        'When the earlier unchanged launcher result is sufficient, retain its29-pass result as observed with raw output unavailable. If its exact coverage or inputs cannot be reconciled, from the app worktree run node --test --test-concurrency=1 scripts/test-windows-tray.mjs scripts/test-serve.mjs scripts/test-bead-binary-option.mjs and save output and exit. Distinguish any Windows-only skip from cloud passes.',
        'Run the pending affected adapter checks with node --test --test-concurrency=1 scripts/test-native-editing.mjs scripts/test-native-edit-ui.mjs. Do not add scripts/test-native-priority-recovery.mjs here: its application URL, project and output inputs are supplied by the separate browser native-ui runner. Reconcile the interrupted earlier target and retain new complete output. Run node node_modules/typescript/bin/tsc --noEmit --incremental false, npm run lint and git diff --check only where their result is missing or a relevant input changed. Avoid simultaneous build/check processes on the recovered cloud memory budget.',
        'Confirm owned fixture servers and temporary helpers exit. Return counts per suite, skipped cases, missing earlier logs, any reused actual tool result, and exact source HEAD. Subprocess doubles or source assertions are not real browser or Windows Forms runs.'
    ],
    'All applicable checks must have a reconciled successful result; the interrupted adapter worker requires an affected rerun. Name platform skips and cover them with the Windows task. Typecheck/lint failures remain pending. These checks can run alongside PC receipt reconciliation and static source inspection.',
    deps=('plan-review',), resources=('scotty-cloud-run',))

add('browser-prepare', 'Prepare the real editing browser check',
    'Provide either a verifiable existing complete browser result for the exact candidate or the isolated cloud runtime needed to execute the saved browser tests.',
    'The previous native55 result verifies the Windows CLI and does not establish the current browser editor. Earlier simple registration/create browser checks predate editing. The cloud now has about7.5GiB RAM; a separate19GiB writable temporary disk is being prepared for the sanctioned single-job native build.',
    f'{APP}/scripts/test-backend-integration.mjs and scripts/test-native-ui-flows.mjs, test-native-ui-recovery.mjs and test-native-priority-recovery.mjs; {ROOT}/transfer runtime manifest and archives; {BACKEND}/scripts/build-from-archive.sh. Use {OUT}/browser-preparation.json for exact executable/runtime paths. Build workspace and toolchains live under {BUILD_ROOT}; keep small results and source references under {OUT}.',
    [
        'Read the reconcile result and search only its named task-output directories for a passing complete browser run. Accept reuse only when the raw run covers current editing, recovery, labels and typed dependencies and matches source/binary. Otherwise record the exact missing coverage. A previously deleted output path cannot support reuse.',
        f'For a fresh run, use the cloud. Recover the four scotty-runtime.zip parts and scotty-runtime.json from transfer commit55a733db99f8ae4200766738af273f97e9d2b27b through the existing permitted Git route. Verify each part and the assembled archive against delivery-manifest.json, then verify extracted .next files and source {APP_RUNTIME}. Reuse this production output; the integration runner uses next start. Run npm run build only if a concrete runtime/source incompatibility requires it, with the cause recorded first.',
        f'Reuse a verified Linux bead executable from runtime source {BACKEND_RUNTIME}, if present with matching metadata/hash. The cloud worker is already preparing the required Rust toolchain and backend checkout under {BUILD_ROOT}; reconcile its running command before starting anything else. If no completed compatible pin exists, from the recovered backend checkout run scripts/build-from-archive.sh {BACKEND_RUNTIME} --name bead-editing-539cdd0-linux-20261124 --out {ROOT}/tools, with BEAD_BUILD_SCRATCH_ROOT={BUILD_ROOT}/archive-build and CARGO_BUILD_JOBS=1. Use only this task-local toolchain environment, a30-minute process deadline and nonblocking status reads. Do not overwrite an existing pin or start a duplicate build. Retain adjacent metadata and build logs in durable coordination results before temporary cleanup.',
        'Verify the resulting bead version, capabilities and update help, including issue_editing version1 and required fields. Inspect the installed Playwright package and available isolated Chromium. Install a browser into the cloud task directory only if the existing package needs it. Keep resource-heavy cloud processes sequential and do not use the user browser or PC GPU.',
        f'Create {OUT}/browser-preparation.json naming exact executable/hash, app runtime identity, Chromium path, unused port3196 or an actually checked replacement and a fresh test root under {OUT}/browser. If reusing an earlier result, identify its existing raw output and each covered requirement instead.'
    ],
    'The runner must have real native CLI, app runtime and browser inputs, or a raw previously passing complete result for those inputs. Missing package/compiler/browser access is a specific missing input, not a test pass. PC fallback requires root to document a separate reviewed memory allowance before assignment. Do not rebuild Next merely because a copied external tray helper later changes.',
    deps=('reconcile',), resources=('scotty-cloud-run',))

add('browser-check', 'Check editing through the real browser',
    'Verify the user can edit supported native fields and dependencies through the actual Scotty browser UI, with real CLI readback and preserved failure recovery.',
    'Browser preparation has exact executable, runtime, browser and temporary-directory choices, or identifies a complete retained run eligible for reuse.',
    f'{APP}; {OUT}/browser-preparation.json; scripts/test-backend-integration.mjs and existing native browser scripts. Keep actual output under {OUT}/browser.',
    [
        'Read browser-preparation.json and confirm its source/runtime identities match the current worktree. If a complete exact passing run is retained, independently verify its assertions and readback records and return those records; do not rerun for ceremony.',
        'Otherwise set BEAD_BIN, SCOTTY_TEST_CHROME, SCOTTY_TEST_ROOT and SCOTTY_TEST_PORT to the verified values from browser-preparation.json. Set POSTHOG_KEY empty, NEXT_TELEMETRY_DISABLED=1, BD_DISABLE_METRICS=1 and BD_DISABLE_EVENT_FLUSH=1 in the command environment. From the app worktree run node scripts/test-backend-integration.mjs bead-rs --browser --native-ui with a bounded15-minute process deadline.',
        'Check that the run exercises title, description, custom type, notes, priority reason, clears, long text, closed-issue edits, labels and all three dependency kinds with their actual direction. Verify reload/readback, read-only refusal, stale/conflicting writes, uncertain-write recovery, preservation of a separate unsaved draft and palette priority recovery as represented by the existing tests. The integration runner supplies the priority recovery flow with its required application URL, project and output inputs.',
        'Inspect actual browser output and captured images at useful resolution. Compare the full editor workflow with the accepted contract. Separate real uninterrupted requests from response-failure injection; neither should be described as the other.',
        'Confirm test server, browser and descendants stop; keep the task result files. Report pass/fail per required behavior, source identities and coverage the runner did not establish. Return a specific missing check or defect rather than assuming it passed.'
    ],
    'A passing real run or independently verified exact retained run is required. Unit/source checks alone cannot close this task. No existing user store or project registration may be changed, and all owned processes must exit.',
    deps=('browser-prepare',), resources=('scotty-cloud-run',))

add('tray-diagnose', 'Diagnose the retained Windows tray failure',
    'Identify the precise cause of the real Windows helper cleanup failure and specify the smallest necessary repair or corrected execution setup.',
    f'F:/Dev/.bead-edit-20261111/tray-results-v2/result.json failed against app {APP_SOURCE}: real Exit showed, clicked and disposed the icon and the controller exited0. The parent-loss helper exited0 but its private cache directory survived with only the correct-hash copied script. Arguments contained the correct CacheDirectory. All owned processes exited; duration16.8seconds and peak533389312bytes stayed below512MiB. Emergency Maintenance runs in noninteractive session0; the already logged-in user is in session1. The small helper diagnostic has been independently reviewed.',
    f'{APP}/bin/windows-tray.ps1 and bin/windows-tray.mjs; retained PC logs under tray-results-v2; {OUT}/windows-tray-helper-diagnostic.ps1. The current corrected diagnostic is YossiMH/bead-me-up-scotty transfer commit{DIAGNOSTIC_COMMIT}, path20261124/windows-tray-helper-diagnostic.ps1, SHA-256{DIAGNOSTIC_SHA}. Its verified job helper is windows-task-job.ps1, SHA-2562758a6ff94c0eecdfa360363469069dfa8470efc1f91228812146919a978921f.',
    [
        'Read the complete failing child output/assertions and match executable identity, source revision, script hash, arguments, start/exit times and cleanup observations. The successful real Exit action remains valid for its case; parent-loss cache cleanup is unfinished. If the retained logs alone identify the cause, do not rerun for ceremony.',
        f'If the cause remains unknown, obtain the exact corrected diagnostic script from commit{DIAGNOSTIC_COMMIT} and verify SHA-256{DIAGNOSTIC_SHA}. Compare the staged real bin/windows-tray.ps1 hash with its source and record it as the ExpectedSha256 argument. Preserve the reviewed job helper beside the execution files. Do not use the earlier diagnostic script hash.',
        'Root creates a uniquely named short-lived Windows task targeted only at the already logged-in session1 and starts it immediately. Run hidden powershell.exe -NoLogo -NoProfile -NonInteractive -WindowStyle Hidden -File on the verified diagnostic, with -HelperPath set to the existing staged real helper, -ExpectedSha256 set to its verified hash, -EvidenceDirectory a new child of F:/Dev/.bead-edit-20261111/helper-results-20261124, -JobHelperPath the verified job helper, -NodePath the existing node.exe, -TimeoutSeconds75 and -MaxResidentMiB200. Capture task/process identity, wait through bounded nonblocking reads and delete only this exact temporary task afterward. This uses the tiny disposable Node parent and real helper, without a Next server, browser, menu display or foreground input.',
        'Read production STOP and parent-loss results, raw helper stdout/stderr, copied-path identities and cleanup. The driver deliberately preserves surviving helper caches. If production output remains insufficient, a second TraceCleanup diagnostic is allowed only with -PriorResultPath pointing to the first actual production result and after verifying the script’s prerequisite checks. It has the same200MiB/90-second maximum; modified diagnostic-copy behavior is never production acceptance.',
        'Return the exact cause and necessary file or command/environment corrections. A code/fixture/installer change requires concrete expanded repair instructions and complete-plan review before assignment. If a precise bin/windows-tray.ps1 repair is needed, account for windows-install.ps1 Assert-DocumentedDescendant: its original allowed paths exclude bin. A reviewed exact helper/hash check may permit that external helper while reusing the unchanged Next build; do not broadly allow bin changes or rebuild Next without a concrete need.',
        'Record which prior results, if any, must be invalidated. Keep useful native55 and unaffected cloud results. Do not close the Windows tray requirement merely because processes exited or the driver deleted its temporary task.'
    ],
    'Completion requires a concrete diagnosis tied to the retained or bounded new result and an executable next step. A new source/test repair is not silently hidden inside this diagnostic task. All owned processes must exit and raw diagnostics must be retained.',
    deps=('reconcile',), resources=('bead-edit-pc',))

add('windows-tray', 'Check the Windows tray and Exit action',
    'Establish that the real Windows tray appears once, Exit stops its owned server, parent loss removes the icon and copied helper, and supervised restart preserves one icon.',
    'The retained Windows run failed and cannot be credited as a complete pass. Diagnosis supplies the corrected setup or identifies a separately reviewed repair whose accepted result is required before this task is dispatched.',
    f'{ROOT}/transfer/windows-tray-smoke.ps1, windows-task-job.ps1 and delivery-manifest.json; PC F:/Dev/.bead-edit-20261111/transfer-v6 and stage-v6. Staged app and exact native executable come from reconcile. Store each new result in a nonexisting child under F:/Dev/.bead-edit-20261111/tray-results-20261124.',
    [
        'Read the diagnosis and accepted repair records. Verify staged app/helper source bytes and script hashes. If diagnosis requires an unreviewed change, keep this task pending and return it to the planner; do not run the old failing setup unchanged.',
        'Root checks free RAM and confirms no other task is using the PC test server. Require at least3GiB free, keep a512MiB owned-process cap and256MiB Node heap, and choose verified unused loopback port43971 or a replacement recorded before execution.',
        'Root creates a uniquely named short-lived Windows task targeted only at the already logged-in session1, starts it immediately, reads its exact process/result and deletes only that task afterward. Run hidden powershell.exe -NoLogo -NoProfile -NonInteractive -WindowStyle Hidden -File on the verified Windows tray wrapper, with -RepositoryPath the existing staged app, -EvidenceDirectory the new result child, -BeadBin the verified executable, -SourceRevision the actual staged source, -Port the checked port, -TimeoutSeconds180 -NodeHeapMiB256 -MaxOwnedResidentMiB512. Pass exact values separately and keep the verified sibling windows-task-job.ps1.',
        'Read resulting JSON and child logs. Require actual NotifyIcon creation, invocation of the real Exit menu item, normal helper disposal, parent-loss cleanup, a real Next server restart and no extra icon/server. The test may invoke the real menu item internally; do not move the mouse, open a visible menu or open a browser.',
        'Confirm exit0, every required case passed, port released, owned children exited, helper copies removed and original config/store untouched. Keep the full bounded failure record if an assertion fails and investigate that exact failure before another run.'
    ],
    'Real Windows cases and cleanup must pass within stated memory/deadline limits. Source assertions, cloud subprocess doubles, modified diagnostic helpers and skipped Windows cases are insufficient. The code reviewer reconciles this result before installation.',
    deps=('tray-diagnose',), resources=('bead-edit-pc',))

add('candidate-review', 'Review the recovered implementation and results',
    'Independently accept the exact backend editing, Scotty integration, tray behavior and checked installer candidate before local installation.',
    f'Backend source {BACKEND_RUNTIME} has an accepted independent review; app {APP_SOURCE} has no reported blocking static finding. Installer ce7093f9055d5b91efe1ae720a5741a994c3a374b363799f8654d2b39d3b7f5b was accepted separately. Complete real tray execution remains required.',
    f'{BACKEND}, {APP}, {ROOT}/transfer/windows-install.ps1, accepted source/specifications and {OUT}/results/reconcile.json, cloud-checks.json, browser-check.json, tray-diagnose.json and windows-tray.json. Read {ROOT}/references/zcf.md, standards.md and postprocess.md.',
    [
        'Start static inspection as soon as assigned; do not wait for execution tasks. Read exact recovered source, accepted editing contract and reviewer records. Retain accepted unaffected findings and verify runtime/source descendants contain only documented text/tests or a separately accepted precise external-helper change.',
        'Inspect scalar atomicity, claim/revision handling, closed edits, priority audit, long text, capability negotiation, recoverable UI errors, dependency kind/direction and original-backend behavior. Inspect tray process identities, Exit, helper failure, parent-loss cleanup and supervised restart without running code.',
        'Read the separate installer review and compare its exact hash and assumptions with current PC preservation/remote/main/runtime records. Require the15-file preservation, original index and old selected executable safeguards. Any amended external-helper allowance must validate the specific accepted helper/hash and retain all other runtime/source checks.',
        'Remain pending until reconcile, cloud-checks, browser-check and windows-tray supply passing applicable results. Inspect complete results and cleanup/limits. Mark lost older raw logs as unavailable; evaluate retained actual tool observations honestly. Do not replace missing Windows/browser execution with static confidence.',
        'Return pass, fail or pending with exact reviewed hashes, retained earlier findings, newly established results, concrete remaining defects and permitted next installation. Authors report two complete clean self-audits after any new code/test/text change; preserve valid prior passes for unchanged work.'
    ],
    'Pass requires exact combined source and installer satisfy the request with applicable actual execution. This task has no blocking edge to execution tasks so inspection starts early, but cannot close before required results are accepted. The reviewer runs no builds, apps or tests.',
    deps=('plan-review',), role='independent reviewer')

add('install', 'Install and publish the accepted app and native tool',
    'Put the accepted editing-enabled executable and app runtime in the two requested PC repositories, preserve existing local work, select the new local pin and publish source to the user forks.',
    'Installation remains pending. The original reviewed installer expects backend main afac9fa0ce9533a707d745018d16a25e4ccff492, app main459a74537cbbe1dff521c6fc7ad1ce3ec2890683, the15-file app baseline55f17568be93442abc6e4725d3e159448e0c9ab5 and old selected executable376537b7917f18d33383a3e4bd3eb9e0955bb42d1a60b73aef5c81865662af28.',
    f'{ROOT}/transfer/windows-install.ps1 with originally accepted hash ce7093f9055d5b91efe1ae720a5741a994c3a374b363799f8654d2b39d3b7f5b, or its separately reviewed exact amendment. PC inputs F:/Dev/.bead-edit-20261111/transfer-v6 and stage-v6; destinations F:/Dev/bead-rs and F:/Dev/bead-me-up-scotty. Read reconcile, candidate-review, browser-check, cloud-checks and windows-tray results.',
    [
        'Verify every prerequisite is accepted for the exact current candidate. Re-read Git status, baseline hashes, main refs, staged runtime, executable and metadata. Confirm no Scotty process is running. If the user started it, preserve that session and continue independent cloud work; do not terminate it under this task.',
        'Resolve installer inputs from verified stage result and manifest: ScottySourceCommit is the accepted app task HEAD descended from f47fd7adef41e989072d5fa8c39160681aa6fd2a; BackendSourceCommit is the accepted backend task HEAD descended from24979aec5d19a48ab145daf24e2399397d9b4814. Import newer approved descendants through ordinary bundle/fetch first. Require the installer to verify allowed changes against both runtime commits. A helper-only correction must have its separately accepted exact-file/hash rule; do not weaken all descendant checks.',
        f'Run the verified installer once in a fresh hidden PowerShell process. Pass -ScottySourceCommit and -BackendSourceCommit the exact accepted commits; -PreservationManifest transfer-v6/pc-preservation-raw.json; -RuntimeManifest transfer-v6/scotty-runtime.json; -StageNextDirectory the staged app .next; -BeadExe the verified bead-editing-539cdd0.exe; -BeadSha256 {BIN_SHA}; -BeadProvenance its verified adjacent metadata; -OutputDirectory a new child of F:/Dev/.bead-edit-20261111/install-results-20261124; and -ScottyPorts containing3000 and observed task ports. Keep the verified sibling windows-task-job.ps1. Pass actual arguments separately; never execute shell text obtained from a receipt.',
        'Read install-result.json before any retry. Require preserved source/index backups, successful fast-forwards, verified runtime swap, copied native pin, exact .env.local selection and unchanged old executable. Verify both remote main refs equal installed accepted source commits. Keep rollback copies and previous runtime.',
        'Verify installed pin reports required editing capabilities and the app remains stopped. Reconcile a partial install from its recorded last phase; do not reset source/index, force-push or repeat the entire installer blindly.'
    ],
    f'Pass requires accepted source in both requested PC repositories, runtime matching its manifest, .env.local selecting .scotty-local/bin/bead-25a05bdfd8fe.exe with SHA-256{BIN_SHA}, preserved source/index/old pin/runtime and verified ordinary publication to both user-fork main refs. Installed launch is separate. A source-publication failure is recorded and retried by a permitted route without undoing correct local installation.',
    deps=('reconcile', 'cloud-checks', 'browser-check', 'windows-tray', 'candidate-review'), resources=('bead-edit-pc',))

add('configured-launch', 'Check the installed launcher and selected native tool',
    'Verify the actual installed batch launcher uses its .env.local editing-enabled native executable and creates a working tray whose Exit stops the server.',
    'The checked installer completed and retained rollback files. The app is stopped; this task cannot disturb an unrelated running server.',
    f'{ROOT}/transfer/windows-configured-launch-smoke.ps1 and verified sibling windows-task-job.ps1; PC F:/Dev/bead-me-up-scotty/launch-scotty.bat and .env.local; installed .scotty-local/bin/bead-25a05bdfd8fe.exe. Read {OUT}/results/install.json.',
    [
        'Verify installed source heads, runtime build ID, executable hash and selected BEAD_BIN match installation. Confirm the script hash matches its transferred manifest/review. Check free RAM and unused port43972.',
        f'Use the verified immediate short-lived Windows task route into logged-in session1 and remove that exact task afterward. Run fresh hidden powershell.exe -NoLogo -NoProfile -NonInteractive -WindowStyle Hidden -File on windows-configured-launch-smoke.ps1 with -BeadExe F:/Dev/bead-me-up-scotty/.scotty-local/bin/bead-25a05bdfd8fe.exe -ExpectedSha256 {BIN_SHA} -EvidenceDirectory a new F:/Dev/.bead-edit-20261111/configured-results-20261124 child -Port43972 -TimeoutSeconds120 -MaxOwnedResidentMiB512. The script sets256MiB Node heap and BelowNormal priority, with an isolated app registry/native workspace.',
        'Read complete result and child logs. Require real launch-scotty.bat, loaded default pin, actual HTTP/native edit round trip, correct tray source cache, real Exit item and released loopback port. No visible menu, browser, build or original store is opened.',
        'Confirm owned process handles have exited, task fixtures/helper caches are removed as specified, original config/registrations/native history are unchanged and app is stopped. After a failure/timeout, reconcile recorded identities and last completed action before retrying.'
    ],
    'The actual installed-default smoke must return zero with all requests and cleanup successful. A staged-source result does not replace it. Store the full result, source/runtime identities, peak memory and final app state.',
    deps=('install',), resources=('bead-edit-pc',))

add('installed-review', 'Review the installed result against the request',
    'Independently confirm requested editing and tray behavior is installed, usable through the app and preserved through the real launch route.',
    'Source candidate and installer passed review. Installation and installed-launch execution supply fresh records; source/binary hashes connect them to browser/native checks.',
    f'User request; accepted issue-editing-v1; {OUT}/results/candidate-review.json, install.json, configured-launch.json, browser-check.json and windows-tray.json; exact installed hashes and preserved original-file comparison.',
    [
        'Begin inspection when installation result exists, then read every named full result as it arrives. Match installed executable/runtime to those exercised. Any difference must be accepted text/tests or separately checked external-helper bytes rather than untested runtime changes.',
        'Trace title, description, priority, notes/type/status/assignee, typed dependency changes, tray appearance and Exit. Verify other original-backend operations and protected user data remain intact according to changed code and retained checks.',
        'Keep this review pending until configured-launch passes. Confirm real launcher used the new default pin, no unrelated process/foreground app was affected, original task stores were preserved and both product main refs contain installed source. Name publication failures separately.',
        'Return pass, fail or pending for every user requirement, with exact result paths and material gaps. Do not execute tests, request cosmetic extra checks or invent physical/UI observations.'
    ],
    'Close only when material installed behavior/preservation requirements are established. Final documentation and cleanup have separate tasks. A concrete defect returns only affected work for repair/review.',
    deps=('install',), role='independent reviewer')

add('backend-handoff', 'Update the backend continuation record',
    'Append an accurate durable backend record of accepted editing, installed binary, checks, remaining limits and cleanup instructions.',
    'Backend handoff preserves successful cloud implementation and native55 but says tray/install/publication are pending. Historical entries remain unchanged. Deleted later cloud logs cannot be cited as retained files.',
    f'{BACKEND}/.marathon/progress.md and existing docs/plan/plan.md; {OUT}/results; published backend main and installed Windows binary metadata. Supported fields are in research/specs/issue-editing-v1.md.',
    [
        'Read installed-review/configured-launch results, exact check counts, source/runtime/binary identities, publication results and native recovery record. Do not claim a second full Rust run where the record contains an old full run plus targeted repairs. Distinguish retained result files, actual conversation observations and unavailable logs.',
        'Append a dated entry to .marathon/progress.md. Record supported editing/dependencies, actual Windows/native/browser/tray/default-launch results, earlier failures and resolution, published main hashes, selected executable and rollback paths.',
        f'Update recovery instructions for the two current worktrees under {ROOT}/worktrees and temporary build files under {BUILD_ROOT}. Root must inspect changes and remote commits before removing worktrees with {ROOT}/tools/node_modules/.bin/riftri exec -- git worktree remove and each exact path, without force. Preserve unpublished work and retained result files. Record absent old51bd paths, lost earlier37-task plan and erased /var/tmp outputs; name the current accepted continuation graph and actual native IDs.',
        'Inspect every sentence against actual results and language rules. Run git diff --check and two complete clean self-audit passes on the same final text. Publish only authorized backend documentation and return the exact candidate commit for independent review.'
    ],
    'Distinguish source acceptance, actual platform checks, local installation and verified publication. Preserve historical facts and provide usable recovery/cleanup paths. Do not change unrelated release ledgers or add a global completion marker.',
    deps=('configured-launch', 'installed-review'))

add('app-handoff', 'Update the app usage and continuation record',
    'Record installed native editing and Windows tray behavior, launch instructions, exact qualified versions and cleanup/recovery information in existing app documentation.',
    'App documentation describes the integrated feature but records tray/install as pending. Normal production launch routes remain accurate. Any concrete helper repair must be reflected in exact installed-byte qualification.',
    f'{APP}/docs/backend-compatibility.md and README.md only if current usage text needs correction; current {OUT}/results and installed-review; native metadata, runtime build ID, source main refs and rollback paths.',
    [
        'Compare current action/field tables and Windows launch/shutdown sections with installed results. Preserve original-bd, Demo, read-only, claim/revision, dependency direction and uncertain-write explanations.',
        'Replace pending wording only for completed results. Record selected editing pin, source/runtime identity, installation path, tested launch-scotty.bat, tray Exit and how to use the preserved old pin. State tests leave the app stopped so the user can launch normally. Describe any corrected helper cleanup and required host session plainly.',
        f'Update the existing recovery section with {ROOT}/worktrees/bead-completion and {ROOT}/worktrees/scotty-completion, actual task branches and Riftri non-force removal commands. Preserve temporary transfer branch until source/binaries are safe in normal durable destinations; record deletion after delivery. Name {BUILD_ROOT} as task-only temporary build storage and preserve durable small results in {OUT}.',
        'Verify links/examples against actual flags/files. Run git diff --check and two complete clean self-audit passes on identical final text. Publish only authorized app documentation and return exact candidate commit.'
    ],
    'Final text must explain how to launch the installed app and what can be edited, matching all reported test/install/publish states. Do not publish private task data, .env content or credentials, or cite missing logs as existing.',
    deps=('configured-launch', 'installed-review'))

for key, producer, directory, filename in [
    ('backend-text-review', 'backend-handoff', BACKEND, '.marathon/progress.md'),
    ('app-text-review', 'app-handoff', APP, 'docs/backend-compatibility.md')
]:
    add(key, 'Review the '+('backend' if key.startswith('backend') else 'app')+' continuation text',
        'Independently verify completed documentation against actual results, clear instructions and the full requested outcome.',
        'The author returned an exact candidate commit and two clean self-audit passes. Source-code acceptance remains valid unless text exposes a concrete contradiction.',
        f'{directory}/{filename}; {producer} result, exact diff and relevant runtime/install/test/cleanup records under {OUT}/results. Read {ROOT}/references/zcf.md and language.md.',
        [
            'Read the entire changed section and surrounding instructions. Compare each factual claim with actual full receipts and final source/runtime/binary IDs. Represent historical failures, retained limits, observed-but-lost logs and truly missing results accurately.',
            'Check requested fields, dependency kind/direction, real Windows tray, selected default pin, local installation, remote publication, old-pin rollback, native history and cleanup instructions. Backend text must retain append-only history; app instructions must work without this conversation.',
            'Apply current language exclusions and verify all file/code/command literals. Separate useful suggestions from concrete missing/wrong information. Do not run product tests or invent additional user work.',
            'Return pass, fail or pending with exact reviewed commit/file hashes and corrections. Preserve accepted unchanged text when a later result only needs a small factual update; review that update before final acceptance.'
        ],
        'Pass requires accurate complete instructions and truthful completed/pending reports, including recovery and non-force cleanup. A bare status assertion without checking source records is insufficient.',
        deps=(producer,), role='independent reviewer')

add('preserve-and-clean', 'Preserve final task records and remove finished worktrees',
    'Finish with verified publication, durable native continuation records, completed handoffs, no task-owned background processes and no disposable worktrees left behind.',
    'Installed behavior and both handoff texts passed independent review. The old37-task plan vanished before checkpoint publication; the current graph/actual IDs must be preserved without altering unrelated native history. A later cloud reset also erased temporary raw results; the persistent coordination files must now survive cleanup.',
    f'{OUT}/plan.json, manifest.json and results; verified native store/CLI paths from reconcile; product parent repositories recorded by git worktree list for {BACKEND} and {APP}; Riftri {ROOT}/tools/node_modules/.bin/riftri. User forks are YossiMH/bead-rs and YossiMH/bead-me-up-scotty. Task-only large build storage is {BUILD_ROOT}.',
    [
        'Reconcile each task key and blocking edge against complete native inventory through the verified list/show commands. Record actual IDs, accepted result paths, revisions and Git outcomes; retain unrelated954 historical records/events. Missing/failed required results remain pending.',
        'Root records completed states with installed revision and issued-claim guards. Use verified sync flush-only to publish the native checkpoint; reconcile committed-but-publication-failed outcomes before retry. Verify the checkpoint and supported restore into a fresh task directory retain current records, dependencies and original history. Never touch Scotty’s machine-local task store.',
        'After installation has finished, publish the native checkpoint/provenance through the backend’s permitted Git process, staging only task-generated checkpoint files. Verify the original source generation stayed unchanged through installer preflight before replacing it with the verified same-history continuation checkpoint. Confirm the remote contains exact objects and accepted source/docs. If a push is blocked, retain local files and its next permitted retry; never delete the only copy.',
        'Verify both PC repositories contain accepted published source/docs, installed runtime/pin remain unchanged, all task processes have exited and app is stopped. Retain rollback copies and useful receipts. Before deleting the temporary transfer branch, verify its source/binaries now exist in normal durable destinations; use an ordinary conditional Git deletion.',
        f'From each recorded parent repository inspect worktree git status and compare HEAD with verified remote main. Remove each clean fully published worktree through {ROOT}/tools/node_modules/.bin/riftri exec -- git worktree remove and its exact path, without --force. Inspect the resulting list. Preserve unexpected/unpublished directories and report why. Before removing {BUILD_ROOT}, verify its resolved path is exactly the task directory, stop only owned build processes and copy required metadata/logs into persistent coordination records. Remove only that task directory, never its /workspace/library-files parent.',
        'Record actual cleanup outcomes in existing handoffs via the parent checkouts, review factual updates with the same writing reviewer and publish normally. Root closes this task and flushes/publishes that final state, verifying its own closure appears in the durable checkpoint. Return final refs, task counts, retained rollback/result paths and any unfinished requirement.'
    ],
    'Completion requires all requested behavior accepted/installed, truthful handoffs, durable current native graph/results, verified product main refs, no owned running processes and all safely removable task worktrees removed. Preserve a specific outside blocker and exact next action if any required final action cannot finish; do not substitute a summary for unfinished work.',
    deps=('backend-text-review', 'app-text-review', 'configured-launch', 'installed-review'), resources=('bead-edit-pc',))

# Restore normal prose and native flag spacing without changing code identifiers.
replacements = {
    'commit55a': 'commit 55a', 'commit6e3': 'commit 6e3', 'path20261124': 'path 20261124',
    'SHA-256b787': 'SHA-256 b787', 'SHA-2562758': 'SHA-256 2758', 'SHA-25625a': 'SHA-256 25a',
    'UUID1c4': 'UUID 1c4', ',954': ', 954', 'and11264': 'and 11264', 'exit3': 'exit 3',
    'native55': 'native 55', 'old37-task': 'old 37-task', 'earlier37-task': 'earlier 37-task',
    'old51bd': 'old 51bd', 'reported29': 'reported 29', 'its29-pass': 'its 29-pass', 'reported145': 'reported 145',
    'about7.5GiB': 'about 7.5 GiB', 'separate19GiB': 'separate 19 GiB', 'a30-minute': 'a 30-minute',
    'version1': 'version 1', 'port3196': 'port 3196', 'bounded15-minute': 'bounded 15-minute',
    'exited0': 'exited 0', 'exited1': 'exited 1', 'duration16.8seconds': 'duration 16.8 seconds',
    'peak533389312bytes': 'peak 533389312 bytes', 'below512MiB': 'below 512 MiB',
    'session0': 'session 0', 'session1': 'session 1', 'same200MiB/90-second': 'same 200 MiB/90-second',
    'at least3GiB': 'at least 3 GiB', 'a512MiB': 'a 512 MiB', 'and256MiB': 'and 256 MiB',
    'port43971': 'port 43971', 'port43972': 'port 43972', '-TimeoutSeconds180': '-TimeoutSeconds 180',
    '-NodeHeapMiB256': '-NodeHeapMiB 256', '-MaxOwnedResidentMiB512': '-MaxOwnedResidentMiB 512',
    '-TimeoutSeconds75': '-TimeoutSeconds 75', '-MaxResidentMiB200': '-MaxResidentMiB 200',
    'exit0': 'exit 0', 'the15-file': 'the 15-file', 'main459': 'main 459', 'baseline55f': 'baseline 55f',
    'executable376': 'executable 376', 'from249': 'from 249', 'containing3000': 'containing 3000',
    '-Port43972': '-Port 43972', '-TimeoutSeconds120': '-TimeoutSeconds 120', 'sets256MiB': 'sets 256 MiB',
    'unrelated954': 'unrelated 954'
}
for task in TASKS:
    for old, new in replacements.items():
        task['description'] = task['description'].replace(old, new)

plan = {
    'version': 2,
    'status': 'draft_requires_independent_review_before_task_store_writes',
    'date': '2026-11-24',
    'goal': 'Complete native bead editing, expose it in Scotty and install working Windows tray Exit while preserving foreground Unreal/VR work and existing local data.',
    'reconstruction': {
        'original_plan_sha256': '87b039efbc7f844ebf4735d5c8226cf607cf5ac92d6656593c1a788bdde360d2',
        'original_manifest_sha256': 'd6d9a4090761fbec5f7857238c7426aa83b73789a90063c9a6b3a3ec81016aed',
        'review_record': str(OUT / 'original-plan-review.json'),
        'graph_preserved': 'Same 16 task keys and24 blocking edges. Original expanded text recovered from author context; this reconstructed text requires a fresh complete review.',
        'R1': 'Removed standalone priority browser test from cloud-checks. Priority coverage remains in browser-check native-ui runner.',
        'other_changes': ['Persistent source/coordination paths', 'Lost raw cloud logs are not described as retained', 'Task-local single-job native build uses separate temporary disk', 'Reuse recovered production Next output unless concrete incompatibility requires rebuild', 'Exact reviewed small Windows helper diagnostic and session limits', 'Potential precise external-helper installer correction remains conditional on diagnosis and separate reviewed repair']
    },
    'sources': {
        'backend_source': BACKEND_SOURCE, 'backend_runtime': BACKEND_RUNTIME,
        'app_source': APP_SOURCE, 'app_runtime': APP_RUNTIME, 'windows_binary_sha256': BIN_SHA,
        'backend_repository': 'https://github.com/YossiMH/bead-rs',
        'app_repository': 'https://github.com/YossiMH/bead-me-up-scotty',
        'backend_worktree': BACKEND, 'app_worktree': APP, 'temporary_build_root': BUILD_ROOT,
        'workflow': str(ROOT / 'references/workflow.md'),
        'accepted_editing_contract': BACKEND + '/research/specs/issue-editing-v1.md',
        'original_installer_sha256': 'ce7093f9055d5b91efe1ae720a5741a994c3a374b363799f8654d2b39d3b7f5b',
        'diagnostic_commit': DIAGNOSTIC_COMMIT, 'diagnostic_sha256': DIAGNOSTIC_SHA
    },
    'prior_work': [
        {'result': 'Native editing and cross-target archive build implemented', 'state': 'preserve', 'source': BACKEND_SOURCE, 'contract': 'issue-editing-v1'},
        {'result': 'Scotty native editing, error recovery and tray launchers implemented', 'state': 'preserve', 'source': APP_SOURCE},
        {'result': 'Original Rust full run and affected reruns', 'state': 'preserve_exact_limits', 'full_run': {'passed': 1878, 'failed': 12, 'ignored': 8}, 'subsequent_runs': 'Four failed targets were repaired and passed; final affected62 passed; final Windows directory-flush fix passed5 configuration and3 filesystem tests. No second complete final-tip run claimed.'},
        {'result': 'Windows native edits, dependencies and checkpoint restore', 'state': 'verified_pass', 'commands_passed': 55, 'windows_binary_sha256': BIN_SHA, 'receipt': 'F:/Dev/.bead-edit-20261111/native-results-v3/windows-native-smoke-5f2c9c6a00f24f4b8e803c81df22f3c9.json'},
        {'result': 'Windows tray run', 'state': 'failed_requires_diagnosis', 'receipt': 'F:/Dev/.bead-edit-20261111/tray-results-v2/result.json', 'cases': [], 'cleanup': 'all_owned_processes_exited', 'peak_resident_bytes': 533389312, 'limit_bytes': 536870912, 'known_failure': 'Parent-loss copied helper directory remains. The real Exit case succeeded.'},
        {'result': 'Source and installer independent reviews', 'state': 'retain_static_acceptance_then_reconcile_current_results', 'detail': 'Root reports backend runtime accepted, no blocking app static finding and original installer accepted. Keep exact reviewer records.'},
        {'result': 'Later cloud checks before reset', 'state': 'observed_tool_results_raw_logs_lost', 'launcher_passed': 29, 'adapter_passed': 145, 'adapter_worker_interruptions': 1, 'detail': 'SIGKILL was a worker interruption without an observed assertion failure; affected rerun remains pending. Do not cite deleted /var/tmp logs as available.'},
        {'result': 'Original native history', 'state': 'preserve', 'uuid': '1c4f5d56-dcff-cbc5-ddf9-c536653c45f4', 'issues': 954, 'events': 11264},
        {'result': 'Earlier37 tasks and62 blocking edges', 'state': 'not_recovered', 'detail': 'Only in absent51bd cloud task store; final checkpoint never flushed. Do not fabricate IDs/closure records. Materialize only this accepted continuation graph after unique-reference checks.'},
        {'result': 'Local Scotty unfinished source', 'state': 'preserve', 'files': 15, 'baseline_commit': '55f17568be93442abc6e4725d3e159448e0c9ab5', 'manifest': str(ROOT / 'transfer/pc-preservation-raw.json')}
    ],
    'coverage': [
        {'requirement': 'Native scalar editing and preserved related records', 'prior': 'accepted issue-editing-v1 implementation and native55', 'tasks': ['reconcile', 'browser-check', 'candidate-review', 'install', 'configured-launch', 'installed-review']},
        {'requirement': 'Scotty editing, labels and typed dependencies', 'prior': 'existing adapter and browser tests', 'tasks': ['cloud-checks', 'browser-prepare', 'browser-check', 'candidate-review', 'install', 'configured-launch', 'installed-review']},
        {'requirement': 'Windows production tray and working Exit', 'prior': 'implemented controller; retained parent-loss cleanup failed', 'tasks': ['tray-diagnose', 'windows-tray', 'candidate-review', 'install', 'configured-launch', 'installed-review']},
        {'requirement': 'Complete work without disturbing foreground PC development', 'tasks': ['reconcile', 'cloud-checks', 'browser-prepare', 'browser-check', 'tray-diagnose', 'windows-tray', 'install', 'configured-launch', 'preserve-and-clean']},
        {'requirement': 'Parallel work and independent reviews', 'tasks': ['plan-review', 'cloud-checks', 'candidate-review', 'installed-review', 'backend-text-review', 'app-text-review']},
        {'requirement': 'Preserved native history, published source, durable handoffs and Riftri cleanup', 'tasks': ['reconcile', 'install', 'backend-handoff', 'app-handoff', 'backend-text-review', 'app-text-review', 'preserve-and-clean']}
    ],
    'dispatch_notes': [
        'Materialize only this exact independently accepted version. The plan-review task records that completed review after materialization; it is not created to permit an unreviewed graph.',
        'After acceptance, reconciliation, cloud checks and static review can proceed together. Cloud checks and browser preparation/execution share scotty-cloud-run because they use one app checkout/build tree. One native build is already being prepared; reconcile it and do not duplicate it.',
        'Browser preparation/run follows reconciliation. Windows diagnosis and execution share the PC reservation. A necessary source/fixture/installer repair returns through complete-plan review before assignment; unaffected accepted work continues.',
        'Candidate-review begins from the existing source but cannot close before reconcile, cloud-checks, browser-check and windows-tray pass. Install has real blocking edges to all five.',
        'Installed-review begins from installation but remains pending until configured-launch passes. Both documentation tasks require installed-review and configured-launch; each has an independent text review.',
        'No known unfinished activity is omitted. Any new concrete repair receives complete instructions and whole-plan review before materialization. No old Red tasks or successful implementation are recreated.',
        'Task results live in persistent coordination/results and enter existing native records/handoffs. Task branches preserve source before checked main publication. Do not create empty commits for ordinary result-only tasks.'
    ],
    'materialization': {
        'store': 'After independent review, restore the existing native checkpoint into F:/Dev/.bead-edit-20261111/coordination-20261124 using the verified staged bead executable: restore --source F:/Dev/bead-rs/.beads/checkpoint --generation gen-a569f746bbb268015d996c8ed4c76f57 --actor chatgpt-bead-edit-20261124. Verify help and original UUID/954issues/11264events. Never bead init or replace a differing live store. Root alone writes it. Original source checkpoint remains untouched until installation finishes.',
        'order': 'After accepted same-history restore, read version/capabilities/help and complete inventory. Reconcile existing unique_ref values. Run manifest dry-run --input PATH --format json, then manifest commit on exactly accepted bytes and retain actual IDs. Dry-run IDs are provisional.',
        'atomicity': 'Creates carry stable unique_ref and resource_keys; all blocking edges share the same native transaction. No newly created dependent becomes visible before its blockers.',
        'mapping': 'Record key-to-actual-ID, full description, state and edges. A unique_ref hit requires comparing existing instructions/edges. Reconcile uncertain writes before retry; preserve settings.',
        'completion': 'Use current revisions and actual issued claim credentials. Inspect complete inventory/edge directions. Empty ready is not completion. Flush/publish records before removing their only local copy.'
    },
    'tasks': TASKS,
    'blocking_edges': [{'blocked': task['key'], 'blocker': dep} for task in TASKS for dep in task['prerequisites']]
}

operations = [
    {'op': 'create', 'local_id': task['key'], 'unique_ref': 'bead-edit-20261124:' + task['key'],
     'title': task['title'], 'description': task['description'], 'issue_type': 'task', 'priority': 1,
     'labels': ['bead-edit-20261124'], 'resource_keys': task['resource_keys']}
    for task in TASKS
]
operations.extend({'op': 'dep_add', 'blocked': '$' + edge['blocked'], 'blocker': '$' + edge['blocker'], 'kind': 'blocks'} for edge in plan['blocking_edges'])
manifest = {'manifest_version': 1, 'operations': operations}
OUT.mkdir(parents=True, exist_ok=True)
for name, value in [('plan.json', plan), ('manifest.json', manifest)]:
    (OUT / name).write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n')

language = (ROOT / 'references/language.md').read_text()
section = language.split('## User-facing writing rules', 1)[1]
list_text = section.split('acceptance gate;', 1)[1].split('\n\n', 1)[0]
terms = ['acceptance gate'] + [term.strip().rstrip('.') for term in list_text.split(';')]
violations = []
for task in TASKS:
    contents = task['title'] + '\n' + task['description']
    for term in terms:
        if term and re.search(r'(?<!\w)' + re.escape(term) + r'(?!\w)', contents, re.IGNORECASE):
            violations.append({'task': task['key'], 'term': term})
    assert all(part in task['description'] for part in ['Result:', 'Starting condition:', 'Locations and inputs:', 'Prerequisites:', 'Required behavior:', 'Steps:', 'Required checks and completion:', 'Permissions and limits:', 'Git completion:'])

keys = [task['key'] for task in TASKS]
assert len(keys) == len(set(keys)) == 16
assert len(plan['blocking_edges']) == 24
assert all(edge['blocked'] in keys and edge['blocker'] in keys for edge in plan['blocking_edges'])
visited, visiting = set(), set()
by_key = {task['key']: task for task in TASKS}
def visit(key):
    assert key not in visiting, 'Dependency cycle at ' + key
    if key in visited:
        return
    visiting.add(key)
    for dep in by_key[key]['prerequisites']:
        visit(dep)
    visiting.remove(key)
    visited.add(key)
for key in keys:
    visit(key)
for task in TASKS:
    operation = next(op for op in operations if op.get('local_id') == task['key'])
    assert operation['description'] == task['description']
    assert operation['resource_keys'] == task['resource_keys']

checks = {'tasks': len(TASKS), 'blocking_edges': len(plan['blocking_edges']), 'unique_keys': True, 'no_cycles': True,
          'full_description_match': True, 'required_sections_present': True, 'language_violations': violations,
          'original_blocking_finding_R1_corrected': True,
          'files': {name: hashlib.sha256((OUT / name).read_bytes()).hexdigest() for name in ['plan.json', 'manifest.json']}}
(OUT / 'checks.json').write_text(json.dumps(checks, indent=2) + '\n')
print(json.dumps(checks, indent=2))
