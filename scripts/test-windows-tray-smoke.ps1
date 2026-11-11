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
$results = New-Object System.Collections.Generic.List[object]

function Wait-Condition([scriptblock]$Condition, [string]$Failure, [int]$Seconds = 45) {
    $deadline = [DateTime]::UtcNow.AddSeconds($Seconds)
    do {
        if (& $Condition) { return }
        Start-Sleep -Milliseconds 150
    } while ([DateTime]::UtcNow -lt $deadline)
    throw $Failure
}

function Read-Processes([string]$Directory) {
    $file = Join-Path $Directory 'processes.jsonl'
    if (-not (Test-Path -LiteralPath $file)) { return @() }
    return @(Get-Content -LiteralPath $file | ForEach-Object { $_ | ConvertFrom-Json })
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
    $start.EnvironmentVariables['SCOTTY_TRAY_SMOKE_DIR'] = $directory
    $start.EnvironmentVariables['SCOTTY_TRAY_SMOKE_ACTION'] = $Action
    $start.EnvironmentVariables['XDG_CONFIG_HOME'] = $directory
    if ($BeadBin) { $start.EnvironmentVariables['BEAD_BIN'] = $BeadBin }
    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $start
    if (-not $process.Start()) { throw 'Controller did not start' }
    $process.PriorityClass = [System.Diagnostics.ProcessPriorityClass]::BelowNormal
    $owned.Add($process)
    $stdout = $process.StandardOutput.ReadToEndAsync()
    $stderr = $process.StandardError.ReadToEndAsync()
    return @{ process = $process; directory = $directory; stdout = $stdout; stderr = $stderr }
}

try {
    if (-not (Test-PortFree)) { throw "Port $Port is already in use" }
    foreach ($action in @('exit', 'parent-loss')) {
        $run = Start-Controller $action
        Wait-Condition {
            if ($run.process.HasExited) { throw 'Controller exited before starting its children; inspect the retained logs' }
            $records = Read-Processes $run.directory
            @($records | Where-Object { $_.kind -eq 'tray' }).Count -eq 1 -and
                @($records | Where-Object { $_.kind -eq 'server' }).Count -eq 1
        } 'Expected one owned server and one tray helper'
        $records = Read-Processes $run.directory
        $trayRecord = $records | Where-Object { $_.kind -eq 'tray' }
        if (-not $trayRecord.windowsHide) { throw 'Tray helper could show a console window' }
        $trayProcess = [System.Diagnostics.Process]::GetProcessById($trayRecord.pid)
        $serverProcess = [System.Diagnostics.Process]::GetProcessById(($records | Where-Object { $_.kind -eq 'server' }).pid)
        $owned.Add($trayProcess)
        $owned.Add($serverProcess)
        Wait-Condition {
            try {
                (Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$Port" -TimeoutSec 2).StatusCode -eq 200
            } catch { $false }
        } 'Owned production server did not become ready'
        if ($action -eq 'exit') {
            [System.IO.File]::WriteAllText((Join-Path $run.directory 'click-exit'), '')
            Wait-Condition { $run.process.HasExited } 'Tray Exit did not stop its controller' 15
            if ($run.process.ExitCode -ne 0) { throw ('Tray Exit failed: ' + $run.stderr.Result) }
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
            if (-not $serverProcess.HasExited) { $serverProcess.Kill(); $serverProcess.WaitForExit() }
        }
        Wait-Condition { Test-PortFree } 'Owned server port stayed occupied after cleanup' 10
        $results.Add(@{ action = $action; controllerPid = $run.process.Id; trayPid = $trayProcess.Id; serverPid = $serverProcess.Id; port = $Port; result = 'pass' })
        $run.stdout.Result | Set-Content -LiteralPath (Join-Path $run.directory 'stdout.log')
        $run.stderr.Result | Set-Content -LiteralPath (Join-Path $run.directory 'stderr.log')
    }
    @{ result = 'pass'; evidenceDirectory = $scratch; cases = $results } | ConvertTo-Json -Depth 6
} finally {
    foreach ($process in $owned) {
        try { if (-not $process.HasExited) { $process.Kill(); $process.WaitForExit(5000) | Out-Null } }
        catch { Write-Warning ('Owned process cleanup failed: ' + $_.Exception.Message) }
        finally { $process.Dispose() }
    }
    # Keep the small receipts and logs for the execution owner to collect and
    # remove. The path is always printed, including on a failed run.
    [Console]::Error.WriteLine('Tray smoke evidence: ' + $scratch)
}
