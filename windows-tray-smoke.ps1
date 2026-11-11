#requires -Version 5.1
<#
Runs the repository's real Windows Forms Exit/parent-loss smoke, followed by
one supervised restart of the real Next server. Everything is sequential,
hidden and BelowNormal; the final state has no owned application processes.
The restart trigger is an external test preload, not the app's update command.
No browser, visible context menu, installation or build is started.

Example:
  powershell.exe -NoLogo -NoProfile -NonInteractive -WindowStyle Hidden -File
    .\windows-tray-smoke.ps1 -RepositoryPath F:\Dev\bead-me-up-scotty
    -EvidenceDirectory F:\Temp\scotty-tray-check-UNIQUE -Port 43971

Exit 0 means all cases and cleanup passed. Exit 1 includes a bounded failure
result. result.json and small logs remain in the new evidence directory.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$RepositoryPath,
    [Parameter(Mandatory = $true)][string]$EvidenceDirectory,
    [string]$NodePath = 'node.exe',
    [string]$BeadBin,
    [string]$SourceRevision,
    [ValidateRange(1024, 65535)][int]$Port = 43971,
    [ValidateRange(45, 240)][int]$TimeoutSeconds = 180,
    [ValidateRange(128, 384)][int]$NodeHeapMiB = 256,
    [ValidateRange(256, 768)][int]$MaxOwnedResidentMiB = 512
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$Utf8 = [Text.UTF8Encoding]::new($false)
$Started = [DateTime]::UtcNow
$Deadline = $Started.AddSeconds($TimeoutSeconds)
$Owned = [Collections.Generic.List[object]]::new()
$Runs = [Collections.Generic.List[object]]::new()
$Seen = [Collections.Generic.HashSet[string]]::new()
$ObservationErrors = [Collections.Generic.HashSet[string]]::new()
$CleanupErrors = [Collections.Generic.List[string]]::new()
$Cases = [Collections.Generic.List[object]]::new()
$Measurements = @{ peak_resident_bytes = 0L; max_live_servers = 0; heartbeat_utc = [DateTime]::MinValue }
$Self = [Diagnostics.Process]::GetCurrentProcess()
$OriginalPriority = $Self.PriorityClass
$SessionId = $Self.SessionId
$ArtifactRoot = $null
$ResultPath = $null
$DriverCopyDirectory = $null
$DriverCopyPath = $null
$JobHash = '2758a6ff94c0eecdfa360363469069dfa8470efc1f91228812146919a978921f'
$Result = [ordered]@{
    schema_version = 1; status = 'failed'; started_utc = $Started.ToString('o')
    repository = $RepositoryPath; source_revision_reported = $SourceRevision
    port = $Port; priority = 'BelowNormal'; timeout_seconds = $TimeoutSeconds
    node_heap_mib = $NodeHeapMiB; owned_resident_limit_mib = $MaxOwnedResidentMiB
    interactive_session_id = $SessionId; cases = $Cases; cleanup = 'pending'
    user_interactive = [Environment]::UserInteractive
    boundaries = @{
        forms = 'Real NotifyIcon, real ExitItem.PerformClick and normal helper disposal.'
        restart = 'An external preload exits the actual Next child with code 75 after HTTP readiness; no update/build command.'
        consoles = 'An external preload sets windowsHide on owned Node child launches.'
        registry = 'Each case uses its own XDG_CONFIG_HOME.'
    }
}

function Assert-That([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw $Message }
}

