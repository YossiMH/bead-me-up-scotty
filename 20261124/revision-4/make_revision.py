"""Expand the complete tray-repair plan and its reviewable native delta."""
from pathlib import Path
import copy
import hashlib
import json
import re

ROOT = Path('/workspace/scratch/3160e3ba3d24')
COORD = ROOT / 'coordination'
OUT = COORD / 'revision-4'
BASE = COORD / 'revision-3'
APP = ROOT / 'worktrees/scotty-completion'
sha = lambda value: hashlib.sha256(value).hexdigest()
BASE_SHA = '41dfc6f10c7c1e80784d9fe69bee8ba56f9310b5dfadc99ee7667f870c297cad'
assert sha((BASE / 'plan.json').read_bytes()) == BASE_SHA
base = json.loads((BASE / 'plan.json').read_text())
materialized = json.loads((COORD / 'results/materialization-result-v3.json').read_text())
assert materialized['status'] == 'passed' and materialized['total_issues'] == 971
ids = materialized['tasks']
plan = copy.deepcopy(base)
before = {t['key']: t for t in base['tasks']}
tasks = {t['key']: t for t in plan['tasks']}
behavior = before['windows-tray']['description'].split('Required behavior: ', 1)[1].split('\n\nSteps:', 1)[0]
git = before['windows-tray']['description'].split('Git completion: ', 1)[1].strip()
limits = (
    "Work in the cloud where possible. Root alone uses Emergency Maintenance on the PC and writes canonical task state. "
    "Preserve the user's foreground Unreal/VR work: no PC builds, GPU use, visible browser or other UI control, service restarts, broad process termination or unrelated changes. "
    "Ordinary PC app checks require at least 3 GiB free physical RAM immediately before launch, hidden BelowNormal processes, a 256 MiB Node heap and a 512 MiB aggregate resident-memory cap covering every owned process. "
    "Only the separately accepted browser task uses its specified 96 MiB heaps. Stop the owned check on excess memory, deadline or new foreground resource pressure. "
    "Only one PC app check runs at once under bead-edit-pc; retain exact process identities and end only owned processes. "
    "Keep the original 954 native records, all 17 existing continuation tasks and their results, the restored store and the 15 modified app files. Never repeat the successful restore, initialize a replacement store, upload private task data or reset another worker's files. "
    "Reviewers read source and supplied results; they run no product tests or builds. Reconcile any uncertain mutation before retry and use only legitimately issued claim credentials. "
    "A changed candidate must receive its affected checks and independent review before installation; a published candidate alone does not establish working Windows behavior."
)

def result_text(key, extra=''):
    return (f'Return {COORD}/results/{key}.json with status, source_commits, exact file/blob/SHA-256 identities, '
            'changed_files, checks and actual exits, output_paths, open_items and git_result. '
            'Name the exercised behavior and remaining limits. Preserve prior failed results and distinguish source inspection from an actual Windows run. ' + extra).strip()

def desc(key, outcome, start, inputs, prerequisites, steps, done, extra=''):
    return (f'Result: {outcome}\n\nStarting condition: {start}\n\nLocations and inputs: {inputs}\n\n'
            f'Prerequisites: {prerequisites}\n\nRequired behavior: {behavior}\n\nSteps:\n' +
            '\n'.join(f'{n}. {s}' for n, s in enumerate(steps, 1)) +
            f'\n\nRequired checks and completion: {done}\n\nPermissions and limits: {limits}\n\n' +
            result_text(key, extra) + f'\n\nGit completion: {git}\n')

def new(key, title, role, owner, prerequisite_keys, resources, **kwargs):
    task = {'key': key, 'title': title, 'prerequisites': prerequisite_keys, 'role': role,
            'owner': owner, 'resource_keys': resources,
            'description': desc(key, **kwargs)}
    tasks[key] = task
    return task

