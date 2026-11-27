#requires -Version 5.1
# Root-owned supervisor for one reviewed Git publication. The exact helper performs work.
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$InputManifest,
    [Parameter(Mandatory=$true)][string]$InputSha256,
    [ValidateRange(60,180)][int]$TimeoutSeconds=180,
    [ValidateRange(256,512)][int]$MaxOwnedResidentMiB=512
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
$Utf8=[Text.UTF8Encoding]::new($false)
$Self=[Diagnostics.Process]::GetCurrentProcess()
$Clock=[Diagnostics.Stopwatch]::StartNew()
$Phase='unvalidated';$ArtifactRoot=$null;$PhaseDirectory=$null;$Job=[IntPtr]::Zero;$Child=$null;$PeakResident=0L
$Owned=[Collections.Generic.List[object]]::new()
$Known=@{}
$CleanupErrors=[Collections.Generic.List[string]]::new()
$Streams=[Collections.Generic.List[object]]::new()
$Result=[ordered]@{schema_version=1;status='failed';phase=$Phase;started_utc=[DateTime]::UtcNow.ToString('o')
    timeout_seconds=$TimeoutSeconds;work_stop_seconds=($TimeoutSeconds-12);max_total_resident_mib=$MaxOwnedResidentMiB
    baseline_free_required_gib=3;minimum_free_during_work_gib=1;node_heap_mib=128;priority='BelowNormal';sample_interval_ms=100
    cleanup_errors=$CleanupErrors;cleanup_assisted=$false;owned_processes=$Owned}
