#requires -Version 5.1
# Wait briefly for foreground memory pressure to ease, then run one exact tray check.
# The waiting process stays hidden and BelowNormal; it never changes user processes.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$self = [Diagnostics.Process]::GetCurrentProcess()
$self.PriorityClass = 'BelowNormal'
$utf8 = [Text.UTF8Encoding]::new($false)
$gateRoot = 'F:\Dev\.bead-edit-20261111\tray-results-20261124\identity-wait-v1'
$evidence = 'F:\Dev\.bead-edit-20261111\tray-results-20261124\repaired-identity-v2'
$smoke = 'C:\Users\YossiMH\AppData\Local\bead-edit-20261111\tray-execution-20261125\windows-tray-smoke-identity-20261125.ps1'
$taskName = 'ChatGPT-BeadEditing-TrayIdentityWait-20261125-v1'
$started = [DateTime]::UtcNow
$deadline = $started.AddSeconds(600)
$launched = $false
if ([IO.Directory]::Exists($gateRoot)) { throw 'Existing gate output; reconcile before any new attempt.' }
[void][IO.Directory]::CreateDirectory($gateRoot)
function Save-GateResult([string]$status, [string]$detail) {
    $record = [ordered]@{
        status = $status; detail = $detail; app_launched = $launched
        started_utc = $started.ToString('o'); finished_utc = [DateTime]::UtcNow.ToString('o')
        evidence_directory = $evidence; minimum_launch_free_bytes = 3221225472
        wait_limit_seconds = 600; sample_interval_seconds = 15
        smoke_limit_seconds = 180; owned_resident_limit_mib = 512
    }
    [IO.File]::WriteAllText((Join-Path $gateRoot 'gate-result.json'), ($record | ConvertTo-Json -Compress), $utf8)
}
function Free-PhysicalBytes {
    $os = Get-CimInstance -ClassName Win32_OperatingSystem -OperationTimeoutSec 3
    return ([int64]$os.FreePhysicalMemory * 1024)
}
try {
    while ([DateTime]::UtcNow -lt $deadline) {
        $free = Free-PhysicalBytes
        $self.Refresh()
        $sample = [ordered]@{utc=[DateTime]::UtcNow.ToString('o');free_physical_bytes=$free;gate_resident_bytes=$self.WorkingSet64}
        [IO.File]::AppendAllText((Join-Path $gateRoot 'memory-samples.jsonl'), (($sample | ConvertTo-Json -Compress) + [Environment]::NewLine), $utf8)
        if ($self.WorkingSet64 -gt 134217728 -or $free -lt 536870912) {
            Save-GateResult 'deferred_memory' 'The waiting process stopped at its own memory/low-free-memory guard.'
            exit 0
        }
        if ($free -ge 3221225472) {
            if (Test-Path -LiteralPath $evidence) { throw 'Existing tray evidence; reconcile before launch.' }
            $hashes = @{
                $smoke = '64ed248e8de69ea53f18ee0a4643edc9bb9e7e1f1b18667104b14b6b698491c6'
                'C:\Users\YossiMH\AppData\Local\bead-edit-20261111\tray-execution-20261125\windows-task-job.ps1' = '2758a6ff94c0eecdfa360363469069dfa8470efc1f91228812146919a978921f'
                'F:\Dev\.bead-edit-20261111\stage-v6\scotty\bin\windows-tray.mjs' = 'a947ec77a5d742f3d735288483dcf0f54e5b057ec7d3b64370e656b878fea611'
                'F:\Dev\.bead-edit-20261111\stage-v6\backend\bead-editing-539cdd0.exe' = '25a05bdfd8feaea92faf6827e9268e597d25432826f1082c7ebadc3af8658798'
            }
            foreach ($file in $hashes.Keys) {
                if ((Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant() -ne $hashes[$file]) { throw 'Reviewed tray input hash differs.' }
            }
            if ($self.SessionId -ne 1) { throw 'Existing interactive session1 required.' }
            $explorers = @(Get-Process -Name explorer -ErrorAction Stop | Where-Object {$_.SessionId -eq 1})
            if ($explorers.Count -eq 0) { throw 'Existing Explorer session unavailable.' }
            foreach ($process in $explorers) { $process.Dispose() }
            $scheduler = New-Object -ComObject 'Schedule.Service'
            $scheduler.Connect()
            $other = @($scheduler.GetFolder('\').GetTasks(1) | Where-Object {
                $_.Name -like 'ChatGPT-BeadEditing-*' -and $_.Name -ne $taskName -and ($_.State -eq 4 -or $_.State -eq 2)
            })
            if ($other.Count -gt 0) { throw 'Another owned task is active or queued.' }
            $tcp = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,43971)
            try { $tcp.Start() } finally { $tcp.Stop() }
            $free = Free-PhysicalBytes
            if ($free -ge 3221225472 -and [DateTime]::UtcNow -lt $deadline) {
                $launch = [ordered]@{utc=[DateTime]::UtcNow.ToString('o');free_physical_bytes=$free;script_sha256=$hashes[$smoke]}
                [IO.File]::WriteAllText((Join-Path $gateRoot 'launch.json'), ($launch | ConvertTo-Json -Compress), $utf8)
                $launched = $true
                Save-GateResult 'launched' 'Exact reviewed smoke is running in this same PowerShell process.'
                $parameters = @{
                    RepositoryPath = 'F:\Dev\.bead-edit-20261111\stage-v6\scotty'
                    EvidenceDirectory = $evidence
                    BeadBin = 'F:\Dev\.bead-edit-20261111\stage-v6\backend\bead-editing-539cdd0.exe'
                    SourceRevision = '38c21a77b4e875d75e17ee68683846601df33591'
                    Port = 43971; TimeoutSeconds = 180; NodeHeapMiB = 256; MaxOwnedResidentMiB = 512
                }
                & $smoke @parameters | Out-Null
                $result = [IO.File]::ReadAllText((Join-Path $evidence 'result.json')) | ConvertFrom-Json
                if ($result.status -ne 'passed' -or $result.cleanup -ne 'all_owned_processes_exited') { throw 'Tray smoke did not pass; inspect its retained result.' }
                Save-GateResult 'passed' 'Tray smoke and owned-process cleanup passed.'
                exit 0
            }
        }
        $remaining = [Math]::Max(0, ($deadline - [DateTime]::UtcNow).TotalSeconds)
        if ($remaining -gt 0) { Start-Sleep -Milliseconds ([int][Math]::Min(15000, $remaining * 1000)) }
    }
    Save-GateResult 'deferred_memory' 'No qualifying memory window before the ten-minute deadline.'
    exit 0
} catch {
    Save-GateResult 'failed' $_.Exception.Message
    throw
} finally {
    $self.Dispose()
}