repair = new('tray-repair', 'Repair Windows tray cleanup after parent exit', 'executor', '/root/tray_finish',
    ['tray-diagnose'], ['scotty-cloud-run'],
    outcome='Let the real Windows tray helper finish its own icon and private-cache cleanup after its Node parent ends, while retaining normal Exit and supervised restart behavior.',
    start='The existing real Windows smoke already failed its parent-loss cache-removal assertion; real Exit passed separately. The actual PC runs Node v25.2.1 with libuv 1.51.0. Matching Node source assigns non-detached children to a parent-held Windows Job with JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE. Current createWindowsTray omits detached:true, so abrupt parent loss can kill the helper before its PowerShell finally block. This is the concrete repair identified by tray-diagnose; the full Windows check remains required. Keep the existing failing Windows assertion as the before-repair result, without rebuilding an artificial failing case.',
    inputs=f'{APP}, working branch task/scotty-recovered-20261124 at f8b139de8cd48c7c0f42de45d28556ab1db0a310; {COORD}/results/tray-diagnose.json and tray-repair-instructions.md. Read AGENTS.md, bin/windows-tray.mjs, bin/windows-tray.ps1, bin/server-controller.mjs, scripts/fixtures/tray-process-boundary.mjs, scripts/fixtures/tray-helper.mjs and scripts/test-windows-tray.mjs. Only bin/windows-tray.mjs, scripts/fixtures/tray-process-boundary.mjs and scripts/test-windows-tray.mjs may change. The starting module SHA-256 is fa66d90908397d29722b5a8fcae54f89ec815d5dea54f221af33ce8f9ca4eb5b; the unchanged PowerShell helper SHA-256 is 46c98de97680cad44f8aa70c643a9538941cc0a0a6f5b4f86b6b2f0eae5716fb.',
    prerequisites=f'tray-diagnose ({ids["tray-diagnose"]}) supplies the concrete source defect. The complete revision-4 plan must be independently accepted and this task materialized before assignment.',
    steps=[
        'Read the exact diagnosis and current Git status before changing the three allowed files. Match the actual Node release source at https://github.com/nodejs/node/blob/4cac2b94bed4bf02810be054e8f63c0048c66564/deps/uv/src/win/process.c to the described parent Job behavior. Preserve all unrelated app and backend code, accepted editing behavior, original helper script and current test assertions.',
        'In createWindowsTray add detached:true only to the PowerShell tray-helper spawn. Keep windowsHide:true, shell:false, all three stdio pipes, the retained child reference, READY/EXIT/STOP handling, timeouts and parent watch. Do not call unref on the child or its streams. Add a short comment explaining why the Windows helper must be able to finish cleanup after parent loss. Detached creation does not request CREATE_BREAKAWAY_FROM_JOB; enclosing test Job containment remains required.',
        'In scripts/fixtures/tray-process-boundary.mjs record the requested options.detached in the existing tray_spawn event before replacing PowerShell with the synthetic Node helper. Set detached:false explicitly on that POSIX replacement so existing process-group cleanup still contains it. Preserve its pipes, controller behavior, server stop and existing timeout cleanup.',
        'In the existing global, serve and start launcher cases in scripts/test-windows-tray.mjs assert the recorded requested detached option is true. Keep every existing hidden-launch, single-helper, real subprocess disposal and server-stop assertion. This fixture checks the requested Windows spawn option; it cannot establish actual Windows Forms cleanup.',
        'Inspect the entire change twice on the final same bytes and record two clean author audits. Run git diff --check only; the separately assigned tray-repair-checks task executes the existing launcher suite and lint. Commit only these three allowed files, then record the exact candidate commit, git rev-parse HEAD:bin/windows-tray.mjs blob ID and SHA-256 of git cat-file blob HEAD:bin/windows-tray.mjs bytes. Record unchanged PowerShell helper hash. No placeholder or checkout-newline hash may substitute for the canonical module hash.',
        'Publish by an ordinary descendant push to YossiMH/bead-me-up-scotty task/scotty-finish-20261124, leaving main at its existing installer baseline. Return the exact candidate and two audits so cloud checks, installer correction and independent inspection can proceed. This task closes when the candidate is inspectable; installation remains blocked by real Windows results and tray-repair-review.'
    ],
    done='The three-file candidate implements only the diagnosed Windows spawn correction and preserves POSIX fixture cleanup. Both author audits and diff check are clean. Its commit, canonical module blob/SHA-256 and unchanged helper identity are recorded. Actual Windows behavior and the full launcher run belong to separate tasks.',
    extra='Include canonical_module={path,source_commit,git_blob,sha256}, unchanged_helper_sha256 and both author audit results. Root uses these actual values to stage source and bind the installer; do not infer a future commit.')

checks_task = new('tray-repair-checks', 'Check the repaired tray launchers in the cloud', 'executor', '/root',
    ['tray-repair'], ['scotty-cloud-run'],
    outcome='Verify the changed Windows spawn request, POSIX fixture cleanup and existing launcher behavior on the exact repair candidate without using the PC.',
    start='The repair candidate and canonical module identity exist. The earlier unchanged launcher suite passed 32 cases and adapter/editor suite passed 161. The three affected launcher files require their focused rerun. Keep the unchanged adapter/editor and 55-command Windows native results.',
    inputs=f'{APP}; {COORD}/results/tray-repair.json and cloud-checks.json; existing scripts/test-windows-tray.mjs, scripts/test-serve.mjs and scripts/test-bead-binary-option.mjs; installed cloud node_modules matching package-lock.json. Write tray-repair-launchers.log, tray-repair-lint.log and tray-repair-diff.log under {COORD}/results.',
    prerequisites='tray-repair (unique reference bead-edit-20261124:tray-repair; root records its actual materialized ID) supplies the exact files and commit. No independent-review prerequisite is imposed, so execution can proceed while review reads the candidate.',
    steps=[
        'Read the repair result, current Git status and actual HEAD. Require the module blob/SHA-256 and allowed three-file change to match the candidate. Use the existing installed cloud dependencies and reserve scotty-cloud-run. Do not modify source or update dependencies under this task.',
        'From the app worktree run node --test --test-concurrency=1 scripts/test-windows-tray.mjs scripts/test-serve.mjs scripts/test-bead-binary-option.mjs. Retain full stdout/stderr and actual exit in tray-repair-launchers.log and the result JSON. Use the existing per-test timeouts plus a 10-minute outer bound; no second suite or build runs at the same time.',
        'Require the existing 32 cases to pass with zero failures and no unexpected skips. Verify the global, serve and start assertions read detached:true before fixture substitution and existing cleanup still completes. A cloud fixture is separate from the real Windows tray result. Keep a concrete failure and send it to the author before any affected retry.',
        'Run npm run lint with a 5-minute bound and git diff --check with a 30-second bound, retaining their output and exits separately. The existing unchanged hooks/use-notifications.ts warning may remain; new errors or warnings require inspection. The module-only launch repair does not require a Next build, TypeScript rerun, backend build or repeat of unchanged editor tests.',
        'Read the existing fixture cleanup results and ensure this run ended its owned helper/server processes and loopback listeners. Stop only an exact owned survivor if an outer timeout occurred. Return actual counts, exits, candidate identity and cleanup. Independent repair review may already be reading the source and incorporates these results before closure.'
    ],
    done='The exact repair candidate passes all 32 existing launcher cases, lint without a new issue and diff check; owned fixture processes and ports are released. Complete logs and actual exits remain available. Windows parent-loss cleanup stays pending until windows-tray passes.',
    extra='Include launcher counts, any platform skip, existing lint warning identity, elapsed times and cleanup results. This task makes no production source changes.')

