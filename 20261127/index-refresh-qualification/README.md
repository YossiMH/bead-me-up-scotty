# Windows private-index refresh qualification

This focused Git-only check verifies the retained failed private index against the complete accepted baseline, then reproduces the raw-index refresh in a new tiny repository. The command-local correction must preserve exact bytes and continue to reject changed content before another installer is accepted.

## Exact scope

The initial original-repository calls are only `git ls-files --stage -z` with the explicit retained private index and `git ls-tree -r -z --full-tree` for baseline `55f17568be93442abc6e4725d3e159448e0c9ab5`. Every mode/blob/path entry must match, and all index stages must be zero. The result contains counts and hashes, without raw source or backup bytes.

The retained private index is `F:\Dev\.bead-edit-20261111\install-v9-retry-20261127-2889282bfcec\scotty-index.prepared`, SHA-256 `13af66e5997b12b75d8ef920eb7e9310968ce5b7b676a1dcc8bc35a46278a887`. The real app index must remain `8b9de62e05335aa677de1a20642f031883bd8a7e7ef6a878dda3337c0d6c9b5f`. Both are rehashed before and after comparison, and again after the tiny fixture.

All mutations occur inside this new task-owned output:

```text
F:\Dev\.bead-edit-20261111\index-refresh-qualification-20261127-2889282bfcec
```

Its `repo` contains only `.gitattributes`, one tracked text file and one added text file. The files use CRLF with explicit Git text normalization. Private indexes are outside that tiny repository. Empty global/system configuration and an empty hook path apply only to the owned Git child processes.

## Required results

The check uses `GIT_OPTIONAL_LOCKS=0` throughout and compares two exact copies of one cacheinfo-prepared index:

1. Default `git diff --exit-code --quiet --` must exit 0 and change private-index bytes, reproducing the failure mechanism.
2. `git -c diff.autoRefreshIndex=false diff --exit-code --quiet --` must exit 0 and preserve every byte through `ls-files` and `write-tree` validation.
3. Both cases must retain exactly the same full stage/mode/blob/path map and tree, with no untracked fixture file.
4. An intentional fixture content change must still make the corrected diff return exit 1 while retaining identical index bytes.

The tiny fixture's original index and HEAD must remain unchanged. Its controlled fixture files and private indexes are retained for independent inspection.

The focused cloud result at `../linux-result.json` already passed these cases on Git 2.56.1. The independent reviewer additionally decoded its raw index files and found only stat fields changed in the control. That result supports this exact Windows check; it is not a Windows execution result.

Git documents `diff.autoRefreshIndex=true` as the default and describes its cached-stat refresh: <https://git-scm.com/docs/diff-config.html>. The selected correction overrides this setting for one validation command and changes no persistent Git configuration.

## Ownership and limits

The script reuses all eight process/path/budget functions, the complete C# Job inspector and final cleanup from accepted supervisor `719f352cc46a8d23bdf3dd3df1f8f9d662d1f4b9ef1985191000fceb80018e4d`. The fixture controller sets a 256 MiB aggregate resident cap, a 60-second hard deadline, a 48-second work deadline and a 12-second cleanup reserve. It requires 1 GiB free physical memory before Git work and during its existing 100 ms sampling. Every Git call is sequential, hidden and BelowNormal under the same owned Job, with a 10-second command bound and bounded output checks.

The Git executable is fixed to `C:\Program Files\Git\cmd\git.exe`, SHA-256 `20d0dde30a65afb6e5810a883700a94dcd77fbf3b44b32868d45bf7c9b30137c`; the Job helper remains `2758a6ff94c0eecdfa360363469069dfa8470efc1f91228812146919a978921f`.

## Root invocation

After independent source review, stage and hash-check the exact script and obtain its ordinary Windows PowerShell 5.1 AST parse. Start only with fresh free memory of at least 1 GiB, using the approved hidden process-only execution policy:

```powershell
& 'F:\Dev\.bead-edit-20261111\final-installation-v9-20261125-1151\qualify-private-index-refresh-20261127.ps1' `
  -JobHelperPath 'F:\Dev\.bead-edit-20261111\final-installation-v9-20261125-1151\windows-task-job.ps1'
```

Require exit 0 and the exact `result.json` with status `passed`, both retained-index hashes unchanged, all control/correction/refusal criteria satisfied, no assisted cleanup/errors and no remaining owned member. The expected negative diff exit 1 belongs only to the intentional content-change case.

A failure preserves its fresh output for reconciliation and cannot qualify the installer correction. Root collects the result and later removes only the fixture's owned files under the existing cleanup task.
