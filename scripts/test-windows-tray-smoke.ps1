param(
    [Parameter(Mandatory = $true)][string]$RepositoryPath,
    [string]$NodePath = 'node.exe',
    [ValidateRange(1024, 65535)][int]$Port = 43971,
    [string]$BeadBin
)
$ErrorActionPreference = 'Stop'
$RepositoryPath = (Resolve-Path -LiteralPath $RepositoryPath).Path
$NodePath = (Get-Command $NodePath -ErrorAction Stop).Source
$scratch = Join-Path ([System.IO.Path]::GetTempPath()) ('scotty-tray-smoke-' + [Guid]::NewGuid().ToString('N'))
[System.IO.Directory]::CreateDirectory($scratch) | Out-Null
$owned = New-Object System.Collections.Generic.List[System.Diagnostics.Process]
$runs = New-Object System.Collections.Generic.List[object]
$ownershipErrors = New-Object System.Collections.Generic.HashSet[string]
$results = New-Object System.Collections.Generic.List[object]

function Wait-Condition([scriptblock]$Condition, [string]$Failure, [int]$Seconds = 45) {
    $deadline = [DateTime]::UtcNow.AddSeconds($Seconds)
    do {
        if (& $Condition) { return }
        Start-Sleep -Milliseconds 150
    } while ([DateTime]::UtcNow -lt $deadline)
    throw $Failure
}

function Read-Processes([string]$Directory, [switch]$Complete) {
    $file = Join-Path $Directory 'processes.jsonl'
    if (-not (Test-Path -LiteralPath $file)) { return @() }
    $text = [System.IO.File]::ReadAllText($file)
    $lines = $text -split "`n"
    $records = New-Object System.Collections.Generic.List[object]
    for ($line = 0; $line -lt $lines.Length - 1; $line++) {
        try {
            $record = $lines[$line] | ConvertFrom-Json -ErrorAction Stop
            if ($null -eq $record -or $record.pid -lt 1 -or $record.kind -notin @('tray', 'server')) {
                throw 'Missing process identity'
            }
            $records.Add($record)
        } catch {
            [void]$ownershipErrors.Add('Invalid ownership record in ' + $file + ' at line ' + ($line + 1))
        }
    }
    # Only a live writer's unterminated final line may be incomplete. Collect
    # valid records even on corruption so cleanup can reclaim every known PID.
    if ($Complete -and $text.Length -gt 0 -and -not $text.EndsWith("`n")) {
        [void]$ownershipErrors.Add('Unfinished ownership record after controller exit: ' + $file)
    }
    return $records.ToArray()
}

function Register-OwnedChildren($Run) {
    foreach ($record in (Read-Processes $Run.directory -Complete:($Run.process.HasExited))) {
        $key = [string]$record.pid
        if ($Run.children.ContainsKey($key)) { continue }
        $child = Get-Process -Id $record.pid -ErrorAction SilentlyContinue
        if ($null -eq $child) { continue }
        try {
            $start = ([DateTimeOffset]$child.StartTime.ToUniversalTime()).ToUnixTimeMilliseconds()
            if ($start -lt ($record.startedAfter - 50) -or $start -gt ($record.recordedAt + 50)) {
                $child.Dispose() # A reused PID no longer identifies this test's child.
                continue
            }
            $Run.children[$key] = $child
            $owned.Add($child)
        } catch {
            $Run.registrationErrors.Add('Could not verify recorded child ' + $key + ': ' + $_.Exception.Message)
            $child.Dispose()
        }
    }
}

function Test-PortFree {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
    try { $listener.Start(); return $true } catch { return $false } finally { $listener.Stop() }
}

function Start-Controller([string]$Action) {
    $directory = Join-Path $scratch $Action
    [System.IO.Directory]::CreateDirectory($directory) | Out-Null
    $observer = Join-Path $RepositoryPath 'scripts\fixtures\windows-tray-observer.mjs'
    $entry = Join-Path $RepositoryPath 'scripts\serve.mjs'
    if ($observer.Contains('"') -or $entry.Contains('"')) { throw 'Unsupported quote in smoke path' }
    $start = New-Object System.Diagnostics.ProcessStartInfo
    $start.FileName = $NodePath
    $start.Arguments = '--import "' + $observer + '" "' + $entry + '"'
    $start.WorkingDirectory = $RepositoryPath
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    $start.EnvironmentVariables['PORT'] = [string]$Port
    $start.EnvironmentVariables['HOST'] = '127.0.0.1'
    $start.EnvironmentVariables['BMUS_TRAY'] = '1'
    $start.EnvironmentVariables['BMUS_SERVE_CMD'] = ''
    $start.EnvironmentVariables['SCOTTY_TRAY_SMOKE_DIR'] = $directory
    $start.EnvironmentVariables['SCOTTY_TRAY_SMOKE_ACTION'] = $Action
    $start.EnvironmentVariables['XDG_CONFIG_HOME'] = $directory
    if ($BeadBin) { $start.EnvironmentVariables['BEAD_BIN'] = $BeadBin }
    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $start
    if (-not $process.Start()) { throw 'Controller did not start' }
    $owned.Add($process)
    $run = @{ process = $process; directory = $directory; stdout = $null; stderr = $null; children = @{}; registrationErrors = (New-Object System.Collections.Generic.List[string]) }
    $runs.Add($run)
    $run.stdout = $process.StandardOutput.ReadToEndAsync()
    $run.stderr = $process.StandardError.ReadToEndAsync()
    $process.PriorityClass = [System.Diagnostics.ProcessPriorityClass]::BelowNormal
    return $run
}

