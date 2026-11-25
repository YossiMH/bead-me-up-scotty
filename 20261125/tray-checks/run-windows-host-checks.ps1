#requires -Version 5.1
param(
    [Parameter(Mandatory=$true)][string]$RepositoryPath,
    [Parameter(Mandatory=$true)][string]$InputsPath,
    [Parameter(Mandatory=$true)][string]$InputsSha256,
    [Parameter(Mandatory=$true)][string]$HelperSha256,
    [Parameter(Mandatory=$true)][string]$JobHelper
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$utf8 = [Text.UTF8Encoding]::new($false)
$watch = [Diagnostics.Stopwatch]::StartNew()
$jobHash = '2758a6ff94c0eecdfa360363469069dfa8470efc1f91228812146919a978921f'
function Sha([string]$File) { (Get-FileHash -LiteralPath $File -Algorithm SHA256).Hash.ToLowerInvariant() }
function Safe-Path([string]$Value, [bool]$Directory=$false) {
    if ($Value -notmatch '^[A-Za-z]:[\\/]') { throw 'Expected an absolute local Windows path' }
    $path = [IO.Path]::GetFullPath($Value)
    $item = Get-Item -LiteralPath $path -Force
    if ([bool]$item.PSIsContainer -ne $Directory) { throw 'Unexpected path type' }
    $cursor = $path
    while ($cursor) {
        if (((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw 'Redirected test path refused'
        }
        $parent = [IO.Directory]::GetParent($cursor)
        $cursor = if ($parent) { $parent.FullName } else { $null }
    }
    return $path
}
function Quote([string]$Value) {
    if ($Value.Contains('"') -or $Value.EndsWith('\')) { throw 'Unexpected quote or trailing slash in a test argument' }
    return '"' + $Value + '"'
}
function Write-Json([string]$File, $Value) {
    $bytes = $utf8.GetBytes(($Value | ConvertTo-Json -Depth 30) + [string][char]10)
    $stream = [IO.File]::Open($File, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::Read)
    try { $stream.Write($bytes,0,$bytes.Length); $stream.Flush($true) } finally { $stream.Dispose() }
}
$RepositoryPath = Safe-Path $RepositoryPath $true
$InputsPath = Safe-Path $InputsPath
$JobHelper = Safe-Path $JobHelper
$own = Safe-Path $PSCommandPath
if ((Sha $InputsPath) -cne $InputsSha256 -or (Sha $own) -cne $HelperSha256 -or (Sha $JobHelper) -cne $jobHash) {
    throw 'Reviewed helper or input bytes differ'
}
$inputData = [IO.File]::ReadAllText($InputsPath) | ConvertFrom-Json
if ($inputData.source_commit -cne '5232c8b94804064ab71af571ee28797667bd72bd' -or
    $inputData.source_tree -cne 'eadf3e74beb2422186f1b6ffb5ba632d0ad8d7d9' -or $inputData.files.Count -ne 9) {
    throw 'Unexpected accepted tray candidate'
}
$temp = Safe-Path $env:RUNNER_TEMP $true
if ($env:GITHUB_RUN_ID -notmatch '^[0-9]+$' -or $env:GITHUB_RUN_ATTEMPT -notmatch '^[1-9][0-9]*$') { throw 'Invalid hosted run identity' }
$root = Join-Path $temp ("scotty-host-windows-$($env:GITHUB_RUN_ID)-$($env:GITHUB_RUN_ATTEMPT)")
if (Test-Path -LiteralPath $root) { throw 'Fresh Windows host evidence directory required' }
[void][IO.Directory]::CreateDirectory($root)
$record = [ordered]@{ schema_version=1; status='failed'; source_commit=$inputData.source_commit;
    source_tree=$inputData.source_tree; helper_sha256=$HelperSha256; inputs_sha256=$InputsSha256;
    job_helper_sha256=$jobHash; output_directory=$root; supervisor_pid=$PID;
    started=[DateTime]::UtcNow.ToString('o'); deadline_seconds=150; owned_children_remaining=$null;
    scope='Two real Forms host lifecycle checks; the interactive PC tray result remains separate.' }
Write-Json (Join-Path $root 'attempt-started.json') $record
. $JobHelper
Enter-ScottyTaskJob
# Query the existing owned Job; creation and kill-on-close remain in the exact helper.
# Assigned-process and returned-list counts can differ during process exit.
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.Runtime.InteropServices;
public static class ScottyHostedTrayJob {
    [DllImport("kernel32.dll", SetLastError=true)]
    static extern bool QueryInformationJobObject(IntPtr job, int kind, IntPtr value, uint length, out uint used);
    public static int[] Pids() {
        Stopwatch clock=Stopwatch.StartNew(); int capacity=32;
        for(int attempt=0;attempt<8 && clock.ElapsedMilliseconds<500;attempt++) {
            int size=8+IntPtr.Size*capacity; IntPtr buffer=Marshal.AllocHGlobal(size);
            try {
                Marshal.WriteInt64(buffer,0,0); uint used;
                bool ok=QueryInformationJobObject(IntPtr.Zero,3,buffer,(uint)size,out used);
                int error=ok?0:Marshal.GetLastWin32Error();
                int assigned=Marshal.ReadInt32(buffer,0), count=Marshal.ReadInt32(buffer,4);
                if(assigned<1 || assigned>1024 || count<0 || count>capacity)
                    throw new InvalidOperationException("Invalid owned Job member counts.");
                if(ok && assigned==count && used>=(uint)(8+IntPtr.Size*count) && used<=(uint)size) {
                    int[] values=new int[count]; HashSet<int> seen=new HashSet<int>();
                    for(int index=0;index<count;index++) {
                        int pid=checked((int)Marshal.ReadIntPtr(buffer,8+index*IntPtr.Size).ToInt64());
                        if(pid<=0 || !seen.Add(pid)) throw new InvalidOperationException("Invalid owned Job PID list.");
                        values[index]=pid;
                    }
                    return values;
                }
                if(error!=0 && error!=234) throw new Win32Exception(error);
                if(assigned>capacity || error==234) capacity=Math.Min(1024,Math.Max(capacity*2,assigned));
            } finally { Marshal.FreeHGlobal(buffer); }
            if(attempt<7 && clock.ElapsedMilliseconds<480) System.Threading.Thread.Sleep(20);
        }
        throw new InvalidOperationException("Owned Job membership did not produce a complete bounded snapshot.");
    }
}
'@
function Wait-EmptyChildren {
    $until = [DateTime]::UtcNow.AddSeconds(5)
    do {
        $members = @([ScottyHostedTrayJob]::Pids())
        if ($members.Count -eq 1 -and $members[0] -eq $PID) { return }
        Start-Sleep -Milliseconds 50
    } while ([DateTime]::UtcNow -lt $until)
    throw 'Owned Job still contains child processes'
}
function Verify-Source {
    $head = & git -C $RepositoryPath rev-parse HEAD
    if ($LASTEXITCODE -ne 0 -or $head -cne $inputData.source_commit) { throw 'Source commit differs' }
    $tree = & git -C $RepositoryPath rev-parse 'HEAD^{tree}'
    if ($LASTEXITCODE -ne 0 -or $tree -cne $inputData.source_tree) { throw 'Source tree differs' }
    $status = & git -C $RepositoryPath status --porcelain=v1 --untracked-files=all
    if ($LASTEXITCODE -ne 0 -or $status) { throw 'Source checkout is not clean' }
    foreach ($row in $inputData.files) {
        $file = Safe-Path (Join-Path $RepositoryPath $row.path)
        if ((Sha $file) -cne $row.sha256 -or (Get-Item -LiteralPath $file).Length -ne $row.bytes) { throw 'A reviewed candidate file differs' }
    }
}
$process = $null
$out = $null
$err = $null
$outTask = $null
$errTask = $null
$exitCode = 1
try {
    Wait-EmptyChildren
    Verify-Source
    $node = Safe-Path ((Get-Command node.exe -CommandType Application | Select-Object -First 1).Source)
    $version = & $node --version
    if ($LASTEXITCODE -ne 0 -or $version -cne 'v25.2.1') { throw 'Node25.2.1 is required for the measured Windows host path' }
    $record['node'] = @{ path=$node; version=$version; sha256=(Sha $node) }
    $test = Join-Path $RepositoryPath 'scripts\test-windows-tray-host-windows.mjs'
    & $node --check $test
    if ($LASTEXITCODE -ne 0) { throw 'Windows test syntax failed' }
    $match = [regex]::Match([IO.File]::ReadAllText($test), '(?s)const supervisorSource = String\.raw`(.*?)`;\r?\n')
    if (-not $match.Success) { throw 'Embedded ordinary PowerShell supervisor is absent' }
    $tokens = $null; $errors = $null
    [void][System.Management.Automation.Language.Parser]::ParseInput($match.Groups[1].Value, [ref]$tokens, [ref]$errors)
    if ($errors.Count -ne 0) { throw 'Embedded ordinary PowerShell supervisor failed native parsing' }
    $record['embedded_powershell_parse'] = 'passed'
    $arguments = @('--test','--test-reporter=tap','--test-concurrency=1','scripts/test-windows-tray-host-windows.mjs')
    $record['command'] = @($node) + $arguments
    $start = [Diagnostics.ProcessStartInfo]::new()
    $start.FileName = $node
    $start.Arguments = (($arguments | ForEach-Object { Quote $_ }) -join ' ')
    $start.WorkingDirectory = $RepositoryPath
    $start.UseShellExecute = $false; $start.CreateNoWindow = $true
    $start.RedirectStandardInput = $true; $start.RedirectStandardOutput = $true; $start.RedirectStandardError = $true
    foreach ($key in @($start.EnvironmentVariables.Keys)) {
        if ($key -eq 'NODE_OPTIONS' -or $key -match '^(SCOTTY_|BMUS_|BEAD_)') { $start.EnvironmentVariables.Remove($key) }
    }
    $start.EnvironmentVariables['SCOTTY_TRAY_HOST_TEST_ROOT'] = Join-Path $root 'cases'
    $out = [IO.File]::Open((Join-Path $root 'node.stdout'),[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
    $err = [IO.File]::Open((Join-Path $root 'node.stderr'),[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
    $process = [Diagnostics.Process]::new(); $process.StartInfo = $start
    if (-not $process.Start()) { throw 'Node test command did not start' }
    $record['node_pid'] = $process.Id
    $process.StandardInput.Close()
    $outTask = $process.StandardOutput.BaseStream.CopyToAsync($out)
    $errTask = $process.StandardError.BaseStream.CopyToAsync($err)
    while (-not $process.WaitForExit(100)) {
        if ($watch.Elapsed.TotalSeconds -ge 150) { throw 'Windows host checks exceeded their outer deadline' }
    }
    $record['node_exit_code'] = $process.ExitCode
    if (-not [Threading.Tasks.Task]::WaitAll([Threading.Tasks.Task[]]@($outTask,$errTask),5000)) { throw 'Node test streams did not close' }
    $out.Flush($true); $out.Dispose(); $out=$null
    $err.Flush($true); $err.Dispose(); $err=$null
    Wait-EmptyChildren
    $record.owned_children_remaining = 0
    if ($process.ExitCode -ne 0) { throw 'Windows host tests did not pass' }
    $text = [IO.File]::ReadAllText((Join-Path $root 'node.stdout'))
    foreach ($name in @('tests','pass','fail','cancelled','skipped','todo')) {
        $expected = if ($name -in @('tests','pass')) { 2 } else { 0 }
        if ([regex]::Matches($text, ('(?m)^# ' + $name + ' ' + $expected + '\r?$')).Count -ne 1) { throw 'Expected two successful unskipped Windows cases' }
    }
    $cases = @(Get-ChildItem -LiteralPath (Join-Path $root 'cases') -Recurse -File -Filter result.json)
    if ($cases.Count -ne 2) { throw 'Expected exactly two complete case receipts' }
    $record['cases'] = @($cases | ForEach-Object {
        $case = [IO.File]::ReadAllText($_.FullName) | ConvertFrom-Json
        if ($case.status -cne 'passed' -or $case.node.version -cne 'v25.2.1' -or $case.processes.children.Count -ne 2 -or
            -not $case.processes.cache_removed -or -not $case.processes.ready_observed -or $case.processes.forced_cleanup.Count -ne 0) { throw 'A real host case receipt failed' }
        @{ action=$case.action; path=$_.FullName; sha256=(Sha $_.FullName); bytes=$_.Length }
    })
    if ((@($record.cases.action | Sort-Object) -join ',') -cne 'parent-loss,stop') { throw 'Case actions differ' }
    Verify-Source
    if ((Sha $own) -cne $HelperSha256 -or (Sha $InputsPath) -cne $InputsSha256 -or (Sha $JobHelper) -cne $jobHash) { throw 'Reviewed inputs changed during execution' }
    Wait-EmptyChildren
    if ($watch.Elapsed.TotalSeconds -gt 150) { throw 'The complete Windows check exceeded its deadline' }
    $record['source_unchanged'] = $true
    $record['owned_children_empty_before_supervisor_exit'] = $true
    $record.status = 'passed'; $exitCode=0
} catch { $record['error'] = $_.Exception.Message }
finally {
    if ($process -and $record.Contains('node_pid') -and -not $process.HasExited) {
        try { $process.Kill() } catch { $record['direct_child_kill_error'] = $_.Exception.Message }
    }
    if ($out -and $outTask -and $outTask.IsCompleted) { $out.Flush($true); $out.Dispose() }
    if ($err -and $errTask -and $errTask.IsCompleted) { $err.Flush($true); $err.Dispose() }
    $record['finished'] = [DateTime]::UtcNow.ToString('o')
    $record['elapsed_seconds'] = [Math]::Round($watch.Elapsed.TotalSeconds,3)
    Write-Json (Join-Path $root 'result.json') $record
    Write-Output ('SCOTTY_WINDOWS_RESULT_SHA256 ' + (Sha (Join-Path $root 'result.json')))
    Write-Output ('SCOTTY_WINDOWS_RESULT_BASE64 ' + [Convert]::ToBase64String([IO.File]::ReadAllBytes((Join-Path $root 'result.json'))))
}
# Observed supervisor exit closes the unchanged helper's non-inheritable Job
# handle and reclaims any exceptional remaining descendants.
[Environment]::Exit($exitCode)