function Get-SafeLocalPath([string]$Value) {
    Assert-That ($Value -match '^[A-Za-z]:[\\/]') 'Use a full local Windows path.'
    $full = [IO.Path]::GetFullPath($Value).TrimEnd('\', '/')
    Assert-That ($full.Length -gt 3) 'A drive root cannot own smoke output.'
    $cursor = $full
    while ($cursor) {
        if ([IO.File]::Exists($cursor) -or [IO.Directory]::Exists($cursor)) {
            $item = Get-Item -LiteralPath $cursor -Force
            Assert-That (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0) ('Reparse point in smoke path: ' + $cursor)
        }
        $parent = [IO.Directory]::GetParent($cursor)
        $cursor = if ($parent) { $parent.FullName } else { $null }
    }
    return $full
}

function Get-TrayCacheEvidence([string]$Directory) {
    $records = @(Read-Records $Directory | Where-Object { $_.kind -eq 'tray' })
    Assert-That ($records.Count -eq 1) 'Expected exactly one production tray helper record.'
    $record = $records[0]
    $fileIndex = [Array]::IndexOf([object[]]$record.args, '-File')
    Assert-That ($fileIndex -ge 0 -and $fileIndex + 1 -lt $record.args.Count) 'The tray helper did not use ordinary -File execution.'
    $helper = Get-SafeLocalPath ([string]$record.helperScript)
    $executed = Get-SafeLocalPath ([string]$record.args[$fileIndex + 1])
    $localRoot = (Get-SafeLocalPath $env:LOCALAPPDATA) + '\'
    foreach ($scriptPath in @($helper, $executed)) {
        Assert-That ($scriptPath.StartsWith($localRoot, [StringComparison]::OrdinalIgnoreCase)) 'A helper or click fixture did not execute from local app data.'
        Assert-That ([IO.File]::Exists($scriptPath)) 'An owned cached script disappeared before its lifecycle check.'
    }
    $helperHash = (Get-FileHash -LiteralPath $helper -Algorithm SHA256).Hash.ToLowerInvariant()
    $fixtureHash = (Get-FileHash -LiteralPath $executed -Algorithm SHA256).Hash.ToLowerInvariant()
    Assert-That ($helperHash -eq $Result.source_sha256['bin\windows-tray.ps1'] -and $record.helperScriptSha256 -eq $helperHash) 'The actual production helper copy differs from the bundled helper.'
    Assert-That ($fixtureHash -eq $Result.source_sha256['scripts\fixtures\windows-tray-click.ps1']) 'The executed click wrapper differs from the repository fixture.'
    Assert-That (@($record.args | Where-Object { $_ -match 'Bypass|ExecutionPolicy|EncodedCommand' }).Count -eq 0) 'The helper must retain the host execution policy.'
    return @{ helper_script = $helper; helper_sha256 = $helperHash; executed_script = $executed; fixture_sha256 = $fixtureHash }
}

function ConvertTo-NativeArgument([string]$Value) {
    $builder = [Text.StringBuilder]::new()
    [void]$builder.Append('"')
    $slashes = 0
    foreach ($character in $Value.ToCharArray()) {
        if ($character -eq '\') { $slashes++; continue }
        [void]$builder.Append(('\' * $(if ($character -eq '"') { 2 * $slashes + 1 } else { $slashes })))
        [void]$builder.Append($character)
        $slashes = 0
    }
    [void]$builder.Append(('\' * (2 * $slashes)))
    [void]$builder.Append('"')
    return $builder.ToString()
}

function Add-OwnedProcess($Process, [string]$Kind, [string]$Directory) {
    # Register the actual handle before priority, streams or metadata can fail.
    $entry = @{
        process = $Process; kind = $Kind; directory = $Directory; process_id = $Process.Id
        started_utc = $null; birth_ms = $null; session_id = $null; priority = $null; exit_code = $null
    }
    $Owned.Add($entry)
    [void]$Process.Handle
    $entry.started_utc = $Process.StartTime.ToUniversalTime().ToString('o')
    $entry.birth_ms = ([DateTimeOffset]$Process.StartTime.ToUniversalTime()).ToUnixTimeMilliseconds()
    $entry.session_id = $Process.SessionId
    Assert-That ($entry.session_id -eq $SessionId) ('Owned ' + $Kind + ' is outside the interactive Explorer session.')
    if (-not $Process.HasExited) { $Process.PriorityClass = [Diagnostics.ProcessPriorityClass]::BelowNormal }
    $entry.priority = 'BelowNormal'
    return $entry
}

function Observe-Record($Record, [string]$Directory) {
    $key = [string]$Record.pid + ':' + [string]$Record.startedAfter
    if ($Seen.Contains($key)) { return }
    if (@($Owned | Where-Object {
        $_.process_id -eq $Record.pid -and $null -ne $_.birth_ms -and
        $_.birth_ms -ge ($Record.startedAfter - 50) -and $_.birth_ms -le ($Record.recordedAt + 50)
    }).Count -gt 0) {
        [void]$Seen.Add($key); return
    }
    $process = Get-Process -Id $Record.pid -ErrorAction SilentlyContinue
    if ($null -eq $process) { return }
    try {
        [void]$process.Handle
        $birth = ([DateTimeOffset]$process.StartTime.ToUniversalTime()).ToUnixTimeMilliseconds()
        Assert-That ($birth -ge ($Record.startedAfter - 50) -and $birth -le ($Record.recordedAt + 50)) 'Recorded PID no longer has the expected process birth time.'
        $expected = [IO.Path]::GetFileNameWithoutExtension([string]$Record.command)
        Assert-That ($process.ProcessName -ieq $expected) 'Recorded PID has an unexpected executable name.'
        if ($Record.kind -eq 'controller') {
            $parents = @($Owned | Where-Object { $_.kind -eq 'smoke-runner' } | ForEach-Object { $_.process_id }) + @($Self.Id)
            Assert-That ($parents -contains [int]$Record.parentPid) 'Controller record has an unknown owner.'
            $identity = Get-CimInstance -ClassName Win32_Process -Filter ('ProcessId = ' + $Record.pid) -OperationTimeoutSec 2
            Assert-That ($null -ne $identity -and $identity.ParentProcessId -eq $Record.parentPid) 'Controller parent identity no longer matches.'
            Assert-That (([string]$identity.CommandLine).IndexOf($ServeEntry, [StringComparison]::OrdinalIgnoreCase) -ge 0) 'Controller command no longer identifies the owned serve entrypoint.'
        }
        $entry = Add-OwnedProcess $process ([string]$Record.kind) $Directory
        $process = $null
        [void]$Seen.Add($key)
    } finally {
        if ($null -ne $process -and @($Owned | Where-Object { $_.process -eq $process }).Count -eq 0) { $process.Dispose() }
    }
}

function Read-Records([string]$Directory) {
    $file = Join-Path $Directory 'processes.jsonl'
    if (-not [IO.File]::Exists($file)) { return @() }
    $lines = [IO.File]::ReadAllText($file, $Utf8).Split([char]10)
    for ($i = 0; $i -lt $lines.Length - 1; $i++) {
        if (-not $lines[$i].Trim()) { continue }
        try {
            $record = $lines[$i] | ConvertFrom-Json
            Assert-That ($record.kind -in @('tray', 'server') -and $record.pid -gt 0) 'Invalid owned child record.'
            $record
        } catch { [void]$ObservationErrors.Add('Invalid complete ownership record: ' + $file + ':' + ($i + 1)) }
    }
}

function Observe-Processes {
    if ($null -eq $ArtifactRoot) { return }
    foreach ($file in [IO.Directory]::GetFiles($ArtifactRoot, 'controller.json', [IO.SearchOption]::AllDirectories)) {
        try { Observe-Record ([IO.File]::ReadAllText($file, $Utf8) | ConvertFrom-Json) ([IO.Path]::GetDirectoryName($file)) }
        catch { [void]$ObservationErrors.Add($_.Exception.Message + ' (' + $file + ')') }
    }
    foreach ($file in [IO.Directory]::GetFiles($ArtifactRoot, 'processes.jsonl', [IO.SearchOption]::AllDirectories)) {
        $directory = [IO.Path]::GetDirectoryName($file)
        foreach ($record in @(Read-Records $directory)) {
            try { Observe-Record $record $directory }
            catch { [void]$ObservationErrors.Add($_.Exception.Message + ' (' + $file + ')') }
        }
    }
}

function Discover-OwnedChildren($Owner) {
    # Failure-only fallback for a driver killed between OS spawn and its first
    # ownership-file write. Query only direct children of the verified handle.
    if ($null -eq $Owner.birth_ms) { throw 'Cannot verify child births for a partially registered owner.' }
    $lastBirth = if ($Owner.process.HasExited) { ([DateTimeOffset]$Owner.process.ExitTime.ToUniversalTime()).ToUnixTimeMilliseconds() }
        else { ([DateTimeOffset][DateTime]::UtcNow).ToUnixTimeMilliseconds() }
    foreach ($identity in @(Get-CimInstance -ClassName Win32_Process -Filter ('ParentProcessId = ' + $Owner.process_id) -OperationTimeoutSec 2)) {
      try {
        if ($null -eq $identity.CreationDate) { throw 'A child lacks its process creation time.' }
        $birth = ([DateTimeOffset]$identity.CreationDate.ToUniversalTime()).ToUnixTimeMilliseconds()
        if ($birth -lt $Owner.birth_ms -or $birth -gt $lastBirth) { continue }
        $command = [string]$identity.ExecutablePath
        $line = [string]$identity.CommandLine
        $kind = if ($command -ieq $NodePath -and $line.IndexOf($ServeEntry, [StringComparison]::OrdinalIgnoreCase) -ge 0) { 'controller' }
            elseif ($Owner.kind -eq 'controller' -and $command -ieq $NodePath -and $line -match '\bstart\b') { 'server' }
            elseif ($Owner.kind -eq 'controller' -and $command -ieq $PowerShellPath -and $line -match 'windows-tray(?:-click)?\.ps1') { 'tray' }
            else { throw ('Unrecognized direct child of owned process ' + $Owner.process_id + '; preserved for inspection.') }
        $record = [pscustomobject]@{ kind = $kind; pid = $identity.ProcessId; parentPid = $Owner.process_id
            command = $command; startedAfter = $birth; recordedAt = $birth }
        Observe-Record $record $Owner.directory
      } catch { $CleanupErrors.Add($_.Exception.Message) }
    }
}

function Check-Budget {
    if (([DateTime]::UtcNow - $Measurements.heartbeat_utc).TotalSeconds -ge 1) {
        [IO.File]::WriteAllText($HeartbeatFile, 'owned', $Utf8)
        $Measurements.heartbeat_utc = [DateTime]::UtcNow
    }
    Observe-Processes
    Assert-That ($ObservationErrors.Count -eq 0) 'Owned process identity or record verification failed.'
    Assert-That ($Owned.Count -le 16) 'The smoke spawned more processes than its bounded cases require.'
    $resident = 0L
    $servers = 0
    foreach ($entry in $Owned) {
        if (-not $entry.process.HasExited) {
            $entry.process.Refresh()
            $resident += $entry.process.WorkingSet64
            if ($entry.kind -eq 'server') { $servers++ }
        }
    }
    $Self.Refresh()
    $resident += $Self.WorkingSet64
    $Measurements.peak_resident_bytes = [Math]::Max($Measurements.peak_resident_bytes, $resident)
    $Measurements.max_live_servers = [Math]::Max($Measurements.max_live_servers, $servers)
    Assert-That ($servers -le 1) 'More than one owned server is live.'
    Assert-That ($resident -le $MaxOwnedResidentMiB * 1MB) 'Owned smoke processes exceeded the resident-memory budget.'
    Assert-That ([DateTime]::UtcNow -lt $Deadline) 'The total tray smoke time budget expired.'
}

function Wait-Until([scriptblock]$Condition, [string]$Failure, [int]$Seconds = 45) {
    $caseDeadline = [DateTime]::UtcNow.AddSeconds($Seconds)
    do {
        Check-Budget
        if (& $Condition) { return }
        Start-Sleep -Milliseconds 150
    } while ([DateTime]::UtcNow -lt $caseDeadline)
    throw $Failure
}

function Test-PortFree {
    $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $Port)
    try { $listener.Start(); return $true } catch { return $false } finally { $listener.Stop() }
}

function Assert-OwnedListener([int]$ProcessId) {
    $listeners = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
    Assert-That ($listeners.Count -gt 0) 'The expected listening port is absent.'
    Assert-That (@($listeners | Where-Object { $_.OwningProcess -ne $ProcessId }).Count -eq 0) 'The listening port is not owned by the recorded server.'
}

function Start-Headless([string]$Command, [string[]]$NativeArguments, [string]$Kind, [string]$Directory, [hashtable]$Environment) {
    [void][IO.Directory]::CreateDirectory($Directory)
    $start = [Diagnostics.ProcessStartInfo]::new()
    $start.FileName = $Command
    $start.Arguments = (($NativeArguments | ForEach-Object { ConvertTo-NativeArgument $_ }) -join ' ')
    $start.WorkingDirectory = $RepositoryPath
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    $start.EnvironmentVariables['NODE_OPTIONS'] = '--max-old-space-size=' + $NodeHeapMiB + ' --import=' + $ControllerObserverUri
    $start.EnvironmentVariables['SCOTTY_SMOKE_SERVE_ENTRY'] = $ServeEntry
    $start.EnvironmentVariables['SCOTTY_SMOKE_HEARTBEAT'] = $HeartbeatFile
    $start.EnvironmentVariables['BMUS_TRAY'] = '1'
    $start.EnvironmentVariables['BMUS_SERVE_CMD'] = ''
    $start.EnvironmentVariables['PORT'] = [string]$Port
    $start.EnvironmentVariables['HOST'] = '127.0.0.1'
    $start.EnvironmentVariables['XDG_CONFIG_HOME'] = $Directory
    $start.EnvironmentVariables['TEMP'] = $TempDirectory
    $start.EnvironmentVariables['TMP'] = $TempDirectory
    if ($BeadBin) { $start.EnvironmentVariables['BEAD_BIN'] = $BeadBin }
    foreach ($name in $Environment.Keys) { $start.EnvironmentVariables[$name] = [string]$Environment[$name] }
    $process = [Diagnostics.Process]::new()
    $process.StartInfo = $start
    Assert-That ($process.Start()) 'An owned smoke process did not start.'
    $entry = Add-OwnedProcess $process $Kind $Directory
    $run = @{ entry = $entry; process = $process; directory = $Directory; stdout = $null; stderr = $null }
    $Runs.Add($run)
    $run.stdout = $process.StandardOutput.ReadToEndAsync()
    $run.stderr = $process.StandardError.ReadToEndAsync()
    return $run
}

function Read-Stream($Task) {
    Assert-That ($null -ne $Task -and $Task.Wait(2000)) 'An owned output stream did not close.'
    return [string]$Task.Result
}

function Save-RunLogs($Run) {
    foreach ($name in @('stdout', 'stderr')) {
        $text = Read-Stream $Run[$name]
        if ($text.Length -gt 32768) { $text = $text.Substring(0, 32768) + [Environment]::NewLine + '[truncated]' }
        [IO.File]::WriteAllText((Join-Path $Run.directory ($name + '.log')), $text, $Utf8)
    }
}

function Get-ChildEntry([string]$Directory, [string]$Kind, [int]$Index = 0) {
    $records = @(Read-Records $Directory | Where-Object { $_.kind -eq $Kind })
    if ($records.Count -le $Index) { return $null }
    $record = $records[$Index]
    $matches = @($Owned | Where-Object {
        $_.process_id -eq $record.pid -and $null -ne $_.birth_ms -and
        $_.birth_ms -ge ($record.startedAfter - 50) -and $_.birth_ms -le ($record.recordedAt + 50)
    })
    if ($matches.Count -eq 1) { return $matches[0] }
    return $null
}

try {
    $Self.PriorityClass = [Diagnostics.ProcessPriorityClass]::BelowNormal
    $RepositoryPath = (Resolve-Path -LiteralPath $RepositoryPath).Path
    $NodePath = (Get-Command $NodePath -ErrorAction Stop).Source
    $PowerShellPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
    $ServeEntry = Join-Path $RepositoryPath 'scripts\serve.mjs'
    $ExistingSmoke = Join-Path $RepositoryPath 'scripts\test-windows-tray-smoke.ps1'
    $ExistingObserver = Join-Path $RepositoryPath 'scripts\fixtures\windows-tray-observer.mjs'
    $files = @('bin\server-controller.mjs', 'bin\windows-tray.mjs', 'bin\windows-tray.ps1',
        'scripts\serve.mjs', 'scripts\test-windows-tray-smoke.ps1',
        'scripts\fixtures\windows-tray-observer.mjs', 'scripts\fixtures\windows-tray-click.ps1',
        '.next\BUILD_ID', 'node_modules\next\package.json')
    foreach ($file in $files) { Assert-That ([IO.File]::Exists((Join-Path $RepositoryPath $file))) ('Missing required runtime file: ' + $file) }
    $explorers = @(Get-Process -Name explorer -ErrorAction SilentlyContinue | Where-Object { $_.SessionId -eq $SessionId })
    Assert-That ([Environment]::UserInteractive -and $SessionId -gt 0 -and $explorers.Count -gt 0) 'Run in the existing interactive Explorer session; no session switch will be attempted.'
    $Result['explorer_process_ids'] = @($explorers | ForEach-Object { $_.Id })
    foreach ($explorer in $explorers) { $explorer.Dispose() }
    $Result['next_version'] = ([IO.File]::ReadAllText((Join-Path $RepositoryPath 'node_modules\next\package.json')) | ConvertFrom-Json).version
    $Result['build_id'] = [IO.File]::ReadAllText((Join-Path $RepositoryPath '.next\BUILD_ID')).Trim()
    $Result['source_sha256'] = @{}
    foreach ($file in $files[0..6]) { $Result.source_sha256[$file] = (Get-FileHash -LiteralPath (Join-Path $RepositoryPath $file) -Algorithm SHA256).Hash.ToLowerInvariant() }
    Assert-That (Test-PortFree) 'The selected loopback port is already occupied; no existing listener will be touched.'
    $EvidenceDirectory = Get-SafeLocalPath $EvidenceDirectory
    Assert-That (-not (Test-Path -LiteralPath $EvidenceDirectory)) 'EvidenceDirectory must be a new task-owned path.'
    [void][IO.Directory]::CreateDirectory($EvidenceDirectory)
    $ArtifactRoot = $EvidenceDirectory
    $ResultPath = Join-Path $ArtifactRoot 'result.json'
    $Result['evidence_directory'] = $ArtifactRoot
    # This invocation is a dedicated process. Its Job reclaims descendants if
    # the outer process is interrupted before its normal ownership cleanup.
    $jobHelper = Join-Path $PSScriptRoot 'windows-task-job.ps1'
    Assert-That ((Get-FileHash -LiteralPath $jobHelper -Algorithm SHA256).Hash.ToLowerInvariant() -eq $JobHash) 'The sibling process-containment helper differs from the reviewed bytes.'
    . $jobHelper
    Enter-ScottyTaskJob
    $Result['job_helper_sha256'] = $JobHash
    # Keep the reviewed driver unchanged while using the host's local-zone
    # execution location. Its repository argument still selects the real app.
    $driverRoot = Get-SafeLocalPath (Join-Path (Get-SafeLocalPath $env:LOCALAPPDATA) 'bead-edit-20261111')
    [void][IO.Directory]::CreateDirectory($driverRoot)
    $driverDirectory = Join-Path $driverRoot ('tray-driver-' + [Guid]::NewGuid().ToString('N'))
    Assert-That (-not (Test-Path -LiteralPath $driverDirectory)) 'The proposed driver copy directory already exists.'
    [void][IO.Directory]::CreateDirectory($driverDirectory)
    $DriverCopyDirectory = $driverDirectory
    $DriverCopyPath = Join-Path $DriverCopyDirectory 'test-windows-tray-smoke.ps1'
    [IO.File]::Copy($ExistingSmoke, $DriverCopyPath, $false)
    $driverHash = (Get-FileHash -LiteralPath $DriverCopyPath -Algorithm SHA256).Hash.ToLowerInvariant()
    Assert-That ($driverHash -eq $Result.source_sha256['scripts\test-windows-tray-smoke.ps1']) 'The local execution copy differs from the repository smoke driver.'
    $Result['driver_copy'] = @{ source = $ExistingSmoke; executed = $DriverCopyPath; sha256 = $driverHash; removed = $false }
    $TempDirectory = Join-Path $ArtifactRoot 'temp'
    [void][IO.Directory]::CreateDirectory($TempDirectory)
    $HeartbeatFile = Join-Path $ArtifactRoot 'owner-heartbeat'
    [IO.File]::WriteAllText($HeartbeatFile, 'owned', $Utf8)
    $ControllerObserver = Join-Path $ArtifactRoot 'controller-observer.mjs'
    [IO.File]::WriteAllText($ControllerObserver, @'
import fs from 'node:fs';
import path from 'node:path';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
// Contain console windows at the external smoke boundary, including Next.
const spawn = childProcess.spawn;
childProcess.spawn = (command, args, options = {}) => spawn(command, args, { ...options, windowsHide: true });
syncBuiltinESMExports();
// If the outer invocation dies, its owned Node processes request shutdown
// after 15 seconds without a heartbeat; the helper sees parent/pipe loss.
const lease = setInterval(() => {
  let age = Infinity;
  try { age = Date.now() - fs.statSync(process.env.SCOTTY_SMOKE_HEARTBEAT).mtimeMs; } catch {}
  if (age < 15000) return;
  clearInterval(lease);
  if (process.listenerCount('SIGTERM')) process.emit('SIGTERM');
  else process.exit(1);
}, 1000);
lease.unref();
const entry = process.env.SCOTTY_SMOKE_SERVE_ENTRY;
const root = process.env.SCOTTY_TRAY_SMOKE_DIR;
if (root && entry && process.argv[1] && path.resolve(process.argv[1]).toLowerCase() === path.resolve(entry).toLowerCase()) {
  const recordedAt = Date.now();
  const record = { kind: 'controller', pid: process.pid, parentPid: process.ppid,
    command: process.execPath, startedAfter: recordedAt - process.uptime() * 1000 - 250, recordedAt };
  const temporary = path.join(root, 'controller.json.tmp');
  fs.writeFileSync(temporary, JSON.stringify(record));
  fs.renameSync(temporary, path.join(root, 'controller.json'));
}
'@, $Utf8)
    $ControllerObserverUri = ([Uri]$ControllerObserver).AbsoluteUri

    # Reuse the already-reviewed real Forms smoke without copying its assertions.
    $arguments = @('-NoLogo', '-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden',
        '-File', $DriverCopyPath, '-RepositoryPath', $RepositoryPath, '-NodePath', $NodePath, '-Port', [string]$Port)
    if ($BeadBin) { $arguments += @('-BeadBin', $BeadBin) }
    $runner = Start-Headless $PowerShellPath $arguments 'smoke-runner' (Join-Path $ArtifactRoot 'existing-smoke') @{}
    Wait-Until { $runner.process.HasExited } 'The existing real Forms smoke did not finish.' $TimeoutSeconds
    Observe-Processes
    Save-RunLogs $runner
    Assert-That ($runner.process.ExitCode -eq 0) 'The repository real Forms smoke failed; inspect its retained logs.'
    $existing = (Read-Stream $runner.stdout) | ConvertFrom-Json
    Assert-That ($existing.result -eq 'pass' -and @($existing.cases).Count -eq 2) 'The repository smoke did not report both cases.'
    foreach ($case in $existing.cases) {
        $caseDirectory = Join-Path ([string]$existing.evidenceDirectory) ([string]$case.action)
        foreach ($childId in @($case.controllerPid, $case.trayPid, $case.serverPid)) {
            $matches = @($Owned | Where-Object { $_.process_id -eq $childId -and $_.directory -eq $caseDirectory })
            Assert-That ($matches.Count -eq 1 -and $matches[0].session_id -eq $SessionId -and $matches[0].process.HasExited) 'A smoke process lacks verified session/exit evidence.'
        }
        $Cases.Add($case)
    }
    Assert-That (Test-PortFree) 'The first smoke left its port occupied.'

    # Trigger code75 inside the actual Next child after HTTP readiness. The
    # normal controller, helper, click fixture and replacement child still run.
    $restartDirectory = Join-Path $ArtifactRoot 'restart'
    [void][IO.Directory]::CreateDirectory($restartDirectory)
    $RestartWatcher = Join-Path $ArtifactRoot 'restart-watcher.mjs'
    [IO.File]::WriteAllText($RestartWatcher, @'
import fs from 'node:fs';
import path from 'node:path';
const root = process.env.SCOTTY_TRAY_SMOKE_DIR;
const trigger = path.join(root, 'request-restart');
const timer = setInterval(() => {
  if (!fs.existsSync(trigger)) return;
  fs.unlinkSync(trigger);
  fs.writeFileSync(path.join(root, 'restart-receipt.json'), JSON.stringify({ pid: process.pid, exitCode: 75 }));
  process.exit(75);
}, 150);
timer.unref();
'@, $Utf8)
    $RestartObserver = Join-Path $ArtifactRoot 'restart-observer.mjs'
    [IO.File]::WriteAllText($RestartObserver, @'
import childProcess from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { syncBuiltinESMExports } from 'node:module';
const originalSpawn = childProcess.spawn;
childProcess.spawn = (command, args = [], options = {}) => {
  const server = command.toLowerCase() === process.execPath.toLowerCase() && args[1] === 'start';
  const actual = server ? ['--import', pathToFileURL(process.env.SCOTTY_SMOKE_RESTART_WATCHER).href, ...args] : args;
  return originalSpawn(command, actual, options);
};
syncBuiltinESMExports();
await import(pathToFileURL(process.env.SCOTTY_SMOKE_EXISTING_OBSERVER).href);
'@, $Utf8)
    $restart = Start-Headless $NodePath @('--import', $RestartObserver, $ServeEntry) 'controller' $restartDirectory @{
        SCOTTY_TRAY_SMOKE_DIR = $restartDirectory; SCOTTY_TRAY_SMOKE_ACTION = 'exit'
        SCOTTY_SMOKE_RESTART_WATCHER = $RestartWatcher; SCOTTY_SMOKE_EXISTING_OBSERVER = $ExistingObserver
    }
    Wait-Until {
        if ($restart.process.HasExited) { throw 'The restart controller exited during startup.' }
        $null -ne (Get-ChildEntry $restartDirectory 'tray') -and $null -ne (Get-ChildEntry $restartDirectory 'server')
    } 'The restart case did not start one helper and server.'
    $tray = Get-ChildEntry $restartDirectory 'tray'
    $first = Get-ChildEntry $restartDirectory 'server'
    $restartCache = Get-TrayCacheEvidence $restartDirectory
    Wait-Until {
        try { (Invoke-WebRequest -UseBasicParsing -Uri ("http://127.0.0.1:" + $Port) -TimeoutSec 2).StatusCode -eq 200 }
        catch { $false }
    } 'The first real server did not become ready.'
    Assert-OwnedListener $first.process_id
    [IO.File]::WriteAllText((Join-Path $restartDirectory 'request-restart'), '', $Utf8)
    Wait-Until {
        if ($restart.process.HasExited) { throw 'The controller exited instead of restarting.' }
        $first.process.HasExited -and $null -ne (Get-ChildEntry $restartDirectory 'server' 1)
    } 'Code75 did not replace the real server.'
    $second = Get-ChildEntry $restartDirectory 'server' 1
    $receipt = [IO.File]::ReadAllText((Join-Path $restartDirectory 'restart-receipt.json')) | ConvertFrom-Json
    Assert-That ($first.process.ExitCode -eq 75 -and $receipt.pid -eq $first.process_id) 'The first server did not exit with the requested code75.'
    Assert-That (-not $tray.process.HasExited) 'The tray helper was lost during restart.'
    Assert-That (@(Read-Records $restartDirectory | Where-Object { $_.kind -eq 'tray' }).Count -eq 1) 'Restart created another tray helper.'
    Assert-That (@(Read-Records $restartDirectory | Where-Object { $_.kind -eq 'server' }).Count -eq 2) 'Restart created an unexpected server count.'
    Wait-Until {
        try { (Invoke-WebRequest -UseBasicParsing -Uri ("http://127.0.0.1:" + $Port) -TimeoutSec 2).StatusCode -eq 200 }
        catch { $false }
    } 'The replacement real server did not become ready.'
    Assert-OwnedListener $second.process_id
    [IO.File]::WriteAllText((Join-Path $restartDirectory 'click-exit'), '', $Utf8)
    Wait-Until { $restart.process.HasExited } 'Exit after restart did not stop the controller.' 15
    Assert-That ($restart.process.ExitCode -eq 0 -and $second.process.HasExited -and $tray.process.HasExited) 'Exit after restart left an owned child alive or failed.'
    $icon = [IO.File]::ReadAllText((Join-Path $restartDirectory 'icon-receipt.json')) | ConvertFrom-Json
    Assert-That ($icon.iconVisible -and $icon.clicked -and $icon.disposed -and $icon.menuText -eq 'Exit') 'The real icon/menu lifecycle failed after restart.'
    Assert-That (Test-PortFree) 'Exit after restart left the owned port occupied.'
    Wait-Until {
        -not [IO.Directory]::Exists([IO.Path]::GetDirectoryName($restartCache.helper_script)) -and
            -not [IO.Directory]::Exists([IO.Path]::GetDirectoryName($restartCache.executed_script))
    } 'Exit after restart left an owned helper or click-fixture cache.' 10
    $restartCache['removed'] = $true
    $Cases.Add(@{ action = 'restart75-exit'; result = 'pass'; controllerPid = $restart.process.Id
        trayPid = $tray.process_id; serverPids = @($first.process_id, $second.process_id)
        firstExitCode = 75; helperCount = 1; icon = $icon; port = $Port; cache = $restartCache })
    Save-RunLogs $restart
    $Result.status = 'passed'
} catch {
    $message = $_.Exception.Message
    $Result['error'] = $message.Substring(0, [Math]::Min(2048, $message.Length))
} finally {
    # Stop the test driver before reconciling its final ownership records so it
    # cannot launch the next case during cleanup. Never kill by name or port.
    foreach ($entry in @($Owned | Where-Object { $_.kind -eq 'smoke-runner' })) {
        try {
            if (-not $entry.process.HasExited) { $entry.process.Kill(); [void]$entry.process.WaitForExit(3000) }
        } catch { $CleanupErrors.Add($_.Exception.Message) }
    }
    try { Observe-Processes } catch { $CleanupErrors.Add($_.Exception.Message) }
    if ($Result.status -ne 'passed') {
        foreach ($owner in @($Owned | Where-Object { $_.kind -eq 'smoke-runner' })) {
            try { Discover-OwnedChildren $owner } catch { $CleanupErrors.Add($_.Exception.Message) }
        }
    }
    foreach ($entry in @($Owned | Where-Object { $_.kind -eq 'controller' })) {
        try {
            if (-not $entry.process.HasExited) {
                $entry.process.Kill()
                Assert-That ($entry.process.WaitForExit(3000)) 'An owned controller survived cleanup.'
            }
        } catch { $CleanupErrors.Add($_.Exception.Message) }
    }
    # A controller may have recorded its last child just before termination.
    try { Observe-Processes } catch { $CleanupErrors.Add($_.Exception.Message) }
    if ($Result.status -ne 'passed') {
        foreach ($owner in @($Owned | Where-Object { $_.kind -eq 'controller' })) {
            try { Discover-OwnedChildren $owner } catch { $CleanupErrors.Add($_.Exception.Message) }
        }
    }
    foreach ($kind in @('controller', 'server', 'tray', 'smoke-runner')) {
        foreach ($entry in @($Owned | Where-Object { $_.kind -eq $kind })) {
            try {
                if (-not $entry.process.HasExited) {
                    $entry.process.Kill()
                    Assert-That ($entry.process.WaitForExit(3000)) 'An owned process survived cleanup.'
                }
                $entry.exit_code = $entry.process.ExitCode
            } catch { $CleanupErrors.Add($_.Exception.Message) }
        }
    }
    foreach ($run in $Runs) {
        try { Save-RunLogs $run } catch { $CleanupErrors.Add($_.Exception.Message) }
    }
    if ($DriverCopyDirectory) {
        try {
            if ($DriverCopyPath -and [IO.File]::Exists($DriverCopyPath)) { [IO.File]::Delete($DriverCopyPath) }
            if ([IO.Directory]::Exists($DriverCopyDirectory)) { [IO.Directory]::Delete($DriverCopyDirectory, $false) }
            if ($Result.Contains('driver_copy')) { $Result.driver_copy.removed = $true }
        } catch { $CleanupErrors.Add('Owned local driver cleanup: ' + $_.Exception.Message) }
    }
    try { if ($ArtifactRoot) {
        foreach ($file in [IO.Directory]::GetFiles($ArtifactRoot, 'processes.jsonl', [IO.SearchOption]::AllDirectories)) {
            $text = [IO.File]::ReadAllText($file, $Utf8)
            if ($text.Length -gt 0 -and -not $text.EndsWith([string][char]10)) { $CleanupErrors.Add('Incomplete ownership record after process exit: ' + $file) }
        }
        if (-not (Test-PortFree)) { $CleanupErrors.Add('The selected port is occupied after owned process cleanup; no unrelated listener was touched.') }
    } } catch { $CleanupErrors.Add($_.Exception.Message) }
    $Result['processes'] = @($Owned | ForEach-Object {
        @{ kind = $_.kind; process_id = $_.process_id; started_utc = $_.started_utc
           session_id = $_.session_id; priority = $_.priority; exit_code = $_.exit_code }
    })
    $Result['measurements'] = $Measurements
    foreach ($message in $ObservationErrors) { $CleanupErrors.Add($message) }
    $Result['cleanup_errors'] = @($CleanupErrors | Select-Object -First 12)
    if ($CleanupErrors.Count -gt 0) { $Result.status = 'failed'; $Result.cleanup = 'failed' }
    else { $Result.cleanup = 'all_owned_processes_exited' }
    foreach ($entry in $Owned) { $entry.process.Dispose() }
    try { $Self.PriorityClass = $OriginalPriority } catch { }
    $Self.Dispose()
    $Result['completed_utc'] = [DateTime]::UtcNow.ToString('o')
    $Result['elapsed_seconds'] = [Math]::Round(([DateTime]::UtcNow - $Started).TotalSeconds, 3)
    $json = ConvertTo-Json -InputObject $Result -Depth 12
    if ($ResultPath) {
        try { [IO.File]::WriteAllText($ResultPath, $json, $Utf8) }
        catch {
            $Result.status = 'failed'
            $Result['evidence_write_error'] = $_.Exception.Message
            $json = ConvertTo-Json -InputObject $Result -Depth 12
        }
    }
    Write-Output $json
}
if ($Result.status -ne 'passed') { exit 1 }