try {
    if (-not (Test-PortFree)) { throw "Port $Port is already in use" }
    foreach ($action in @('exit', 'parent-loss')) {
        $run = Start-Controller $action
        Wait-Condition {
            Register-OwnedChildren $run
            if ($run.process.HasExited) { throw 'Controller exited before starting its children; inspect the retained logs' }
            $records = Read-Processes $run.directory
            @($records | Where-Object { $_.kind -eq 'tray' }).Count -eq 1 -and
                @($records | Where-Object { $_.kind -eq 'server' }).Count -eq 1
        } 'Expected one owned server and one tray helper'
        $records = Read-Processes $run.directory
        Register-OwnedChildren $run
        $trayRecord = $records | Where-Object { $_.kind -eq 'tray' }
        if (-not $trayRecord.windowsHide) { throw 'Tray helper could show a console window' }
        $trayProcess = $run.children[[string]$trayRecord.pid]
        $serverRecord = $records | Where-Object { $_.kind -eq 'server' }
        $serverProcess = $run.children[[string]$serverRecord.pid]
        if ($null -eq $trayProcess -or $null -eq $serverProcess) { throw 'An owned child exited during startup' }
        Wait-Condition {
            try {
                (Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$Port" -TimeoutSec 2).StatusCode -eq 200
            } catch { $false }
        } 'Owned production server did not become ready'
        if ($action -eq 'exit') {
            [System.IO.File]::WriteAllText((Join-Path $run.directory 'click-exit'), '')
            Wait-Condition { $run.process.HasExited } 'Tray Exit did not stop its controller' 15
            if ($run.process.ExitCode -ne 0) { throw 'Tray Exit failed; inspect the retained logs' }
            if (-not $serverProcess.HasExited -or -not $trayProcess.HasExited) {
                throw 'Controller exited before its owned server and tray helper'
            }
            $receipt = Get-Content -Raw -LiteralPath (Join-Path $run.directory 'icon-receipt.json') | ConvertFrom-Json
            if (-not $receipt.iconVisible -or -not $receipt.clicked -or -not $receipt.disposed -or $receipt.menuText -ne 'Exit') {
                throw 'The real NotifyIcon and Exit menu handler did not complete their lifecycle'
            }
        } else {
            # Abruptly kill this controller handle only. The unmodified helper
            # must observe parent loss without a foreground window or UI click.
            $run.process.Kill()
            Wait-Condition { $trayProcess.HasExited } 'Tray helper survived parent loss' 15
            if (-not $serverProcess.HasExited) {
                $serverProcess.Kill()
                if (-not $serverProcess.WaitForExit(5000)) { throw 'Owned server did not exit after cleanup' }
            }
        }
        Wait-Condition { Test-PortFree } 'Owned server port stayed occupied after cleanup' 10
        $results.Add(@{ action = $action; controllerPid = $run.process.Id; trayPid = $trayProcess.Id; serverPid = $serverProcess.Id; port = $Port; result = 'pass' })
    }
    @{ result = 'pass'; evidenceDirectory = $scratch; cases = $results } | ConvertTo-Json -Depth 6
} finally {
    $cleanupErrors = New-Object System.Collections.Generic.List[string]
    # Stop the controllers first so a failing startup cannot create more
    # children while cleanup reconciles the recorded process ownership.
    foreach ($run in $runs) {
        try {
            if (-not $run.process.HasExited) { $run.process.Kill(); $run.process.WaitForExit(5000) | Out-Null }
            Register-OwnedChildren $run
        } catch { $cleanupErrors.Add($_.Exception.Message) }
    }
    foreach ($process in $owned) {
        try {
            if (-not $process.HasExited) {
                $process.Kill()
                if (-not $process.WaitForExit(5000)) { throw 'Owned process did not terminate after cleanup' }
            }
        }
        catch { $cleanupErrors.Add($_.Exception.Message) }
        finally { $process.Dispose() }
    }
    foreach ($run in $runs) {
        $cleanupErrors.AddRange($run.registrationErrors)
        foreach ($stream in @('stdout', 'stderr')) {
            $task = $run[$stream]
            try {
                $text = if ($null -eq $task) { 'Output stream was not opened before startup failure' }
                    elseif ($task.Wait(1000)) { $task.Result } else { 'Output stream did not close during cleanup' }
                $text | Set-Content -LiteralPath (Join-Path $run.directory ($stream + '.log'))
            } catch { $cleanupErrors.Add($_.Exception.Message) }
        }
    }
    # Keep the small receipts and logs for the execution owner to collect and
    # remove. The path is always printed, including on a failed run.
    [Console]::Error.WriteLine('Tray smoke evidence: ' + $scratch)
    foreach ($message in $ownershipErrors) { $cleanupErrors.Add($message) }
    if ($cleanupErrors.Count -gt 0) { throw ('Tray smoke cleanup: ' + ($cleanupErrors -join '; ')) }
}