installer = new('installer-repair', 'Bind the installer to the repaired tray module', 'executor', '/root',
    ['tray-repair'], ['bead-edit-pc'],
    outcome='Allow installation of exactly the accepted external tray module while retaining the existing runtime, user-file, index, pin and rollback safeguards.',
    start='The original installer at SHA-256 ce7093f9055d5b91efe1ae720a5741a994c3a374b363799f8654d2b39d3b7f5b refuses any bin change after the Next build. The repair changes bin/windows-tray.mjs, which the launcher loads separately from the unchanged Next output. The repair result supplies its actual source commit, Git blob ID and canonical SHA-256.',
    inputs=f'{ROOT}/transfer/windows-install.ps1 and windows-task-job.ps1; {COORD}/results/tray-repair.json; {ROOT}/transfer/pc-preservation-raw.json, scotty-runtime.json and delivery-manifest.json. Write only {ROOT}/transfer/windows-install-tray-20261124.ps1 as the installer candidate, preserving the original file byte-for-byte. Runtime source fbb09312e43ec8094da6db04f126a16e8c5746f7 has 230 files, manifest SHA-256 948194c2eda868f879152111570f52ce6f643dc6f4c4fe79f8f4eef8043a510a and build ID Eox2_s2VuIuWWAISvMqKK. Backend runtime source 539cdd0b4c54665c2db01da08fdf9f3871f7148a and Windows executable SHA-256 25a05bdfd8feaea92faf6827e9268e597d25432826f1082c7ebadc3af8658798 remain unchanged.',
    prerequisites='tray-repair (unique reference bead-edit-20261124:tray-repair; root records its actual materialized ID) supplies the specific module identities. Cloud launcher checks and static review may proceed independently of this authoring task.',
    steps=[
        'Read the entire original installer and its prior review, the repair result and preservation/runtime manifests. Verify the original hash and create the separately named copy. Keep backend main afac9fa0ce9533a707d745018d16a25e4ccff492, app main 459a74537cbbe1dff521c6fc7ad1ce3ec2890683, preserved 15-file baseline 55f17568be93442abc6e4725d3e159448e0c9ab5 and old pin SHA-256 376537b7917f18d33383a3e4bd3eb9e0955bb42d1a60b73aef5c81865662af28 checks.',
        'Keep Assert-DocumentedDescendant and its existing allowed paths. Permit the additional exact path bin/windows-tray.mjs only after validating its final Git blob ID and canonical SHA-256 against the actual repair result. Bind both expected identities explicitly in the candidate; an absent, malformed or differing value fails before installation changes. Do not allow other bin paths or accept any supplied hash merely because its format is valid.',
        'Read canonical content through the existing bounded Git function with cat-file blob <FinalCommit>:bin/windows-tray.mjs. Hash the existing UTF-8 encoding of that exact text with Hash-Bytes, preserving its final newline; independently compare rev-parse <FinalCommit>:bin/windows-tray.mjs to the accepted blob ID. Verify source ancestry and protected-path restrictions still apply. Avoid a working-copy hash whose newline conversion could differ from canonical Git bytes.',
        'Record the accepted external module path, actual source commit, Git blob and canonical SHA-256 separately in install-result.json. Preserve the complete 230-file Next verification, build ID, native executable/provenance, exact 15 dirty files, private-index operations, file identity checks, .env.local guards, previous pin/runtime backups, no-running-server checks, ordinary user-fork publication and partial-install reconciliation.',
        'Inspect the complete new file and its diff against the frozen original twice on identical final bytes. Record two clean author audits, the new file SHA-256 and the original still matching its prior hash. Root may perform a bounded ordinary Windows PowerShell Parser.ParseFile read on the transferred exact candidate under bead-edit-pc, with no app or installer invocation; require zero parse errors. Keep the host execution policy unchanged. Parser output and transferred hash enter this task result.',
        'Publish only the small reviewed transfer candidate through the existing task/build-transfer-20261111 branch using the permitted Git route, preserving older transfer files and product branches. Record actual commit/ref and file hash. Transfer publication does not authorize execution; the separate install task requires all existing checks and the final tray-repair-review pass.'
    ],
    done='The new installer permits only the accepted canonical bin/windows-tray.mjs identity beyond its old text/test allowances; the original installer and all other guards remain intact. Both author audits and ordinary PowerShell parsing pass, exact hashes are recorded and the candidate is available for independent inspection. Do not run this installer or demonstrate installation under this task.',
    extra='Include original_installer_sha256, candidate_installer_path, candidate_installer_sha256, accepted_module identity, unchanged runtime/native identities, parser result and two author audits. The new installer has its own output file and never overwrites windows-install.ps1.')

