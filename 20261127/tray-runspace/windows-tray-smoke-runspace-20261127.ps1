#requires -Version 5.1
<#
Runs the repository's real Windows Forms Exit/parent-loss smoke, followed by
one supervised restart of the real Next server. Everything is sequential,
hidden and BelowNormal; the final state has no owned application processes.
The restart trigger is an external test preload, not the app's update command.
No browser, visible context menu, installation or build is started.

Example:
  powershell.exe -NoLogo -NoProfile -NonInteractive -WindowStyle Hidden -File
    .\windows-tray-smoke-runspace-20261127.ps1 -RepositoryPath F:\Dev\bead-me-up-scotty
    -EvidenceDirectory F:\Temp\scotty-tray-check-UNIQUE -Port 43971

Exit 0 means all cases and cleanup passed. Exit 1 includes a bounded failure
result. result.json and small logs remain in the new evidence directory.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$RepositoryPath,
    [Parameter(Mandatory = $true)][string]$EvidenceDirectory,
    [string]$NodePath = 'node.exe',
    [string]$BeadBin,
    [string]$SourceRevision,
    [ValidateRange(1024, 65535)][int]$Port = 43971,
    [ValidateRange(45, 180)][int]$TimeoutSeconds = 180,
    [ValidateRange(128, 256)][int]$NodeHeapMiB = 128,
    [ValidateRange(256, 512)][int]$MaxOwnedResidentMiB = 512
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$Utf8 = [Text.UTF8Encoding]::new($false)
$Started = [DateTime]::UtcNow
$Deadline = $Started.AddSeconds($TimeoutSeconds)
$Owned = [Collections.Generic.List[object]]::new()
$Runs = [Collections.Generic.List[object]]::new()
$Seen = [Collections.Generic.HashSet[string]]::new()
$ObservationErrors = [Collections.Generic.HashSet[string]]::new()
$IdentityObservations = [Collections.Generic.List[object]]::new()
$CleanupErrors = [Collections.Generic.List[string]]::new()
$Cases = [Collections.Generic.List[object]]::new()
$Measurements = @{ peak_resident_bytes = 0L; max_live_servers = 0; heartbeat_utc = [DateTime]::MinValue }
$Self = [Diagnostics.Process]::GetCurrentProcess()
$OriginalPriority = $Self.PriorityClass
$SessionId = $Self.SessionId
$ArtifactRoot = $null
$AcceptedTrayHashes = @{
    'bin\windows-tray.mjs' = '4205c86aab176cd394c528221d946bcf920f854d26e539164e62cc109c747446'
    'bin\windows-tray-host.mjs' = '39d1f1e609a787f862cdc21d6fef7aa3c768d981233a12e22c0d2108e93cf0dd'
}
$ResultPath = $null
$DriverCopyDirectory = $null
$DriverCopyPath = $null
$DriverRun = $null
$AcceptedDriverHash = '4e13d7172c8f520c17ae1698cc9428b5b5a87aaa3ed30e2bcc7a2dcbad870279'
$JobHash = '2758a6ff94c0eecdfa360363469069dfa8470efc1f91228812146919a978921f'
$Result = [ordered]@{
    schema_version = 1; status = 'failed'; started_utc = $Started.ToString('o')
    repository = $RepositoryPath; source_revision_reported = $SourceRevision
    port = $Port; priority = 'BelowNormal'; timeout_seconds = $TimeoutSeconds
    node_heap_mib = $NodeHeapMiB; owned_resident_limit_mib = $MaxOwnedResidentMiB
    live_free_required_bytes = 1GB; minimum_observed_free_physical_bytes = $null
    interactive_session_id = $SessionId; cases = $Cases; cleanup = 'pending'
    identity_observations = $IdentityObservations
    user_interactive = [Environment]::UserInteractive
    boundaries = @{
        forms = 'Real NotifyIcon, real ExitItem.PerformClick and normal helper disposal.'
        restart = 'An external preload exits the actual Next child with code 75 after HTTP readiness; no update/build command.'
        consoles = 'An external preload sets windowsHide on owned Node child launches.'
        registry = 'Each case uses its own XDG_CONFIG_HOME.'
    }
}

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

function Assert-That([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw $Message }
}