function Assert-That([bool]$Value,[string]$Message){if(-not $Value){throw $Message}}
function Hash([string]$Value){return (Get-FileHash -LiteralPath $Value -Algorithm SHA256).Hash.ToLowerInvariant()}
function Safe-Path([string]$Value){
    Assert-That ($Value -match '^[A-Za-z]:[\\/]') 'Use a full local Windows path.'
    $full=[IO.Path]::GetFullPath($Value).TrimEnd('\','/')
    Assert-That ($full.Length -gt 3) 'A drive root cannot own this run.'
    $cursor=$full
    while($cursor){
        if(Test-Path -LiteralPath $cursor){
            Assert-That (((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)-eq 0) ('Reparse point in path: '+$cursor)
        }
        $parent=[IO.Directory]::GetParent($cursor);$cursor=if($parent){$parent.FullName}else{$null}
    }
    return $full
}
function Check-PublicationLock{
    $publicationLock='F:\Dev\bead-rs\.beads\checkpoint\publish.lock'
    try{$item=Get-Item -LiteralPath $publicationLock -Force -ErrorAction Stop}
    catch [System.Management.Automation.ItemNotFoundException]{return @{present=$false}}
    Assert-That (-not $item.PSIsContainer -and ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)-eq 0 -and $item.Length -eq 0) 'Only a regular non-reparse zero-byte publication lock is allowed.'
    return @{present=$true;bytes=0;regular=$true;reparse=$false}
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
    foreach($processId in [GitPublication20261127Inspector]::Members($Job)){
        if($processId -eq $Self.Id){continue}
        $process=$null;$tracked=$false
        try{
            $process=[Diagnostics.Process]::GetProcessById([int]$processId);[void]$process.Handle
            if(-not [GitPublication20261127Inspector]::IsMember($process.Handle,$Job)){$process.Dispose();continue}
            $birth=$process.StartTime.ToUniversalTime().Ticks;$key=([string]$process.Id)+':'+([string]$birth)
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
        try{
            if(-not $process.HasExited){
                Assert-That ([GitPublication20261127Inspector]::IsMember($process.Handle,$Job)) 'Owned process left the task Job.'
                $process.Refresh();$value=[long]$process.WorkingSet64;$resident+=$value
                if($value -gt $entry.peak_resident_bytes){$entry.peak_resident_bytes=$value}
            }
        }catch{if(-not $process.HasExited){throw}}
    }
    if($resident -gt $script:PeakResident){$script:PeakResident=$resident}
    if(-not $Cleanup){
        [void](Check-PublicationLock)
        Assert-That ($resident -le $MaxOwnedResidentMiB*1MB) 'Aggregate task resident memory exceeded its budget.'
        Assert-That ($Clock.Elapsed.TotalSeconds -lt $TimeoutSeconds-12) 'Git publication work deadline expired.'
        $free=[GitPublication20261127Inspector]::AvailablePhysical()
        if(-not $Result.Contains('minimum_observed_free_physical_bytes') -or $free -lt $Result.minimum_observed_free_physical_bytes){$Result['minimum_observed_free_physical_bytes']=$free}
        Assert-That ($free -ge 1GB) 'Foreground memory pressure: stop the owned phase.'
        foreach($stream in $Streams){Assert-That ($stream.file.Length -le 8MB) 'Helper output exceeded 8 MiB.'}
        if($null -ne $PhaseDirectory -and (Test-Path -LiteralPath $PhaseDirectory)){
            foreach($file in Get-ChildItem -LiteralPath $PhaseDirectory -File){
                if($file.Extension -in @('.stdout','.stderr')){Assert-That ($file.Length -le 16MB) 'Native output exceeded 16 MiB.'}
            }
        }
    }
}
function Stop-Owned{
    Refresh-Owned
    foreach($entry in $Owned){
        try{
            if(-not $entry.process.HasExited){
                Assert-That ([GitPublication20261127Inspector]::IsMember($entry.process.Handle,$Job)) 'Refuse to stop a process outside the owned Job.'
                $entry.process.Kill();$entry.killed_by_supervisor=$true;$Result.cleanup_assisted=$true
            }
        }catch{if(-not $entry.process.HasExited){$CleanupErrors.Add($_.Exception.Message)}}
    }
}
try{
    $Self.PriorityClass='BelowNormal'
    $InputManifest=Safe-Path $InputManifest
    Assert-That ($InputSha256 -match '^[a-f0-9]{64}$') 'Expected exact request SHA256.'
    Assert-That ((Hash $InputManifest)-eq $InputSha256) 'Request bytes differ from the reviewed hash.'
    Assert-That ((Get-Item -LiteralPath $InputManifest).Length -le 1MB) 'Request exceeds 1 MiB.'
    $manifest=[IO.File]::ReadAllText($InputManifest)|ConvertFrom-Json
    $Phase=[string]$manifest.phase;$Result.phase=$Phase
    Assert-That (@('documents','checkpoint','delete-reviewed-task-refs') -contains $Phase) 'Unknown phase.'
    [void](Safe-Path 'F:/Dev/bead-rs/.beads/checkpoint')
    $Result['publication_lock_initial']=Check-PublicationLock
    $taskRoot=Safe-Path 'F:/Dev/.bead-edit-20261111'
    $repository=Safe-Path 'F:/Dev/.bead-edit-20261111/coordination-20261124'
    $binary=Safe-Path $manifest.git.path
    $jobHelper=Safe-Path $manifest.job_helper_path
    $driver=Safe-Path (Join-Path $PSScriptRoot 'publish-reviewed-git-crlf-20261127.mjs')
    $EvidenceDirectory=Safe-Path $manifest.supervisor_output
    Assert-That ($InputManifest.StartsWith($taskRoot+'\',[StringComparison]::OrdinalIgnoreCase)) 'Request must be within the owned task root.'
    Assert-That ($EvidenceDirectory.StartsWith($repository+'\git-publication-',[StringComparison]::OrdinalIgnoreCase)) 'Unexpected supervisor output path.'
    Assert-That (([IO.Path]::GetDirectoryName($EvidenceDirectory))-eq $repository) 'Supervisor output must be an immediate coordination child.'
    Assert-That (-not(Test-Path -LiteralPath $EvidenceDirectory)) 'Use a fresh supervisor output directory.'
    Assert-That ((Hash $PSCommandPath)-eq $manifest.supervisor_sha256) 'Supervisor bytes differ from reviewed request.'
    Assert-That ((Hash $driver)-eq $manifest.helper_sha256) 'Helper bytes differ from reviewed request.'
    Assert-That ((Hash $jobHelper)-eq '2758a6ff94c0eecdfa360363469069dfa8470efc1f91228812146919a978921f') 'Qualified task Job helper differs.'
    Assert-That ($binary -eq 'C:\Program Files\Git\cmd\git.exe') 'Expected the observed Git path.'
    Assert-That ($manifest.git.sha256 -eq '20d0dde30a65afb6e5810a883700a94dcd77fbf3b44b32868d45bf7c9b30137c') 'Expected the observed Git executable.'
    Assert-That ((Hash $binary)-eq $manifest.git.sha256) 'Git executable differs.'
    $history=Safe-Path 'F:/Dev/.bead-edit-20261111/coordination-20261124/revision-9/checkpoint-only-inputs/git-finalization/checkpoint-only-handoff-crlf-20261127.mjs'
    Assert-That ((Hash $history)-eq '2f0f403c5747047bf452514513a9bfb2e18b59b83675be268d348ba88b4b303b') 'Accepted history verifier differs.'
    $NodePath=Safe-Path $manifest.node.path
    Assert-That ($manifest.node.sha256 -eq '91ec09dda8f20556f366110859f106ab189d45f8f6a2bd092e6785174ad4a0fa') 'Expected the observed Node 25.2.1 executable.'
    Assert-That ((Hash $NodePath)-eq $manifest.node.sha256) 'Node executable differs.'
    $PhaseDirectory=Safe-Path $manifest.output_directory
    Assert-That ($PhaseDirectory.StartsWith($repository+'\git-publication-',[StringComparison]::OrdinalIgnoreCase)) 'Unexpected Git output path.'
    Assert-That (([IO.Path]::GetDirectoryName($PhaseDirectory))-eq $repository) 'Git output must be an immediate coordination child.'
    Assert-That ($EvidenceDirectory -eq $PhaseDirectory+'.supervisor') 'Supervisor output differs from the exact Git attempt.'
    Assert-That (-not(Test-Path -LiteralPath $PhaseDirectory)) 'Existing Git attempt; reconcile without replay.'
    [void][IO.Directory]::CreateDirectory($EvidenceDirectory);$ArtifactRoot=$EvidenceDirectory
    $Result['input_manifest']=$InputManifest;$Result['input_manifest_sha256']=$InputSha256
    $Result['binary']=$binary;$Result['binary_sha256']=Hash $binary;$Result['node']=$NodePath;$Result['node_sha256']=Hash $NodePath
    $Result['session_id']=$Self.SessionId
    . $jobHelper
    Enter-ScottyTaskJob
    $field=[Scotty20261111TaskJob].GetField('ownedJob',[Reflection.BindingFlags]'Static,NonPublic')
    $Job=[IntPtr]$field.GetValue($null)
    Assert-That ($Job -ne [IntPtr]::Zero) 'Qualified helper did not retain its owned Job handle.'
    Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.ComponentModel;
using System.Runtime.InteropServices;
public static class GitPublication20261127Inspector {
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool QueryInformationJobObject(IntPtr job,int type,IntPtr information,uint size,out uint needed);
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool IsProcessInJob(IntPtr process,IntPtr job,out bool member);
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool GlobalMemoryStatusEx(ref Memory status);
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool TerminateJobObject(IntPtr job,uint exitCode);
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool TerminateProcess(IntPtr process,uint exitCode);
    [DllImport("kernel32.dll")] static extern IntPtr GetCurrentProcess();
    static System.Threading.Timer deadline;
    [StructLayout(LayoutKind.Sequential)] struct Memory {
        public uint size,load;public ulong total,available,totalPage,availablePage,totalVirtual,availableVirtual,extended;
    }
    public static ulong AvailablePhysical() {
        Memory data=new Memory();data.size=(uint)Marshal.SizeOf(typeof(Memory));
        if(!GlobalMemoryStatusEx(ref data))throw new Win32Exception(Marshal.GetLastWin32Error());return data.available;
    }
    public static bool IsMember(IntPtr process,IntPtr job) {
        bool member;if(!IsProcessInJob(process,job,out member))throw new Win32Exception(Marshal.GetLastWin32Error());return member;
    }
    public static void ArmDeadline(IntPtr job,int milliseconds) {
        if(milliseconds<1 || deadline!=null)throw new InvalidOperationException("Invalid task deadline.");
        deadline=new System.Threading.Timer(delegate(object state) {
            if(!TerminateJobObject(job,124))TerminateProcess(GetCurrentProcess(),124);
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
    $available=[GitPublication20261127Inspector]::AvailablePhysical();$Result['baseline_free_physical_bytes']=$available
    Assert-That ($available -ge 3GB) 'At least 3 GiB free physical RAM is required before Git publication.'
    $initial=@([GitPublication20261127Inspector]::Members($Job))
    Assert-That ($initial.Count -eq 1 -and $initial[0] -eq $Self.Id) 'New task Job must initially contain only this supervisor.'
    Sample-Budget
    $Result['state']='running';$Result['hard_deadline_exit_code']=124
    [IO.File]::WriteAllText((Join-Path $ArtifactRoot 'before.json'),($Result|ConvertTo-Json -Depth 12),$Utf8)
    [GitPublication20261127Inspector]::ArmDeadline($Job,[int][Math]::Floor(($TimeoutSeconds-$Clock.Elapsed.TotalSeconds)*1000))
    $workDeadline=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()+[long](($TimeoutSeconds-22-$Clock.Elapsed.TotalSeconds)*1000)
    Assert-That ($workDeadline -gt [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()) 'Prerequisites consumed work budget.'
    $start=[Diagnostics.ProcessStartInfo]::new();$start.FileName=$NodePath
    $arguments=@('--max-old-space-size=128',$driver,$InputManifest,$InputSha256,[string]$workDeadline)
    $start.Arguments=($arguments|ForEach-Object{Quote-Argument $_})-join ' '
    $start.WorkingDirectory=$repository;$start.UseShellExecute=$false;$start.CreateNoWindow=$true
    $start.RedirectStandardInput=$true;$start.RedirectStandardOutput=$true;$start.RedirectStandardError=$true
    $start.EnvironmentVariables.Remove('NODE_OPTIONS');$start.EnvironmentVariables.Remove('NODE_PATH')
    $Child=[Diagnostics.Process]::new();$Child.StartInfo=$start
    Assert-That ($Child.Start()) 'Could not start Git publication helper.'
    [void]$Child.Handle;$Child.StandardInput.Close()
    $Result['driver_pid']=$Child.Id;$Result['command']=@($NodePath)+$arguments
    foreach($name in @('stdout','stderr')){
        $filename=Join-Path $ArtifactRoot ('driver.'+$name+'.log')
        $stream=[IO.FileStream]::new($filename,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::ReadWrite,4096,[IO.FileOptions]::Asynchronous)
        $reader=if($name -eq 'stdout'){$Child.StandardOutput}else{$Child.StandardError}
        $task=$reader.BaseStream.CopyToAsync($stream);$Streams.Add(@{name=$name;path=$filename;file=$stream;task=$task})
    }
    do{Sample-Budget;if($Child.HasExited){break};Start-Sleep -Milliseconds 100}while($true)
    $Result['driver_exit_code']=$Child.ExitCode
    Assert-That ($Child.ExitCode -eq 0) 'Helper failed; reconcile retained phase attempt before any repeated mutation.'
    $phaseResult=Join-Path $PhaseDirectory 'result.json'
    $driverResult=[IO.File]::ReadAllText($phaseResult)|ConvertFrom-Json
    Assert-That ($driverResult.status -eq 'passed' -and $driverResult.phase -eq $Phase) 'No passed result for this exact phase.'
    Assert-That ($driverResult.request_sha256 -eq $InputSha256) 'Result belongs to another request.'
    $Result['publication_lock_final']=Check-PublicationLock
    $Result['phase_result']=$phaseResult;$Result['phase_result_sha256']=Hash $phaseResult;$Result.status='passed'
}catch{
    $Result['error']=$_.Exception.ToString();$Result.status='failed'
}finally{
    if($Job -ne [IntPtr]::Zero -and ('GitPublication20261127Inspector' -as [type])){
        try{
            Sample-Budget -Cleanup;Stop-Owned
            $cleanupEnd=[Math]::Min($Clock.Elapsed.TotalSeconds+5,$TimeoutSeconds-2)
            do{
                Refresh-Owned;$live=@($Owned|Where-Object{-not $_.process.HasExited})
                if($live.Count -eq 0){break};Stop-Owned;Start-Sleep -Milliseconds 100
            }while($Clock.Elapsed.TotalSeconds -lt $cleanupEnd)
            $Result['remaining_job_members']=@([GitPublication20261127Inspector]::Members($Job)|Where-Object{$_ -ne $Self.Id})
            if($Result.remaining_job_members.Count -gt 0){$CleanupErrors.Add('Owned descendants remain; kill-on-close Job reclaims them when supervisor exits.')}
        }catch{$CleanupErrors.Add($_.Exception.ToString())}
    }
    foreach($stream in $Streams){
        try{if(-not $stream.task.Wait(250)){$CleanupErrors.Add('Helper stream did not close: '+$stream.name)}}catch{$CleanupErrors.Add($_.Exception.Message)}
        try{$stream.file.Flush();$stream.file.Dispose()}catch{$CleanupErrors.Add($_.Exception.Message)}
    }
    foreach($entry in $Owned){
        try{if($entry.process.HasExited){$entry.exit_code=$entry.process.ExitCode}}catch{}
        $entry.process.Dispose();$entry.Remove('process')
    }
    if($null -ne $Child){$Child.Dispose()}
    $Result['peak_total_resident_bytes']=$PeakResident;$Result['duration_seconds']=[Math]::Round($Clock.Elapsed.TotalSeconds,3)
    $Result['finished_utc']=[DateTime]::UtcNow.ToString('o');$Result['state']='finished'
    if($PeakResident -gt $MaxOwnedResidentMiB*1MB){$CleanupErrors.Add('Recorded aggregate resident peak exceeded limit.')}
    if($CleanupErrors.Count -gt 0 -or $Clock.Elapsed.TotalSeconds -gt $TimeoutSeconds -or $Result.cleanup_assisted){$Result.status='failed'}
    if($null -ne $ArtifactRoot){[IO.File]::WriteAllText((Join-Path $ArtifactRoot 'result.json'),($Result|ConvertTo-Json -Depth 12),$Utf8)}
    $Result|ConvertTo-Json -Depth 12
}
if($Result.status -eq 'passed'){exit 0}else{exit 1}