review = new('tray-repair-review', 'Review the tray repair and exact installer allowance', 'independent reviewer', '/root/delivery_review',
    ['tray-repair', 'installer-repair'], [],
    outcome='Independently accept the repaired tray module and narrowly changed installer after source inspection and the required cloud and real Windows results.',
    start='Both authors supplied inspectable candidates with two clean self-audits and exact file identities. Cloud launcher execution and the Windows tray check may still be running or awaiting PC memory. Begin static inspection immediately; keep this review open until those required results pass.',
    inputs=f'{APP}/bin/windows-tray.mjs, scripts/fixtures/tray-process-boundary.mjs, scripts/test-windows-tray.mjs and unchanged bin/windows-tray.ps1; {ROOT}/transfer/windows-install.ps1 and windows-install-tray-20261124.ps1; {COORD}/results/tray-diagnose.json, tray-repair.json, tray-repair-checks.json, installer-repair.json and windows-tray.json; original preservation/runtime manifests; {ROOT}/references/zcf.md, standards.md and postprocess.md.',
    prerequisites='tray-repair (unique reference bead-edit-20261124:tray-repair) and installer-repair (bead-edit-20261124:installer-repair) supply the two concrete outputs; root records both actual materialized IDs. No blocking edge from the test tasks delays starting this inspection. Closure also requires passing tray-repair-checks and windows-tray results on these same bytes.',
    steps=[
        'Read both complete candidates and their original versions, exact commits/hashes and author audits. Verify the diagnosis against the matching Node v25.2.1/libuv source and retained failed parent-loss assertion. Treat the detached option as a source correction whose actual Windows outcome still needs the existing full check.',
        'Trace the Windows helper spawn, hidden window setting, shell:false, three pipes, retained references, READY/EXIT/STOP, startup/shutdown deadlines and parent watch. Require detached:true only for the Windows helper and no unref. Confirm the POSIX synthetic helper remains detached:false after recording the requested option, and the three existing entrypoint tests retain all earlier assertions.',
        'Read the entire new installer and its diff against ce7093f9055d5b91efe1ae720a5741a994c3a374b363799f8654d2b39d3b7f5b. Require the one exact bin/windows-tray.mjs allowance, both accepted blob/SHA-256 checks on canonical Git bytes, separate module provenance, the unchanged Next/native identities, all user-file/index/pin/rollback checks and ordinary main publication. Verify the PowerShell parse result and transfer identity without invoking the installer.',
        'Report any concrete correction as soon as found. When source inspection is clean but execution remains unavailable, return pending and list the exact missing result. The windows-tray task depends on the repair candidate and cloud checks, not this completed review, so no review/test dependency cycle is introduced.',
        'Read full tray-repair-checks logs and require the 32 launcher passes, lint/diff success and cleanup. Read the complete real Windows tray result on the new staged source and exact module hash. Require actual menu Exit, server shutdown, parent-loss icon and copied-cache removal, code-75 restart with one icon, no later restart after Exit, all owned processes ended and port released within the 512 MiB/180-second bounds. An ended helper with a surviving cache fails. Static assertions, fixture substitution or modified diagnostic helpers cannot replace those cases.',
        'Return pass only when both substantive outputs and these execution results agree on exact identities and required behavior. Record any affected rerun after a concrete correction, preserving unrelated backend/editor/browser results. Root can then allow install only after its other existing requirements also pass.'
    ],
    done='The independent reviewer has accepted both exact outputs and reconciled passing focused cloud and complete Windows tray results, with all preservation and resource limits satisfied. Static inspection can finish early, but this bead cannot close while either required execution result is pending or failed. The reviewer runs no builds, tests or apps.',
    extra='Include separate module/test and installer verdicts, exact reviewed hashes, cloud and Windows result paths, their limits, and the final combined verdict. This review does not replace the existing candidate-review of the full user request.')

