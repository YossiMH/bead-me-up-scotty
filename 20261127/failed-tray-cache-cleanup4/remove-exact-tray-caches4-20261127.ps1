#requires -Version 5.1
# One-shot removal of four exactly observed failed-run tray cache files and their empty directories.
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$InputManifest,
    [Parameter(Mandatory=$true)][string]$InputSha256
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
$Utf8=[Text.UTF8Encoding]::new($false,$true)
$Clock=[Diagnostics.Stopwatch]::StartNew()
$Self=[Diagnostics.Process]::GetCurrentProcess()
$Self.PriorityClass='BelowNormal'
$InputStreams=[Collections.Generic.List[object]]::new()
$Removed=[Collections.Generic.List[object]]::new()
$Errors=[Collections.Generic.List[string]]::new()
$Owners=[Collections.Generic.List[object]]::new()
$Output=$null;$GuardStarted=$false
$TaskRoot='F:\Dev\.bead-edit-20261111'
$Coordination=Join-Path $TaskRoot 'coordination-20261124'
$ExpectedOutput=Join-Path $Coordination 'failed-tray-cache-cleanup4-20261127-2889282bfcec'
$FailedRuns=@(
    @{name='old-tray-host';path=(Join-Path $TaskRoot 'tray-host-check-20261127-2889282bfcec\result.json');bytes=14492;sha256='0974b117a9586541024de04f1d2b4c87db59362dfd37556d57f355dbee815370';owner_count=8},
    @{name='configured-session';path=(Join-Path $TaskRoot 'configured-v9-session-20261127-2889282bfcec\result.json');bytes=11603;sha256='e9ebb93fc64c308a235219b267e7887667cc91587b3061877c026cbae49e3358';owner_count=11}
)
$CacheRoot='C:\Users\YossiMH\AppData\Local\bead-me-up-scotty'
$Caches=@(
    @{run='configured-session';directory=(Join-Path $CacheRoot 'tray\session-EQDYF7');name='windows-tray.ps1';bytes=5042;sha256='fc7249848722f4b3fbff6351523a30be5864082288efcca51bd9212867344923'},
    @{run='configured-session';directory=(Join-Path $CacheRoot 'tray-smoke\session-0KObLb');name='windows-tray-click.ps1';bytes=2405;sha256='4df81d91044d7d615856dc49fc20cee4dff35c4bc4ae81a23b135cbb56d70937'},
    @{run='old-tray-host';directory=(Join-Path $CacheRoot 'tray\session-LEmh0Z');name='windows-tray.ps1';bytes=4921;sha256='46c98de97680cad44f8aa70c643a9538941cc0a0a6f5b4f86b6b2f0eae5716fb'},
    @{run='old-tray-host';directory=(Join-Path $CacheRoot 'tray-smoke\session-cPU56F');name='windows-tray-click.ps1';bytes=2355;sha256='b065d88ba13c4ed4fe4f71ebcb14abaa303fcd98945b9073a84573e3ef691df9'}
)
$Result=[ordered]@{schema_version=1;status='failed';started_utc=[DateTime]::UtcNow.ToString('o');input_sha256=$InputSha256
    expected_cache_count=4;expected_identity_count=19;removed=$Removed;errors=$Errors;replay_allowed=$false
    priority='BelowNormal';baseline_free_required_bytes=1GB;live_free_required_bytes=1GB;max_helper_resident_bytes=256MB
    work_seconds=48;hard_seconds=60;sample_interval_ms=100;process_actions='Read-only handles for the 19 pinned PID/birth identities; the resource timer can exit only this helper.'}
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
function Hash-Bytes([byte[]]$Bytes){
    $sha=[Security.Cryptography.SHA256]::Create()
    try{return [BitConverter]::ToString($sha.ComputeHash($Bytes)).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}
}
function Read-PinnedJson([string]$Path,[string]$Sha256,[int]$MaximumBytes){
    Assert-That ($Sha256 -cmatch '^[a-f0-9]{64}$') 'An actual accepted input hash is required.'
    $full=Safe-Path $Path
    Assert-That ($full.StartsWith($TaskRoot+'\',[StringComparison]::OrdinalIgnoreCase)) 'Input must remain under the owned task root.'
    $stream=[IO.File]::Open($full,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
    $InputStreams.Add($stream)
    Assert-That ($stream.Length -gt 0 -and $stream.Length -le $MaximumBytes) 'Input size is outside its bound.'
    $data=[byte[]]::new([int]$stream.Length);$offset=0
    while($offset -lt $data.Length){$count=$stream.Read($data,$offset,$data.Length-$offset);Assert-That ($count -gt 0) 'Input ended before its recorded length.';$offset+=$count}
    Assert-That ((Hash-Bytes $data)-ceq $Sha256) 'Pinned input bytes changed.'
    $text=$Utf8.GetString($data);if($text.Length -gt 0 -and $text[0] -eq [char]0xfeff){$text=$text.Substring(1)}
    return @{path=$full;sha256=$Sha256;bytes=$data;value=($text|ConvertFrom-Json)}
}
function Save-Bytes([string]$Path,[byte[]]$Bytes){
    $stream=[IO.File]::Open($Path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
    try{$stream.Write($Bytes,0,$Bytes.Length);$stream.Flush($true)}finally{$stream.Dispose()}
}
function Save-Json([string]$Name,[object]$Value){Save-Bytes (Join-Path $Output $Name) ($Utf8.GetBytes((ConvertTo-Json -InputObject $Value -Depth 8)))}
function Check-Budget{
    [TaskRegistrationCleanup20261127Guard]::Check()
    Assert-That ($Clock.Elapsed.TotalSeconds -lt 48) 'Work deadline reached; retain the partial attempt.'
}

# Enumerate only the exact cache directory, stopping as soon as a second entry is found.
function Sole-Entry([string]$Directory,[string]$Name){
    $full=Safe-Path $Directory
    $attributes=[IO.File]::GetAttributes($full)
    Assert-That (($attributes -band [IO.FileAttributes]::Directory)-ne 0 -and ($attributes -band [IO.FileAttributes]::ReparsePoint)-eq 0) 'Expected an ordinary cache directory.'
    $iterator=[IO.Directory]::EnumerateFileSystemEntries($full).GetEnumerator()
    try{
        Assert-That ($iterator.MoveNext()) 'Expected cache file is absent.'
        $entry=[string]$iterator.Current
        Assert-That ([IO.Path]::GetFileName($entry) -ceq $Name) 'Unexpected sole cache entry.'
        Assert-That (-not $iterator.MoveNext()) 'Unexpected additional cache entry.'
    }finally{if($iterator -is [IDisposable]){$iterator.Dispose()}}
    $file=Safe-Path (Join-Path $full $Name)
    $flags=[IO.File]::GetAttributes($file)
    Assert-That (($flags -band ([IO.FileAttributes]::Directory -bor [IO.FileAttributes]::ReparsePoint -bor [IO.FileAttributes]::Device))-eq 0) 'Expected an ordinary cache file.'
    return $file
}
function Read-Cache([object]$Expected){
    Check-Budget
    $file=Sole-Entry $Expected.directory $Expected.name
    $stream=[IO.File]::Open($file,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
    try{
        Assert-That ($stream.Length -eq $Expected.bytes -and $stream.Length -le 8192) 'Exact cache length changed.'
        $data=[byte[]]::new([int]$stream.Length);$offset=0
        while($offset -lt $data.Length){$count=$stream.Read($data,$offset,$data.Length-$offset);Assert-That ($count -gt 0) 'Cache ended before its pinned length.';$offset+=$count}
        Assert-That ($stream.ReadByte() -eq -1 -and (Hash-Bytes $data)-ceq $Expected.sha256) 'Exact cache bytes changed.'
        Assert-That ((Sole-Entry $Expected.directory $Expected.name)-ceq $file) 'Cache path changed during its held read.'
        return @{run=$Expected.run;directory=$Expected.directory;path=$file;name=$Expected.name;length=$data.Length;sha256=$Expected.sha256;bytes=$data}
    }finally{$stream.Dispose()}
}
function Check-Owners{
    Check-Budget
    $observations=[Collections.Generic.List[object]]::new()
    $Result['last_identity_check']=$observations
    foreach($owner in $Owners){
        Check-Budget
        $observation=[TrayCacheIdentity20261127]::Observe([int]$owner.process_id,[long]::Parse($owner.birth_filetime,[Globalization.CultureInfo]::InvariantCulture))
        $record=@{run=$owner.run;process_id=$owner.process_id;expected_birth_filetime=$owner.birth_filetime;observed_birth_filetime=$observation.ObservedBirthFiletime;state=$observation.State;open_error=$observation.OpenError;wait_result=$observation.WaitResult}
        $observations.Add($record)
        Assert-That ($observation.State -ceq 'absent' -or $observation.State -ceq 'reused-pid' -or $observation.State -ceq 'matching-exited') ('A recorded cache owner is still live: '+$owner.process_id)
    }
    Assert-That ($observations.Count -eq 19) 'Expected exactly 19 retained process identities.'
    return ,@($observations)
}
function Require-AbsentPath([string]$Path){
    $absent=$false
    try{$null=[IO.File]::GetAttributes($Path)}
    catch [IO.FileNotFoundException]{$absent=$true}
    catch [IO.DirectoryNotFoundException]{$absent=$true}
    Assert-That $absent ('Expected exact path to be absent: '+$Path)
}
function Require-EmptyDirectory([string]$Directory){
    $full=Safe-Path $Directory;$flags=[IO.File]::GetAttributes($full)
    Assert-That (($flags -band [IO.FileAttributes]::Directory)-ne 0 -and ($flags -band [IO.FileAttributes]::ReparsePoint)-eq 0) 'Expected ordinary empty cache directory.'
    $iterator=[IO.Directory]::EnumerateFileSystemEntries($full).GetEnumerator()
    try{Assert-That (-not $iterator.MoveNext()) 'Cache directory is not empty.'}finally{if($iterator -is [IDisposable]){$iterator.Dispose()}}
}

try{
    Assert-That ($InputSha256 -cmatch '^[a-f0-9]{64}$') 'Use the exact independently reviewed final request hash.'
    $manifestPin=Read-PinnedJson $InputManifest $InputSha256 8192;$manifest=$manifestPin.value
    Assert-That ($manifest.schema_version -eq 1 -and $manifest.helper_sha256 -cmatch '^[a-f0-9]{64}$' -and (Hash $PSCommandPath)-ceq $manifest.helper_sha256) 'Exact cleanup source binding differs.'
    Assert-That ($manifest.exclusive_owned_cache_window -is [bool] -and $manifest.exclusive_owned_cache_window -eq $true) 'Root must establish the exclusive exact-cache window.'
    $out=Safe-Path $manifest.output_directory
    Assert-That ($out -ceq $ExpectedOutput -and -not(Test-Path -LiteralPath $out)) 'Output must be the fresh exact cleanup directory.'
    $pins=[Collections.Generic.List[object]]::new()
    $identityKeys=[Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    foreach($run in $FailedRuns){
        $pin=Read-PinnedJson $run.path $run.sha256 $run.bytes
        Assert-That ($pin.bytes.Length -eq $run.bytes -and $pin.value.status -ceq 'failed' -and $pin.value.error -ceq 'All owned Job members exceeded the aggregate resident-memory budget.') 'Pinned failed-run outcome differs.'
        Assert-That (@($pin.value.remaining_job_members).Count -eq 0 -and $pin.value.job_measurements.cleanup_assisted -eq $true -and $pin.value.job_measurements.budget_exceeded -eq $true) 'Pinned failure lacks completed bounded cleanup.'
        $rows=@($pin.value.job_processes)
        Assert-That ($rows.Count -eq $run.owner_count) 'Retained process-identity count differs.'
        foreach($row in $rows){
            Assert-That (($row.process_id -is [int] -or $row.process_id -is [long]) -and $row.process_id -gt 0 -and $row.process_id -le [int]::MaxValue -and $row.birth_filetime -is [long] -and $row.birth_filetime -gt 0) 'Retained PID/birth identity must have exact integer types.'
            $birth=$row.birth_filetime.ToString([Globalization.CultureInfo]::InvariantCulture)
            Assert-That ($identityKeys.Add(([string]$row.process_id+':'+$birth))) 'Repeated retained process identity.'
            $Owners.Add(@{run=$run.name;process_id=[int]$row.process_id;birth_filetime=$birth})
        }
        $pins.Add(@{name=$run.name;pin=$pin})
    }
    Assert-That ($Owners.Count -eq 19) 'Expected all eight old and eleven Session Job identities.'
    $memory=Get-CimInstance Win32_OperatingSystem -OperationTimeoutSec 5
    Assert-That ([long]$memory.FreePhysicalMemory*1024 -ge 1GB) 'At least 1 GiB free physical RAM is required.'
    $Self.Refresh()
    Assert-That ($Self.WorkingSet64 -le 256MB -and $Clock.Elapsed.TotalSeconds -lt 30) 'Input validation consumed the cleanup budget.'
    Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
// Owns one process handle and a 100 ms timer; a guard failure exits only this helper.
public static class TaskRegistrationCleanup20261127Guard {
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool GlobalMemoryStatusEx(ref Memory status);
    [StructLayout(LayoutKind.Sequential)] struct Memory {
        public uint size,load;public ulong total,available,totalPage,availablePage,totalVirtual,availableVirtual,extended;
    }
    static readonly object gate=new object();
    static Timer timer;static Process self;static Stopwatch clock;static int maximumMilliseconds;static string stopPath;static bool stopped;
    public static long PeakResident;public static ulong MinimumFree;public static int Samples;
    public static ulong AvailablePhysical() {
        Memory data=new Memory();data.size=(uint)Marshal.SizeOf(typeof(Memory));
        if(!GlobalMemoryStatusEx(ref data))throw new Win32Exception(Marshal.GetLastWin32Error());return data.available;
    }
    static int Measure() {
        self.Refresh();long resident=self.WorkingSet64;ulong available=AvailablePhysical();Samples++;
        if(resident>PeakResident)PeakResident=resident;if(Samples==1 || available<MinimumFree)MinimumFree=available;
        if(clock.ElapsedMilliseconds>=maximumMilliseconds)return 124;
        if(available<1073741824UL)return 125;
        if(resident>268435456L)return 126;
        return 0;
    }
    public static void Start(int remainingMilliseconds,string failurePath) {
        if(remainingMilliseconds<1 || timer!=null)throw new InvalidOperationException("Invalid one-shot guard.");
        self=Process.GetCurrentProcess();clock=Stopwatch.StartNew();maximumMilliseconds=remainingMilliseconds;stopPath=failurePath;
        timer=new Timer(delegate(object state) {
            lock(gate) {
                if(stopped)return;
                int code;try{code=Measure();}catch{code=127;}
                if(code==0)return;
                try {
                    string text="{\"status\":\"interrupted\",\"exit_code\":"+code+",\"replay_allowed\":false}";
                    byte[] bytes=new UTF8Encoding(false).GetBytes(text);
                    using(FileStream file=new FileStream(stopPath,FileMode.CreateNew,FileAccess.Write,FileShare.Read)){file.Write(bytes,0,bytes.Length);file.Flush(true);}
                }catch{/* A missing interruption record cannot postpone this helper's hard exit. */}
                Environment.Exit(code);
            }
        },null,100,100);
    }
    public static void Check() {
        lock(gate){if(stopped)throw new InvalidOperationException("Guard already stopped.");int code=Measure();if(code!=0)throw new InvalidOperationException("Cleanup resource/deadline guard: "+code);}
    }
    public static void Stop() {
        lock(gate){stopped=true;if(timer!=null)timer.Dispose();if(self!=null)self.Dispose();}
    }
}

// Query-only process handles; no creation, enumeration, signaling, termination or privilege changes.
public static class TrayCacheIdentity20261127 {
    [DllImport("kernel32.dll",SetLastError=true)] static extern IntPtr OpenProcess(uint access,bool inherit,uint processId);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool GetProcessTimes(IntPtr process, out long creation, out long exit, out long kernel, out long user);
    [DllImport("kernel32.dll", SetLastError=true)] static extern uint GetProcessId(IntPtr process);
    [DllImport("kernel32.dll",SetLastError=true)] static extern uint WaitForSingleObject(IntPtr process,uint milliseconds);
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool CloseHandle(IntPtr handle);
    public sealed class Observation {
        public string ObservedBirthFiletime;
        public string State;
        public int OpenError;
        public uint WaitResult;
    }
    public static long Birth(IntPtr process, int expectedPid) {
        if(GetProcessId(process)!=(uint)expectedPid) throw new InvalidOperationException("Held process handle has a different PID.");
        long creation,exit,kernel,user;
        if(!GetProcessTimes(process,out creation,out exit,out kernel,out user)) throw new Win32Exception(Marshal.GetLastWin32Error());
        return creation;
    }
    public static Observation Observe(int expectedPid,long expectedBirth) {
        if(expectedPid<=0 || expectedBirth<=0)throw new InvalidOperationException("Invalid retained process identity.");
        Observation result=new Observation();
        IntPtr process=OpenProcess(0x00101000U,false,(uint)expectedPid);
        if(process==IntPtr.Zero) {
            int error=Marshal.GetLastWin32Error();
            if(error!=87)throw new Win32Exception(error);
            result.State="absent";result.OpenError=error;return result;
        }
        try {
            long birth=Birth(process,expectedPid);
            result.ObservedBirthFiletime=birth.ToString(System.Globalization.CultureInfo.InvariantCulture);
            if(birth!=expectedBirth){result.State="reused-pid";return result;}
            uint wait=WaitForSingleObject(process,0);
            result.WaitResult=wait;
            if(wait==0){result.State="matching-exited";return result;}
            if(wait==258){result.State="matching-running";return result;}
            if(wait==0xffffffffU)throw new Win32Exception(Marshal.GetLastWin32Error());
            throw new InvalidOperationException("Unexpected read-only process wait result.");
        }finally{if(!CloseHandle(process))throw new Win32Exception(Marshal.GetLastWin32Error());}
    }
}

'@
    Assert-That ([TaskRegistrationCleanup20261127Guard]::AvailablePhysical() -ge 1GB) 'Memory fell below 1 GiB before cleanup.'
    $Self.Refresh();Assert-That ($Self.WorkingSet64 -le 256MB -and $Clock.Elapsed.TotalSeconds -lt 48) 'Guard setup consumed the cleanup budget.'
    Assert-That (-not(Test-Path -LiteralPath $out)) 'Cleanup output appeared during validation.'
    [void](New-Item -Path $out -ItemType Directory -ErrorAction Stop);$Output=$out
    Save-Json 'attempt-started.json' @{status='started';utc=[DateTime]::UtcNow.ToString('o');request_sha256=$InputSha256;helper_sha256=$manifest.helper_sha256;replay_allowed=$false;cache_count=4;identity_count=19}
    $GuardStarted=$true;[TaskRegistrationCleanup20261127Guard]::Start([int](60000-$Clock.ElapsedMilliseconds),(Join-Path $Output 'guard-interrupted.json'))
    Save-Bytes (Join-Path $Output 'request.json') $manifestPin.bytes
    Assert-That ((Hash (Join-Path $Output 'request.json'))-ceq $InputSha256) 'Private request copy differs.'
    foreach($item in $pins){
        Check-Budget;$copy=Join-Path $Output ($item.name+'-result.json');Save-Bytes $copy $item.pin.bytes
        Assert-That ((Hash $copy)-ceq $item.pin.sha256) 'Private failed-run copy differs.'
    }
    $Result['retained_inputs']=@($pins|ForEach-Object{@{run=$_.name;path=$_.pin.path;bytes=$_.pin.bytes.Length;sha256=$_.pin.sha256}})
    $initialOwners=Check-Owners
    Save-Json 'owners-preflight.json' @{status='passed';identities=$initialOwners}
    $preflight=[Collections.Generic.List[object]]::new()
    for($i=0;$i -lt $Caches.Count;$i++){
        $cache=Read-Cache $Caches[$i];$backupName=('{0:D2}-{1}' -f ($i+1),$cache.name)
        Save-Bytes (Join-Path $Output $backupName) $cache.bytes
        Assert-That ((Hash (Join-Path $Output $backupName))-ceq $cache.sha256) 'Private cache backup differs.'
        $preflight.Add(@{run=$cache.run;directory=$cache.directory;path=$cache.path;bytes=$cache.length;sha256=$cache.sha256;backup_file=$backupName})
    }
    Save-Json 'cache-preflight.json' @{status='passed';files=@($preflight);all_four_exact=$true}
    for($i=0;$i -lt $Caches.Count;$i++){
        Check-Budget;$expected=$Caches[$i];$record=$preflight[$i]
        Save-Json ('delete-intended-{0:D2}.json' -f ($i+1)) @{status='intended';path=$record.path;directory=$record.directory;sha256=$record.sha256;bytes=$record.bytes;backup_file=$record.backup_file;replay_allowed=$false}
        $currentOwners=Check-Owners
        Save-Json ('owners-before-{0:D2}.json' -f ($i+1)) @{status='passed';identities=$currentOwners}
        $cache=Read-Cache $expected
        Check-Budget
        [IO.File]::Delete($cache.path)
        Save-Json ('unlink-returned-{0:D2}.json' -f ($i+1)) @{status='returned_success';path=$cache.path;utc=[DateTime]::UtcNow.ToString('o')}
        Require-AbsentPath $cache.path
        Require-EmptyDirectory $cache.directory
        Check-Budget
        [IO.Directory]::Delete($cache.directory,$false)
        Require-AbsentPath $cache.directory
        $deleted=@{run=$cache.run;path=$cache.path;directory=$cache.directory;bytes=$cache.length;sha256=$cache.sha256;backup_file=$record.backup_file;file_absent=$true;directory_absent=$true;utc=[DateTime]::UtcNow.ToString('o')}
        Save-Json ('deleted-{0:D2}.json' -f ($i+1)) $deleted;$Removed.Add($deleted)
    }
    foreach($cache in $Caches){Check-Budget;Require-AbsentPath (Join-Path $cache.directory $cache.name);Require-AbsentPath $cache.directory}
    $finalOwners=Check-Owners;Save-Json 'owners-final.json' @{status='passed';identities=$finalOwners}
    Assert-That ($Removed.Count -eq 4) 'The exact four caches were not removed.'
    $Result['all_exact_cache_files_and_directories_absent']=$true;$Result.status='passed'
}catch{
    $Errors.Add(('Failure at script line {0}: {1} (HRESULT {2}). Inspect retained private attempt records.' -f $_.InvocationInfo.ScriptLineNumber,$_.Exception.GetType().FullName,$_.Exception.HResult));$Result.status='failed'
}finally{
    foreach($stream in $InputStreams){try{$stream.Dispose()}catch{$Errors.Add('Input stream release failed: '+$_.Exception.GetType().FullName);$Result.status='failed'}}
    if($GuardStarted){
        try{[TaskRegistrationCleanup20261127Guard]::Check()}catch{$Errors.Add($_.Exception.Message);$Result.status='failed'}
        $Result['peak_helper_resident_bytes']=[TaskRegistrationCleanup20261127Guard]::PeakResident
        $Result['minimum_free_physical_bytes']=[TaskRegistrationCleanup20261127Guard]::MinimumFree
        $Result['resource_samples']=[TaskRegistrationCleanup20261127Guard]::Samples
    }
    $Result['duration_seconds']=[Math]::Round($Clock.Elapsed.TotalSeconds,3);$Result['finished_utc']=[DateTime]::UtcNow.ToString('o')
    if($Errors.Count -gt 0 -or $Clock.Elapsed.TotalSeconds -ge 60){$Result.status='failed'}
    if($null -ne $Output){try{Save-Json 'result.json' $Result}catch{$Errors.Add('Result persistence failed: '+$_.Exception.GetType().FullName);$Result.status='failed'}}
    $Result|ConvertTo-Json -Depth 8
    if($GuardStarted){[TaskRegistrationCleanup20261127Guard]::Stop()}
    $Self.Dispose()
}
if($Result.status -eq 'passed'){exit 0}else{exit 1}
