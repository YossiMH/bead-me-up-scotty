param(
    [Parameter(Mandatory=$true)][string]$OutputDirectory,
    [Parameter(Mandatory=$true)][ValidateSet('Marker','ParentLoss')][string]$Mode,
    [Parameter(Mandatory=$true)][int]$ParentProcessId
)
$ErrorActionPreference = 'Stop'
$utf8 = [Text.UTF8Encoding]::new($false)
$parent = $null
$completed = $false
$parentLost = $false
$exitCode = 1
try {
    [IO.File]::WriteAllText((Join-Path $OutputDirectory 'entry.json'),
        (@{ pid=$PID; parentProcessId=$ParentProcessId; powershell=$PSVersionTable.PSVersion.ToString(); mode=$Mode; utc=[DateTime]::UtcNow.ToString('o') } | ConvertTo-Json -Compress), $utf8)
    if ($Mode -eq 'ParentLoss') { $parent = [Diagnostics.Process]::GetProcessById($ParentProcessId); [void]$parent.Handle }
    [Console]::Out.WriteLine('READY')
    [Console]::Out.Flush()
    if ($Mode -eq 'Marker') {
        $completed = $true
        $exitCode = 7
    } else {
        $deadline = [DateTime]::UtcNow.AddSeconds(8)
        while (-not $parent.HasExited -and [DateTime]::UtcNow -lt $deadline) { Start-Sleep -Milliseconds 50 }
        $parentLost = $parent.HasExited
        if (-not $parentLost) { throw 'Original controller did not exit within eight seconds' }
        $completed = $true
        $exitCode = 0
        [Console]::Out.WriteLine('COMPLETE')
        [Console]::Out.Flush()
    }
} catch {
    [Console]::Error.WriteLine($_.Exception.Message)
} finally {
    if ($null -ne $parent) { $parent.Dispose() }
    [IO.File]::WriteAllText((Join-Path $OutputDirectory 'finally.json'),
        (@{ pid=$PID; completed=$completed; parentLost=$parentLost; exitCode=$exitCode; utc=[DateTime]::UtcNow.ToString('o') } | ConvertTo-Json -Compress), $utf8)
}
exit $exitCode
