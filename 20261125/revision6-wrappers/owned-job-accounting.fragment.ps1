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