# Update only instructions affected by the diagnosed module repair or its execution location.
wt = tasks['windows-tray']
wt['prerequisites'] = ['tray-diagnose', 'tray-repair', 'tray-repair-checks']
wt['description'] = desc('windows-tray',
    'Establish that the repaired real Windows tray appears once, Exit stops its owned server, parent loss removes the icon and copied helper, and supervised restart preserves one icon.',
    'The retained real Windows parent-loss check failed. The exact installed Node release and its libuv source establish the missing detached spawn option as a concrete defect. The separate tray-repair candidate supplies corrected source and exact module identity; its focused cloud checks must pass before this full Windows rerun. The final repair review may be inspecting source and remains open until this result exists.',
    f'{COORD}/results/tray-diagnose.json, tray-repair.json and tray-repair-checks.json; {ROOT}/transfer/windows-tray-smoke.ps1 at SHA-256 43c0b6887164a4f5d14f19552db8af576c80a024a3d58f7de879dbec832e2f80 and windows-task-job.ps1 at 2758a6ff94c0eecdfa360363469069dfa8470efc1f91228812146919a978921f; PC stage-v6/stage-result.json under F:/Dev/.bead-edit-20261111, whose app_directory resolves the staged repository. Use a fresh nonexisting child under F:/Dev/.bead-edit-20261111/tray-results-20261124 for every actual run.',
    f'tray-diagnose ({ids["tray-diagnose"]}); tray-repair (bead-edit-20261124:tray-repair); tray-repair-checks (bead-edit-20261124:tray-repair-checks). Root resolves actual new IDs after materialization. Completed tray-repair-review is deliberately not a prerequisite, since it must read this run before closure.',
    [
        'Read the exact repair and passing cloud-check result. Resolve the actual published app commit, canonical module blob/SHA-256 and unchanged PowerShell helper hash from tray-repair.json. Read the stage result instead of assuming a directory name. Verify the staged repository is clean, its actual HEAD is an ancestor of the repair commit and its ignored runtime/dependency/config data remain unchanged. Fetch or import the already published exact repair commit and advance only this task-owned staged repository with git merge --ff-only. Preserve all .next files, node_modules, prior result directories and config. Do not change either requested PC main repository during staging or assume f47fd7a is still the final source.',
        'Match staged HEAD and the canonical Git module blob/SHA-256 to the repair result, and verify checked-out source content against that Git object with the repository newline rules. Require bin/windows-tray.ps1 SHA-256 46c98de97680cad44f8aa70c643a9538941cc0a0a6f5b4f86b6b2f0eae5716fb, the unchanged verified Next build Eox2_s2VuIuWWAISvMqKK and native executable SHA-256 25a05bdfd8feaea92faf6827e9268e597d25432826f1082c7ebadc3af8658798. Retain the new source/module identities in the run inputs and result.',
        'Root holds bead-edit-pc, confirms at least 3 GiB free physical RAM immediately before launch and checks unused loopback port 43971 or records a verified replacement. Retain the 512 MiB aggregate owned-process cap, 256 MiB Node heap and 180-second full-run deadline including cleanup. While memory is insufficient, do cloud work and wait; no app or helper starts.',
        'Copy the exact reviewed Windows smoke entry script and matching windows-task-job.ps1 beside one another under C:/Users/YossiMH/AppData/Local/bead-edit-20261111/tray-execution-20261124. Verify both hashes there. The ordinary F: helper dot-source previously failed the host execution policy; use this already qualified local execution location without changing that policy, file-zone settings or security controls. Preserve all prior script/results copies.',
        'Create one uniquely named short-lived COM scheduled task for the already logged-in session 1 with a limited token, hidden window, BelowNormal priority and no persistent trigger. Its ordinary powershell.exe -NoLogo -NoProfile -NonInteractive -WindowStyle Hidden -File action invokes the verified local entry script with -RepositoryPath the now repaired stage, -EvidenceDirectory the fresh result child, -BeadBin the qualified executable, -SourceRevision the actual repair commit, -Port the checked port, -TimeoutSeconds 180 -NodeHeapMiB 256 -MaxOwnedResidentMiB 512. Use validated argument values and the exact sibling Job helper. Record the task/process identities and use bounded nonblocking reads; remove only this task after reconciling its result.',
        'Read the complete result and child logs. Require actual NotifyIcon creation, real Exit menu invocation and server shutdown; parent loss must remove the real icon and copied helper/cache; code-75 restart must produce exactly one icon/server and Exit must prevent another restart. The check may invoke the real menu internally and requires no mouse, visible menu or browser. Keep every existing assertion and ordinary parent-watch behavior.',
        'Require exit 0, all cases passed, port released, all owned processes ended, helper copies removed and protected original files/stores unchanged. An exited helper with a surviving cache is a failure. Retain any failure and diagnose that exact cause before another affected run. Return actual source/module hashes, elapsed time, peak aggregate memory and cleanup so tray-repair-review and candidate-review can complete.'
    ],
    'All existing real Windows cases and cleanup pass on the repaired staged source within the stated bounds. Static inspection, cloud subprocess fixtures, modified diagnostic helpers and skipped cases are insufficient. Installation remains blocked by both independent reviews and the other existing checks.')

def replace_once(key, old, new):
    assert tasks[key]['description'].count(old) == 1, (key, old)
    tasks[key]['description'] = tasks[key]['description'].replace(old, new)

replace_once('candidate-review',
    f'{ROOT}/transfer/windows-install.ps1, accepted source/specifications',
    f'{ROOT}/transfer/windows-install.ps1 and windows-install-tray-20261124.ps1, accepted source/specifications')
replace_once('candidate-review',
    'Any amended external-helper allowance must validate the specific accepted helper/hash and retain all other runtime/source checks.',
    f'Read {COORD}/results/tray-repair-review.json and installer-repair.json for the separately inspected module repair and new installer. Its bin/windows-tray.mjs allowance must compare the exact accepted canonical Git blob and SHA-256 and retain every other runtime/source check. Reuse that independent inspection, while checking that its accepted identities match this combined candidate.')
replace_once('candidate-review',
    'Remain pending until reconcile, cloud-checks, browser-check and windows-tray supply passing applicable results.',
    'Remain pending until reconcile, cloud-checks, browser-check and windows-tray supply passing applicable results and tray-repair-review accepts the module and new installer on those exact inputs.')

