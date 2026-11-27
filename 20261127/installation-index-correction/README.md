# Final installation with private-index refresh disabled

This separately named installer adds `-c diff.autoRefreshIndex=false` to the single private-index `git diff --exit-code --quiet --` validation. The original complete-byte guard remains after validation. Its wrapper binds the new driver and one fresh output directory.

## Actual failure and retained state

The previous retry used driver `c3c61ad33112ead3746325a32446b1aa786ee622532c69b9dad846838f721638` and supervisor `719f352cc46a8d23bdf3dd3df1f8f9d662d1f4b9ef1985191000fceb80018e4d`. It completed both exact repository-origin and user-fork preflight checks, preserved the original environment/index/fifteen app files, and built its private index. It then acquired its original-index lock and refused at `Prepared index changed during validation.` before any index publication or ref adoption.

The private index changed from recorded SHA-256 `26acf1c2d1e94545debb530c26b0b02d245f1a7eddd16028d3a384a3ca1686e6` to `13af66e5997b12b75d8ef920eb7e9310968ce5b7b676a1dcc8bc35a46278a887`, with the same 27,402-byte length. The independently accepted 09:16:50 UTC reconciliation confirms both original repository HEADs and raw indexes, all fifteen app files/statuses, Git configurations, environment and old native pin remain unchanged. The acquired lock is absent, the new pin is absent, and the final staged runtime is intact. The complete failed result is SHA-256 `22195c6b222f7798440ac27122febb75faed1c4ff0cc836120adc84d3920a0f2`; its failure/preservation review is `469c0ecb4ffea76a170ded402035ddd1ae1518addebc2494b0e630955daaac77`.

Keep both failed installer attempts, their result records and all backup/private-index files. This candidate uses a fresh output and preserves the previous corrected origin and full-name NullString result writer.

## Exact correction and qualification

The single changed command is:

```powershell
$null=Git-Index $Scotty $preparedIndex @('-c','diff.autoRefreshIndex=false','diff','--exit-code','--quiet','--')
```

Git documents `diff.autoRefreshIndex` as a default-on cached-stat refresh for porcelain `git diff`: <https://git-scm.com/docs/diff-config.html>. The focused cloud fixture, SHA-256 `ac9c04b28df2591569da686c459461b23de2120cb5ab92ccdaa094117b4f232d`, reproduced a default diff changing private-index bytes despite `GIT_OPTIONAL_LOCKS=0`. The command-local override preserved exact bytes. Both cases retained the same full stage/mode/blob/path entries and tree; an intentional content change still returned exit 1. Independent raw-index inspection found only stat fields changed in that control.

The Windows qualification script `qualify-private-index-refresh-20261127.ps1`, SHA-256 `269638d84252ff895cc5790687923a67f16ffa20ee0a650a502d15176935ad0c`, is prepared separately. It first compares the retained actual private index against every baseline mode/blob/path/stage entry while preserving both raw-index hashes, then performs the control/correction/content-refusal check in a new tiny repository. Its exact successful Windows result and independent acceptance are required before this installer can run. The author record leaves that future result pending.

The installer still requires the prepared tree to match the accepted baseline, the original app/index/status to remain exact before adoption, the private index hash to remain unchanged through validation, and the bytes actually read for publication to match that hash. Its original index-lock identity, replaced-index backup hash, published-index hash, source/pin/runtime/environment protections and normal user-fork pushes remain unchanged. No persistent Git configuration is changed.

## Exact new scripts

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `windows-install-tray-host-index-20261127.ps1` | 34,715 | `5a638cb4ebcfa4e0b37389148f0fd4c73bf64821b99b402dae201373cfdecbd5` |
| `windows-install-supervisor-index-20261127.ps1` | 23,767 | `ebb659ca3f2f53ca81b8eb2ae42ca3f5b57cccfbc4acaff3fdecdcfc2527286c` |

Stage both beside the existing accepted Job helper and preservation manifest in `F:\Dev\.bead-edit-20261111\final-installation-v9-20261125-1151`. The supervisor changes only the driver filename/hash and these new output paths:

```text
F:\Dev\.bead-edit-20261111\install-v9-index-20261127-2889282bfcec
F:\Dev\.bead-edit-20261111\install-v9-index-20261127-2889282bfcec.supervisor
```

Reverse the single new driver command and three wrapper substitutions to recover the entire accepted retry pair exactly. All eight wrapper functions, C# declarations and final cleanup are identical.

## Root invocation after qualification

Root first accepts the exact Windows qualification, obtains independent review of this source, stages and hashes both new scripts, and obtains their ordinary Windows PowerShell 5.1 parse. Refresh original-state preservation, new-pin/output absence, stopped-process/port observations and available memory before one new attempt. The wrapper retains all successful stage checks and final product/build hashes.

If the fresh observed ports remain 3000 and 43972, invoke in one fresh hidden Windows PowerShell process with the approved process-only execution policy:

```powershell
& 'F:\Dev\.bead-edit-20261111\final-installation-v9-20261125-1151\windows-install-supervisor-index-20261127.ps1' `
  -JobHelperPath 'C:\Users\YossiMH\AppData\Local\bead-edit-20261111\tray-host-execution-20261125\windows-task-job.ps1' `
  -StageResultSha256 '63b718e5a84b679496fbfea68320248181c230ece667b1043ea4f98c9c41b93c' `
  -StageSupervisorResultSha256 'c75506863b6aadd827f04584345865671d56a0a136b11dc95e3cc4def329827f' `
  -ScottyPorts @(3000,43972)
```

The existing limits remain 3 GiB baseline/immediate free memory, a live 1 GiB floor, 512 MiB aggregate resident memory, BelowNormal priority, 100 ms sampling, a 168-second work deadline and a 180-second hard deadline with a 12-second cleanup reserve. Every original final source/runtime/native/preservation identity is unchanged. The final app source remains `0309539797fd7d016e2b8fd8bdc0ae9cefc20219`, native source `2d801ba455b7a722daf644a7615445117d57e8e9`, native pin `0431a828bf95038641a0c55b4cf11c5800b52881940a13bd2f56b02f0b27177a`, and runtime BUILD_ID `YIOHeRJTEdlOszyc4LyHr`.

Require complete successful driver/supervisor results, exit 0, unchanged accepted input hashes, correct installed source/runtime/pin and user-fork refs, a stopped app, natural owned cleanup and no remaining Job member. Any failure retains this new attempt for reconciliation.

The configured-launch invocation must then bind this successful new attempt's exact driver/supervisor result hashes and these new helper identities. The old configured template remains retained and blocked against the failed prior attempt. Actual configured launch, installed review, handoff publication and checkpoint-history work remain subsequent tasks.

This packet is prepared outside product repositories, with no new linked worktree. Root owns publication, PC execution, task-state changes and final retention/cleanup.