function Get-SafeLocalPath([string]$Value) {
    Assert-That ($Value -match '^[A-Za-z]:[\\/]') 'Use a full local Windows path.'
    $full = [IO.Path]::GetFullPath($Value).TrimEnd('\', '/')
    Assert-That ($full.Length -gt 3) 'A drive root cannot own smoke output.'
    $cursor = $full
    while ($cursor) {
        if ([IO.File]::Exists($cursor) -or [IO.Directory]::Exists($cursor)) {
            $item = Get-Item -LiteralPath $cursor -Force
            Assert-That (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0) ('Reparse point in smoke path: ' + $cursor)
        }
        $parent = [IO.Directory]::GetParent($cursor)
        $cursor = if ($parent) { $parent.FullName } else { $null }
    }
    return $full
}

function Get-TrayCacheEvidence([string]$Directory) {
    $records = @(Read-Records $Directory | Where-Object { $_.kind -eq 'tray' })
    Assert-That ($records.Count -eq 1) 'Expected exactly one production tray helper record.'
    $record = $records[0]
    $hosts = @(Read-Records $Directory | Where-Object { $_.kind -eq 'tray-host' })
    Assert-That ($hosts.Count -eq 1) 'Expected exactly one production tray host record.'
    $hostRecord = $hosts[0]
    $hostScript = Get-SafeLocalPath ([string]$hostRecord.hostScript)
    Assert-That ($hostScript -ieq $HostEntry) 'The actual tray host path differs from the repository module.'
    $hostHash = (Get-FileHash -LiteralPath $hostScript -Algorithm SHA256).Hash.ToLowerInvariant()
    Assert-That ($hostHash -eq $Result.source_sha256['bin\windows-tray-host.mjs'] -and $hostRecord.hostScriptSha256 -eq $hostHash) 'The actual tray host bytes differ.'
    Assert-That ($hostRecord.windowsHide -eq $true -and $hostRecord.detached -eq $true -and ($hostRecord.stdio -join ',') -ceq 'pipe,pipe,pipe') 'The host must use a hidden detached process and three fresh pipes.'
    Assert-That ($record.windowsHide -eq $true -and $record.detached -eq $false -and ($record.stdio -join ',') -ceq 'pipe,pipe,pipe') 'PowerShell must use a hidden attached process and three fresh pipes.'
    Assert-That ($record.parentPid -eq $hostRecord.pid) 'PowerShell is not owned by the recorded tray host.'
    $parentIndex = [Array]::IndexOf([object[]]$record.args, '-ParentProcessId')
    Assert-That ($parentIndex -ge 0 -and $parentIndex + 1 -lt $record.args.Count -and [int]$record.args[$parentIndex + 1] -eq $hostRecord.parentPid) 'PowerShell did not retain the original controller PID.'
    $fileIndex = [Array]::IndexOf([object[]]$record.args, '-File')
    Assert-That ($fileIndex -ge 0 -and $fileIndex + 1 -lt $record.args.Count) 'The tray helper did not use ordinary -File execution.'
    $helper = Get-SafeLocalPath ([string]$record.helperScript)
    $executed = Get-SafeLocalPath ([string]$record.args[$fileIndex + 1])
    $localRoot = (Get-SafeLocalPath $env:LOCALAPPDATA) + '\'
    foreach ($scriptPath in @($helper, $executed)) {
        Assert-That ($scriptPath.StartsWith($localRoot, [StringComparison]::OrdinalIgnoreCase)) 'A helper or click fixture did not execute from local app data.'
        Assert-That ([IO.File]::Exists($scriptPath)) 'An owned cached script disappeared before its lifecycle check.'
    }
    $helperHash = (Get-FileHash -LiteralPath $helper -Algorithm SHA256).Hash.ToLowerInvariant()
    $fixtureHash = (Get-FileHash -LiteralPath $executed -Algorithm SHA256).Hash.ToLowerInvariant()
    Assert-That ($helperHash -eq $Result.source_sha256['bin\windows-tray.ps1'] -and $record.helperScriptSha256 -eq $helperHash) 'The actual production helper copy differs from the bundled helper.'
    Assert-That ($fixtureHash -eq $Result.source_sha256['scripts\fixtures\windows-tray-click.ps1']) 'The executed click wrapper differs from the repository fixture.'
    Assert-That (@($record.args | Where-Object { $_ -match 'Bypass|ExecutionPolicy|EncodedCommand' }).Count -eq 0) 'The helper must retain the host execution policy.'
    return @{ helper_script = $helper; helper_sha256 = $helperHash; executed_script = $executed; fixture_sha256 = $fixtureHash; host_script = $hostScript; host_sha256 = $hostHash; host_pid = $hostRecord.pid }
}

function ConvertTo-NativeArgument([string]$Value) {
    $builder = [Text.StringBuilder]::new()
    [void]$builder.Append('"')
    $slashes = 0
    foreach ($character in $Value.ToCharArray()) {
        if ($character -eq '\') { $slashes++; continue }
        [void]$builder.Append(('\' * $(if ($character -eq '"') { 2 * $slashes + 1 } else { $slashes })))
        [void]$builder.Append($character)
        $slashes = 0
    }
    [void]$builder.Append(('\' * (2 * $slashes)))
    [void]$builder.Append('"')
    return $builder.ToString()
}

function Add-OwnedProcess($Process, [string]$Kind, [string]$Directory) {
    # Register the actual handle before priority, streams or metadata can fail.
    $entry = @{
        process = $Process; kind = $Kind; directory = $Directory; process_id = $Process.Id
        started_utc = $null; birth_ms = $null; session_id = $null; priority = $null; exit_code = $null
    }
    $Owned.Add($entry)
    [void]$Process.Handle
    Register-JobProcess $Process
    $entry.started_utc = $Process.StartTime.ToUniversalTime().ToString('o')
    $entry.birth_ms = ([DateTimeOffset]$Process.StartTime.ToUniversalTime()).ToUnixTimeMilliseconds()
    $entry.session_id = $Process.SessionId
    Assert-That ($entry.session_id -eq $SessionId) ('Owned ' + $Kind + ' is outside the interactive Explorer session.')
    if (-not $Process.HasExited) { $Process.PriorityClass = [Diagnostics.ProcessPriorityClass]::BelowNormal }
    $entry.priority = 'BelowNormal'
    return $entry
}

function Observe-Record($Record, [string]$Directory) {
    $key = [string]$Record.pid + ':' + [string]$Record.startedAfter
    if ($Seen.Contains($key)) { return }
    if (@($Owned | Where-Object {
        $_.process_id -eq $Record.pid -and $null -ne $_.birth_ms -and
        $_.birth_ms -ge ($Record.startedAfter - 50) -and $_.birth_ms -le ($Record.recordedAt + 50)
    }).Count -gt 0) {
        [void]$Seen.Add($key); return
    }
    $process = Get-Process -Id $Record.pid -ErrorAction SilentlyContinue
    if ($null -eq $process) { return }
    try {
        [void]$process.Handle
        if ($process.HasExited) { return }
        Assert-That ([Scotty20261125TrayJobInspector]::IsMember($process.Handle, $Job)) 'Recorded process is outside the exact owned Job.'
        $creationTime = $process.StartTime.ToUniversalTime()
        $birth = ([DateTimeOffset]$creationTime).ToUnixTimeMilliseconds()
        Assert-That ($birth -ge ($Record.startedAfter - 50) -and $birth -le ($Record.recordedAt + 50)) 'Recorded PID no longer has the expected process birth time.'
        $expected = [IO.Path]::GetFileNameWithoutExtension([string]$Record.command)
        $actualName = $process.ProcessName
        # Capture the exact compared value before the assertion can stop this run.
        $identityObservation = [pscustomobject][ordered]@{
            observed_utc = [DateTime]::UtcNow.ToString('o'); kind = [string]$Record.kind
            recorded_pid = $Record.pid; process_id = $process.Id; command = [string]$Record.command
            expected_name = $expected; actual_name = $actualName
            creation_time_utc = $creationTime.ToString('o'); birth_ms = $birth
            recorded_started_after = $Record.startedAfter; recorded_at = $Record.recordedAt
            has_exited = $process.HasExited
        }
        $IdentityObservations.Add($identityObservation)
        $identityDetail = ConvertTo-Json -InputObject $identityObservation -Compress -Depth 3
        Assert-That ($actualName -ieq $expected) ('Recorded PID has an unexpected executable name: ' + $identityDetail)
        Assert-That (([Scotty20261125TrayJobInspector]::Image($process.Handle)) -ieq [IO.Path]::GetFullPath([string]$Record.command)) 'Recorded PID has an unexpected executable path.'
        if ($Record.kind -eq 'controller') {
            $parents = @($Owned | Where-Object { $_.kind -eq 'smoke-runner' } | ForEach-Object { $_.process_id }) + @($Self.Id)
            Assert-That ($parents -contains [int]$Record.parentPid) 'Controller record has an unknown owner.'
            $identity = Get-CimInstance -ClassName Win32_Process -Filter ('ProcessId = ' + $Record.pid) -OperationTimeoutSec 2
            if ($null -eq $identity -and $process.HasExited) { return }
            Assert-That ($null -ne $identity -and $identity.ParentProcessId -eq $Record.parentPid) 'Controller parent identity no longer matches.'
            Assert-That (([string]$identity.CommandLine).IndexOf($ServeEntry, [StringComparison]::OrdinalIgnoreCase) -ge 0) 'Controller command no longer identifies the owned serve entrypoint.'
        }
        if ($Record.kind -in @('server', 'tray-host', 'tray')) {
            $parentKind = if ($Record.kind -eq 'tray') { 'tray-host' } else { 'controller' }
            $parents = @($Owned | Where-Object { $_.kind -eq $parentKind -and $_.directory -eq $Directory -and $_.process_id -eq $Record.parentPid })
            if ($parents.Count -eq 0) { return } # Parent record may arrive on the next observation.
            Assert-That ($parents.Count -eq 1) 'Recorded child has ambiguous ownership in this case.'
            $identity = Get-CimInstance -ClassName Win32_Process -Filter ('ProcessId = ' + $Record.pid) -OperationTimeoutSec 2
            if ($null -eq $identity -and $process.HasExited) { return }
            Assert-That ($null -ne $identity -and $identity.ParentProcessId -eq $Record.parentPid) 'Recorded child OS parent differs.'
            if ($Record.kind -eq 'tray-host') {
                Assert-That (([string]$identity.CommandLine).IndexOf($HostEntry, [StringComparison]::OrdinalIgnoreCase) -ge 0) 'Tray host command does not identify the verified module.'
            }
        }
        $entry = Add-OwnedProcess $process ([string]$Record.kind) $Directory
        $process = $null
        [void]$Seen.Add($key)
    } finally {
        if ($null -ne $process -and @($Owned | Where-Object { $_.process -eq $process }).Count -eq 0) { $process.Dispose() }
    }
}

function Read-Records([string]$Directory) {
    $file = Join-Path $Directory 'processes.jsonl'
    if (-not [IO.File]::Exists($file)) { return @() }
    $lines = [IO.File]::ReadAllText($file, $Utf8).Split([char]10)
    for ($i = 0; $i -lt $lines.Length - 1; $i++) {
        if (-not $lines[$i].Trim()) { continue }
        try {
            $record = $lines[$i] | ConvertFrom-Json
            Assert-That ($record.kind -in @('tray-host', 'tray', 'server') -and $record.pid -gt 0) 'Invalid owned child record.'
            $record
        } catch { [void]$ObservationErrors.Add('Invalid complete ownership record: ' + $file + ':' + ($i + 1)) }
    }
}

function Observe-Processes {
    if ($null -eq $ArtifactRoot) { return }
    foreach ($file in [IO.Directory]::GetFiles($ArtifactRoot, 'controller.json', [IO.SearchOption]::AllDirectories)) {
        try { Observe-Record ([IO.File]::ReadAllText($file, $Utf8) | ConvertFrom-Json) ([IO.Path]::GetDirectoryName($file)) }
        catch { [void]$ObservationErrors.Add($_.Exception.Message + ' (' + $file + ')') }
    }
    foreach ($file in [IO.Directory]::GetFiles($ArtifactRoot, 'processes.jsonl', [IO.SearchOption]::AllDirectories)) {
        $directory = [IO.Path]::GetDirectoryName($file)
        foreach ($record in @(Read-Records $directory | Sort-Object @{Expression={if ($_.kind -eq 'tray-host') { 0 } elseif ($_.kind -eq 'tray') { 1 } else { 2 }}})) {
            try { Observe-Record $record $directory }
            catch { [void]$ObservationErrors.Add($_.Exception.Message + ' (' + $file + ')') }
        }
    }
}

function Check-Budget {
    if (([DateTime]::UtcNow - $Measurements.heartbeat_utc).TotalSeconds -ge 1) {
        [IO.File]::WriteAllText($HeartbeatFile, 'owned', $Utf8)
        $Measurements.heartbeat_utc = [DateTime]::UtcNow
    }
    Observe-Processes
    Assert-That ($ObservationErrors.Count -eq 0) 'Owned process identity or record verification failed.'
    Assert-That ($Owned.Count -le 16) 'The smoke spawned more processes than its bounded cases require.'
    $resident = Measure-OwnedJob
    $available = [Scotty20261125TrayJobInspector]::AvailablePhysical()
    if ($null -eq $Result.minimum_observed_free_physical_bytes -or $available -lt $Result.minimum_observed_free_physical_bytes) {
        $Result.minimum_observed_free_physical_bytes = $available
    }
    Assert-That ($available -ge 1GB) 'Tray smoke postponed: less than 1 GiB free physical memory during execution.'
    $servers = 0
    foreach ($entry in $Owned) {
        if (-not $entry.process.HasExited) {
            if ($entry.kind -eq 'server') { $servers++ }
        }
    }
    $Measurements.peak_resident_bytes = [Math]::Max($Measurements.peak_resident_bytes, $resident)
    $Measurements.max_live_servers = [Math]::Max($Measurements.max_live_servers, $servers)
    Assert-That ($servers -le 1) 'More than one owned server is live.'
    Assert-That ($resident -le $MaxOwnedResidentMiB * 1MB) 'Owned smoke processes exceeded the resident-memory budget.'
    Assert-That ([DateTime]::UtcNow -lt $Deadline) 'The total tray smoke time budget expired.'
}

function Wait-Until([scriptblock]$Condition, [string]$Failure, [int]$Seconds = 45) {
    $caseDeadline = [DateTime]::UtcNow.AddSeconds($Seconds)
    do {
        Check-Budget
        if (& $Condition) { return }
        Start-Sleep -Milliseconds 150
    } while ([DateTime]::UtcNow -lt $caseDeadline)
    throw $Failure
}

function Test-PortFree {
    $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $Port)
    try { $listener.Start(); return $true } catch { return $false } finally { $listener.Stop() }
}

function Assert-OwnedListener([int]$ProcessId) {
    $listeners = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
    Assert-That ($listeners.Count -gt 0) 'The expected listening port is absent.'
    Assert-That (@($listeners | Where-Object { $_.OwningProcess -ne $ProcessId }).Count -eq 0) 'The listening port is not owned by the recorded server.'
}

function Start-Headless([string]$Command, [string[]]$NativeArguments, [string]$Kind, [string]$Directory, [hashtable]$Environment) {
    [void][IO.Directory]::CreateDirectory($Directory)
    $start = [Diagnostics.ProcessStartInfo]::new()
    $start.FileName = $Command
    $start.Arguments = (($NativeArguments | ForEach-Object { ConvertTo-NativeArgument $_ }) -join ' ')
    $start.WorkingDirectory = $RepositoryPath
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    $start.EnvironmentVariables['NODE_OPTIONS'] = '--max-old-space-size=' + $NodeHeapMiB + ' --import=' + $ControllerObserverUri
    $start.EnvironmentVariables['SCOTTY_SMOKE_SERVE_ENTRY'] = $ServeEntry
    $start.EnvironmentVariables['SCOTTY_SMOKE_HEARTBEAT'] = $HeartbeatFile
    $start.EnvironmentVariables['BMUS_TRAY'] = '1'
    $start.EnvironmentVariables['BMUS_SERVE_CMD'] = ''
    $start.EnvironmentVariables['PORT'] = [string]$Port
    $start.EnvironmentVariables['HOST'] = '127.0.0.1'
    $start.EnvironmentVariables['XDG_CONFIG_HOME'] = $Directory
    $start.EnvironmentVariables['TEMP'] = $TempDirectory
    $start.EnvironmentVariables['TMP'] = $TempDirectory
    if ($BeadBin) { $start.EnvironmentVariables['BEAD_BIN'] = $BeadBin }
    foreach ($name in $Environment.Keys) { $start.EnvironmentVariables[$name] = [string]$Environment[$name] }
    $process = [Diagnostics.Process]::new()
    $process.StartInfo = $start
    Check-Budget
    Assert-LaunchHeadroom
    Assert-That ($process.Start()) 'An owned smoke process did not start.'
    $entry = Add-OwnedProcess $process $Kind $Directory
    $run = @{ entry = $entry; process = $process; directory = $Directory; stdout = $null; stderr = $null }
    $Runs.Add($run)
    $run.stdout = $process.StandardOutput.ReadToEndAsync()
    $run.stderr = $process.StandardError.ReadToEndAsync()
    return $run
}

function Read-Stream($Task) {
    Assert-That ($null -ne $Task -and $Task.Wait(2000)) 'An owned output stream did not close.'
    return [string]$Task.Result
}

function Save-RunLogs($Run) {
    foreach ($name in @('stdout', 'stderr')) {
        $text = Read-Stream $Run[$name]
        if ($text.Length -gt 32768) { $text = $text.Substring(0, 32768) + [Environment]::NewLine + '[truncated]' }
        [IO.File]::WriteAllText((Join-Path $Run.directory ($name + '.log')), $text, $Utf8)
    }
}

function Get-ChildEntry([string]$Directory, [string]$Kind, [int]$Index = 0) {
    $records = @(Read-Records $Directory | Where-Object { $_.kind -eq $Kind })
    if ($records.Count -le $Index) { return $null }
    $record = $records[$Index]
    $matches = @($Owned | Where-Object {
        $_.process_id -eq $record.pid -and $null -ne $_.birth_ms -and
        $_.birth_ms -ge ($record.startedAfter - 50) -and $_.birth_ms -le ($record.recordedAt + 50)
    })
    if ($matches.Count -eq 1) { return $matches[0] }
    return $null
}

# Run the exact reviewed driver on another runspace thread. Its script scope,
# variables and functions remain isolated while this thread keeps sampling the
# same Job. There is no second PowerShell process or its extra console host.
function Start-ExistingSmokeRunspace {
    $directory = Join-Path $ArtifactRoot 'existing-smoke'
    Assert-That (-not (Test-Path -LiteralPath $directory)) 'The runspace evidence directory already exists.'
    [void][IO.Directory]::CreateDirectory($directory)
    $script:DriverRun = @{
        runspace = $null; shell = $null; invocation = $null; stop = $null
        environment = @{}; original_console_error = $null; console_writer = $null
        directory = $directory; disposed = $false; end_called = $false
    }
    $Result['driver_runspace'] = [ordered]@{
        host_process_id = $Self.Id; script_sha256 = $AcceptedDriverHash
        invocation_state = 'NotStarted'; cancellation_requested = $false
        environment_restored = $false; console_error_restored = $false; disposed = $false
        stdout_path = (Join-Path $directory 'stdout.log')
        stderr_path = (Join-Path $directory 'stderr.log')
        pipeline_errors_path = (Join-Path $directory 'pipeline-errors.log')
    }
    $environment = @{
        NODE_OPTIONS = ('--max-old-space-size=' + $NodeHeapMiB + ' --import=' + $ControllerObserverUri)
        SCOTTY_SMOKE_SERVE_ENTRY = $ServeEntry; SCOTTY_SMOKE_HEARTBEAT = $HeartbeatFile
        BMUS_TRAY = '1'; BMUS_SERVE_CMD = ''; PORT = [string]$Port; HOST = '127.0.0.1'
        XDG_CONFIG_HOME = $directory; TEMP = $TempDirectory; TMP = $TempDirectory
    }
    if ($BeadBin) { $environment.BEAD_BIN = $BeadBin }
    foreach ($name in $environment.Keys) {
        $DriverRun.environment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
        [Environment]::SetEnvironmentVariable($name, [string]$environment[$name], 'Process')
    }
    # The unchanged driver writes its evidence path through Console.Error.
    # Capture it in the same per-driver stderr log without touching child pipes.
    $DriverRun.original_console_error = [Console]::Error
    $DriverRun.console_writer = [IO.StreamWriter]::new($Result.driver_runspace.stderr_path, $false, $Utf8)
    $DriverRun.console_writer.AutoFlush = $true
    [Console]::SetError([IO.TextWriter]::Synchronized($DriverRun.console_writer))
    $state = [Management.Automation.Runspaces.InitialSessionState]::CreateDefault2()
    $DriverRun.runspace = [Management.Automation.Runspaces.RunspaceFactory]::CreateRunspace($state)
    $DriverRun.runspace.ThreadOptions = [Management.Automation.Runspaces.PSThreadOptions]::ReuseThread
    $DriverRun.runspace.ApartmentState = [Threading.ApartmentState]::MTA
    $DriverRun.runspace.Open()
    [void]$DriverRun.runspace.SessionStateProxy.Path.SetLocation($RepositoryPath)
    $DriverRun.shell = [Management.Automation.PowerShell]::Create()
    $DriverRun.shell.Runspace = $DriverRun.runspace
    [void]$DriverRun.shell.AddCommand($DriverCopyPath)
    [void]$DriverRun.shell.AddParameter('RepositoryPath', $RepositoryPath)
    [void]$DriverRun.shell.AddParameter('NodePath', $NodePath)
    [void]$DriverRun.shell.AddParameter('Port', $Port)
    if ($BeadBin) { [void]$DriverRun.shell.AddParameter('BeadBin', $BeadBin) }
    Check-Budget
    Assert-LaunchHeadroom
    $DriverRun.invocation = $DriverRun.shell.BeginInvoke()
    $Result.driver_runspace.invocation_state = 'Running'
}

function Request-ExistingSmokeStop {
    if ($null -eq $DriverRun -or $DriverRun.disposed -or $null -eq $DriverRun.invocation -or $DriverRun.invocation.IsCompleted) { return }
    $Result.driver_runspace.cancellation_requested = $true
    try { $DriverRun.stop = $DriverRun.shell.BeginStop($null, $null) }
    catch { if (-not $DriverRun.invocation.IsCompleted) { $CleanupErrors.Add('Could not request smoke runspace cancellation: ' + $_.Exception.Message) } }
}

function Complete-ExistingSmokeRunspace {
    param([switch]$Cleanup)
    if ($null -eq $DriverRun -or $DriverRun.disposed) { return }
    if ($null -ne $DriverRun.invocation -and -not $DriverRun.invocation.IsCompleted) {
        Assert-That $Cleanup 'The real smoke driver has not completed.'
        $stopDeadline = [DateTime]::UtcNow.AddSeconds(3)
        while (-not $DriverRun.invocation.IsCompleted -and [DateTime]::UtcNow -lt $stopDeadline -and [DateTime]::UtcNow -lt $HardDeadline.AddSeconds(-3)) {
            $null = Measure-OwnedJob -Cleanup
            Start-Sleep -Milliseconds 50
        }
        if (-not $DriverRun.invocation.IsCompleted) {
            $CleanupErrors.Add('The smoke runspace did not stop within its cleanup allowance; the hard Job deadline remains armed.')
            return
        }
    }
    $output = @(); $endError = $null; $state = 'NotStarted'
    try {
        if ($null -ne $DriverRun.invocation -and -not $DriverRun.end_called) {
            $DriverRun.end_called = $true
            try { $output = @($DriverRun.shell.EndInvoke($DriverRun.invocation)) }
            catch { $endError = $_.Exception.Message }
        }
        if ($null -ne $DriverRun.shell) {
            $state = [string]$DriverRun.shell.InvocationStateInfo.State
            $Result.driver_runspace.invocation_state = $state
            $Result.driver_runspace.had_errors = $DriverRun.shell.HadErrors
            $errors = @($DriverRun.shell.Streams.Error | ForEach-Object { [string]$_ }) -join [Environment]::NewLine
            if ($errors.Length -gt 32768) { $errors = $errors.Substring(0, 32768) + [Environment]::NewLine + '[truncated]' }
            [IO.File]::WriteAllText($Result.driver_runspace.pipeline_errors_path, $errors, $Utf8)
        }
        if ($null -ne $DriverRun.stop) {
            if ($DriverRun.stop.IsCompleted) { $DriverRun.shell.EndStop($DriverRun.stop) }
            else { $CleanupErrors.Add('Smoke runspace stop callback did not complete; the hard Job deadline remains armed.'); return }
        }
        $stdout = @($output | ForEach-Object { [string]$_ }) -join [Environment]::NewLine
        Assert-That ($stdout.Length -le 32768) 'The real smoke result exceeded its output bound.'
        [IO.File]::WriteAllText($Result.driver_runspace.stdout_path, $stdout, $Utf8)
    } finally {
        # EndInvoke is observed before disposing the runspace or restoring any
        # process-wide state. A still-running invocation keeps the hard timer.
        if ($null -eq $DriverRun.invocation -or ($DriverRun.invocation.IsCompleted -and ($null -eq $DriverRun.stop -or $DriverRun.stop.IsCompleted))) {
            $releaseErrors = [Collections.Generic.List[string]]::new()
            try {
                if ($null -ne $DriverRun.shell) { $DriverRun.shell.Dispose() }
                if ($null -ne $DriverRun.runspace) { $DriverRun.runspace.Dispose() }
                $DriverRun.disposed = $true; $Result.driver_runspace.disposed = $true
            } catch {
                $releaseErrors.Add('Smoke runspace disposal failed: ' + $_.Exception.Message)
            } finally {
                if ($null -ne $DriverRun.original_console_error) {
                    try {
                        [Console]::SetError($DriverRun.original_console_error)
                        $Result.driver_runspace.console_error_restored = $true
                    } catch { $releaseErrors.Add('Console error restoration failed: ' + $_.Exception.Message) }
                }
                try { if ($null -ne $DriverRun.console_writer) { $DriverRun.console_writer.Dispose() } }
                catch { $releaseErrors.Add('Smoke error log closure failed: ' + $_.Exception.Message) }
                $environmentRestored = $true
                foreach ($name in $DriverRun.environment.Keys) {
                    try {
                        [Environment]::SetEnvironmentVariable($name, $DriverRun.environment[$name], 'Process')
                        Assert-That ([Environment]::GetEnvironmentVariable($name, 'Process') -ceq $DriverRun.environment[$name]) ('Process environment restoration differs: ' + $name)
                    } catch {
                        $environmentRestored = $false
                        $releaseErrors.Add('Process environment restoration failed for ' + $name + ': ' + $_.Exception.Message)
                    }
                }
                $Result.driver_runspace.environment_restored = $environmentRestored
            }
            Assert-That ($releaseErrors.Count -eq 0) ($releaseErrors -join '; ')
        }
    }
    if ($endError) {
        $Result.driver_runspace['invocation_error'] = $endError.Substring(0, [Math]::Min(2048, $endError.Length))
        if (-not $Cleanup) { throw ('The repository real Forms smoke failed: ' + $Result.driver_runspace.invocation_error) }
    }
    if (-not $Cleanup) {
        Assert-That ($state -eq 'Completed' -and -not $Result.driver_runspace.cancellation_requested) 'The real smoke driver did not complete normally.'
        # Its exact source has no exit statement: a terminating failure throws
        # from EndInvoke. Expected silent lookup races can set HadErrors, so
        # preserve ordinary -File semantics and require the complete pass JSON.
        return ($stdout | ConvertFrom-Json)
    }
}

try {
    $Self.PriorityClass = [Diagnostics.ProcessPriorityClass]::BelowNormal
    $RepositoryPath = (Resolve-Path -LiteralPath $RepositoryPath).Path
    $NodePath = (Get-Command $NodePath -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
    $ServeEntry = Join-Path $RepositoryPath 'scripts\serve.mjs'
    $HostEntry = Join-Path $RepositoryPath 'bin\windows-tray-host.mjs'
    $ExistingSmoke = Join-Path $RepositoryPath 'scripts\test-windows-tray-smoke.ps1'
    $ExistingObserver = Join-Path $RepositoryPath 'scripts\fixtures\windows-tray-observer.mjs'
    $files = @('bin\server-controller.mjs', 'bin\windows-tray.mjs', 'bin\windows-tray.ps1',
        'scripts\serve.mjs', 'scripts\test-windows-tray-smoke.ps1',
        'scripts\fixtures\windows-tray-observer.mjs', 'scripts\fixtures\windows-tray-click.ps1', 'bin\windows-tray-host.mjs',
        '.next\BUILD_ID', 'node_modules\next\package.json')
    foreach ($file in $files) { Assert-That ([IO.File]::Exists((Join-Path $RepositoryPath $file))) ('Missing required runtime file: ' + $file) }
    $explorers = @(Get-Process -Name explorer -ErrorAction SilentlyContinue | Where-Object { $_.SessionId -eq $SessionId })
    Assert-That ([Environment]::UserInteractive -and $SessionId -gt 0 -and $explorers.Count -gt 0) 'Run in the existing interactive Explorer session; no session switch will be attempted.'
    $Result['explorer_process_ids'] = @($explorers | ForEach-Object { $_.Id })
    foreach ($explorer in $explorers) { $explorer.Dispose() }
    $Result['next_version'] = ([IO.File]::ReadAllText((Join-Path $RepositoryPath 'node_modules\next\package.json')) | ConvertFrom-Json).version
    $Result['build_id'] = [IO.File]::ReadAllText((Join-Path $RepositoryPath '.next\BUILD_ID')).Trim()
    $Result['source_sha256'] = @{}
    foreach ($file in $files[0..7]) { $Result.source_sha256[$file] = (Get-FileHash -LiteralPath (Join-Path $RepositoryPath $file) -Algorithm SHA256).Hash.ToLowerInvariant() }
    foreach ($file in $AcceptedTrayHashes.Keys) { Assert-That ($Result.source_sha256[$file] -ceq $AcceptedTrayHashes[$file]) ('Accepted tray module differs: ' + $file) }
    Assert-That (Test-PortFree) 'The selected loopback port is already occupied; no existing listener will be touched.'
    $EvidenceDirectory = Get-SafeLocalPath $EvidenceDirectory
    Assert-That (-not (Test-Path -LiteralPath $EvidenceDirectory)) 'EvidenceDirectory must be a new task-owned path.'
    [void][IO.Directory]::CreateDirectory($EvidenceDirectory)
    $ArtifactRoot = $EvidenceDirectory
    $ResultPath = Join-Path $ArtifactRoot 'result.json'
    $Result['evidence_directory'] = $ArtifactRoot
    # This invocation is a dedicated process. Its Job reclaims descendants if
    # the outer process is interrupted before its normal ownership cleanup.
    $jobHelper = Join-Path $PSScriptRoot 'windows-task-job.ps1'
    Assert-That ((Get-FileHash -LiteralPath $jobHelper -Algorithm SHA256).Hash.ToLowerInvariant() -eq $JobHash) 'The sibling process-containment helper differs from the reviewed bytes.'
    . $jobHelper
    Enter-ScottyTaskJob
    Initialize-OwnedJob
    $Result['job_helper_sha256'] = $JobHash
    # Keep the reviewed driver unchanged while using the host's local-zone
    # execution location. Its repository argument still selects the real app.
    $driverRoot = Get-SafeLocalPath (Join-Path (Get-SafeLocalPath $env:LOCALAPPDATA) 'bead-edit-20261111')
    [void][IO.Directory]::CreateDirectory($driverRoot)
    $driverDirectory = Join-Path $driverRoot ('tray-driver-' + [Guid]::NewGuid().ToString('N'))
    Assert-That (-not (Test-Path -LiteralPath $driverDirectory)) 'The proposed driver copy directory already exists.'
    [void][IO.Directory]::CreateDirectory($driverDirectory)
    $DriverCopyDirectory = $driverDirectory
    $DriverCopyPath = Join-Path $DriverCopyDirectory 'test-windows-tray-smoke.ps1'
    [IO.File]::Copy($ExistingSmoke, $DriverCopyPath, $false)
    $driverHash = (Get-FileHash -LiteralPath $DriverCopyPath -Algorithm SHA256).Hash.ToLowerInvariant()
    Assert-That ($driverHash -eq $Result.source_sha256['scripts\test-windows-tray-smoke.ps1']) 'The local execution copy differs from the repository smoke driver.'
    Assert-That ($driverHash -ceq $AcceptedDriverHash) 'The smoke driver differs from the independently reviewed exact source.'
    $Result['driver_copy'] = @{ source = $ExistingSmoke; executed = $DriverCopyPath; sha256 = $driverHash; removed = $false }
    $TempDirectory = Join-Path $ArtifactRoot 'temp'
    [void][IO.Directory]::CreateDirectory($TempDirectory)
    $HeartbeatFile = Join-Path $ArtifactRoot 'owner-heartbeat'
    [IO.File]::WriteAllText($HeartbeatFile, 'owned', $Utf8)
    $ControllerObserver = Join-Path $ArtifactRoot 'controller-observer.mjs'
    [IO.File]::WriteAllText($ControllerObserver, @'
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
// Contain console windows at the external smoke boundary, including Next.
const spawn = childProcess.spawn;
childProcess.spawn = (command, args, options = {}) => spawn(command, args, { ...options, windowsHide: true });
syncBuiltinESMExports();
// If the outer invocation dies, its owned Node processes request shutdown
// after 15 seconds without a heartbeat; the helper sees parent/pipe loss.
const lease = setInterval(() => {
  let age = Infinity;
  try { age = Date.now() - fs.statSync(process.env.SCOTTY_SMOKE_HEARTBEAT).mtimeMs; } catch {}
  if (age < 15000) return;
  clearInterval(lease);
  if (process.listenerCount('SIGTERM')) process.emit('SIGTERM');
  else process.exit(1);
}, 1000);
lease.unref();
const entry = process.env.SCOTTY_SMOKE_SERVE_ENTRY;
const root = process.env.SCOTTY_TRAY_SMOKE_DIR;
if (root && entry && process.argv[1] && path.resolve(process.argv[1]).toLowerCase() === path.resolve(entry).toLowerCase()) {
  const recordedAt = Date.now();
  const record = { kind: 'controller', pid: process.pid, parentPid: process.ppid,
    command: process.execPath, startedAfter: recordedAt - process.uptime() * 1000 - 250, recordedAt };
  const temporary = path.join(root, 'controller.json.tmp');
  fs.writeFileSync(temporary, JSON.stringify(record));
  fs.renameSync(temporary, path.join(root, 'controller.json'));
  const freeBytes = os.freemem();
  fs.writeFileSync(path.join(root, 'memory-start.json'), JSON.stringify({ freeBytes, minimumBytes: 3 * 1024 ** 3, checkedAt: Date.now() }));
  if (freeBytes < 3 * 1024 ** 3) throw new Error('App launch postponed: less than 3 GiB free physical memory.');
}
'@, $Utf8)
    $ControllerObserverUri = ([Uri]$ControllerObserver).AbsoluteUri

    # Reuse the unchanged real Forms smoke in an isolated runspace while this
    # process retains the independent Job sampler and hard deadline.
    Start-ExistingSmokeRunspace
    Wait-Until { $DriverRun.invocation.IsCompleted } 'The existing real Forms smoke did not finish.' $TimeoutSeconds
    Observe-Processes
    $existing = Complete-ExistingSmokeRunspace
    Assert-That ($existing.result -eq 'pass' -and @($existing.cases).Count -eq 2) 'The repository smoke did not report both cases.'
    foreach ($case in $existing.cases) {
        $caseDirectory = Join-Path ([string]$existing.evidenceDirectory) ([string]$case.action)
        foreach ($childId in @($case.controllerPid, $case.hostPid, $case.trayPid, $case.serverPid)) {
            $matches = @($Owned | Where-Object { $_.process_id -eq $childId -and $_.directory -eq $caseDirectory })
            Assert-That ($matches.Count -eq 1 -and $matches[0].session_id -eq $SessionId -and $matches[0].process.HasExited) 'A smoke process lacks verified session/exit evidence.'
        }
        $memory = [IO.File]::ReadAllText((Join-Path $caseDirectory 'memory-start.json'), $Utf8) | ConvertFrom-Json
        Assert-That ($memory.minimumBytes -eq 3GB -and $memory.freeBytes -ge 3GB) 'A real controller lacks passing launch headroom evidence.'
        $case | Add-Member -NotePropertyName memory_start -NotePropertyValue $memory
        $Cases.Add($case)
    }
    Assert-That (Test-PortFree) 'The first smoke left its port occupied.'

    # Trigger code75 inside the actual Next child after HTTP readiness. The
    # normal controller, helper, click fixture and replacement child still run.
    $restartDirectory = Join-Path $ArtifactRoot 'restart'
    [void][IO.Directory]::CreateDirectory($restartDirectory)
    $RestartWatcher = Join-Path $ArtifactRoot 'restart-watcher.mjs'
    [IO.File]::WriteAllText($RestartWatcher, @'
import fs from 'node:fs';
import path from 'node:path';
const root = process.env.SCOTTY_TRAY_SMOKE_DIR;
const trigger = path.join(root, 'request-restart');
const timer = setInterval(() => {
  if (!fs.existsSync(trigger)) return;
  fs.unlinkSync(trigger);
  fs.writeFileSync(path.join(root, 'restart-receipt.json'), JSON.stringify({ pid: process.pid, exitCode: 75 }));
  process.exit(75);
}, 150);
timer.unref();
'@, $Utf8)
    $RestartObserver = Join-Path $ArtifactRoot 'restart-observer.mjs'
    [IO.File]::WriteAllText($RestartObserver, @'
import childProcess from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { syncBuiltinESMExports } from 'node:module';
const originalSpawn = childProcess.spawn;
childProcess.spawn = (command, args = [], options = {}) => {
  const server = command.toLowerCase() === process.execPath.toLowerCase() && args[1] === 'start';
  const actual = server ? ['--import', pathToFileURL(process.env.SCOTTY_SMOKE_RESTART_WATCHER).href, ...args] : args;
  return originalSpawn(command, actual, options);
};
syncBuiltinESMExports();
await import(pathToFileURL(process.env.SCOTTY_SMOKE_EXISTING_OBSERVER).href);
'@, $Utf8)
    $restart = Start-Headless $NodePath @('--import', ([Uri]$RestartObserver).AbsoluteUri, $ServeEntry) 'controller' $restartDirectory @{
        SCOTTY_TRAY_SMOKE_DIR = $restartDirectory; SCOTTY_TRAY_SMOKE_ACTION = 'exit'
        SCOTTY_SMOKE_RESTART_WATCHER = $RestartWatcher; SCOTTY_SMOKE_EXISTING_OBSERVER = $ExistingObserver
    }
    Wait-Until {
        if ($restart.process.HasExited) { throw 'The restart controller exited during startup.' }
        $null -ne (Get-ChildEntry $restartDirectory 'tray-host') -and $null -ne (Get-ChildEntry $restartDirectory 'tray') -and $null -ne (Get-ChildEntry $restartDirectory 'server')
    } 'The restart case did not start one helper and server.'
    $tray = Get-ChildEntry $restartDirectory 'tray'
    $trayHost = Get-ChildEntry $restartDirectory 'tray-host'
    $first = Get-ChildEntry $restartDirectory 'server'
    $restartCache = Get-TrayCacheEvidence $restartDirectory
    Wait-Until {
        try { (Invoke-WebRequest -UseBasicParsing -Uri ("http://127.0.0.1:" + $Port) -TimeoutSec 2).StatusCode -eq 200 }
        catch { $false }
    } 'The first real server did not become ready.'
    Assert-OwnedListener $first.process_id
    [IO.File]::WriteAllText((Join-Path $restartDirectory 'request-restart'), '', $Utf8)
    Wait-Until {
        if ($restart.process.HasExited) { throw 'The controller exited instead of restarting.' }
        $first.process.HasExited -and $null -ne (Get-ChildEntry $restartDirectory 'server' 1)
    } 'Code75 did not replace the real server.'
    $second = Get-ChildEntry $restartDirectory 'server' 1
    $receipt = [IO.File]::ReadAllText((Join-Path $restartDirectory 'restart-receipt.json')) | ConvertFrom-Json
    Assert-That ($first.process.ExitCode -eq 75 -and $receipt.pid -eq $first.process_id) 'The first server did not exit with the requested code75.'
    Assert-That (-not $tray.process.HasExited -and -not $trayHost.process.HasExited) 'The tray host or helper was lost during restart.'
    Assert-That (@(Read-Records $restartDirectory | Where-Object { $_.kind -eq 'tray-host' }).Count -eq 1) 'Restart created another tray host.'
    Assert-That (@(Read-Records $restartDirectory | Where-Object { $_.kind -eq 'tray' }).Count -eq 1) 'Restart created another tray helper.'
    Assert-That (@(Read-Records $restartDirectory | Where-Object { $_.kind -eq 'server' }).Count -eq 2) 'Restart created an unexpected server count.'
    Wait-Until {
        try { (Invoke-WebRequest -UseBasicParsing -Uri ("http://127.0.0.1:" + $Port) -TimeoutSec 2).StatusCode -eq 200 }
        catch { $false }
    } 'The replacement real server did not become ready.'
    Assert-OwnedListener $second.process_id
    [IO.File]::WriteAllText((Join-Path $restartDirectory 'click-exit'), '', $Utf8)
    Wait-Until { $restart.process.HasExited } 'Exit after restart did not stop the controller.' 15
    Assert-That ($restart.process.ExitCode -eq 0 -and $second.process.HasExited -and $tray.process.HasExited -and $trayHost.process.HasExited) 'Exit after restart left an owned child alive or failed.'
    $icon = [IO.File]::ReadAllText((Join-Path $restartDirectory 'icon-receipt.json')) | ConvertFrom-Json
    Assert-That ($icon.iconVisible -and $icon.clicked -and $icon.disposed -and $icon.menuText -eq 'Exit') 'The real icon/menu lifecycle failed after restart.'
    Assert-That (Test-PortFree) 'Exit after restart left the owned port occupied.'
    Wait-Until {
        -not [IO.Directory]::Exists([IO.Path]::GetDirectoryName($restartCache.helper_script)) -and
            -not [IO.Directory]::Exists([IO.Path]::GetDirectoryName($restartCache.executed_script))
    } 'Exit after restart left an owned helper or click-fixture cache.' 10
    $restartCache['removed'] = $true
    $restartMemory = [IO.File]::ReadAllText((Join-Path $restartDirectory 'memory-start.json'), $Utf8) | ConvertFrom-Json
    Assert-That ($restartMemory.minimumBytes -eq 3GB -and $restartMemory.freeBytes -ge 3GB) 'Restart controller lacks passing launch headroom evidence.'
    $Cases.Add(@{ action = 'restart75-exit'; result = 'pass'; controllerPid = $restart.process.Id
        trayPid = $tray.process_id; hostPid = $trayHost.process_id; serverPids = @($first.process_id, $second.process_id)
        firstExitCode = 75; helperCount = 1; icon = $icon; port = $Port; cache = $restartCache; memory_start = $restartMemory })
    Save-RunLogs $restart
    $Result.status = 'passed'
} catch {
    $message = $_.Exception.Message
    $Result['error'] = $message.Substring(0, [Math]::Min(2048, $message.Length))
} finally {
    try { Request-ExistingSmokeStop } catch { $CleanupErrors.Add($_.Exception.Message) }
    try { Complete-OwnedJob } catch { $CleanupErrors.Add($_.Exception.Message) }
    try { Complete-ExistingSmokeRunspace -Cleanup } catch { $CleanupErrors.Add($_.Exception.Message) }
    try { Observe-Processes } catch { $CleanupErrors.Add($_.Exception.Message) }
    foreach ($entry in $Owned) {
        try { Assert-That ($entry.process.HasExited) 'An observed owned process survived cleanup.'; $entry.exit_code = $entry.process.ExitCode }
        catch { $CleanupErrors.Add($_.Exception.Message) }
    }
    foreach ($run in $Runs) {
        try { Save-RunLogs $run } catch { $CleanupErrors.Add($_.Exception.Message) }
    }
    if ($DriverCopyDirectory -and ($null -eq $DriverRun -or $DriverRun.disposed)) {
        try {
            if ($DriverCopyPath -and [IO.File]::Exists($DriverCopyPath)) { [IO.File]::Delete($DriverCopyPath) }
            if ([IO.Directory]::Exists($DriverCopyDirectory)) { [IO.Directory]::Delete($DriverCopyDirectory, $false) }
            if ($Result.Contains('driver_copy')) { $Result.driver_copy.removed = $true }
        } catch { $CleanupErrors.Add('Owned local driver cleanup: ' + $_.Exception.Message) }
    }
    try { if ($ArtifactRoot) {
        foreach ($file in [IO.Directory]::GetFiles($ArtifactRoot, 'processes.jsonl', [IO.SearchOption]::AllDirectories)) {
            $text = [IO.File]::ReadAllText($file, $Utf8)
            if ($text.Length -gt 0 -and -not $text.EndsWith([string][char]10)) { $CleanupErrors.Add('Incomplete ownership record after process exit: ' + $file) }
        }
        if (-not (Test-PortFree)) { $CleanupErrors.Add('The selected port is occupied after owned process cleanup; no unrelated listener was touched.') }
    } } catch { $CleanupErrors.Add($_.Exception.Message) }
    $Result['processes'] = @($Owned | ForEach-Object {
        @{ kind = $_.kind; process_id = $_.process_id; started_utc = $_.started_utc
           session_id = $_.session_id; priority = $_.priority; exit_code = $_.exit_code }
    })
    Save-JobEvidence
    $Result['measurements'] = $Measurements
    foreach ($message in $ObservationErrors) { $CleanupErrors.Add($message) }
    $Result['cleanup_errors'] = @($CleanupErrors | Select-Object -First 12)
    if ($CleanupErrors.Count -gt 0) { $Result.status = 'failed'; $Result.cleanup = 'failed' }
    else { $Result.cleanup = 'all_owned_processes_exited' }
    foreach ($entry in $Owned) { $entry.process.Dispose() }
    foreach ($entry in $JobOwned) { $entry.process.Dispose() }
    try { $Self.PriorityClass = $OriginalPriority } catch { }
    $Self.Dispose()
    $Result['completed_utc'] = [DateTime]::UtcNow.ToString('o')
    $Result['elapsed_seconds'] = [Math]::Round(([DateTime]::UtcNow - $Started).TotalSeconds, 3)
    $json = ConvertTo-Json -InputObject $Result -Depth 12
    if ($ResultPath) {
        try { [IO.File]::WriteAllText($ResultPath, $json, $Utf8) }
        catch {
            $Result.status = 'failed'
            $Result['evidence_write_error'] = $_.Exception.Message
            $json = ConvertTo-Json -InputObject $Result -Depth 12
        }
    }
    Write-Output $json
    if (('Scotty20261125TrayJobInspector' -as [type]) -and ($null -eq $DriverRun -or $DriverRun.disposed)) {
        [Scotty20261125TrayJobInspector]::FinishDeadline()
    }
}
if ($Result.status -ne 'passed') { exit 1 }