it = tasks['install']
it['prerequisites'].append('tray-repair-review')
replace_once('install',
    f'{ROOT}/transfer/windows-install.ps1 with originally accepted hash ce7093f9055d5b91efe1ae720a5741a994c3a374b363799f8654d2b39d3b7f5b, or its separately reviewed exact amendment.',
    f'{ROOT}/transfer/windows-install-tray-20261124.ps1 with the exact new SHA-256 and canonical module identities from {COORD}/results/installer-repair.json and tray-repair-review.json. Preserve the original windows-install.ps1 at ce7093f9055d5b91efe1ae720a5741a994c3a374b363799f8654d2b39d3b7f5b as the reviewed baseline.')
replace_once('install',
    'Prerequisites: reconcile; cloud-checks; browser-check; windows-tray; candidate-review',
    'Prerequisites: reconcile; cloud-checks; browser-check; windows-tray; candidate-review; tray-repair-review (bead-edit-20261124:tray-repair-review; root resolves the actual new ID). Preserve every existing blocking edge and add this final repair-review requirement.')
replace_once('install',
    'Resolve installer inputs from verified stage result and manifest: ScottySourceCommit is the accepted app task HEAD descended from f47fd7adef41e989072d5fa8c39160681aa6fd2a; BackendSourceCommit is the accepted backend task HEAD descended from 24979aec5d19a48ab145daf24e2399397d9b4814. Import newer approved descendants through ordinary bundle/fetch first. Require the installer to verify allowed changes against both runtime commits. A helper-only correction must have its separately accepted exact-file/hash rule; do not weaken all descendant checks.',
    'Resolve installer inputs from the verified stage result and accepted repair records: ScottySourceCommit is the actual published app candidate containing the repaired module; BackendSourceCommit is the accepted backend task HEAD descended from 24979aec5d19a48ab145daf24e2399397d9b4814. Verify ancestry and import exact approved descendants through ordinary bundle/fetch first. The new installer must match bin/windows-tray.mjs to the accepted canonical Git blob and SHA-256 and retain all other descendant rules. Keep Next source fbb09312e43ec8094da6db04f126a16e8c5746f7, manifest SHA-256 948194c2eda868f879152111570f52ce6f643dc6f4c4fe79f8f4eef8043a510a and build ID Eox2_s2VuIuWWAISvMqKK unchanged. Record the external module source separately.')
replace_once('install',
    'Run the verified installer once in a fresh hidden PowerShell process.',
    'Copy the exact new installer and verified windows-task-job.ps1 beside one another into the established task-owned LocalAppData execution directory, recheck hashes and ordinary PowerShell parsing, and keep host policy unchanged. Run that verified installer once in a fresh hidden PowerShell process.')
replace_once('install',
    'Require preserved source/index backups, successful fast-forwards, verified runtime swap, copied native pin, exact .env.local selection and unchanged old executable.',
    'Require preserved source/index backups, successful fast-forwards, verified runtime swap, copied native pin, exact .env.local selection and unchanged old executable. Verify the separately recorded tray-module source commit, path, canonical Git blob and SHA-256 equal the accepted repair values.')

replace_once('configured-launch',
    'Use the verified immediate short-lived Windows task route into logged-in session 1 and remove that exact task afterward.',
    'Copy the exact reviewed windows-configured-launch-smoke.ps1 at SHA-256 2987f21bc4a2e051ca7cf864fbd2644feef504c6e9ca9e70552433b38ee0ebd0 and windows-task-job.ps1 at 2758a6ff94c0eecdfa360363469069dfa8470efc1f91228812146919a978921f beside one another under the established task-owned LocalAppData execution directory; verify both hashes and retain ordinary PowerShell policy. Use the verified immediate short-lived Windows task route into logged-in session 1 with a limited token and remove that exact task afterward.')

replace_once('app-handoff',
    f'{APP}/docs/backend-compatibility.md and README.md only if current usage text needs correction;',
    f'{APP}/docs/backend-compatibility.md and README.md;')
replace_once('app-handoff',
    'State tests leave the app stopped so the user can launch normally. Describe any corrected helper cleanup and required host session plainly.',
    'State tests leave the app stopped so the user can launch normally. In README.md put the supported Windows production/source launch first: the installed launch-scotty.bat and existing production source commands that create the tray. Label npm run dev explicitly as frontend development and explain its existing tray behavior accurately. Do not add tray support to the frontend development server under this documentation task. Describe the repaired parent-loss cleanup, exact module identity and required host session plainly.')
replace_once('app-text-review',
    f'{APP}/docs/backend-compatibility.md; app-handoff result',
    f'{APP}/docs/backend-compatibility.md and README.md; app-handoff result')
replace_once('app-text-review',
    'Backend text must retain append-only history; app instructions must work without this conversation.',
    'App instructions must work without this conversation. Require README.md to present the supported tray-capable Windows production/source launch before npm run dev, which must be described as frontend development with its existing behavior. Match the repaired module identity and installed launch result; this writing change does not expand dev-server features.')
replace_once('preserve-and-clean',
    f'{COORD}/plan.json, manifest.json and results;',
    f'{OUT}/plan.json, delta-manifest.template.json, the exact rendered revision-4 manifest and its actual materialization result, plus {COORD}/results; preserve prior accepted plan/manifests and the original revision-3 17-ID mapping;')

