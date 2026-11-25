#requires -Version 5.1
# Close an explicitly hashed accepted-task request with the fixed revision-6 helper in one owned Job.
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$JobHelperPath,
    [Parameter(Mandatory=$true)][string]$RequestPath,
    [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$RequestSha256,
    [Parameter(Mandatory=$true)][ValidatePattern('^completed-[0-9]{8}-[a-z][a-z0-9-]{1,40}$')][string]$OutputName
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue'
$TimeoutSeconds=180;$MaxOwnedResidentMiB=512
$Utf8=[Text.UTF8Encoding]::new($false)
$Self=[Diagnostics.Process]::GetCurrentProcess()
$Clock=[Diagnostics.Stopwatch]::StartNew();$Started=[DateTime]::UtcNow
$ArtifactRoot=$null;$Job=[IntPtr]::Zero;$Child=$null;$PeakResident=0L
$Owned=[Collections.Generic.List[object]]::new();$Known=@{}
$CleanupErrors=[Collections.Generic.List[string]]::new()
$StreamEntries=[Collections.Generic.List[object]]::new()
$Result=[ordered]@{schema_version=1;status='failed';phase='accepted-tasks-revision-6';started_utc=$Started.ToString('o')
    timeout_seconds=$TimeoutSeconds;work_stop_seconds=($TimeoutSeconds-12);max_total_resident_mib=512
    baseline_free_required_gib=1;node_heap_mib=128;priority='BelowNormal';sample_interval_ms=100
    cleanup_errors=$CleanupErrors;cleanup_assisted=$false;owned_processes=$Owned;replay_allowed=$false}
function Assert-That([bool]$Value,[string]$Message){if(-not $Value){throw $Message}}
function Hash([string]$Value){return (Get-FileHash -LiteralPath $Value -Algorithm SHA256).Hash.ToLowerInvariant()}
function Safe-Path([string]$Value){
    Assert-That ($Value -match '^[A-Za-z]:[\\/]') 'Use a full local Windows path.'
    $full=[IO.Path]::GetFullPath($Value).TrimEnd('\','/')
    Assert-That ($full.Length -gt 3) 'A drive root cannot own this run.'
    $cursor=$full
    while($cursor){
        if(Test-Path -LiteralPath $cursor){Assert-That (((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)-eq 0) ('Reparse point in path: '+$cursor)}
        $parent=[IO.Directory]::GetParent($cursor);$cursor=if($parent){$parent.FullName}else{$null}
    }
    return $full
}
function Quote-Argument([string]$Value){
    $builder=[Text.StringBuilder]::new();[void]$builder.Append('"');$slashes=0
    foreach($character in $Value.ToCharArray()){
        if($character -eq '\'){$slashes++;continue}
        $count=if($character -eq '"'){2*$slashes+1}else{$slashes}
        [void]$builder.Append(('\'*$count));[void]$builder.Append($character);$slashes=0
    }
    [void]$builder.Append(('\'*(2*$slashes)));[void]$builder.Append('"');return $builder.ToString()
}
function Refresh-Owned{
    foreach($processId in [Scotty20261125CoordinationInspector]::Members($Job)){
        if($processId -eq $Self.Id){continue}
        $process=$null;$tracked=$false
        try{
            $process=[Diagnostics.Process]::GetProcessById([int]$processId)
            [void]$process.Handle
            if(-not [Scotty20261125CoordinationInspector]::IsMember($process.Handle,$Job)){$process.Dispose();continue}
            $birth=$process.StartTime.ToUniversalTime().Ticks
            $key=([string]$process.Id)+':'+([string]$birth)
            if($Known.ContainsKey($key)){$process.Dispose();continue}
            $entry=@{pid=$process.Id;start_ticks=$birth;session_id=$process.SessionId;name=$process.ProcessName
                process=$process;peak_resident_bytes=0L;killed_by_supervisor=$false;exit_code=$null}
            $Known[$key]=$entry;$Owned.Add($entry);$tracked=$true
            Assert-That ($process.SessionId -eq $Self.SessionId) 'Owned descendant escaped the selected session.'
            if(-not $process.HasExited){$process.PriorityClass='BelowNormal'}
        }catch{
            $failure=$_;$exited=$false
            if($null -ne $process){
                try{$exited=$process.HasExited}catch{}
                if(-not $tracked){$process.Dispose()}
            }
            # Process lookup can race exit. Retain every already-owned handle;
            # only an exited retained process makes priority/Win32 errors benign.
            if($exited -or ($null -eq $process -and $failure.Exception.GetBaseException() -is [ArgumentException])){continue}
            throw $failure
        }
    }
}
function Sample-Budget([switch]$Cleanup){
    Refresh-Owned
    $Self.Refresh();$resident=[long]$Self.WorkingSet64
    foreach($entry in $Owned){
        $process=$entry.process
        if(-not $process.HasExited){
            Assert-That ([Scotty20261125CoordinationInspector]::IsMember($process.Handle,$Job)) 'An owned process left the task Job.'
            $process.Refresh();$value=[long]$process.WorkingSet64;$resident+=$value
            if($value -gt $entry.peak_resident_bytes){$entry.peak_resident_bytes=$value}
        }
    }
    if($resident -gt $script:PeakResident){$script:PeakResident=$resident}
    if(-not $Cleanup){
        Assert-That ($resident -le $MaxOwnedResidentMiB*1MB) 'Aggregate task Job resident memory exceeded the budget.'
        Assert-That ($Clock.Elapsed.TotalSeconds -lt $TimeoutSeconds-12) 'Coordination work deadline expired.'
        foreach($stream in $StreamEntries){Assert-That ($stream.file.Length -le 8MB) 'A driver output stream exceeded 8 MiB.'}
    }
}
function Stop-Owned{
    Refresh-Owned
    foreach($entry in $Owned){
        try{
            if(-not $entry.process.HasExited){
                Assert-That ([Scotty20261125CoordinationInspector]::IsMember($entry.process.Handle,$Job)) 'Refuse to stop a process outside the task Job.'
                $entry.process.Kill();$entry.killed_by_supervisor=$true;$Result.cleanup_assisted=$true
            }
        }catch{if(-not $entry.process.HasExited){$CleanupErrors.Add($_.Exception.Message)}}
    }
}
try{
    $Self.PriorityClass='BelowNormal'
    $repository=Safe-Path 'F:/Dev/.bead-edit-20261111/coordination-20261124'
    $driver=Safe-Path (Join-Path $repository 'record-accepted-tasks-v6.mjs')
    $NodePath=Safe-Path 'C:/Program Files/nodejs/node.exe'
    $jobHelper=Safe-Path $JobHelperPath
    Assert-That ((Hash $driver)-eq '597dfe7c65dd135fcc446a54d11385cc64ceac6fc816e2a2469cef7c43589637') 'Accepted revision-6 helper changed.'
    Assert-That ((Hash $jobHelper)-eq '2758a6ff94c0eecdfa360363469069dfa8470efc1f91228812146919a978921f') 'Qualified task Job helper differs.'
    $reviewHash='27ee4c9b84debcd3706332105a055e48e4243930dbe4dde6a5b88c52da5fcbd0'
    Assert-That ((Hash (Join-Path $repository 'revision-6/plan-review.json'))-eq $reviewHash) 'Accepted plan review changed.'
    Assert-That ((Hash (Join-Path $repository 'materialization-result-v6.json'))-eq '838f89a388d5ea3a962e36b93060d171bfa300da455867c58ab27d9ae2539bd2') 'Accepted native revision-6 receipt changed.'
    Assert-That ((Hash (Join-Path $repository 'revision-6/plan.json'))-eq '80b7381aa09378cf14d7bff2862de30afa11fa9041a914c8fef240dcbd18ab4c') 'Accepted revision-6 plan changed.'
    $request=Safe-Path $RequestPath
    Assert-That ($request.StartsWith($repository+'\',[StringComparison]::OrdinalIgnoreCase)) 'Request must stay within the owned coordination directory.'
    Assert-That ((Hash $request)-eq $RequestSha256) 'Accepted task request changed.'
    $requestObject=[IO.File]::ReadAllText($request)|ConvertFrom-Json
    Assert-That ($requestObject.schema_version -eq 1 -and @($requestObject.tasks).Count -ge 1 -and @($requestObject.tasks).Count -le 32) 'Invalid accepted task request.'
    $outputDirectory=Safe-Path (Join-Path $repository $OutputName)
    Assert-That (-not(Test-Path -LiteralPath $outputDirectory)) 'Existing closure attempt; reconcile before any new mutation.'
    $EvidenceDirectory=Safe-Path (Join-Path $repository ($OutputName+'-supervisor'))
    Assert-That (-not(Test-Path -LiteralPath $EvidenceDirectory)) 'Existing supervisor attempt; no replay.'
    [void][IO.Directory]::CreateDirectory($EvidenceDirectory);$ArtifactRoot=$EvidenceDirectory
    $Result['repository']=$repository;$Result['helper_sha256']=Hash $driver
    $Result['request_path']=$request;$Result['request_sha256']=$RequestSha256;$Result['output_name']=$OutputName
    $Result['supervisor_sha256']=Hash $PSCommandPath;$Result['job_helper_sha256']=Hash $jobHelper
    $Result['node']=$NodePath;$Result['node_sha256']=Hash $NodePath;$Result['session_id']=$Self.SessionId
    . $jobHelper
    Enter-ScottyTaskJob
    $field=[Scotty20261111TaskJob].GetField('ownedJob',[Reflection.BindingFlags]'Static,NonPublic')
    $Job=[IntPtr]$field.GetValue($null)
    Assert-That ($Job -ne [IntPtr]::Zero) 'Qualified helper did not retain its task Job handle.'
    Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.ComponentModel;
using System.Runtime.InteropServices;
public static class Scotty20261125CoordinationInspector {
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool QueryInformationJobObject(IntPtr job, int type, IntPtr information, uint size, out uint needed);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool IsProcessInJob(IntPtr process, IntPtr job, out bool member);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool GlobalMemoryStatusEx(ref Memory status);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool TerminateJobObject(IntPtr job, uint exitCode);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool TerminateProcess(IntPtr process, uint exitCode);
    [DllImport("kernel32.dll")] static extern IntPtr GetCurrentProcess();
    static System.Threading.Timer deadline;
    [StructLayout(LayoutKind.Sequential)] struct Memory {
        public uint size, load; public ulong total, available, totalPage, availablePage, totalVirtual, availableVirtual, extended;
    }
    public static ulong AvailablePhysical() {
        Memory data=new Memory(); data.size=(uint)Marshal.SizeOf(typeof(Memory));
        if(!GlobalMemoryStatusEx(ref data)) throw new Win32Exception(Marshal.GetLastWin32Error());
        return data.available;
    }
    public static bool IsMember(IntPtr process, IntPtr job) {
        bool member; if(!IsProcessInJob(process,job,out member)) throw new Win32Exception(Marshal.GetLastWin32Error()); return member;
    }
    public static void ArmDeadline(IntPtr job, int milliseconds) {
        if(milliseconds<1 || deadline!=null) throw new InvalidOperationException("Invalid task deadline.");
        // This timer owns no additional process and can terminate only our Job.
        // Exit124 is an interrupted failure; a final receipt plus exit0 is required.
        deadline=new System.Threading.Timer(delegate(object state) {
            if(!TerminateJobObject(job,124)) TerminateProcess(GetCurrentProcess(),124);
        },null,milliseconds,System.Threading.Timeout.Infinite);
    }
    public static int[] Members(IntPtr job) {
        Stopwatch clock=Stopwatch.StartNew(); int capacity=32;
        for(int attempt=0;attempt<8 && clock.ElapsedMilliseconds<500;attempt++) {
            int size=8+IntPtr.Size*capacity; IntPtr buffer=Marshal.AllocHGlobal(size);
            try {
                Marshal.WriteInt64(buffer,0,0); uint needed;
                bool ok=QueryInformationJobObject(job,3,buffer,(uint)size,out needed);
                int error=ok?0:Marshal.GetLastWin32Error();
                int assigned=Marshal.ReadInt32(buffer,0), count=Marshal.ReadInt32(buffer,4);
                if(assigned<1 || assigned>1024 || count<0 || count>capacity) throw new InvalidOperationException("Invalid task Job member counts.");
                if(ok && assigned==count && needed>=(uint)(8+IntPtr.Size*count) && needed<=(uint)size) {
                    int[] values=new int[count]; HashSet<int> seen=new HashSet<int>();
                    for(int index=0;index<count;index++) {
                        int pid=checked((int)Marshal.ReadIntPtr(buffer,8+index*IntPtr.Size).ToInt64());
                        if(pid<=0 || !seen.Add(pid)) throw new InvalidOperationException("Invalid task Job PID list.");
                        values[index]=pid;
                    }
                    return values;
                }
                if(error!=0 && error!=234) throw new Win32Exception(error);
                if(assigned>capacity || error==234) capacity=Math.Min(1024,Math.Max(capacity*2,assigned));
            } finally { Marshal.FreeHGlobal(buffer); }
            if(attempt<7 && clock.ElapsedMilliseconds<480) System.Threading.Thread.Sleep(20);
        }
        throw new InvalidOperationException("Task Job membership did not produce a complete bounded snapshot.");
    }
}
'@
    $available=[Scotty20261125CoordinationInspector]::AvailablePhysical()
    $Result['baseline_free_physical_bytes']=$available
    Assert-That ($available -ge 1GB) 'At least 1 GiB free physical RAM is required for this small accepted-task closure.'
    $initialMembers=@([Scotty20261125CoordinationInspector]::Members($Job))
    Assert-That ($initialMembers.Count -eq 1 -and $initialMembers[0] -eq $Self.Id) 'The task Job must initially contain only this supervisor.'
    Sample-Budget
    $Result['phase']='running';$Result['hard_deadline_exit_code']=124
    [IO.File]::WriteAllText((Join-Path $ArtifactRoot 'before.json'),($Result|ConvertTo-Json -Depth 12),$Utf8)
    [Scotty20261125CoordinationInspector]::ArmDeadline($Job,[int][Math]::Floor(($TimeoutSeconds-$Clock.Elapsed.TotalSeconds)*1000))
    $start=[Diagnostics.ProcessStartInfo]::new();$start.FileName=$NodePath
    $arguments=@('--max-old-space-size=128',$driver,$request,$RequestSha256,$OutputName)
    $start.Arguments=($arguments|ForEach-Object{Quote-Argument $_})-join ' '
    $start.WorkingDirectory=$repository;$start.UseShellExecute=$false;$start.CreateNoWindow=$true
    $start.RedirectStandardInput=$true;$start.RedirectStandardOutput=$true;$start.RedirectStandardError=$true
    $start.EnvironmentVariables.Remove('NODE_OPTIONS');$start.EnvironmentVariables.Remove('NODE_PATH')
    $Child=[Diagnostics.Process]::new();$Child.StartInfo=$start
    Assert-That ($Child.Start()) 'Could not start accepted coordination helper.'
    [void]$Child.Handle;$Child.StandardInput.Close()
    $Result['driver_pid']=$Child.Id;$Result['command']=@($NodePath)+$arguments
    foreach($name in @('stdout','stderr')){
        $filename=Join-Path $ArtifactRoot ('driver.'+$name+'.log')
        $stream=[IO.FileStream]::new($filename,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::ReadWrite,4096,[IO.FileOptions]::Asynchronous)
        $reader=if($name -eq 'stdout'){$Child.StandardOutput}else{$Child.StandardError}
        $task=$reader.BaseStream.CopyToAsync($stream)
        $StreamEntries.Add(@{name=$name;path=$filename;file=$stream;task=$task})
    }
    do{Sample-Budget;if($Child.HasExited){break};Start-Sleep -Milliseconds 100}while($true)
    $Result['driver_exit_code']=$Child.ExitCode
    Assert-That ($Child.ExitCode -eq 0) 'Coordination helper failed; reconcile raw logs and native intents before any mutation.'
    $phaseResult=Join-Path $outputDirectory 'result.json'
    $driverResult=[IO.File]::ReadAllText($phaseResult)|ConvertFrom-Json
    Assert-That ($driverResult.status -eq 'passed' -and $driverResult.original_954_unchanged -eq $true -and $driverResult.other_stored_fields_unchanged -eq $true) 'No successful accepted-task closure result.'
    Assert-That ($driverResult.request_sha256 -eq $RequestSha256) 'Result belongs to a different request.'
    $closedProperties=@($driverResult.closed.PSObject.Properties)
    Assert-That ($closedProperties.Count -eq @($requestObject.tasks).Count) 'The closure result contains a different number of tasks.'
    foreach($task in $requestObject.tasks){Assert-That (@($closedProperties|Where-Object{$_.Name -ceq $task.key}).Count -eq 1) 'An accepted task is missing from the closure result.'}
    $Result['native_result']=$phaseResult;$Result['native_result_sha256']=Hash $phaseResult
    $Result['status']='passed'
}catch{
    $Result['error']=$_.Exception.ToString();$Result['status']='failed'
}finally{
    if($Job -ne [IntPtr]::Zero -and ('Scotty20261125CoordinationInspector' -as [type])){
        try{
            Sample-Budget -Cleanup
            Stop-Owned
            $cleanupEnd=[Math]::Min($Clock.Elapsed.TotalSeconds+5,$TimeoutSeconds-2)
            do{
                Refresh-Owned
                $live=@($Owned|Where-Object{-not $_.process.HasExited})
                if($live.Count -eq 0){break}
                Stop-Owned;Start-Sleep -Milliseconds 100
            }while($Clock.Elapsed.TotalSeconds -lt $cleanupEnd)
            $Result['remaining_job_members']=@([Scotty20261125CoordinationInspector]::Members($Job)|Where-Object{$_ -ne $Self.Id})
            if($Result.remaining_job_members.Count -gt 0){$CleanupErrors.Add('Owned descendants remain; kill-on-close Job will reclaim them when this supervisor exits.')}
        }catch{$CleanupErrors.Add($_.Exception.ToString())}
    }
    foreach($stream in $StreamEntries){
        try{if(-not $stream.task.Wait(250)){$CleanupErrors.Add('Driver stream did not close: '+$stream.name)}}catch{$CleanupErrors.Add($_.Exception.Message)}
        try{$stream.file.Flush();$stream.file.Dispose()}catch{$CleanupErrors.Add($_.Exception.Message)}
    }
    foreach($entry in $Owned){
        try{if($entry.process.HasExited){$entry.exit_code=$entry.process.ExitCode}}catch{}
        $entry.process.Dispose();$entry.Remove('process')
    }
    if($null -ne $Child){$Child.Dispose()}
    $Result['peak_total_resident_bytes']=$PeakResident
    $Result['duration_seconds']=[Math]::Round($Clock.Elapsed.TotalSeconds,3)
    $Result['finished_utc']=[DateTime]::UtcNow.ToString('o')
    if($PeakResident -gt $MaxOwnedResidentMiB*1MB){$CleanupErrors.Add('Recorded aggregate resident peak exceeded the limit, including cleanup samples.')}
    if($CleanupErrors.Count -gt 0 -or $Clock.Elapsed.TotalSeconds -gt $TimeoutSeconds){$Result.status='failed'}
    if($Result.cleanup_assisted){$Result.status='failed'}
    $Result['phase']='finished'
    if($null -ne $ArtifactRoot){[IO.File]::WriteAllText((Join-Path $ArtifactRoot 'result.json'),($Result|ConvertTo-Json -Depth 12),$Utf8)}
    $Result|ConvertTo-Json -Depth 12
}
if($Result.status -eq 'passed'){exit 0}else{exit 1}
