#requires -Version 5.1
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][ValidateSet('build','check')][string]$Phase,
    [Parameter(Mandatory=$true)][string]$PythonHelper,
    [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$HelperSha256,
    [Parameter(Mandatory=$true)][string]$InputManifest,
    [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$InputsSha256,
    [Parameter(Mandatory=$true)][string]$JobHelper,
    [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$SupervisorSha256,
    [string]$Checkout,
    [string]$ArtifactDirectory,
    [string]$BuildHelper,
    [string]$CorpusHelper,
    [string]$CorpusInputs,
    [string]$SmokeHelper
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$Utf8 = [Text.UTF8Encoding]::new($false)
$JobSha256 = '2758a6ff94c0eecdfa360363469069dfa8470efc1f91228812146919a978921f'
$LimitSeconds = if ($Phase -eq 'build') { 210 } else { 8460 }

function Get-SafePath([string]$Value, [bool]$Directory=$false) {
    if ($Value -notmatch '^[A-Za-z]:[\\/]') { throw 'A full local Windows path is required.' }
    $path = [IO.Path]::GetFullPath($Value).TrimEnd('\','/')
    $item = Get-Item -LiteralPath $path -Force
    if ($Directory -ne [bool]$item.PSIsContainer) { throw 'Unexpected path type.' }
    $cursor = $path
    while ($cursor) {
        $entry = Get-Item -LiteralPath $cursor -Force
        if (($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Reparse path refused.' }
        $parent = [IO.Directory]::GetParent($cursor)
        $cursor = if ($parent) { $parent.FullName } else { $null }
    }
    return $path
}
function Get-Sha([string]$Path) { return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant() }
function Quote-Argument([string]$Value) {
    $builder = [Text.StringBuilder]::new()
    [void]$builder.Append('"')
    $slashes = 0
    foreach ($c in $Value.ToCharArray()) {
        if ($c -eq '\') { $slashes++; continue }
        if ($c -eq '"') { [void]$builder.Append(('\' * (2 * $slashes + 1))) }
        else { [void]$builder.Append(('\' * $slashes)) }
        [void]$builder.Append($c)
        $slashes = 0
    }
    [void]$builder.Append(('\' * (2 * $slashes)))
    [void]$builder.Append('"')
    return $builder.ToString()
}
function Write-NewJson([string]$Path, $Value) {
    $bytes = $Utf8.GetBytes((ConvertTo-Json -InputObject $Value -Depth 30) + [string][char]10)
    $stream = [IO.File]::Open($Path, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::Read)
    try { $stream.Write($bytes,0,$bytes.Length); $stream.Flush($true) } finally { $stream.Dispose() }
}
$PythonHelper = Get-SafePath $PythonHelper
$InputManifest = Get-SafePath $InputManifest
$JobHelper = Get-SafePath $JobHelper
$ownPath = Get-SafePath $PSCommandPath
if ((Get-Sha $ownPath) -cne $SupervisorSha256 -or (Get-Sha $PythonHelper) -cne $HelperSha256 -or
    (Get-Sha $InputManifest) -cne $InputsSha256 -or (Get-Sha $JobHelper) -cne $JobSha256) {
    throw 'An exact reviewed script or input hash differs.'
}
if ((Get-Item -LiteralPath $InputManifest).Length -gt 1MB) { throw 'Inputs exceed the metadata bound.' }
$temp = Get-SafePath $env:RUNNER_TEMP $true
if ($env:GITHUB_RUN_ID -notmatch '^[0-9]+$' -or $env:GITHUB_RUN_ATTEMPT -notmatch '^[1-9][0-9]*$') {
    throw 'Invalid hosted run identity.'
}
$root = Join-Path $temp ("bead-checkpoint-windows-supervisor-$Phase-$($env:GITHUB_RUN_ID)-$($env:GITHUB_RUN_ATTEMPT)")
if (Test-Path -LiteralPath $root) { throw 'Supervisor output exists; reconcile this attempt before any retry.' }
[void][IO.Directory]::CreateDirectory($root)
$arguments = @($PythonHelper, '--inputs', $InputManifest, '--inputs-sha256', $InputsSha256, '--helper-sha256', $HelperSha256)
if ($Phase -eq 'build') {
    $Checkout = Get-SafePath $Checkout $true
    $arguments += @('--checkout', $Checkout)
} else {
    $ArtifactDirectory = Get-SafePath $ArtifactDirectory $true
    $BuildHelper = Get-SafePath $BuildHelper
    $CorpusHelper = Get-SafePath $CorpusHelper
    $CorpusInputs = Get-SafePath $CorpusInputs
    $SmokeHelper = Get-SafePath $SmokeHelper
    $arguments += @('--artifact-directory', $ArtifactDirectory, '--build-helper', $BuildHelper,
                    '--corpus-helper', $CorpusHelper, '--corpus-inputs', $CorpusInputs, '--smoke-helper', $SmokeHelper)
}
$pythonCommand = Get-Command python.exe -CommandType Application -ErrorAction Stop | Select-Object -First 1
$python = Get-SafePath $pythonCommand.Source
$record = [ordered]@{ schema_version=1; status='failed'; phase=$Phase; supervisor_pid=$PID;
    supervisor_started_utc=[Diagnostics.Process]::GetCurrentProcess().StartTime.ToUniversalTime().ToString('o');
    started_utc=[DateTime]::UtcNow.ToString('o'); deadline_seconds=$LimitSeconds;
    supervisor_sha256=$SupervisorSha256; helper_sha256=$HelperSha256; inputs_sha256=$InputsSha256;
    job_helper_sha256=$JobSha256; python=$python; python_sha256=(Get-Sha $python);
    output_directory=$root; owned_children_remaining=$null; outer_job_closed_on_supervisor_exit=$true }
$parsePaths = @($ownPath,$JobHelper)
if ($Phase -eq 'check') { $parsePaths += $SmokeHelper }
foreach ($path in $parsePaths) {
    $tokens = $null
    $errors = $null
    [void][System.Management.Automation.Language.Parser]::ParseFile($path,[ref]$tokens,[ref]$errors)
    if ($errors.Count -ne 0) { throw ('PowerShell parsing failed: ' + $path) }
}
$record['powershell_version'] = $PSVersionTable.PSVersion.ToString()
$record['parsed_scripts'] = $parsePaths
Write-NewJson (Join-Path $root 'attempt-started.json') $record
. $JobHelper
Enter-ScottyTaskJob
# Query the Job created by the unchanged helper; this probe never creates or terminates a Job.
Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
public static class CheckpointHostedJobProbe {
    [DllImport("kernel32.dll", SetLastError=true)]
    static extern bool QueryInformationJobObject(IntPtr job, int kind, IntPtr value, uint length, out uint used);
    public static long[] Pids() {
        IntPtr data=Marshal.AllocHGlobal(8+8*1024);
        try {
            uint used;
            if(!QueryInformationJobObject(IntPtr.Zero,3,data,8+8*1024,out used))
                throw new Win32Exception(Marshal.GetLastWin32Error());
            int assigned=Marshal.ReadInt32(data,0), count=Marshal.ReadInt32(data,4);
            if(assigned!=count || count<1 || count>1024) throw new InvalidOperationException("Incomplete Job PID list.");
            long[] result=new long[count];
            for(int i=0;i<count;i++) result[i]=Marshal.ReadInt64(data,8+8*i);
            return result;
        } finally { Marshal.FreeHGlobal(data); }
    }
}
'@
$before = @([CheckpointHostedJobProbe]::Pids())
if ($before.Count -ne 1 -or $before[0] -ne $PID) { throw 'The owned Job is not initially empty of children.' }
$watch = [Diagnostics.Stopwatch]::StartNew()
$process = $null
$stdout = $null
$stderr = $null
$stdoutTask = $null
$stderrTask = $null
$exitCode = 1
try {
    $start = [Diagnostics.ProcessStartInfo]::new()
    $start.FileName = $python
    $start.Arguments = (($arguments | ForEach-Object { Quote-Argument $_ }) -join ' ')
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardInput = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    $start.WorkingDirectory = $root
    $start.EnvironmentVariables['SCOTTY_CHECKPOINT_JOB_SHA256'] = $JobSha256
    $start.EnvironmentVariables['SCOTTY_CHECKPOINT_SUPERVISOR_PID'] = [string]$PID
    $start.EnvironmentVariables['PYTHONDONTWRITEBYTECODE'] = '1'
    $stdout = [IO.File]::Open((Join-Path $root 'helper.stdout'),[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
    $stderr = [IO.File]::Open((Join-Path $root 'helper.stderr'),[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
    $process = [Diagnostics.Process]::new()
    $process.StartInfo = $start
    if (-not $process.Start()) { throw 'The reviewed helper failed to start.' }
    $record['helper_pid'] = $process.Id
    $process.StandardInput.Close()
    $process.PriorityClass = [Diagnostics.ProcessPriorityClass]::BelowNormal
    $stdoutTask = $process.StandardOutput.BaseStream.CopyToAsync($stdout)
    $stderrTask = $process.StandardError.BaseStream.CopyToAsync($stderr)
    while (-not $process.WaitForExit(250)) {
        if ($watch.Elapsed.TotalSeconds -ge $LimitSeconds) {
            $record['timed_out'] = $true
            throw 'The owned hosted phase exceeded its outer deadline.'
        }
    }
    $record['helper_exit_code'] = $process.ExitCode
    if (-not [Threading.Tasks.Task]::WaitAll([Threading.Tasks.Task[]]@($stdoutTask,$stderrTask),5000)) {
        throw 'Owned output streams did not close after the helper exited.'
    }
    $remaining = @([CheckpointHostedJobProbe]::Pids() | Where-Object { $_ -ne $PID })
    $record.owned_children_remaining = $remaining.Count
    $record['owned_child_pids_after'] = $remaining
    if ($remaining.Count -ne 0) { throw 'Owned descendants remain; closing this supervisor will reclaim its Job.' }
    if ($process.ExitCode -ne 0) { throw "The reviewed helper exited $($process.ExitCode)." }
    if ((Get-Sha $PythonHelper) -cne $HelperSha256 -or (Get-Sha $InputManifest) -cne $InputsSha256 -or
        (Get-Sha $JobHelper) -cne $JobSha256 -or (Get-Sha $ownPath) -cne $SupervisorSha256) {
        throw 'A reviewed input changed during the hosted phase.'
    }
    $record['owned_children_empty_before_outer_exit'] = $true
    $record.status = 'passed'
    $exitCode = 0
} catch {
    $record['error'] = $_.Exception.Message
} finally {
    if ($process -and $record.Contains('helper_pid') -and -not $process.HasExited) {
        try { $process.Kill() } catch { $record['direct_child_kill_error'] = $_.Exception.Message }
    }
    if ($stdout -and $stdoutTask -and $stdoutTask.IsCompleted) { $stdout.Flush($true); $stdout.Dispose(); $stdout=$null }
    if ($stderr -and $stderrTask -and $stderrTask.IsCompleted) { $stderr.Flush($true); $stderr.Dispose(); $stderr=$null }
    $record['finished_utc'] = [DateTime]::UtcNow.ToString('o')
    $record['elapsed_seconds'] = [Math]::Round($watch.Elapsed.TotalSeconds,3)
    $resultPath = Join-Path $root 'supervisor-result.json'
    Write-NewJson $resultPath $record
    $bytes = [IO.File]::ReadAllBytes($resultPath)
    Write-Output ('CHECKPOINT_WINDOWS_SUPERVISOR_SHA256 ' + (Get-Sha $resultPath))
    Write-Output ('CHECKPOINT_WINDOWS_SUPERVISOR_BASE64 ' + [Convert]::ToBase64String($bytes))
}
# This process is the sole owner of the non-inheritable Job handle.
# Its observed exit closes that handle, reclaiming any exceptional remaining descendants.
[Environment]::Exit($exitCode)