new_tasks = [repair, checks_task, installer, review]
# Put the four additions next to the diagnosed behavior without changing old task identities.
index = next(i for i,t in enumerate(plan['tasks']) if t['key'] == 'windows-tray')
plan['tasks'][index:index] = new_tasks
plan['blocking_edges'] = [{'blocked': t['key'], 'blocker': dep}
                          for t in plan['tasks'] for dep in t['prerequisites']]
old_edges = {(e['blocked'], e['blocker']) for e in base['blocking_edges']}
new_edges = [e for e in plan['blocking_edges'] if (e['blocked'], e['blocker']) not in old_edges]
assert old_edges <= {(e['blocked'], e['blocker']) for e in plan['blocking_edges']}
changed = [k for k in before if tasks[k] != before[k]]
unchanged = [k for k in before if tasks[k] == before[k]]
plan['version'] = 5
plan['continuation_revision'] = 4
plan['status'] = 'draft_revision_requires_independent_full_review_before_changed_task_records'
plan['revision_4'] = {
    'base_plan_sha256': BASE_SHA,
    'base_manifest_sha256': materialized['manifest_sha256'],
    'base_materialization_result': str(COORD / 'results/materialization-result-v3.json'),
    'base_task_ids': ids,
    'existing_task_count': len(before), 'new_task_keys': [t['key'] for t in new_tasks],
    'changed_existing_task_keys': changed, 'unchanged_task_keys': unchanged,
    'added_blocking_edges': new_edges, 'removed_blocking_edges': [],
    'reason': 'The installed Node/libuv version and retained Windows parent-loss failure identify a concrete tray spawn defect. Add the specific module/fixture repair, focused cloud execution, exact installer correction and independent combined review.',
    'review_start_and_close': 'Repair review starts after the module and installer candidates exist, while cloud checks and Windows execution proceed. It closes only after their actual passing results. Windows execution has no dependency on completed repair review. Installation retains its old dependencies and also requires repair review.',
    'materialization': 'The original 954 records and accepted 17 tasks already exist. Use only the separately reviewed revision-4 delta, with these 17 actual IDs, four absent stable unique references, current if_revision bindings and a byte-for-byte live old-description comparison. Never replay creates for the 17 existing tasks or repeat restore. Retain their states, claims and results; use legitimate claim reconciliation before any affected native update.',
    'historical_text': 'Unchanged completed-task descriptions and earlier revision metadata remain the accepted historical instructions. Revision-4 descriptions govern the newly assigned repair and affected delivery tasks. Earlier restore/initial-create directions must not be replayed.',
    'red_result': 'The retained permanent full Windows smoke already failed parent-loss cache removal. Keep that real failure as the before-repair result; no recreated failing test is needed.',
    'writing_rules': str(OUT / 'writing-rules.json'),
    'pending_actual_values': 'The repair author records its actual commit, canonical module Git blob and SHA-256 before installer authoring or staged Windows execution; no final repair identity is invented in this plan.'
}
plan['sources']['tray_diagnosis'] = str(COORD / 'results/tray-diagnose.json')
plan['sources']['new_installer_candidate'] = str(ROOT / 'transfer/windows-install-tray-20261124.ps1')
plan['sources']['installed_node_version'] = 'v25.2.1'
plan['sources']['installed_libuv_version'] = '1.51.0'
plan['prior_work'].append({'result': 'Revision-3 native materialization', 'state': 'verified_pass', 'record': str(COORD / 'results/materialization-result-v3.json'), 'original_issues': 954, 'continuation_tasks': 17, 'blocking_edges': 26, 'total_issues': 971})
plan['prior_work'].append({'result': 'Tray parent-loss source diagnosis', 'state': 'concrete_repair_required', 'record': str(COORD / 'results/tray-diagnose.json'), 'actual_node': 'v25.2.1', 'actual_libuv': '1.51.0', 'post_repair_windows_pass': False})
plan['dispatch_notes'].append('Revision 4 adds tray-repair, tray-repair-checks, installer-repair and tray-repair-review. Preserve the accepted 17 tasks and all previous valid results. Root runs focused cloud checks while independent inspection proceeds; it also owns the separate installer candidate. Full Windows execution uses the actual new staged module identity and can proceed before the repair review closes. All PC app starts still require at least 3 GiB free RAM. The actual four new IDs come only from the accepted delta commit/readback.')
plan['materialization']['revision_4'] = plan['revision_4']['materialization']
for row in plan['coverage']:
    if row['requirement'] == 'Windows production tray and working Exit':
        row['tasks'] = ['tray-diagnose', 'tray-repair', 'tray-repair-checks', 'installer-repair', 'tray-repair-review', 'windows-tray', 'candidate-review', 'install', 'configured-launch', 'installed-review', 'app-handoff', 'app-text-review']
    elif row['requirement'] == 'Parallel work and independent reviews':
        row['tasks'].extend(['tray-repair-checks', 'installer-repair', 'tray-repair-review'])
    elif row['requirement'] == 'Complete work without disturbing foreground PC development':
        row['tasks'].extend(['tray-repair', 'tray-repair-checks', 'installer-repair'])

ops = [{'op': 'create', 'local_id': t['key'], 'unique_ref': 'bead-edit-20261124:' + t['key'],
        'title': t['title'], 'description': t['description'], 'issue_type': 'task', 'priority': 1,
        'labels': ['bead-edit-20261124'], 'resource_keys': t['resource_keys']} for t in new_tasks]
