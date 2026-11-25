#requires -Version 5.1
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][ValidateSet('build','check')][string]$Phase,
    [Parameter(Mandatory=$true)][string]$PacketDirectory,
    [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$PacketSha256,
    [Parameter(Mandatory=$true)][string]$JobHelper,
    [string]$Checkout,
    [string]$ArtifactDirectory,
    [string]$SmokeHelper,
    [ValidateSet('core','editing','grid-1','grid-2','grid-3')][string]$Partition
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false
$Utf8 = [Text.UTF8Encoding]::new($false)
function Hash-File([string]$Path) { return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant() }
function Safe-Path([string]$Value) {
    if ($Value -notmatch '^[A-Za-z]:[\\/]') { throw 'A full local path is required.' }
    $path = [IO.Path]::GetFullPath($Value).TrimEnd('\','/')
    $cursor = $path
    while ($cursor) {
        $entry = Get-Item -LiteralPath $cursor -Force
        if (($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Reparse point refused.' }
        $parent = [IO.Directory]::GetParent($cursor)
        $cursor = if ($parent) { $parent.FullName } else { $null }
    }
    return $path
}
function New-Json([string]$Path,$Value) {
    $bytes = $Utf8.GetBytes((ConvertTo-Json -InputObject $Value -Depth 40) + [string][char]10)
    $stream = [IO.File]::Open($Path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
    try { $stream.Write($bytes,0,$bytes.Length); $stream.Flush($true) } finally { $stream.Dispose() }
}
$PacketDirectory = Safe-Path $PacketDirectory
$manifestPath = Join-Path $PacketDirectory 'packet.json'
if ((Hash-File $manifestPath) -cne $PacketSha256) { throw 'Packet identity differs.' }
$manifest = ConvertFrom-Json -InputObject ([IO.File]::ReadAllText($manifestPath,$Utf8))
if ($manifest.schema_version -ne 1) { throw 'Unexpected packet schema.' }
foreach ($file in $manifest.files.PSObject.Properties) {
    if ($file.Name -notmatch '^[A-Za-z0-9_.-]+$') { throw 'Unexpected packet filename.' }
    if ((Hash-File (Safe-Path (Join-Path $PacketDirectory $file.Name))) -cne $file.Value) { throw 'Packet file differs.' }
}
if ((Hash-File $PSCommandPath) -cne $manifest.files.'checkpoint-windows-driver-20261125.ps1') { throw 'Driver differs.' }
$binding = $manifest.phase_inputs.$Phase
if ($Phase -eq 'check') {
    if ([string]::IsNullOrEmpty($Partition) -or $env:SCOTTY_WINDOWS_PARTITION -cne $Partition) {
        throw 'An exact qualification partition is required.'
    }
    $binding = $binding.$Partition
}
if ($null -eq $binding) { throw 'This phase has no separately reviewed actual inputs yet.' }
if ($binding.path -notmatch '^[A-Za-z0-9_.-]+\.json$') { throw 'Invalid input filename.' }
$inputs = Safe-Path (Join-Path $PacketDirectory $binding.path)
if ((Hash-File $inputs) -cne $binding.sha256) { throw 'Phase inputs differ.' }
$JobHelper = Safe-Path $JobHelper
if ((Hash-File $JobHelper) -cne '2758a6ff94c0eecdfa360363469069dfa8470efc1f91228812146919a978921f') { throw 'Job helper differs.' }
$temp = Safe-Path $env:RUNNER_TEMP
if ($env:GITHUB_RUN_ID -notmatch '^[0-9]+$' -or $env:GITHUB_RUN_ATTEMPT -notmatch '^[1-9][0-9]*$') { throw 'Invalid run identity.' }
$token = "$($env:GITHUB_RUN_ID)-$($env:GITHUB_RUN_ATTEMPT)"
$artifact = Join-Path $temp "bead-checkpoint-windows-artifact-$Phase-$token"
if (Test-Path -LiteralPath $artifact) { throw 'Artifact output exists; do not replay.' }
[void][IO.Directory]::CreateDirectory($artifact)
$supervisor = Join-Path $PacketDirectory 'checkpoint-windows-supervisor-20261125.ps1'
$helperName = "checkpoint-windows-$Phase-20261125.py"
$helper = Join-Path $PacketDirectory $helperName
$argv = @('-NoLogo','-NoProfile','-NonInteractive','-File',$supervisor,'-Phase',$Phase,
          '-PythonHelper',$helper,'-HelperSha256',$manifest.files.$helperName,
          '-InputManifest',$inputs,'-InputsSha256',$binding.sha256,
          '-JobHelper',$JobHelper,'-SupervisorSha256',$manifest.files.'checkpoint-windows-supervisor-20261125.ps1')
if ($Phase -eq 'build') { $argv += @('-Checkout',(Safe-Path $Checkout)) }
else {
    $argv += @('-ArtifactDirectory',(Safe-Path $ArtifactDirectory),
               '-BuildHelper',(Join-Path $PacketDirectory 'checkpoint-windows-build-20261125.py'),
               '-CorpusHelper',(Join-Path $PacketDirectory 'checkpoint-release-corpus-20261125.py'),
               '-CorpusInputs',(Join-Path $PacketDirectory 'corpus-inputs.json'),
               '-SmokeHelper',(Safe-Path $SmokeHelper))
}
$systemPowerShell = Safe-Path (Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe')
$exitCode = 1
$completion = [ordered]@{ schema_version=1; status='failed'; phase=$Phase; packet_sha256=$PacketSha256;
    run_id=$env:GITHUB_RUN_ID; run_attempt=$env:GITHUB_RUN_ATTEMPT; workflow_commit=$env:GITHUB_SHA; partition=$Partition;
    supervisor_process_exited=$false; owned_job_empty_after_supervisor_exit=$false }
$supervisorRoot = Join-Path $temp "bead-checkpoint-windows-supervisor-$Phase-$token"
try {
    & $systemPowerShell @argv
    $exitCode = $LASTEXITCODE
    $completion['supervisor_exit_code'] = $exitCode
    $receiptPath = Safe-Path (Join-Path $supervisorRoot 'supervisor-result.json')
    $receipt = ConvertFrom-Json -InputObject ([IO.File]::ReadAllText($receiptPath,$Utf8))
    $completion['supervisor_result_sha256'] = Hash-File $receiptPath
    $completion['supervisor_pid'] = $receipt.supervisor_pid
    $sameProcessAlive = $false
    try {
        $process = [Diagnostics.Process]::GetProcessById([int]$receipt.supervisor_pid)
        $sameProcessAlive = $process.StartTime.ToUniversalTime().ToString('o') -ceq $receipt.supervisor_started_utc
        $process.Dispose()
    } catch [ArgumentException] { $sameProcessAlive = $false }
    $completion.supervisor_process_exited = -not $sameProcessAlive
    if ($exitCode -ne 0 -or $receipt.status -cne 'passed' -or $sameProcessAlive -or
        $receipt.phase -cne $Phase -or $receipt.helper_sha256 -cne $manifest.files.$helperName -or
        $receipt.inputs_sha256 -cne $binding.sha256 -or
        $receipt.owned_children_remaining -ne 0 -or -not $receipt.owned_children_empty_before_outer_exit) {
        throw 'The owned phase or its outer Job completion was not successful.'
    }
    $completion.owned_job_empty_after_supervisor_exit = $true
    $completion.status = 'passed'
} catch {
    $completion['error'] = $_.Exception.Message
    $exitCode = 1
} finally {
    $copied = [Collections.Generic.List[object]]::new()
    $script:CopiedBytes = 0L
    function Copy-File([string]$Source,[string]$Destination) {
        $Source = Safe-Path $Source
        $length = (Get-Item -LiteralPath $Source).Length
        $script:CopiedBytes += $length
        if ($script:CopiedBytes -gt 4GB) { throw 'Artifact copy bound exceeded.' }
        [void][IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($Destination))
        [IO.File]::Copy($Source,$Destination,$false)
        $digest = Hash-File $Source
        if ((Hash-File $Destination) -cne $digest) { throw 'Retained artifact copy differs.' }
        $copied.Add([pscustomobject]@{ path=$Destination.Substring($artifact.Length+1).Replace('\','/'); bytes=$length; sha256=$digest })
    }
    function Copy-Tree([string]$Source,[string]$Destination) {
        if (-not [IO.Directory]::Exists($Source)) { return }
        $Source = Safe-Path $Source
        foreach ($entry in Get-ChildItem -LiteralPath $Source -Force) {
            if (($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Output contains a reparse point.' }
            if ($entry.PSIsContainer) {
                Copy-Tree $entry.FullName (Join-Path $Destination $entry.Name)
            } else {
                Copy-File $entry.FullName (Join-Path $Destination $entry.FullName.Substring($Source.Length+1))
            }
        }
    }
    try {
        $phaseRoot = Join-Path $temp "bead-checkpoint-windows-$Phase-$token"
        foreach ($name in @('result.json','build-result.json','attempt-started.json','windows-build-bundle.tar.gz','archive-build-script.sh')) {
            $path = Join-Path $phaseRoot $name
            if ([IO.File]::Exists($path)) { Copy-File $path (Join-Path $artifact $name) }
        }
        foreach ($name in @('logs','release-under-test','smoke-output')) { Copy-Tree (Join-Path $phaseRoot $name) (Join-Path $artifact $name) }
        if ([IO.Directory]::Exists($supervisorRoot)) {
            foreach ($name in @('supervisor-result.json','helper.stdout','helper.stderr')) {
                $path = Join-Path $supervisorRoot $name
                if ([IO.File]::Exists($path)) { Copy-File $path (Join-Path $artifact $name) }
            }
        }
        if ($Phase -eq 'check') {
            $corpus = Join-Path $temp "bead-checkpoint-windows-corpus-$token"
            foreach ($name in @('result.json','attempt-started.json')) {
                $path = Join-Path $corpus $name
                if ([IO.File]::Exists($path)) { Copy-File $path (Join-Path $artifact "corpus\$name") }
            }
            foreach ($name in @('logs','reports','evidence')) { Copy-Tree (Join-Path $corpus $name) (Join-Path $artifact "corpus\$name") }
        }
        $completion['retained_files'] = $copied
    } catch {
        $completion.status = 'failed'
        $completion['retention_error'] = $_.Exception.Message
        $exitCode = 1
    }
    $completion['finished_utc'] = [DateTime]::UtcNow.ToString('o')
    $completionPath = Join-Path $artifact 'supervisor-completion.json'
    New-Json $completionPath $completion
    Write-Output ('CHECKPOINT_WINDOWS_COMPLETION_SHA256 ' + (Hash-File $completionPath))
    Write-Output ('CHECKPOINT_WINDOWS_COMPLETION_BASE64 ' + [Convert]::ToBase64String([IO.File]::ReadAllBytes($completionPath)))
    foreach ($name in @('helper.stdout','helper.stderr')) {
        $path = Join-Path $artifact $name
        if ([IO.File]::Exists($path)) {
            $reader = [IO.StreamReader]::new($path,$Utf8)
            try {
                while (($line = $reader.ReadLine()) -ne $null) {
                    if ($line.Length -gt 512KB) { throw 'An emitted metadata/log line exceeds its reviewed bound.' }
                    Write-Output $line
                }
            } finally { $reader.Dispose() }
        }
    }
}
exit $exitCode
