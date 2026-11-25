param(
    [Parameter(Mandatory=$true)][string]$Artifact,
    [Parameter(Mandatory=$true)][string]$ManifestSha256,
    [Parameter(Mandatory=$true)][string]$ArtifactId,
    [Parameter(Mandatory=$true)][string]$OutputDirectory
)
$ErrorActionPreference = 'Stop'
$packet = Split-Path -Parent $PSCommandPath
$jobHelper = Join-Path $packet 'windows-task-job.ps1'
$helper = Join-Path $packet 'maintenance.py'
$expectedJob = '2758a6ff94c0eecdfa360363469069dfa8470efc1f91228812146919a978921f'
if ((Get-FileHash -Algorithm SHA256 $jobHelper).Hash.ToLowerInvariant() -ne $expectedJob) {
    throw 'The accepted owned-process helper differs.'
}
$python = (Get-Command python.exe -CommandType Application | Select-Object -First 1).Source
. $jobHelper
Enter-ScottyTaskJob
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
if ($before.Count -ne 1 -or $before[0] -ne $PID) { throw 'Owned Job had unexpected children before execution.' }
$started = [DateTime]::UtcNow
$watch = [Diagnostics.Stopwatch]::StartNew()
$exitCode = 1
$record = [ordered]@{
    schema_version = 1; operation = 'windows-maintenance-red-supervisor'
    status = 'failed'; started_utc = $started.ToString('o'); supervisor_pid = $PID
    job_helper_sha256 = $expectedJob; source_commit = 'c90f0cdbade93f9e9e6206e9a4d1999fa63afb1b'
    helper_sha256 = (Get-FileHash -Algorithm SHA256 $helper).Hash.ToLowerInvariant()
    supervisor_sha256 = (Get-FileHash -Algorithm SHA256 $PSCommandPath).Hash.ToLowerInvariant()
    artifact_id = $ArtifactId; artifact_manifest_sha256 = $ManifestSha256
    child_job_handle_closed_on_supervisor_exit = $true; owned_children_remaining = $null
}
try {
    & $python $helper red --artifact $Artifact --manifest-sha256 $ManifestSha256 --artifact-id $ArtifactId --output $OutputDirectory
    $exitCode = $LASTEXITCODE
    $record['helper_exit'] = $exitCode
    if ($exitCode -ne 0) { throw "Maintenance Red verification exited $exitCode." }
    if ($watch.Elapsed.TotalSeconds -gt 300) { throw 'Maintenance execution exceeded its outer deadline.' }
    $record['status'] = 'passed'
} catch {
    $record['error'] = $_.Exception.Message
    $exitCode = 1
} finally {
    try {
        $remaining = @([CheckpointHostedJobProbe]::Pids() | Where-Object { $_ -ne $PID })
        for ($attempt = 0; $remaining.Count -gt 0 -and $attempt -lt 20; $attempt++) {
            Start-Sleep -Milliseconds 100
            $remaining = @([CheckpointHostedJobProbe]::Pids() | Where-Object { $_ -ne $PID })
        }
        $record['owned_children_remaining'] = $remaining.Count
        $record['remaining_pids'] = $remaining
        if ($remaining.Count -ne 0) { throw 'Owned child processes remain before supervisor exit.' }
    } catch {
        $record['cleanup_error'] = $_.Exception.Message
        $record['status'] = 'failed'
        $exitCode = 1
    }
    $record['finished_utc'] = [DateTime]::UtcNow.ToString('o')
    $record['duration_seconds'] = $watch.Elapsed.TotalSeconds
    if (-not (Test-Path -LiteralPath $OutputDirectory)) {
        [void](New-Item -ItemType Directory -Path $OutputDirectory)
    }
    $receipt = Join-Path $OutputDirectory 'supervisor-result.json'
    [IO.File]::WriteAllText($receipt, (($record | ConvertTo-Json -Depth 20) + [Environment]::NewLine), [Text.UTF8Encoding]::new($false))
    Write-Output ('MAINTENANCE_SUPERVISOR_SHA256 ' + (Get-FileHash -Algorithm SHA256 $receipt).Hash.ToLowerInvariant())
    Write-Output ('MAINTENANCE_SUPERVISOR_BASE64 ' + [Convert]::ToBase64String([IO.File]::ReadAllBytes($receipt)))
}
exit $exitCode