ops.extend({'op': 'update', 'id': ids[k], 'if_revision': '@revision:' + k,
            'description': tasks[k]['description']} for k in changed)
ref = lambda key: ids[key] if key in ids else '$' + key
ops.extend({'op': 'dep_add', 'blocked': ref(e['blocked']), 'blocker': ref(e['blocker']), 'kind': 'blocks'} for e in new_edges)
template = {'manifest_version': 1, 'operations': ops}
bindings = {'format': 'revision_4_bindings_v1', 'store_uuid': materialized['source_store_uuid'],
    'base_materialization_confirmed': False, 'current_inventory_path': None,
    'current_inventory_sha256': None, 'claiming_paused_for_changed_tasks': False,
    'old_edges_verified': False, 'original_954_unchanged': False,
    'new_unique_refs': {'bead-edit-20261124:' + t['key']: {'matches': None, 'record_source': None} for t in new_tasks},
    'tasks': {k: {'id': ids[k], 'unique_ref': 'bead-edit-20261124:' + k,
                 'ref_matches': None, 'record_source': None, 'revision': None,
                 'description_sha256': sha(before[k]['description'].encode()),
                 'claim_released_or_absent': False if k in changed else None} for k in before}}
for name, obj in [('plan.json', plan), ('delta-manifest.template.json', template), ('bindings.example.json', bindings)]:
    (OUT / name).write_text(json.dumps(obj, indent=2, ensure_ascii=False) + '\n')

# Whole-plan structural and per-bead language checks; no product or database execution.
keys = [t['key'] for t in plan['tasks']]
assert len(keys) == len(set(keys)) == 21
assert len(plan['blocking_edges']) == 34 and len(new_edges) == 8
visiting, visited = set(), set()
def visit(key):
    assert key not in visiting, 'Dependency cycle: ' + key
    if key in visited: return
    visiting.add(key)
    for dependency in tasks[key]['prerequisites']:
        assert dependency in tasks
        visit(dependency)
    visiting.remove(key); visited.add(key)
for key in keys: visit(key)
assert tasks['tray-repair-review']['prerequisites'] == ['tray-repair', 'installer-repair']
assert 'tray-repair-review' not in tasks['windows-tray']['prerequisites']
assert 'tray-repair-review' in tasks['install']['prerequisites']
assert len({t['key'] for t in new_tasks} & set(ids)) == 0
assert [o['id'] for o in ops if o['op'] == 'update'] == [ids[k] for k in changed]
assert sum(o['op'] == 'create' for o in ops) == 4
for k in unchanged: assert tasks[k] == before[k]
language = json.loads((OUT / 'writing-rules.json').read_text())['section']
terms = ['acceptance gate'] + [x.strip().rstrip('.') for x in language.split('acceptance gate;', 1)[1].split('\n\n', 1)[0].split(';')]
violations = []
per_task = []
for task in plan['tasks']:
    fields = json.dumps(task, ensure_ascii=False)
    hits = [term for term in terms if term and re.search(r'(?<!\w)' + re.escape(term) + r'(?!\w)', fields, re.I)]
    for pattern in [r"(?:it(?:'|’)?s|it is)\s+not\b.{0,100}?,?\s+(?:it(?:'|’)?s|it is)\b", r'\bnot just\b.{0,120}\bbut\b']:
        if re.search(pattern, fields, re.I): hits.append('listed rhetorical pattern')
    if hits: violations.append({'key': task['key'], 'matches': hits})
    for marker in ['Result:', 'Starting condition:', 'Locations and inputs:', 'Prerequisites:', 'Required behavior:', 'Steps:\n1.', 'Required checks and completion:', 'Permissions and limits:', 'Return ', 'Git completion:']:
        assert marker in task['description'], (task['key'], marker)
    per_task.append({'key': task['key'], 'description_sha256': sha(task['description'].encode()), 'language_matches': hits, 'required_sections_present': True})
assert not violations, violations
assert sha((BASE / 'plan.json').read_bytes()) == BASE_SHA
files = ['plan.json', 'delta-manifest.template.json', 'bindings.example.json', 'writing-rules.json', 'make_revision.py', 'render_delta.py', 'DB_UPDATE_PROCEDURE.md']
checks = {'tasks': len(keys), 'existing_tasks': len(before), 'new_tasks': len(new_tasks),
          'existing_ids_preserved': ids, 'blocking_edges': len(plan['blocking_edges']), 'old_edges_preserved': len(old_edges),
          'new_edges': len(new_edges), 'removed_edges': 0, 'delta_operations': len(ops),
          'changed_existing_task_keys': changed, 'unchanged_existing_task_keys': unchanged,
          'acyclic': True, 'old_task_recreation': False, 'review_execution_cycle': False,
          'language_violations': violations, 'per_task': per_task,
          'product_tests_or_builds': False, 'database_access': False,
          'files': {name: sha((OUT/name).read_bytes()) for name in files if (OUT/name).exists()}}
(OUT/'checks.json').write_text(json.dumps(checks,indent=2)+'\n')
print(json.dumps({k:v for k,v in checks.items() if k not in ('per_task','existing_ids_preserved')},indent=2))
