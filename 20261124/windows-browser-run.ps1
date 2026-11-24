#requires -Version 5.1
# Temporary outer supervisor: one unchanged browser flow per fresh invocation.
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$InputManifest,
    [Parameter(Mandatory=$true)][ValidateSet('flows','recovery','priority')][string]$Flow,
    [Parameter(Mandatory=$true)][string]$EvidenceDirectory,
    [Parameter(Mandatory=$true)][ValidateRange(1024,65535)][int]$Port,
    [ValidateRange(60,180)][int]$TimeoutSeconds=180,
    [ValidateRange(256,512)][int]$MaxOwnedResidentMiB=512,
    [string]$NodePath='node.exe'
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
$Utf8=[Text.UTF8Encoding]::new($false)
$Self=[Diagnostics.Process]::GetCurrentProcess()
$Clock=[Diagnostics.Stopwatch]::StartNew()
$Started=[DateTime]::UtcNow
$ArtifactRoot=$null;$Job=[IntPtr]::Zero;$Child=$null;$PeakResident=0L
$Owned=[Collections.Generic.List[object]]::new()
$Known=@{}
$CleanupErrors=[Collections.Generic.List[string]]::new()
$StreamEntries=[Collections.Generic.List[object]]::new()
$Result=[ordered]@{schema_version=1;status='failed';flow=$Flow;started_utc=$Started.ToString('o');port=$Port
    timeout_seconds=$TimeoutSeconds;work_stop_seconds=($TimeoutSeconds-12);max_total_resident_mib=$MaxOwnedResidentMiB
    baseline_free_required_gib=3;node_heap_mib=96;priority='BelowNormal';sample_interval_ms=100
    cleanup_errors=$CleanupErrors;cleanup_assisted=$false;owned_processes=$Owned}
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
function Test-PortFree{
    $listener=[Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,$Port)
    $listener.Server.ExclusiveAddressUse=$true
    try{$listener.Start();return $true}catch{return $false}finally{$listener.Stop()}
}
function Refresh-Owned{
    foreach($processId in [Scotty20261124BrowserInspector]::Members($Job)){
        if($processId -eq $Self.Id){continue}
        $process=$null;$tracked=$false
        try{
            $process=[Diagnostics.Process]::GetProcessById([int]$processId)
            [void]$process.Handle
            if(-not [Scotty20261124BrowserInspector]::IsMember($process.Handle,$Job)){$process.Dispose();continue}
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
            Assert-That ([Scotty20261124BrowserInspector]::IsMember($process.Handle,$Job)) 'An owned process left the task Job.'
            $process.Refresh();$value=[long]$process.WorkingSet64;$resident+=$value
            if($value -gt $entry.peak_resident_bytes){$entry.peak_resident_bytes=$value}
        }
    }
    if($resident -gt $script:PeakResident){$script:PeakResident=$resident}
    if(-not $Cleanup){
        Assert-That ($resident -le $MaxOwnedResidentMiB*1MB) 'Aggregate task Job resident memory exceeded the budget.'
        Assert-That ($Clock.Elapsed.TotalSeconds -lt $TimeoutSeconds-12) 'Browser work deadline expired.'
        foreach($stream in $StreamEntries){Assert-That ($stream.file.Length -le 8MB) 'A driver output stream exceeded 8 MiB.'}
    }
}
function Stop-Owned{
    Refresh-Owned
    foreach($entry in $Owned){
        try{
            if(-not $entry.process.HasExited){
                Assert-That ([Scotty20261124BrowserInspector]::IsMember($entry.process.Handle,$Job)) 'Refuse to stop a process outside the task Job.'
                $entry.process.Kill();$entry.killed_by_supervisor=$true;$Result.cleanup_assisted=$true
            }
        }catch{if(-not $entry.process.HasExited){$CleanupErrors.Add($_.Exception.Message)}}
    }
}
try{
    $Self.PriorityClass='BelowNormal'
    $InputManifest=Safe-Path $InputManifest
    $manifest=[IO.File]::ReadAllText($InputManifest)|ConvertFrom-Json
    $taskRoot=Safe-Path $manifest.task_root
    $repository=Safe-Path $manifest.repository_path
    $binary=Safe-Path $manifest.bead_exe
    $chrome=Safe-Path $manifest.chrome_path
    $jobHelper=Safe-Path $manifest.job_helper_path
    $driver=Safe-Path (Join-Path $PSScriptRoot 'windows-browser-driver.mjs')
    $EvidenceDirectory=Safe-Path $EvidenceDirectory
    Assert-That ($EvidenceDirectory.StartsWith($taskRoot+'\',[StringComparison]::OrdinalIgnoreCase)) 'Evidence must be within the task root.'
    Assert-That (-not(Test-Path -LiteralPath $EvidenceDirectory)) 'Use a fresh evidence directory.'
    Assert-That (-not $EvidenceDirectory.StartsWith($repository+'\',[StringComparison]::OrdinalIgnoreCase)) 'Keep native fixtures outside the source tree.'
    Assert-That ((Hash $PSCommandPath)-eq $manifest.runner_sha256) 'Outer runner bytes differ from the reviewed manifest.'
    Assert-That ((Hash $driver)-eq $manifest.driver_sha256) 'Node runner bytes differ from the reviewed manifest.'
    Assert-That ((Hash $jobHelper)-eq '2758a6ff94c0eecdfa360363469069dfa8470efc1f91228812146919a978921f') 'Qualified task Job helper differs.'
    Assert-That ($manifest.bead_sha256 -eq '25a05bdfd8feaea92faf6827e9268e597d25432826f1082c7ebadc3af8658798') 'Unexpected native binary pin.'
    Assert-That ((Hash $binary)-eq $manifest.bead_sha256) 'Native executable bytes differ.'
    Assert-That ([IO.File]::Exists($chrome)) 'Existing Chrome executable is missing.'
    $NodePath=(Get-Command $NodePath -ErrorAction Stop).Source
    Assert-That (Test-PortFree) 'Requested loopback port is occupied.'
    [void][IO.Directory]::CreateDirectory($EvidenceDirectory);$ArtifactRoot=$EvidenceDirectory
    $Result['input_manifest']=$InputManifest;$Result['input_manifest_sha256']=Hash $InputManifest
    $Result['repository']=$repository;$Result['binary']=$binary;$Result['binary_sha256']=Hash $binary
    $Result['chrome']=$chrome;$Result['chrome_file_version']=[Diagnostics.FileVersionInfo]::GetVersionInfo($chrome).FileVersion
    $Result['node']=$NodePath;$Result['session_id']=$Self.SessionId
    . $jobHelper
    Enter-ScottyTaskJob
    # Read only the handle created by this exact qualified helper; no other Job is queried.
    $field=[Scotty20261111TaskJob].GetField('ownedJob',[Reflection.BindingFlags]'Static,NonPublic')
    $Job=[IntPtr]$field.GetValue($null)
    Assert-That ($Job -ne [IntPtr]::Zero) 'Qualified helper did not retain its task Job handle.'
    Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
public static class Scotty20261124BrowserInspector {
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
        for(int capacity=32;capacity<=4096;capacity*=2) {
            int size=8+IntPtr.Size*capacity; IntPtr buffer=Marshal.AllocHGlobal(size);
            try {
                uint needed; bool ok=QueryInformationJobObject(job,3,buffer,(uint)size,out needed);
                if(!ok) { int error=Marshal.GetLastWin32Error(); if(error==234) continue; throw new Win32Exception(error); }
                int count=Marshal.ReadInt32(buffer,4); if(count<0 || count>capacity) throw new InvalidOperationException("Invalid Job member count.");
                int[] values=new int[count]; for(int index=0;index<count;index++) values[index]=checked((int)Marshal.ReadIntPtr(buffer,8+index*IntPtr.Size).ToInt64());
                return values;
            } finally { Marshal.FreeHGlobal(buffer); }
        }
        throw new InvalidOperationException("Task Job exceeded 4096 members.");
    }
}
'@
    $available=[Scotty20261124BrowserInspector]::AvailablePhysical()
    $Result['baseline_free_physical_bytes']=$available
    Assert-That ($available -ge 3GB) 'At least 3 GiB free physical RAM is required before browser work.'
    $initialMembers=@([Scotty20261124BrowserInspector]::Members($Job))
    Assert-That ($initialMembers.Count -eq 1 -and $initialMembers[0] -eq $Self.Id) 'The new task Job must initially contain only this supervisor.'
    Sample-Budget
    $Result['phase']='running';$Result['hard_deadline_exit_code']=124
    [IO.File]::WriteAllText((Join-Path $ArtifactRoot 'result.json'),($Result|ConvertTo-Json -Depth 12),$Utf8)
    [Scotty20261124BrowserInspector]::ArmDeadline($Job,[int][Math]::Floor(($TimeoutSeconds-$Clock.Elapsed.TotalSeconds)*1000))
    $workDeadline=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()+[long](($TimeoutSeconds-22-$Clock.Elapsed.TotalSeconds)*1000)
    Assert-That ($workDeadline -gt [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()) 'Prerequisites consumed the browser work budget.'
    $inputPath=Join-Path $ArtifactRoot 'driver-input.json'
    $inputRecord=@{manifest_path=$InputManifest;flow=$Flow;evidence_directory=$ArtifactRoot;port=$Port;work_deadline_ms=$workDeadline}
    [IO.File]::WriteAllText($inputPath,($inputRecord|ConvertTo-Json -Depth 8),$Utf8)
    $start=[Diagnostics.ProcessStartInfo]::new()
    $start.FileName=$NodePath;$arguments=@('--max-old-space-size=96',$driver,$inputPath)
    $start.Arguments=($arguments|ForEach-Object{Quote-Argument $_})-join ' '
    $start.WorkingDirectory=$repository;$start.UseShellExecute=$false;$start.CreateNoWindow=$true
    $start.RedirectStandardInput=$true;$start.RedirectStandardOutput=$true;$start.RedirectStandardError=$true
    $start.EnvironmentVariables.Remove('NODE_OPTIONS');$start.EnvironmentVariables.Remove('NODE_PATH')
    $Child=[Diagnostics.Process]::new();$Child.StartInfo=$start
    Assert-That ($Child.Start()) 'Could not start browser driver.'
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
    Assert-That ($Child.ExitCode -eq 0) 'The browser driver failed; inspect its raw stderr and result.'
    $driverResult=Get-Content -LiteralPath (Join-Path $ArtifactRoot 'driver-result.json') -Raw|ConvertFrom-Json
    Assert-That ($driverResult.status -eq 'passed' -and $driverResult.assertions_passed -eq $true) 'Existing UI assertions did not pass.'
    Assert-That ($driverResult.launch_count -eq 1 -and $driverResult.context_count -eq 1 -and $driverResult.maximum_live_contexts -eq 1) 'Browser/context count differs.'
    $Result['status']='passed'
}catch{
    $Result['error']=$_.Exception.ToString();$Result['status']='failed'
}finally{
    if($Job -ne [IntPtr]::Zero -and ('Scotty20261124BrowserInspector' -as [type])){
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
            $Result['remaining_job_members']=@([Scotty20261124BrowserInspector]::Members($Job)|Where-Object{$_ -ne $Self.Id})
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
    $Result['port_free']=Test-PortFree
    if(-not $Result.port_free){$CleanupErrors.Add('The requested loopback port is still occupied.')}
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
