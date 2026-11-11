#requires -Version 5.1
<#
Runs a verified bead executable against two new, disposable native workspaces.
The caller supplies task-owned local directories. Existing stores are refused.
Each native child is hidden, BelowNormal, sequential, and limited to 20 seconds.
Successful fixture directories are reclaimed; failed fixtures and logs remain.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$BeadExe,
    [Parameter(Mandatory = $true)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$ExpectedSha256,
    [Parameter(Mandatory = $true)][string]$ScratchRoot,
    [Parameter(Mandatory = $true)][string]$OutputDirectory
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$Utf8 = [System.Text.UTF8Encoding]::new($false)
$RunId = [Guid]::NewGuid().ToString('N')
$RunName = 'windows-native-smoke-' + $RunId
$OwnedDirectory = $null
$ResultPath = $null
$LogDirectory = $null
$Commands = [System.Collections.Generic.List[object]]::new()
$Checks = [System.Collections.Generic.List[string]]::new()
$Result = [ordered]@{
    run_id = $RunId; started_utc = [DateTime]::UtcNow.ToString('o')
    status = 'failed'; executable = $BeadExe; expected_sha256 = $ExpectedSha256.ToLowerInvariant()
    priority = 'BelowNormal'; commands = $Commands; checks = $Checks
    fixture_directory = $null; cleanup = 'not_created'
}

# Require full local paths; reject junctions before creating or removing fixtures.
function Get-SafeLocalPath([string]$Value) {
    if ($Value -notmatch '^[A-Za-z]:[\\/]') { throw "A full local Windows path is required: $Value" }
    $full = [IO.Path]::GetFullPath($Value).TrimEnd('\', '/')
    if ($full.Length -le 3) { throw 'A drive root cannot own smoke-test output.' }
    $cursor = $full
    while ($cursor) {
        if ([IO.File]::Exists($cursor) -or [IO.Directory]::Exists($cursor)) {
            $item = Get-Item -LiteralPath $cursor -Force
            if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
                throw "Reparse points are not accepted in smoke-test paths: $cursor"
            }
        }
        $parent = [IO.Directory]::GetParent($cursor)
        $cursor = if ($parent) { $parent.FullName } else { $null }
    }
    return $full
}

function Assert-That([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw $Message }
}

# Quote argv for the Windows native runtime without a shell or PowerShell expansion.
function ConvertTo-NativeArgument([string]$Value) {
    $builder = [Text.StringBuilder]::new()
    [void]$builder.Append('"')
    $slashes = 0
    foreach ($character in $Value.ToCharArray()) {
        if ($character -eq '\') { $slashes++; continue }
        if ($character -eq '"') {
            [void]$builder.Append(('\' * (2 * $slashes + 1)))
        } else {
            [void]$builder.Append(('\' * $slashes))
        }
        [void]$builder.Append($character)
        $slashes = 0
    }
    [void]$builder.Append(('\' * (2 * $slashes)))
    [void]$builder.Append('"')
    return $builder.ToString()
}

function Get-LogExcerpt([string]$Text) {
    if ($Text.Length -le 8192) { return $Text }
    return $Text.Substring(0, 8192) + "`n[Output truncated after 8192 characters]"
}

# Own one child, drain both streams concurrently, and preserve every command result.
function Invoke-Bead {
    param([string]$Workspace, [string]$Name, [string[]]$NativeArguments,
          [int]$ExpectedExit = 0, [switch]$Publish)
    $arguments = @()
    if (-not $Publish) { $arguments += '--no-auto-flush' }
    $arguments += $NativeArguments
    $start = [Diagnostics.ProcessStartInfo]::new()
    $start.FileName = $script:BeadExe
    $start.WorkingDirectory = $Workspace
    $start.Arguments = (($arguments | ForEach-Object { ConvertTo-NativeArgument $_ }) -join ' ')
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    $start.StandardOutputEncoding = $script:Utf8
    $start.StandardErrorEncoding = $script:Utf8
    $start.EnvironmentVariables['BEAD_WORKSPACE_ROOT'] = $Workspace
    $start.EnvironmentVariables['BEAD_ACTOR'] = 'scotty-windows-smoke'
    $start.EnvironmentVariables['BEAD_ORG_SECRET_SCANNER'] = 'off'
    $start.EnvironmentVariables['RAYON_NUM_THREADS'] = '1'
    $start.EnvironmentVariables.Remove('NEEDLE_BEAD_ID')
    $start.EnvironmentVariables.Remove('NEEDLE_BEAD_FENCING_TOKEN')
    $child = [Diagnostics.Process]::new()
    $child.StartInfo = $start
    $clock = [Diagnostics.Stopwatch]::StartNew()
    $timedOut = $false
    $started = $false
    try {
        $started = $child.Start()
        Assert-That $started "Could not start $Name."
        try { $child.PriorityClass = [Diagnostics.ProcessPriorityClass]::BelowNormal }
        catch { if (-not $child.HasExited) { throw } }
        $stdoutTask = $child.StandardOutput.ReadToEndAsync()
        $stderrTask = $child.StandardError.ReadToEndAsync()
        if (-not $child.WaitForExit(20000)) {
            $timedOut = $true
            $child.Kill()
            if (-not $child.WaitForExit(5000)) { throw "Owned child did not exit after timeout: $Name" }
        }
        $stdout = $stdoutTask.GetAwaiter().GetResult()
        $stderr = $stderrTask.GetAwaiter().GetResult()
        $clock.Stop()
        $number = $script:Commands.Count + 1
        $filename = '{0:D2}-{1}.log' -f $number, $Name
        $log = "Command: $Name`nArguments: $($arguments -join ' ')`nExit: $($child.ExitCode)`nElapsed ms: $($clock.ElapsedMilliseconds)`nTimed out: $timedOut`nSTDOUT:`n$(Get-LogExcerpt $stdout)`nSTDERR:`n$(Get-LogExcerpt $stderr)`n"
        [IO.File]::WriteAllText((Join-Path $script:LogDirectory $filename), $log, $script:Utf8)
        $script:Commands.Add([pscustomobject]@{ name = $Name; exit_code = $child.ExitCode
            milliseconds = $clock.ElapsedMilliseconds; timed_out = $timedOut; log = $filename })
        Assert-That (-not $timedOut) "$Name timed out; its write outcome is unknown. Keep the fixture for inspection."
        Assert-That ($child.ExitCode -eq $ExpectedExit) "$Name exited $($child.ExitCode), expected $ExpectedExit. See $filename."
        return [pscustomobject]@{ Stdout = $stdout; Stderr = $stderr; ExitCode = $child.ExitCode }
    } finally {
        if ($started -and -not $child.HasExited) { $child.Kill(); [void]$child.WaitForExit(5000) }
        $child.Dispose()
    }
}

function Read-BeadJson([string]$Workspace, [string]$Name, [string[]]$NativeArguments) {
    $reply = Invoke-Bead -Workspace $Workspace -Name $Name -NativeArguments $NativeArguments
    return ConvertFrom-Json -InputObject $reply.Stdout
}

function Read-Issue([string]$Workspace, [string]$Name, [string]$IssueId) {
    return Read-BeadJson $Workspace $Name @('show', $IssueId, '--comments', 'all', '--json')
}

# The compact show document omits type and closure metadata; use the public query.
function Read-Metadata([string]$Workspace, [string]$Name, [string]$IssueId) {
    $query = '{"version":"v1","predicates":[],"sort":[],"projection":{"fields":["id","issue_type","closed_at","close_reason"]}}'
    $rows = @(Read-BeadJson $Workspace $Name @('query', '--json', $query, '--output-json'))
    $matching = @($rows | Where-Object { $_.Id -ceq $IssueId })
    Assert-That ($matching.Count -eq 1) 'The metadata query must identify exactly one issue.'
    return $matching[0]
}

function ConvertTo-CompactJson($Value) { return ConvertTo-Json -InputObject $Value -Depth 40 -Compress }

try {
    [Diagnostics.Process]::GetCurrentProcess().PriorityClass = [Diagnostics.ProcessPriorityClass]::BelowNormal
    $BeadExe = Get-SafeLocalPath $BeadExe
    $ScratchRoot = Get-SafeLocalPath $ScratchRoot
    $OutputDirectory = Get-SafeLocalPath $OutputDirectory
    [void][IO.Directory]::CreateDirectory($OutputDirectory)
    $ResultPath = Join-Path $OutputDirectory ($RunName + '.json')
    Assert-That (-not (Test-Path -LiteralPath $ResultPath)) 'The result file already exists.'
    Assert-That ([IO.File]::Exists($BeadExe)) 'The selected executable does not exist.'
    $actualHash = (Get-FileHash -LiteralPath $BeadExe -Algorithm SHA256).Hash.ToLowerInvariant()
    Assert-That ($actualHash -ceq $ExpectedSha256.ToLowerInvariant()) 'The executable SHA-256 does not match the receipt.'
    $Result.executable = $BeadExe
    $Result['actual_sha256'] = $actualHash

    # Refuse ancestor stores even though every child receives an explicit workspace.
    $ancestor = $ScratchRoot
    while ($ancestor) {
        Assert-That (-not (Test-Path -LiteralPath (Join-Path $ancestor '.beads'))) "An existing store is above the scratch root: $ancestor"
        $parent = [IO.Directory]::GetParent($ancestor)
        $ancestor = if ($parent) { $parent.FullName } else { $null }
    }
    [void][IO.Directory]::CreateDirectory($ScratchRoot)
    $OwnedDirectory = Join-Path $ScratchRoot $RunName
    Assert-That (-not (Test-Path -LiteralPath $OwnedDirectory)) 'The run directory already exists.'
    [void][IO.Directory]::CreateDirectory($OwnedDirectory)
    [IO.File]::WriteAllText((Join-Path $OwnedDirectory 'owner.txt'), $RunId, $Utf8)
    $LogDirectory = Join-Path $OutputDirectory ($RunName + '-logs')
    Assert-That (-not (Test-Path -LiteralPath $LogDirectory)) 'The log directory already exists.'
    [void][IO.Directory]::CreateDirectory($LogDirectory)
    $Result.fixture_directory = $OwnedDirectory
    $Result.cleanup = 'retained'
    $workspace = Join-Path $OwnedDirectory 'workspace'
    $restored = Join-Path $OwnedDirectory 'restored'
    [void][IO.Directory]::CreateDirectory($workspace)
    [void][IO.Directory]::CreateDirectory($restored)

    $Result['version'] = (Invoke-Bead $workspace 'version' @('--version')).Stdout.Trim()
    $capabilities = Read-BeadJson $workspace 'capabilities' @('capabilities')
    Assert-That ($capabilities.implementation -ceq 'bead-rs' -and $capabilities.contract -ceq 'native-v1') 'Unsupported native contract.'
    Assert-That ($capabilities.priority_change -eq $true) 'Priority change capability is absent.'
    Assert-That ($capabilities.issue_editing.version -eq 1 -and $capabilities.issue_editing.revision_guard -eq $true -and $capabilities.issue_editing.clear_description -eq $true -and $capabilities.issue_editing.priority_reason_required -eq $true) 'Editing capability contract differs.'
    foreach ($field in @('title', 'description', 'priority', 'issue_type', 'notes', 'status', 'assignee')) {
        Assert-That ($capabilities.issue_editing.fields -ccontains $field) "Missing editable field: $field"
    }
    $Result['capabilities'] = $capabilities
    [void](Invoke-Bead $workspace 'init' @('init', '--prefix', 'wsmoke'))
    $issueId = (Invoke-Bead $workspace 'create-issue' @('create', '--title=Original smoke issue')).Stdout.Trim()
    $blockerId = (Invoke-Bead $workspace 'create-blocker' @('create', '--title=Smoke blocker')).Stdout.Trim()
    Assert-That ($issueId -match '^wsmoke-[a-f0-9]+$' -and $blockerId -match '^wsmoke-[a-f0-9]+$') 'Creation returned an unexpected identity.'
    [void](Invoke-Bead $workspace 'label-add' @('label', 'add', $issueId, '--label=smoke-label'))
    $labelled = Read-Issue $workspace 'label-added-read' $issueId
    Assert-That ($labelled.labels -ccontains 'smoke-label') 'Label add did not persist.'
    [void](Invoke-Bead $workspace 'label-remove' @('label', 'remove', $issueId, '--label=smoke-label'))
    $unlabelled = Read-Issue $workspace 'label-removed-read' $issueId
    Assert-That (-not ($unlabelled.labels -ccontains 'smoke-label')) 'Label remove did not persist.'
    [void](Invoke-Bead $workspace 'label-retain' @('label', 'add', $issueId, '--label=keep-label'))
    foreach ($kind in @('blocks', 'relates_to', 'verifies')) {
        [void](Invoke-Bead $workspace ("dep-add-$kind") @('dep', 'add', $issueId, $blockerId, "--kind=$kind"))
        $outgoing = Read-Issue $workspace ("dep-read-$kind") $issueId
        $reverse = Read-Issue $workspace ("dep-direction-$kind") $blockerId
        Assert-That (@($outgoing.dependencies | Where-Object { $_.blocker -ceq $blockerId -and $_.kind -ceq $kind }).Count -eq 1) "Missing exact dependency: $kind"
        Assert-That (@($reverse.dependencies | Where-Object { $_.blocker -ceq $issueId }).Count -eq 0) 'Dependency direction was reversed.'
        [void](Invoke-Bead $workspace ("dep-remove-$kind") @('dep', 'remove', $issueId, $blockerId, "--kind=$kind"))
        $removed = Read-Issue $workspace ("dep-removed-$kind") $issueId
        Assert-That (@($removed.dependencies).Count -eq 0) "Dependency removal left an edge: $kind"
    }
    [void](Invoke-Bead $workspace 'dep-retain' @('dep', 'add', $issueId, $blockerId, '--kind=blocks'))
    $Checks.Add('Label add/remove and all three dependency kinds preserve direction.')

    $before = Read-Issue $workspace 'before-edit' $issueId
    $unicode = ([string][char]0x65e5) + ([string][char]0x672c) + ([string][char]0x8a9e)
    $title = 'Edited "quoted" title ' + $unicode
    $description = "First line`nSecond line $unicode`n"
    $notes = "Notes $unicode`nAnother line"
    [void](Invoke-Bead $workspace 'compound-edit' @('update', $issueId, "--title=$title", "--description=$description", '--priority=0', '--reason=Windows smoke priority edit', '--issue-type=review_check', "--notes=$notes", "--if-revision=$($before.revision)"))
    $edited = Read-Issue $workspace 'compound-read' $issueId
    $metadata = Read-Metadata $workspace 'compound-metadata' $issueId
    Assert-That ($edited.title -ceq $title -and $edited.description -ceq $description -and $edited.notes -ceq $notes -and $edited.priority -eq 0 -and $metadata.IssueType -ceq 'review_check') 'Compound scalar readback differs.'
    Assert-That ($edited.id -ceq $before.id -and $edited.created_at -ceq $before.created_at -and $edited.revision -eq ([long]$before.revision + 1)) 'Compound editing changed identity or incremented revision incorrectly.'
    Assert-That ((ConvertTo-CompactJson $edited.labels) -ceq (ConvertTo-CompactJson $before.labels)) 'Editing changed labels.'
    Assert-That ((ConvertTo-CompactJson $edited.dependencies) -ceq (ConvertTo-CompactJson $before.dependencies)) 'Editing changed dependencies.'
    $audit = @(Read-BeadJson $workspace 'priority-audit' @('history', $issueId, '--json'))
    $priorityEvents = @($audit | Where-Object { $_.kind -ceq 'priority_changed' })
    Assert-That ($priorityEvents.Count -eq 1 -and $priorityEvents[0].actor -ceq 'scotty-windows-smoke') 'Priority audit event or actor is missing.'
    $Checks.Add('One guarded compound edit preserves identity, related records and priority audit.')

    $descriptionFile = Join-Path $OwnedDirectory 'description.txt'
    $notesFile = Join-Path $OwnedDirectory 'notes.txt'
    $fileDescription = ("File description $unicode`n" * 2000)
    $fileNotes = ("File notes $unicode`n" * 2000)
    [IO.File]::WriteAllText($descriptionFile, $fileDescription, $Utf8)
    [IO.File]::WriteAllText($notesFile, $fileNotes, $Utf8)
    [void](Invoke-Bead $workspace 'file-edit' @('update', $issueId, "--description-file=$descriptionFile", "--notes-file=$notesFile"))
    $fileRead = Read-Issue $workspace 'file-read' $issueId
    Assert-That ($fileRead.description -ceq $fileDescription -and $fileRead.notes -ceq $fileNotes) 'UTF-8 file transport changed text.'
    [void](Invoke-Bead $workspace 'empty-clear' @('update', $issueId, '--description=', '--notes='))
    $cleared = Read-Issue $workspace 'empty-clear-read' $issueId
    Assert-That ($cleared.description -ceq '' -and $cleared.notes -ceq '') 'Empty strings did not clear both text fields.'
    [void](Invoke-Bead $workspace 'description-restore' @('update', $issueId, '--description=Temporary'))
    [void](Invoke-Bead $workspace 'explicit-clear' @('update', $issueId, '--clear-description'))
    $clearedAgain = Read-Issue $workspace 'explicit-clear-read' $issueId
    Assert-That ($clearedAgain.description -ceq '') 'Explicit clear did not remove description.'
    $Checks.Add('Long UTF-8 file edits, empty-string clears and explicit description clear round-trip.')

    [void](Invoke-Bead $workspace 'sync-mode' @('sync', 'configure', '--mode', 'monolithic'))
    [void](Invoke-Bead $workspace 'initial-checkpoint' @('sync', 'flush-only'))
    $pointer = Join-Path $workspace '.beads\checkpoint\current.json'
    Assert-That ([IO.File]::Exists($pointer)) 'Checkpoint pointer was not published.'
    $pointerBefore = (Get-FileHash -LiteralPath $pointer -Algorithm SHA256).Hash
    $staleBefore = Read-Issue $workspace 'stale-before' $issueId
    $historyBefore = @(Read-BeadJson $workspace 'stale-history-before' @('history', $issueId, '--json'))
    [void](Invoke-Bead -Workspace $workspace -Name 'stale-edit' -NativeArguments @('update', $issueId, '--title=Must not save', '--description=Must not save', '--priority=4', '--reason=Stale smoke request', '--issue-type=must_not_save', '--notes=Must not save', "--if-revision=$($before.revision)") -ExpectedExit 4 -Publish)
    $staleAfter = Read-Issue $workspace 'stale-after' $issueId
    $staleMetadata = Read-Metadata $workspace 'stale-metadata' $issueId
    $historyAfter = @(Read-BeadJson $workspace 'stale-history-after' @('history', $issueId, '--json'))
    Assert-That ((ConvertTo-CompactJson $staleBefore) -ceq (ConvertTo-CompactJson $staleAfter) -and $staleMetadata.IssueType -ceq 'review_check') 'A stale request partially changed the issue.'
    Assert-That ((ConvertTo-CompactJson $historyBefore) -ceq (ConvertTo-CompactJson $historyAfter)) 'A stale request appended an audit event.'
    Assert-That ((Get-FileHash -LiteralPath $pointer -Algorithm SHA256).Hash -ceq $pointerBefore) 'A stale request published a checkpoint.'
    $Checks.Add('Stale revision refuses the complete edit, audit and publication.')

    [void](Invoke-Bead -Workspace $workspace -Name 'published-edit' -NativeArguments @('update', $issueId, '--title=Published Windows edit', "--description-file=$descriptionFile", "--notes-file=$notesFile", "--if-revision=$($staleAfter.revision)") -Publish)
    Assert-That ((Get-FileHash -LiteralPath $pointer -Algorithm SHA256).Hash -cne $pointerBefore) 'A successful edit did not publish a new checkpoint.'
    $published = Read-Issue $workspace 'published-read' $issueId
    $publishedMetadata = Read-Metadata $workspace 'published-metadata' $issueId
    Assert-That ($published.title -ceq 'Published Windows edit' -and $published.description -ceq $fileDescription -and $published.notes -ceq $fileNotes) 'Published fields differ.'
    Assert-That (-not (Test-Path -LiteralPath (Join-Path $restored '.beads'))) 'Restore target already contains a store.'
    [void](Invoke-Bead $restored 'restore-init' @('init', '--prefix', 'wsmoke'))
    $emptyTarget = @(Read-BeadJson $restored 'restore-empty' @('query', '--json', '{"version":"v1","predicates":[],"sort":[],"projection":{"fields":["id"]}}', '--output-json'))
    Assert-That ($emptyTarget.Count -eq 0) 'The newly initialized restore target is not empty.'
    [void](Invoke-Bead $restored 'checkpoint-restore' @('sync', 'import-only', '--input', (Join-Path $workspace '.beads\checkpoint'), '--restore-into-empty', '--actor=scotty-windows-restore'))
    $restoredIssue = Read-Issue $restored 'restored-read' $issueId
    $restoredMetadata = Read-Metadata $restored 'restored-metadata' $issueId
    Assert-That ((ConvertTo-CompactJson $published) -ceq (ConvertTo-CompactJson $restoredIssue)) 'Checkpoint restore changed native issue fields or related records.'
    Assert-That ((ConvertTo-CompactJson $publishedMetadata) -ceq (ConvertTo-CompactJson $restoredMetadata)) 'Checkpoint restore changed custom type or closure metadata.'
    $restoredAudit = @(Read-BeadJson $restored 'restored-audit' @('history', $issueId, '--json'))
    Assert-That (@($restoredAudit | Where-Object { $_.kind -ceq 'priority_changed' -and $_.actor -ceq 'scotty-windows-smoke' }).Count -eq 1) 'Priority audit did not survive restore.'
    $Checks.Add('Automatic checkpoint publication restores fields, graph, labels and priority history.')
    Assert-That ((Get-FileHash -LiteralPath $BeadExe -Algorithm SHA256).Hash.ToLowerInvariant() -ceq $actualHash) 'The selected executable changed during the smoke check.'
    $Result['issue_id'] = $issueId
    $Result['restored_revision'] = $restoredIssue.revision
    $Result['file_utf8_bytes'] = @{ description = $Utf8.GetByteCount($fileDescription); notes = $Utf8.GetByteCount($fileNotes) }

    # Delete only the exact new run directory after checking its owner and every path.
    $resolvedOwned = Get-SafeLocalPath $OwnedDirectory
    Assert-That ($resolvedOwned -ceq $OwnedDirectory -and [IO.Directory]::GetParent($resolvedOwned).FullName -ceq $ScratchRoot) 'Fixture cleanup ownership path differs.'
    Assert-That ([IO.File]::ReadAllText((Join-Path $resolvedOwned 'owner.txt'), $Utf8) -ceq $RunId) 'Fixture owner marker differs.'
    foreach ($entry in Get-ChildItem -LiteralPath $resolvedOwned -Force -Recurse) {
        Assert-That (($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0) 'Fixture contains a reparse point; retain it for inspection.'
    }
    [IO.Directory]::Delete($resolvedOwned, $true)
    $Result.cleanup = 'removed_owned_fixtures'
    $Result.status = 'passed'
} catch {
    $Result['error'] = $_.Exception.Message
} finally {
    $Result['completed_utc'] = [DateTime]::UtcNow.ToString('o')
    if ($ResultPath) {
        [IO.File]::WriteAllText($ResultPath, (ConvertTo-Json -InputObject $Result -Depth 40), $Utf8)
        Write-Output $ResultPath
    } else {
        Write-Output (ConvertTo-Json -InputObject $Result -Depth 40 -Compress)
    }
}
if ($Result.status -ne 'passed') { exit 1 }
