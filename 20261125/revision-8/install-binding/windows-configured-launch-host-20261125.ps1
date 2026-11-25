#requires -Version 5.1
<#
Run as a fresh, hidden powershell.exe -File process after installation. This
checks the real launch-scotty.bat and its .env.local BEAD_BIN default, using one
new native workspace and an isolated app registry. It leaves the app stopped.
The external observer reuses the repository's real tray click fixture. No
browser, visible menu, build or existing store is opened.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$BeadExe,
    [Parameter(Mandatory=$true)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$ExpectedSha256,
    [Parameter(Mandatory=$true)][string]$EvidenceDirectory,
    [ValidateRange(1024,65535)][int]$Port=43972,
    [ValidateRange(45,120)][int]$TimeoutSeconds=120,
    [ValidateRange(256,512)][int]$MaxOwnedResidentMiB=512
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
$RepositoryPath='F:\Dev\bead-me-up-scotty'
$JobHash='2758a6ff94c0eecdfa360363469069dfa8470efc1f91228812146919a978921f'
$Utf8=[Text.UTF8Encoding]::new($false)
$Self=[Diagnostics.Process]::GetCurrentProcess()
$SessionId=$Self.SessionId
$Started=[DateTime]::UtcNow
$Deadline=$Started.AddSeconds($TimeoutSeconds)
$Owned=[Collections.Generic.List[object]]::new()
$Seen=[Collections.Generic.HashSet[string]]::new()
$Commands=[Collections.Generic.List[object]]::new()
$Requests=[Collections.Generic.List[object]]::new()
$CleanupErrors=[Collections.Generic.List[string]]::new()
$PeakResident=0L
$ArtifactRoot=$null
$Launcher=$null
$Client=$null
$AcceptedTrayHashes = @{
    'bin\windows-tray.mjs' = '4205c86aab176cd394c528221d946bcf920f854d26e539164e62cc109c747446'
    'bin\windows-tray-host.mjs' = '39d1f1e609a787f862cdc21d6fef7aa3c768d981233a12e22c0d2108e93cf0dd'
}
$Result=[ordered]@{schema_version=1;status='failed';started_utc=$Started.ToString('o');repository=$RepositoryPath
    port=$Port;priority='BelowNormal';node_heap_mib=128;timeout_seconds=$TimeoutSeconds
    owned_resident_limit_mib=$MaxOwnedResidentMiB;interactive_session_id=$SessionId
    commands=$Commands;requests=$Requests;cleanup='pending'}

# The qualified helper owns this handle. This wrapper borrows it for exact
# membership, resident-memory sampling and cleanup; it never closes the Job.
$Job = [IntPtr]::Zero
$JobOwned = [Collections.Generic.List[object]]::new()
$JobKeys = [Collections.Generic.HashSet[string]]::new()
$JobMeasurements = @{ samples = 0; peak_resident_bytes = 0L; peak_member_count = 0; cleanup_assisted = $false; budget_exceeded = $false }
$HardDeadline = $Deadline
$Deadline = $HardDeadline.AddSeconds(-12)

function Initialize-OwnedJob {
    $field = [Scotty20261111TaskJob].GetField('ownedJob', [Reflection.BindingFlags]'Static,NonPublic')
    Assert-That ($null -ne $field) 'Qualified helper has no retained task Job field.'
    $script:Job = [IntPtr]$field.GetValue($null)
    Assert-That ($Job -ne [IntPtr]::Zero) 'Qualified helper did not retain its task Job handle.'
    Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
public static class Scotty20261125TrayJobInspector {
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool QueryInformationJobObject(IntPtr job, int type, IntPtr information, uint size, out uint needed);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool IsProcessInJob(IntPtr process, IntPtr job, out bool member);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool GlobalMemoryStatusEx(ref Memory status);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool GetProcessTimes(IntPtr process, out long creation, out long exit, out long kernel, out long user);
    [DllImport("kernel32.dll", SetLastError=true)] static extern uint GetProcessId(IntPtr process);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern bool QueryFullProcessImageName(IntPtr process, uint flags, StringBuilder name, ref uint size);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool TerminateJobObject(IntPtr job, uint exitCode);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool TerminateProcess(IntPtr process, uint exitCode);
    [DllImport("kernel32.dll")] static extern IntPtr GetCurrentProcess();
    [DllImport("psapi.dll", SetLastError=true)] static extern bool GetProcessMemoryInfo(IntPtr process, ref Counters counters, uint size);
    [StructLayout(LayoutKind.Sequential)] struct Memory {
        public uint size, load; public ulong total, available, totalPage, availablePage, totalVirtual, availableVirtual, extended;
    }
    [StructLayout(LayoutKind.Sequential)] struct Counters {
        public uint size, faults;
        public UIntPtr peakWorkingSet, workingSet, peakPagedPool, pagedPool, peakNonPagedPool, nonPagedPool, pagefile, peakPagefile, privateUsage;
    }
    static System.Threading.Timer deadline;
    public static ulong AvailablePhysical() {
        Memory value=new Memory(); value.size=(uint)Marshal.SizeOf(typeof(Memory));
        if(!GlobalMemoryStatusEx(ref value)) throw new Win32Exception(Marshal.GetLastWin32Error());
        return value.available;
    }
    public static long Birth(IntPtr process, int expectedPid) {
        if(GetProcessId(process)!=(uint)expectedPid) throw new InvalidOperationException("Held process handle has a different PID.");
        long creation,exit,kernel,user;
        if(!GetProcessTimes(process,out creation,out exit,out kernel,out user)) throw new Win32Exception(Marshal.GetLastWin32Error());
        return creation;
    }
    public static string Image(IntPtr process) {
        uint size=32768; StringBuilder name=new StringBuilder((int)size);
        if(!QueryFullProcessImageName(process,0,name,ref size)) throw new Win32Exception(Marshal.GetLastWin32Error());
        return name.ToString();
    }
    public static bool IsMember(IntPtr process, IntPtr job) {
        bool member; if(!IsProcessInJob(process,job,out member)) throw new Win32Exception(Marshal.GetLastWin32Error()); return member;
    }
    public static ulong Resident(IntPtr process) {
        Counters value=new Counters(); value.size=(uint)Marshal.SizeOf(typeof(Counters));
        if(!GetProcessMemoryInfo(process,ref value,value.size)) throw new Win32Exception(Marshal.GetLastWin32Error());
        return value.workingSet.ToUInt64();
    }
    public static void ArmDeadline(IntPtr job, int milliseconds) {
        if(milliseconds<1 || deadline!=null) throw new InvalidOperationException("Invalid task deadline.");
        deadline=new System.Threading.Timer(delegate(object state) {
            if(!TerminateJobObject(job,124)) TerminateProcess(GetCurrentProcess(),124);
        },null,milliseconds,System.Threading.Timeout.Infinite);
    }
    public static void FinishDeadline() { if(deadline!=null) { deadline.Dispose(); deadline=null; } }
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
    $initial = @([Scotty20261125TrayJobInspector]::Members($Job))
    Assert-That ($initial.Count -eq 1 -and $initial[0] -eq $Self.Id) 'The dedicated task Job must initially contain only this wrapper.'
    Assert-That ([Scotty20261125TrayJobInspector]::IsMember($Self.Handle, $Job)) 'Wrapper is outside its retained task Job.'
    $Result['job_initial_members'] = $initial
    $Result['job_accounting'] = 'All members of the exact retained Job at each sample, including console hosts and short native children; PID, birth and process handle retained.'
    $Result['hard_deadline_exit_code'] = 124
    [Scotty20261125TrayJobInspector]::ArmDeadline($Job, [int][Math]::Floor(($HardDeadline - [DateTime]::UtcNow).TotalMilliseconds))
}

function Register-JobProcess($Process) {
    [void]$Process.Handle
    if ($Process.HasExited) { return }
    Assert-That ([Scotty20261125TrayJobInspector]::IsMember($Process.Handle, $Job)) 'Observed process is outside the exact owned Job.'
    $birth = [Scotty20261125TrayJobInspector]::Birth($Process.Handle, $Process.Id)
    $key = [string]$Process.Id + ':' + [string]$birth
    if ($JobKeys.Contains($key)) { return }
    # Retain a separate handle so role metadata and aggregate accounting cannot
    # dispose each other's ownership evidence.
    $held = [Diagnostics.Process]::GetProcessById($Process.Id)
    try {
        [void]$held.Handle
        Assert-That ([Scotty20261125TrayJobInspector]::Birth($held.Handle, $held.Id) -eq $birth) 'PID was reused during Job capture.'
        Assert-That ([Scotty20261125TrayJobInspector]::IsMember($held.Handle, $Job)) 'Captured process left the owned Job.'
        if ($held.HasExited) { return }
        Assert-That ($held.SessionId -eq $SessionId) 'An owned Job descendant is outside the existing interactive session.'
        $held.PriorityClass = [Diagnostics.ProcessPriorityClass]::BelowNormal
        $entry = @{ process = $held; process_id = $held.Id; birth_filetime = $birth
            started_utc = [DateTime]::FromFileTimeUtc($birth).ToString('o'); session_id = $held.SessionId
            image = [Scotty20261125TrayJobInspector]::Image($held.Handle); exit_code = $null; peak_resident_bytes = 0L }
        Assert-That ($JobOwned.Count -lt 128) 'Task Job exceeded its cumulative process bound.'
        $JobOwned.Add($entry); [void]$JobKeys.Add($key); $held = $null
    } finally { if ($null -ne $held) { $held.Dispose() } }
}

function Refresh-JobProcesses {
    $members = @([Scotty20261125TrayJobInspector]::Members($Job))
    Assert-That ($members -contains $Self.Id) 'Wrapper disappeared from its owned Job.'
    foreach ($processId in $members) {
        if ($processId -eq $Self.Id) { continue }
        if (@($JobOwned | Where-Object { $_.process_id -eq $processId -and -not $_.process.HasExited }).Count -eq 1) { continue }
        $process = $null
        try {
            try { $process = [Diagnostics.Process]::GetProcessById($processId) }
            catch [ArgumentException] { continue }
            Register-JobProcess $process
        } catch {
            # A process may exit during this bounded read. Live members must
            # pass every handle, identity, membership and session check.
            if ($null -eq $process -or -not $process.HasExited) { throw }
        } finally { if ($null -ne $process) { $process.Dispose() } }
    }
    return $members
}

function Measure-OwnedJob {
    param([switch]$Cleanup)
    $members = @(Refresh-JobProcesses)
    $resident = [long][Scotty20261125TrayJobInspector]::Resident($Self.Handle)
    foreach ($entry in $JobOwned) {
        if ($entry.process.HasExited) { continue }
        try {
            Assert-That ([Scotty20261125TrayJobInspector]::Birth($entry.process.Handle, $entry.process_id) -eq $entry.birth_filetime) 'Held Job process identity changed.'
            Assert-That ([Scotty20261125TrayJobInspector]::IsMember($entry.process.Handle, $Job)) 'Held process is no longer a member of the exact Job.'
            $bytes = [long][Scotty20261125TrayJobInspector]::Resident($entry.process.Handle)
            $resident += $bytes; $entry.peak_resident_bytes = [Math]::Max($entry.peak_resident_bytes, $bytes)
        } catch { if (-not $entry.process.HasExited) { throw } }
    }
    $JobMeasurements.samples++
    $JobMeasurements.peak_resident_bytes = [Math]::Max($JobMeasurements.peak_resident_bytes, $resident)
    $JobMeasurements.peak_member_count = [Math]::Max($JobMeasurements.peak_member_count, $members.Count)
    if ($resident -gt $MaxOwnedResidentMiB * 1MB) {
        $JobMeasurements.budget_exceeded = $true
        $Result.status = 'failed'
        $message = 'All owned Job members exceeded the aggregate resident-memory budget.'
        if (-not $CleanupErrors.Contains($message)) { $CleanupErrors.Add($message) }
        if (-not $Cleanup) { throw $message }
    }
    return $resident
}

function Assert-LaunchHeadroom {
    $available = [Scotty20261125TrayJobInspector]::AvailablePhysical()
    if (-not $Result.Contains('launch_headroom')) { $Result['launch_headroom'] = [Collections.Generic.List[object]]::new() }
    $Result.launch_headroom.Add(@{ utc = [DateTime]::UtcNow.ToString('o'); available_physical_bytes = $available; minimum_bytes = 3GB })
    Assert-That ($available -ge 3GB) 'App launch postponed: less than 3 GiB free physical memory.'
}

function Complete-OwnedJob {
    if ($Job -eq [IntPtr]::Zero -or -not ('Scotty20261125TrayJobInspector' -as [type])) { return }
    # A console host may finish just after its application. A successful test
    # must reach zero children naturally; forced cleanup always fails it.
    $grace = [DateTime]::UtcNow.AddMilliseconds(1000)
    do {
        $null = Measure-OwnedJob -Cleanup
        $live = @($JobOwned | Where-Object { -not $_.process.HasExited })
        $members = @([Scotty20261125TrayJobInspector]::Members($Job) | Where-Object { $_ -ne $Self.Id })
        if ($members.Count -eq 0 -and $live.Count -eq 0) { break }
        if ($Result.status -ne 'passed') { break }
        Start-Sleep -Milliseconds 50
    } while ([DateTime]::UtcNow -lt $grace -and [DateTime]::UtcNow -lt $HardDeadline.AddSeconds(-5))
    if ($members.Count -gt 0 -or $live.Count -gt 0) {
        $JobMeasurements.cleanup_assisted = $true
        $CleanupErrors.Add('Owned Job descendants required forced cleanup.')
        $cleanupEnd = [DateTime]::UtcNow.AddSeconds(3)
        do {
            $null = Refresh-JobProcesses
            foreach ($entry in $JobOwned) {
                if ($entry.process.HasExited) { continue }
                Assert-That ([Scotty20261125TrayJobInspector]::Birth($entry.process.Handle, $entry.process_id) -eq $entry.birth_filetime) 'Cleanup handle identity changed.'
                Assert-That ([Scotty20261125TrayJobInspector]::IsMember($entry.process.Handle, $Job)) 'Cleanup refused a process outside the exact owned Job.'
                $entry.process.Kill()
            }
            Start-Sleep -Milliseconds 50
            $members = @([Scotty20261125TrayJobInspector]::Members($Job) | Where-Object { $_ -ne $Self.Id })
        } while ($members.Count -gt 0 -and [DateTime]::UtcNow -lt $cleanupEnd -and [DateTime]::UtcNow -lt $HardDeadline.AddSeconds(-2))
    }
    $Result['remaining_job_members'] = @([Scotty20261125TrayJobInspector]::Members($Job) | Where-Object { $_ -ne $Self.Id })
    Assert-That ($Result.remaining_job_members.Count -eq 0) 'Owned Job descendants remain for kill-on-close reclamation.'
    foreach ($entry in $JobOwned) {
        Assert-That ($entry.process.HasExited) 'A retained owned handle survived cleanup.'
        $entry.exit_code = $entry.process.ExitCode
    }
}

function Save-JobEvidence {
    $Result['job_measurements'] = $JobMeasurements
    $Result['job_processes'] = @($JobOwned | ForEach-Object {
        @{ process_id = $_.process_id; birth_filetime = $_.birth_filetime; started_utc = $_.started_utc
           session_id = $_.session_id; image = $_.image; peak_resident_bytes = $_.peak_resident_bytes; exit_code = $_.exit_code }
    })
}

function Assert-That([bool]$Condition,[string]$Message){if(-not $Condition){throw $Message}}
function Hash([string]$Path){return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()}
function Safe-Path([string]$Value){
    Assert-That ($Value -match '^[A-Za-z]:[\\/]') 'Use a full local Windows path.'
    $full=[IO.Path]::GetFullPath($Value).TrimEnd('\','/')
    Assert-That ($full.Length -gt 3) 'A drive root cannot own smoke output.'
    $cursor=$full
    while($cursor){
        if(Test-Path -LiteralPath $cursor){Assert-That (((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)-eq 0) ('Reparse point in smoke path: '+$cursor)}
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
    try{$listener.Start();return $true}catch{return $false}finally{$listener.Stop()}
}
function Add-Owned($Process,[string]$Kind){
    $entry=@{process=$Process;kind=$Kind;process_id=$Process.Id;started_utc=$null;session_id=$null;exit_code=$null}
    $Owned.Add($entry)
    [void]$Process.Handle
    Register-JobProcess $Process
    $entry.started_utc=$Process.StartTime.ToUniversalTime().ToString('o');$entry.session_id=$Process.SessionId
    Assert-That ($Process.SessionId -eq $SessionId) ('Owned '+$Kind+' is outside the interactive Explorer session.')
    try{if(-not $Process.HasExited){$Process.PriorityClass='BelowNormal'}}catch{if(-not $Process.HasExited){throw}}
    return $entry
}
function Read-Lines([string]$Name,[switch]$Final){
    $file=Join-Path $ArtifactRoot $Name
    if(-not [IO.File]::Exists($file)){return @()}
    # Share writes so the observer can append while this short snapshot is read.
    $stream=[IO.File]::Open($file,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::ReadWrite)
    $reader=[IO.StreamReader]::new($stream,$Utf8)
    try{$text=$reader.ReadToEnd()}finally{$reader.Dispose()}
    Assert-That ($text.Length -le 262144) 'Ownership records exceeded their bound.'
    $lines=$text.Split([char]10)
    if($Final){Assert-That (-not $lines[-1].Trim()) ('Incomplete final ownership record: '+$Name)}
    for($i=0;$i -lt $lines.Length-1;$i++){
        if($lines[$i].Trim()){$lines[$i]|ConvertFrom-Json}
    }
}
function Get-TrayCacheEvidence{
    $records=@(Read-Lines 'processes.jsonl'|Where-Object{$_.kind -eq 'tray'})
    Assert-That ($records.Count -eq 1) 'Expected exactly one production tray helper record.'
    $hosts=@(Read-Lines 'processes.jsonl'|Where-Object{$_.kind -eq 'tray-host'})
    Assert-That ($hosts.Count -eq 1) 'Expected exactly one production tray host record.'
    $hostRecord=$hosts[0];$hostScript=Safe-Path ([string]$hostRecord.hostScript)
    Assert-That ($hostScript -ieq (Join-Path $RepositoryPath 'bin\windows-tray-host.mjs')) 'Actual tray host path differs from the installed module.'
    $hostHash=Hash $hostScript
    Assert-That ($hostRecord.hostScriptSha256 -eq $hostHash -and $hostHash -eq $Result.source_sha256[$hostScript]) 'Actual tray host bytes differ from the installed module.'
    $record=$records[0]
    Assert-That ($hostRecord.windowsHide -eq $true -and $hostRecord.detached -eq $true -and ($hostRecord.stdio -join ',') -ceq 'pipe,pipe,pipe') 'Host launch must be hidden/detached with fresh pipes.'
    Assert-That ($record.windowsHide -eq $true -and $record.detached -eq $false -and ($record.stdio -join ',') -ceq 'pipe,pipe,pipe') 'PowerShell launch must be hidden/attached with fresh pipes.'
    Assert-That ($record.parentPid -eq $hostRecord.pid) 'PowerShell is not owned by the recorded tray host.'
    $parentIndex=[Array]::IndexOf([object[]]$record.args,'-ParentProcessId')
    Assert-That ($parentIndex -ge 0 -and $parentIndex+1 -lt $record.args.Count -and [int]$record.args[$parentIndex+1] -eq $hostRecord.parentPid) 'PowerShell did not retain the original controller PID.'
    $fileIndex=[Array]::IndexOf([object[]]$record.args,'-File')
    Assert-That ($fileIndex -ge 0 -and $fileIndex+1 -lt $record.args.Count) 'The tray helper did not use ordinary -File execution.'
    $helper=Safe-Path ([string]$record.helperScript);$executed=Safe-Path ([string]$record.args[$fileIndex+1])
    $localRoot=(Safe-Path $env:LOCALAPPDATA)+'\'
    foreach($scriptPath in @($helper,$executed)){
        Assert-That ($scriptPath.StartsWith($localRoot,[StringComparison]::OrdinalIgnoreCase)) 'A helper or click fixture did not execute from local app data.'
        Assert-That ([IO.File]::Exists($scriptPath)) 'An owned cached script disappeared before its lifecycle check.'
    }
    $helperHash=Hash $helper;$fixtureHash=Hash $executed
    Assert-That ($helperHash -eq (Hash (Join-Path $RepositoryPath 'bin\windows-tray.ps1')) -and $record.helperScriptSha256 -eq $helperHash) 'The actual production helper copy differs from the installed helper.'
    Assert-That ($fixtureHash -eq (Hash (Join-Path $RepositoryPath 'scripts\fixtures\windows-tray-click.ps1'))) 'The executed click wrapper differs from the installed fixture.'
    Assert-That (@($record.args|Where-Object{$_ -match 'Bypass|ExecutionPolicy|EncodedCommand'}).Count -eq 0) 'The helper must retain the host execution policy.'
    return @{helper_script=$helper;helper_sha256=$helperHash;executed_script=$executed;fixture_sha256=$fixtureHash;host_script=$hostScript;host_sha256=$hostHash;host_pid=$hostRecord.pid}
}
function Observe-Record($Record){
    Assert-That ($Record.kind -in @('controller','server','tray-host','tray','native') -and $Record.pid -gt 0) 'Invalid process ownership record.'
    $key=[string]$Record.kind+':'+[string]$Record.pid+':'+[string]$Record.startedAfter
    if($Seen.Contains($key)){return}
    $process=Get-Process -Id $Record.pid -ErrorAction SilentlyContinue
    if($null -eq $process){return}
    try{
        [void]$process.Handle
        if($process.HasExited){return}
        Assert-That ([Scotty20261125TrayJobInspector]::IsMember($process.Handle,$Job)) 'Recorded process is outside the exact owned Job.'
        $birth=([DateTimeOffset]$process.StartTime.ToUniversalTime()).ToUnixTimeMilliseconds()
        Assert-That ($birth -ge ($Record.startedAfter-50) -and $birth -le ($Record.recordedAt+50)) 'Recorded PID has a different birth time.'
        Assert-That (([Scotty20261125TrayJobInspector]::Image($process.Handle)) -ieq [IO.Path]::GetFullPath([string]$Record.command)) 'Recorded PID has a different executable.'
        if($Record.kind -eq 'controller'){
            Assert-That ($null -ne $Launcher -and $Record.parentPid -eq $Launcher.process.Id) 'The controller is not owned by this batch launch.'
            $identity=Get-CimInstance -ClassName Win32_Process -Filter ('ProcessId = '+$Record.pid) -OperationTimeoutSec 2
            if($null -eq $identity -and $process.HasExited){return}
            Assert-That ($null -ne $identity -and $identity.ParentProcessId -eq $Launcher.process.Id) 'Controller OS parent differs.'
            Assert-That ([IO.Path]::GetFullPath([string]$Record.entry)-ieq $EntryPoint -and ([string]$identity.CommandLine)-match '[\\/]bin[\\/]bead-me-up-scotty\.mjs') 'Controller is not the installed CLI entrypoint.'
        }
        if($Record.kind -in @('server','tray-host','tray')){
            $parentKind=if($Record.kind -eq 'tray'){'tray-host'}else{'controller'}
            $parents=@($Owned|Where-Object{$_.kind -eq $parentKind -and $_.process_id -eq $Record.parentPid})
            if($parents.Count -eq 0){return} # Defer until its parent record is observed.
            Assert-That ($parents.Count -eq 1) 'Recorded child has ambiguous ownership.'
            $identity=Get-CimInstance -ClassName Win32_Process -Filter ('ProcessId = '+$Record.pid) -OperationTimeoutSec 2
            if($null -eq $identity -and $process.HasExited){return}
            Assert-That ($null -ne $identity -and $identity.ParentProcessId -eq $Record.parentPid) 'Recorded child OS parent differs.'
            if($Record.kind -eq 'tray-host'){
                Assert-That (([string]$identity.CommandLine).IndexOf((Join-Path $RepositoryPath 'bin\windows-tray-host.mjs'),[StringComparison]::OrdinalIgnoreCase) -ge 0) 'Tray host command does not identify the verified installed module.'
            }
        }
        $null=Add-Owned $process ([string]$Record.kind);$process=$null;[void]$Seen.Add($key)
    }catch{
        # A native read can complete between lookup and metadata inspection.
        # Its close record is checked later; no unverified handle is acted on.
        if($Record.kind -eq 'native' -and $null -ne $process -and $process.HasExited){return}
        throw
    }finally{if($null -ne $process -and @($Owned|Where-Object{$_.process -eq $process}).Count -eq 0){$process.Dispose()}}
}
function Observe-Processes{
    if($null -eq $ArtifactRoot){return}
    $controller=Join-Path $ArtifactRoot 'controller.json'
    if([IO.File]::Exists($controller)){Observe-Record ([IO.File]::ReadAllText($controller,$Utf8)|ConvertFrom-Json)}
    foreach($record in @(Read-Lines 'processes.jsonl' | Sort-Object @{Expression={if($_.kind -eq 'tray-host'){0}elseif($_.kind -eq 'tray'){1}else{2}}})){Observe-Record $record}
    $native=@(Read-Lines 'native.jsonl')
    foreach($record in @($native|Where-Object{$_.phase -eq 'start'})){
        # Completed short commands need their close receipt, not a fresh lookup
        # of a PID that Windows may have already reassigned.
        if(@($native|Where-Object{$_.phase -eq 'close' -and $_.pid -eq $record.pid -and $_.startedAfter -eq $record.startedAfter}).Count -eq 0){Observe-Record $record}
    }
}
function Check-Budget{
    Observe-Processes
    $resident=Measure-OwnedJob
    $script:PeakResident=[Math]::Max($script:PeakResident,$resident)
    foreach($kind in @('controller','server','tray-host','tray')){Assert-That (@($Owned|Where-Object{$_.kind -eq $kind -and -not $_.process.HasExited}).Count -le 1) ('More than one owned '+$kind+' is live.')}
    Assert-That ($resident -le $MaxOwnedResidentMiB*1MB) 'Owned processes exceeded the resident-memory budget.'
    Assert-That ([DateTime]::UtcNow -lt $Deadline) 'Configured-launch smoke exceeded its total time budget.'
}
function Wait-Until([scriptblock]$Condition,[string]$Failure,[int]$Seconds=30){
    $end=[DateTime]::UtcNow.AddSeconds($Seconds)
    do{Check-Budget;if(& $Condition){return};Start-Sleep -Milliseconds 150}while([DateTime]::UtcNow -lt $end)
    throw $Failure
}
function Native([string]$Name,[string[]]$Arguments){
    Check-Budget
    $start=[Diagnostics.ProcessStartInfo]::new();$start.FileName=$BeadExe;$start.WorkingDirectory=$Workspace
    $start.Arguments=((@('--no-auto-flush')+$Arguments|ForEach-Object{Quote-Argument $_}) -join ' ')
    $start.UseShellExecute=$false;$start.CreateNoWindow=$true;$start.RedirectStandardOutput=$true;$start.RedirectStandardError=$true
    $start.StandardOutputEncoding=$Utf8;$start.StandardErrorEncoding=$Utf8
    $start.EnvironmentVariables['BEAD_WORKSPACE_ROOT']=$Workspace;$start.EnvironmentVariables['BEAD_ACTOR']='scotty-launcher-smoke'
    $start.EnvironmentVariables['TEMP']=$TempDirectory;$start.EnvironmentVariables['TMP']=$TempDirectory
    $start.EnvironmentVariables['RAYON_NUM_THREADS']='1'
    foreach($key in @('NEEDLE_BEAD_ID','NEEDLE_BEAD_FENCING_TOKEN')){$start.EnvironmentVariables.Remove($key)}
    $child=[Diagnostics.Process]::new();$child.StartInfo=$start
    Assert-That ($child.Start()) ('Could not start '+$Name)
    $entry=Add-Owned $child 'fixture-cli'
    $out=$child.StandardOutput.ReadToEndAsync();$err=$child.StandardError.ReadToEndAsync()
    Wait-Until {$child.HasExited} ('Native command timed out: '+$Name) 20
    Assert-That ($out.Wait(2000) -and $err.Wait(2000)) ('Native output did not close: '+$Name)
    $stdout=[string]$out.Result;$stderr=[string]$err.Result
    $Commands.Add([pscustomobject]@{name=$Name;exit_code=$child.ExitCode})
    Assert-That ($child.ExitCode -eq 0) ('Native command failed: '+$Name+' '+$stderr.Substring(0,[Math]::Min(4096,$stderr.Length)))
    return $stdout
}
function Api([string]$Method,[string]$Route,$Body=$null,[int]$ExpectedStatus=200){
    Check-Budget
    $request=[Net.Http.HttpRequestMessage]::new([Net.Http.HttpMethod]::new($Method),('http://127.0.0.1:'+$Port+$Route))
    [void]$request.Headers.TryAddWithoutValidation('Cookie','scotty-viewer-mode=editing')
    if($null -ne $Body){$request.Content=[Net.Http.StringContent]::new((ConvertTo-Json -InputObject $Body -Compress -Depth 8),$Utf8,'application/json')}
    $response=$null
    try{
        $task=$Client.SendAsync($request)
        while(-not $task.Wait(150)){Check-Budget}
        $response=$task.GetAwaiter().GetResult();$text=$response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
        Assert-That ($text.Length -le 262144) 'An API smoke response exceeded its output bound.'
        $Requests.Add([pscustomobject]@{method=$Method;route=$Route;status=[int]$response.StatusCode})
        Assert-That ([int]$response.StatusCode -eq $ExpectedStatus) ('Unexpected API response: '+$Method+' '+$Route+' '+[int]$response.StatusCode+' '+$text.Substring(0,[Math]::Min(2048,$text.Length)))
        return $text|ConvertFrom-Json
    }finally{if($null -ne $response){$response.Dispose()};$request.Dispose()}
}

try{
    $Self.PriorityClass='BelowNormal'
    $BeadExe=Safe-Path $BeadExe;$EvidenceDirectory=Safe-Path $EvidenceDirectory
    Assert-That ($EvidenceDirectory.StartsWith('F:\Dev\.bead-edit-20261111\',[StringComparison]::OrdinalIgnoreCase)) 'Use a new directory within this task staging root.'
    Assert-That (-not(Test-Path -LiteralPath $EvidenceDirectory)) 'EvidenceDirectory already exists; reconcile it before retry.'
    $cursor=$EvidenceDirectory
    while($cursor){
        Assert-That (-not(Test-Path -LiteralPath (Join-Path $cursor '.beads'))) 'An existing store is above the smoke fixture.'
        $parent=[IO.Directory]::GetParent($cursor);$cursor=if($parent){$parent.FullName}else{$null}
    }
    Assert-That ((Hash $BeadExe)-eq $ExpectedSha256.ToLowerInvariant()) 'The installed executable hash differs.'
    $explorers=@(Get-Process -Name explorer -ErrorAction SilentlyContinue|Where-Object{$_.SessionId -eq $SessionId})
    Assert-That ([Environment]::UserInteractive -and $SessionId -gt 0 -and $explorers.Count -gt 0) 'The existing interactive Explorer session is required.'
    $Result['explorer_process_ids']=@($explorers|ForEach-Object{$_.Id});foreach($explorer in $explorers){$explorer.Dispose()}
    Assert-That (Test-PortFree) 'The requested loopback port is occupied.'
    $Batch=Join-Path $RepositoryPath 'launch-scotty.bat';$EntryPoint=Join-Path $RepositoryPath 'bin\bead-me-up-scotty.mjs'
    $Observer=Join-Path $RepositoryPath 'scripts\fixtures\windows-tray-observer.mjs'
    $EnvironmentFile=Join-Path $RepositoryPath '.env.local';$JobHelper=Join-Path $PSScriptRoot 'windows-task-job.ps1'
    $NodePath=(Get-Command node.exe -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source;$CmdPath=Join-Path $env:SystemRoot 'System32\cmd.exe'
    $Result['node_executable']=$NodePath
    $Result['source_sha256']=@{}
    foreach($file in @($Batch,$EntryPoint,$Observer,(Join-Path $RepositoryPath 'scripts\fixtures\windows-tray-click.ps1'),(Join-Path $RepositoryPath 'bin\windows-tray.ps1'),(Join-Path $RepositoryPath 'bin\windows-tray.mjs'),(Join-Path $RepositoryPath 'bin\windows-tray-host.mjs'),$EnvironmentFile,$JobHelper)){$Result.source_sha256[$file]=Hash $file}
    foreach($file in $AcceptedTrayHashes.Keys){Assert-That ($Result.source_sha256[(Join-Path $RepositoryPath $file)] -ceq $AcceptedTrayHashes[$file]) ('Accepted tray module differs: '+$file)}
    Assert-That ((Hash $JobHelper)-eq $JobHash) 'The task Job helper differs from its reviewed bytes.'
    $pinLines=@([IO.File]::ReadAllLines($EnvironmentFile)|Where-Object{$_ -match '^\s*BEAD_BIN\s*='})
    Assert-That ($pinLines.Count -eq 1) 'Expected exactly one BEAD_BIN assignment in installed .env.local.'
    $configured=($pinLines[0] -replace '^\s*BEAD_BIN\s*=\s*','').Trim().Trim('"',"'")
    Assert-That ([IO.Path]::GetFullPath($configured)-ieq $BeadExe) 'The installed default pin is not the verified executable.'
    $Result['configured_pin']=$configured;$Result['binary_sha256']=Hash $BeadExe
    $Result['build_id']=[IO.File]::ReadAllText((Join-Path $RepositoryPath '.next\BUILD_ID')).Trim()
    [void][IO.Directory]::CreateDirectory($EvidenceDirectory);$ArtifactRoot=$EvidenceDirectory
    [IO.File]::WriteAllText((Join-Path $ArtifactRoot 'task-owner.txt'),'bead-edit-20261111',$Utf8)
    $Workspace=Join-Path $ArtifactRoot 'native-workspace';$ConfigDirectory=Join-Path $ArtifactRoot 'config';$TempDirectory=Join-Path $ArtifactRoot 'temp'
    foreach($directory in @($Workspace,$ConfigDirectory,$TempDirectory)){[void][IO.Directory]::CreateDirectory($directory)}
    # A present empty projects array prevents legacy BEADS_REPO/cwd migration.
    $AppConfigDirectory=Join-Path $ConfigDirectory 'bead-me-up-scotty'
    [void][IO.Directory]::CreateDirectory($AppConfigDirectory)
    $emptyConfig=@{humanActor='scotty-launcher-smoke';humanAllowlist=@('scotty-launcher-smoke');humanActorChosen=$true;pollIntervalMs=300000;projects=@();orders=@{};gamification=$false}
    [IO.File]::WriteAllText((Join-Path $AppConfigDirectory 'config.json'),(ConvertTo-Json -InputObject $emptyConfig -Depth 5),$Utf8)
    . $JobHelper
    Enter-ScottyTaskJob
    Initialize-OwnedJob
    $null=Native 'init' @('init','--prefix','launchsmoke')
    $Preload=Join-Path $ArtifactRoot 'configured-launch-observer.mjs'
    [IO.File]::WriteAllText($Preload,@'
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
const root = process.env.SCOTTY_TRAY_SMOKE_DIR;
const normal = value => path.resolve(String(value)).toLowerCase();
const expected = normal(process.env.SCOTTY_SMOKE_EXPECTED_BEAD);
const workspace = normal(process.env.SCOTTY_SMOKE_WORKSPACE);
await import(pathToFileURL(process.env.SCOTTY_SMOKE_TRAY_OBSERVER).href);
const observedSpawn = childProcess.spawn;
childProcess.spawn = (command, args = [], options = {}) => observedSpawn(command, args, { ...options, windowsHide: true });
// Preserve execFile's callback and custom-promisify contracts. No executable
// override is supplied: a wrong installed default fails before touching data.
const execFile = childProcess.execFile;
function optionsFor(input) {
  const args = [...input];
  const index = Array.isArray(args[1]) ? 2 : 1;
  if (args[index] === undefined || typeof args[index] === 'function') args.splice(index, 0, {});
  args[index] = { ...args[index], windowsHide: true };
  const native = normal(args[index].cwd || process.cwd()) === workspace;
  if (native && normal(args[0]) !== expected) throw new Error('Configured native executable differs from the verified installed pin.');
  if (normal(args[0]) === expected && !native) throw new Error('Native execution outside the owned fixture was refused.');
  return { args, native, startedAfter: Date.now() };
}
function observeNative(child, call) {
  if (!call.native || !child?.pid) return;
  const record = { kind: 'native', phase: 'start', pid: child.pid, command: call.args[0],
    cwd: call.args[2].cwd, operation: call.args[1]?.[0], envPin: process.env.BEAD_BIN,
    startedAfter: call.startedAfter, recordedAt: Date.now() };
  const append = value => fs.appendFileSync(path.join(root, 'native.jsonl'), `${JSON.stringify(value)}\n`);
  append(record);
  child.once('close', (code, signal) => append({ phase: 'close', pid: child.pid, startedAfter: call.startedAfter, code, signal }));
}
childProcess.execFile = (...input) => {
  const call = optionsFor(input); const child = execFile(...call.args); observeNative(child, call); return child;
};
Object.defineProperty(childProcess.execFile, promisify.custom, { value: (...input) => {
  const call = optionsFor(input); const promise = execFile[promisify.custom](...call.args); observeNative(promise.child, call); return promise;
}});
const execFileSync = childProcess.execFileSync;
childProcess.execFileSync = (...input) => execFileSync(...optionsFor(input).args);
syncBuiltinESMExports();
if (process.argv[1] && normal(process.argv[1]) === normal(process.env.SCOTTY_SMOKE_ENTRY)) {
  if (process.env.BEAD_BIN) throw new Error('The batch controller inherited BEAD_BIN instead of using .env.local.');
  const recordedAt = Date.now();
  const record = { kind: 'controller', pid: process.pid, parentPid: process.ppid, command: process.execPath, entry: process.argv[1],
    startedAfter: recordedAt - process.uptime() * 1000 - 250, recordedAt, inheritedBeadBin: false };
  fs.writeFileSync(path.join(root, 'controller.json.tmp'), JSON.stringify(record));
  fs.renameSync(path.join(root, 'controller.json.tmp'), path.join(root, 'controller.json'));
  const freeBytes = os.freemem();
  fs.writeFileSync(path.join(root, 'memory-start.json'), JSON.stringify({ freeBytes, minimumBytes: 3 * 1024 ** 3, checkedAt: Date.now() }));
  if (freeBytes < 3 * 1024 ** 3) throw new Error('App launch postponed: less than 3 GiB free physical memory.');
}
'@,$Utf8)
    $start=[Diagnostics.ProcessStartInfo]::new();$start.FileName=$CmdPath
    $start.Arguments='/d /s /c ""'+$Batch+'" --no-open --port '+$Port+'"'
    $start.WorkingDirectory=$RepositoryPath;$start.UseShellExecute=$false;$start.CreateNoWindow=$true
    $start.RedirectStandardInput=$true;$start.RedirectStandardOutput=$true;$start.RedirectStandardError=$true
    foreach($key in @('BEAD_BIN','BEAD_WORKSPACE_ROOT','BEADS_REPO','NEEDLE_BEAD_ID','NEEDLE_BEAD_FENCING_TOKEN','BMUS_SERVE_CMD')){$start.EnvironmentVariables.Remove($key)}
    foreach($pair in @{
        NODE_OPTIONS=('--max-old-space-size=128 --import='+([Uri]$Preload).AbsoluteUri)
        XDG_CONFIG_HOME=$ConfigDirectory;TEMP=$TempDirectory;TMP=$TempDirectory;BEADS_ACTOR='scotty-launcher-smoke';RAYON_NUM_THREADS='1';NEXT_TELEMETRY_DISABLED='1'
        BMUS_TRAY='1';SCOTTY_TRAY_SMOKE_DIR=$ArtifactRoot;SCOTTY_TRAY_SMOKE_ACTION='exit'
        SCOTTY_SMOKE_ENTRY=$EntryPoint;SCOTTY_SMOKE_EXPECTED_BEAD=$BeadExe;SCOTTY_SMOKE_WORKSPACE=$Workspace;SCOTTY_SMOKE_TRAY_OBSERVER=$Observer
    }.GetEnumerator()){$start.EnvironmentVariables[$pair.Key]=[string]$pair.Value}
    $process=[Diagnostics.Process]::new();$process.StartInfo=$start
    Check-Budget
    Assert-LaunchHeadroom
    Assert-That ($process.Start()) 'The installed batch launcher did not start.'
    $entry=Add-Owned $process 'batch'
    $Launcher=@{process=$process;stdout=$null;stderr=$null};$process.StandardInput.Close()
    $Launcher.stdout=$process.StandardOutput.ReadToEndAsync();$Launcher.stderr=$process.StandardError.ReadToEndAsync()
    Add-Type -AssemblyName System.Net.Http
    $handler=[Net.Http.HttpClientHandler]::new();$handler.UseProxy=$false
    $Client=[Net.Http.HttpClient]::new($handler);$Client.Timeout=[TimeSpan]::FromSeconds(20);$Client.MaxResponseContentBufferSize=262144
    Wait-Until {
        Assert-That (-not $Launcher.process.HasExited) 'The batch launcher exited before readiness.'
        return @($Owned|Where-Object{$_.kind -in @('controller','server','tray-host','tray') -and -not $_.process.HasExited}).Count -eq 4
    } 'The controller, tray host, Next server and tray did not all start.' 30
    $trayCache=Get-TrayCacheEvidence
    $server=@($Owned|Where-Object{$_.kind -eq 'server'})[0]
    Wait-Until {
        $socket=[Net.Sockets.TcpClient]::new()
        try{$connection=$socket.ConnectAsync('127.0.0.1',$Port);return $connection.Wait(150) -and $socket.Connected}catch{return $false}finally{$socket.Dispose()}
    } 'The owned Next server did not listen.' 30
    $listeners=@(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
    Assert-That ($listeners.Count -gt 0 -and @($listeners|Where-Object{$_.OwningProcess -ne $server.process.Id}).Count -eq 0) 'The listening port is not owned by the recorded server.'
    $initial=Api 'GET' '/api/projects'
    Assert-That (@($initial.projects|Where-Object{$_.id -ne 'demo'}).Count -eq 0) 'The isolated registry unexpectedly contains real projects.'
    $project=Api 'POST' '/api/projects' @{path=$Workspace;backend='bead-rs'} 201
    $collection='/api/p/'+[Uri]::EscapeDataString([string]$project.id)+'/beads'
    $listed=Api 'GET' $collection
    Assert-That ($listed.meta.kind -eq 'bead-rs' -and @($listed.beads).Count -eq 0) 'The newly registered workspace is not empty native bead-rs.'
    foreach($field in @('title','description','priority','issue_type','notes')){Assert-That ($listed.meta.capabilities.editableFields -contains $field) ('Missing native editing capability: '+$field)}
    $created=Api 'POST' $collection @{title='Configured launcher original';description='Before editing';priority=2;issue_type='task'} 201
    $item=$collection+'/'+[Uri]::EscapeDataString([string]$created.id)
    $unicode=([string][char]0x65e5)+([string][char]0x672c)+([string][char]0x8a9e)
    $patch=@{title=('Configured launcher "quoted" '+$unicode);description=("First line`nSecond line "+$unicode);priority=0;issue_type='launch_check';notes=("Saved notes`n"+$unicode)}
    $edited=Api 'PATCH' $item $patch
    $readback=Api 'GET' $item
    foreach($key in $patch.Keys){Assert-That ($edited.$key -ceq $patch[$key] -and $readback.$key -ceq $patch[$key]) ('API scalar readback differs: '+$key)}
    $cli=(Native 'readback' @('show',[string]$created.id,'--json'))|ConvertFrom-Json
    foreach($key in @('title','description','priority','notes')){Assert-That ($cli.$key -ceq $patch[$key]) ('CLI scalar readback differs: '+$key)}
    $query='{"version":"v1","predicates":[],"sort":[],"projection":{"fields":["id","issue_type"]}}'
    $rows=@((Native 'type-readback' @('query','--json',$query,'--output-json'))|ConvertFrom-Json)
    Assert-That ($rows.Count -eq 1 -and $rows[0].Id -ceq $created.id -and $rows[0].IssueType -ceq $patch.issue_type) 'CLI type readback differs.'
    $Result['issue_id']=$created.id;$Result['verified_fields']=@('title','description','priority','issue_type','notes')
    $Result['workspace']=$Workspace;$Result['app_registry']=$ConfigDirectory
    [IO.File]::WriteAllText((Join-Path $ArtifactRoot 'click-exit'),'exit',$Utf8)
    Wait-Until {@($Owned|Where-Object{$_.kind -in @('batch','controller','server','tray-host','tray') -and -not $_.process.HasExited}).Count -eq 0} 'Tray Exit left an owned launcher, controller, server or helper running.' 15
    Assert-That ($Launcher.process.ExitCode -eq 0) 'The batch launcher returned a failure exit code.'
    $icon=[IO.File]::ReadAllText((Join-Path $ArtifactRoot 'icon-receipt.json'),$Utf8)|ConvertFrom-Json
    Assert-That ($icon.iconVisible -eq $true -and $icon.menuText -eq 'Exit' -and $icon.clicked -eq $true -and $icon.disposed -eq $true) 'The actual tray icon/Exit/disposal receipt is incomplete.'
    $Result['tray']=$icon
    Assert-That (Test-PortFree) 'Tray Exit left the owned port occupied.'
    Wait-Until {
        -not [IO.Directory]::Exists([IO.Path]::GetDirectoryName($trayCache.helper_script)) -and
            -not [IO.Directory]::Exists([IO.Path]::GetDirectoryName($trayCache.executed_script))
    } 'Tray Exit left an owned helper or click-fixture cache.' 10
    $trayCache['removed']=$true;$Result['tray_cache']=$trayCache
    $children=@(Read-Lines 'processes.jsonl' -Final)
    Assert-That (@($children|Where-Object{$_.kind -eq 'server'}).Count -eq 1 -and @($children|Where-Object{$_.kind -eq 'tray'}).Count -eq 1 -and @($children|Where-Object{$_.kind -eq 'tray-host'}).Count -eq 1) 'The configured launch did not use exactly one server and one tray helper.'
    $native=@(Read-Lines 'native.jsonl' -Final);$invocations=@($native|Where-Object{$_.phase -eq 'start'})
    Assert-That ($invocations.Count -gt 0) 'No actual default-pin invocations were observed.'
    foreach($call in $invocations){
        Assert-That ([IO.Path]::GetFullPath($call.command)-ieq $BeadExe -and [IO.Path]::GetFullPath($call.envPin)-ieq $BeadExe -and [IO.Path]::GetFullPath($call.cwd)-ieq $Workspace) 'An actual native invocation used a different pin or workspace.'
        $closed=@($native|Where-Object{$_.phase -eq 'close' -and $_.pid -eq $call.pid -and $_.startedAfter -eq $call.startedAfter})
        Assert-That ($closed.Count -eq 1 -and $closed[0].code -eq 0 -and $null -eq $closed[0].signal) 'A native API invocation lacks successful process completion.'
    }
    $memory=[IO.File]::ReadAllText((Join-Path $ArtifactRoot 'memory-start.json'),$Utf8)|ConvertFrom-Json
    Assert-That ($memory.minimumBytes -eq 3GB -and $memory.freeBytes -ge 3GB) 'Installed controller lacks passing launch headroom evidence.'
    $Result['memory_start']=$memory
    $Result['native_invocations']=$invocations.Count;$Result.status='passed'
}catch{$Result['error']=$_.Exception.Message}
finally{
    if($null -ne $Client){$Client.CancelPendingRequests();$Client.Dispose()}
    try{Complete-OwnedJob}catch{$CleanupErrors.Add($_.Exception.Message)}
    if($null -ne $ArtifactRoot){try{Observe-Processes}catch{$CleanupErrors.Add($_.Exception.Message)}}
    foreach($entry in $Owned){
        try{Assert-That ($entry.process.HasExited) 'An observed owned process survived cleanup.';$entry.exit_code=$entry.process.ExitCode}
        catch{$CleanupErrors.Add($_.Exception.Message)}
    }
    if($null -ne $Launcher -and $null -ne $ArtifactRoot){
        foreach($name in @('stdout','stderr')){
            try{
                $task=$Launcher[$name];Assert-That ($null -ne $task -and $task.Wait(2000)) 'A batch output stream did not close.'
                $text=[string]$task.Result;if($text.Length -gt 32768){$text=$text.Substring(0,32768)+"`n[truncated]"}
                [IO.File]::WriteAllText((Join-Path $ArtifactRoot ($name+'.log')),$text,$Utf8)
            }catch{$CleanupErrors.Add($_.Exception.Message)}
        }
    }
    $Result['port_free']=Test-PortFree;$Result['peak_owned_resident_bytes']=$PeakResident
    $Result['processes']=@($Owned|ForEach-Object{[pscustomobject]@{kind=$_.kind;pid=$_.process_id;started_utc=$_.started_utc;session_id=$_.session_id;exit_code=$_.exit_code}})
    Save-JobEvidence
    $Result['cleanup_errors']=@($CleanupErrors)
    if($CleanupErrors.Count -gt 0 -or -not $Result.port_free){$Result.status='failed'}
    $Result.cleanup=if($Result.status -eq 'passed'){'passed; all observed owned processes exited and port is free'}else{'owned handles stopped where possible; the dedicated PowerShell Job reclaims any unobserved descendants on this process exit'}
    $Result['completed_utc']=[DateTime]::UtcNow.ToString('o')
    foreach($entry in $Owned){$entry.process.Dispose()}
    foreach($entry in $JobOwned){$entry.process.Dispose()}
    $json=ConvertTo-Json -InputObject $Result -Depth 8
    if($null -ne $ArtifactRoot){[IO.File]::WriteAllText((Join-Path $ArtifactRoot 'result.json'),$json,$Utf8)}
    Write-Output $json
    if('Scotty20261125TrayJobInspector' -as [type]){[Scotty20261125TrayJobInspector]::FinishDeadline()}
}
if($Result.status -ne 'passed'){exit 1}
