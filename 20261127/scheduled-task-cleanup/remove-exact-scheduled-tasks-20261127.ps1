#requires -Version 5.1
# Removes only the fixed twenty completed task registrations after exact XML and idle checks.
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$InputManifest,
    [Parameter(Mandatory=$true)][string]$InputSha256
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
$Utf8=[Text.UTF8Encoding]::new($false,$true)
$XmlEncoding=[Text.UnicodeEncoding]::new($false,$true,$true)
$Clock=[Diagnostics.Stopwatch]::StartNew()
$Self=[Diagnostics.Process]::GetCurrentProcess()
$Self.PriorityClass='BelowNormal'
$InputStreams=[Collections.Generic.List[object]]::new()
$Removed=[Collections.Generic.List[object]]::new()
$Errors=[Collections.Generic.List[string]]::new()
$Output=$null;$Folder=$null;$Service=$null;$GuardStarted=$false
$TaskRoot='F:\Dev\.bead-edit-20261111'
$Coordination=Join-Path $TaskRoot 'coordination-20261124'
$ExpectedOutput=Join-Path $Coordination 'scheduled-task-cleanup-20261127-2889282bfcec'
$BaselinePath=Join-Path $Coordination 'scheduled-task-readback-20261127-v1\result.json'
$BaselineSha='97971b4fb451e6be8839d8ca7e37a8d49f486d1b3b81aaeaf754293d3e7cbd4f'
$ConfiguredName='ChatGPT-BeadEditing-Configured-20261127-2889282bfcec'
$CreationPath=Join-Path $TaskRoot 'configured-task-20261127-2889282bfcec.json'
$ConfiguredResultPath=Join-Path $TaskRoot 'configured-v9-final-20261125-1151\result.json'
$ConfiguredHelperSha='8db39140f935b690af58fc2c604ba7a0566945f7c4ea140d6f98637ead75c5ae'
$OriginalNames=@(
    'ChatGPT-BeadEditing-BrowserFlows-20261124-v1',
    'ChatGPT-BeadEditing-BrowserFlows-20261125-v2',
    'ChatGPT-BeadEditing-DesktopProbe-20261111',
    'ChatGPT-BeadEditing-HelperDiag-20261124-v1',
    'ChatGPT-BeadEditing-HelperDiag-20261124-v2',
    'ChatGPT-BeadEditing-HelperDiag-20261124-v3',
    'ChatGPT-BeadEditing-MaterializeR5-20261125',
    'ChatGPT-BeadEditing-MaterializeR5-20261125-v2',
    'ChatGPT-BeadEditing-NativeSmoke-20261111',
    'ChatGPT-BeadEditing-NativeSmokeV2-20261111',
    'ChatGPT-BeadEditing-NativeSmokeV3-20261111',
    'ChatGPT-BeadEditing-RecordCheckpointFoundation-20261125',
    'ChatGPT-BeadEditing-RecordCheckpointGreenBuild-20261125',
    'ChatGPT-BeadEditing-TrayIdentityWait-20261125-v1',
    'ChatGPT-BeadEditing-TrayRepair-20261125-v1',
    'ChatGPT-BeadEditing-TraySmoke-20261111',
    'ChatGPT-BeadEditing-TraySmokeV2-20261111',
    'ChatGPT-BeadEditing-TrayHost-20261127-2889282bfcec',
    'ChatGPT-BeadEditing-TrayRunspace-20261127-2889282bfcec'
)
$Result=[ordered]@{schema_version=1;status='failed';started_utc=[DateTime]::UtcNow.ToString('o');input_sha256=$InputSha256
    baseline_sha256=$BaselineSha;expected_task_count=20;removed=$Removed;errors=$Errors;replay_allowed=$false
    priority='BelowNormal';baseline_free_required_bytes=1GB;live_free_required_bytes=1GB;max_helper_resident_bytes=256MB
    work_seconds=48;hard_seconds=60;sample_interval_ms=100;process_actions='Current helper only; no task or other process run/stop/kill calls.'}
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
# Hash a complete in-memory byte sequence; XML hashes use the exact UTF-8 text bytes.
function Hash-Bytes([byte[]]$Bytes){
    $sha=[Security.Cryptography.SHA256]::Create()
    try{return [BitConverter]::ToString($sha.ComputeHash($Bytes)).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}
}
# Keep each accepted input open without write/delete sharing until this attempt finishes.
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
# Exclusive durable records preserve partial deletion attempts; existing files never become retry slots.
function Save-Bytes([string]$Path,[byte[]]$Bytes){
    $stream=[IO.File]::Open($Path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
    try{$stream.Write($Bytes,0,$Bytes.Length);$stream.Flush($true)}finally{$stream.Dispose()}
}
function Save-Json([string]$Name,[object]$Value){Save-Bytes (Join-Path $Output $Name) ($Utf8.GetBytes((ConvertTo-Json -InputObject $Value -Depth 8)))}
function Release-Com([object]$Value){if($null -ne $Value -and [Runtime.InteropServices.Marshal]::IsComObject($Value)){[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($Value)}}
function Check-Budget{
    [TaskRegistrationCleanup20261127Guard]::Check()
    Assert-That ($Clock.Elapsed.TotalSeconds -lt 48) 'Work deadline reached; retain the partial attempt.'
}
# Compare every XML code unit and its complete UTF-8 bytes before trusting an exact task registration.
function Check-Task([object]$Expected){
    Check-Budget
    $task=$null;$instances=$null
    try{
        $task=$Folder.GetTask($Expected.name)
        Assert-That ([string]$task.Name -ceq $Expected.name -and [string]$task.Path -ceq $Expected.path) 'Exact task identity changed.'
        $xml=[string]$task.Xml
        Assert-That ([string]::Equals($xml,$Expected.xml,[StringComparison]::Ordinal)) ('Full task XML changed: '+$Expected.name)
        $xmlSha=Hash-Bytes ($Utf8.GetBytes($xml))
        Assert-That ($xmlSha -ceq $Expected.xml_sha256) 'Complete task XML byte hash changed.'
        Assert-That ([int]$task.State -eq 3) ('Task is not ready: '+$Expected.name)
        $instances=$task.GetInstances(0)
        Assert-That ([int]$instances.Count -eq 0 -and [int]$task.State -eq 3) ('Task has running or queued instances: '+$Expected.name)
        Check-Budget
        return @{name=$Expected.name;path=$Expected.path;state=3;running_instances=0;xml_utf8_sha256=$xmlSha;xml_characters=$xml.Length}
    }finally{Release-Com $instances;Release-Com $task}
}
# Only the exact FILE_NOT_FOUND result proves absence; all other COM errors remain failures.
function Require-Absent([string]$Name){
    Check-Budget
    $task=$null;$absent=$false
    try{$task=$Folder.GetTask($Name)}
    catch{if($_.Exception.GetBaseException().HResult -eq -2147024894){$absent=$true}else{throw}}
    finally{Release-Com $task}
    Assert-That $absent ('Task remains registered or was recreated: '+$Name)
    Check-Budget
}
try{
    Assert-That ($InputSha256 -cmatch '^[a-f0-9]{64}$') 'Use the exact reviewed actual request hash.'
    $manifestPin=Read-PinnedJson $InputManifest $InputSha256 32768;$manifest=$manifestPin.value
    Assert-That ($manifest.schema_version -eq 1) 'Unknown cleanup input schema.'
    Assert-That ($manifest.helper_sha256 -cmatch '^[a-f0-9]{64}$' -and (Hash $PSCommandPath)-ceq $manifest.helper_sha256) 'Cleanup helper bytes differ.'
    Assert-That ($manifest.attestations.exclusive_task_registration_window -eq $true -and $manifest.attestations.configured_launch_accepted -eq $true) 'Actual root acceptance and exclusive task-registration window are required.'
    $out=Safe-Path $manifest.output_directory
    Assert-That ($out -ceq $ExpectedOutput -and -not(Test-Path -LiteralPath $out)) 'Cleanup output must be the fresh exact owned directory.'
    $baseline=Read-PinnedJson $BaselinePath $BaselineSha 100788
    Assert-That ($baseline.bytes.Length -eq 100788 -and $baseline.value.status -ceq 'passed') 'Original task-definition baseline differs.'
    $creation=Read-PinnedJson $CreationPath $manifest.configured.creation_sha256 65536
    $definitionPath=Safe-Path $manifest.configured.definition.path
    Assert-That ($definitionPath.StartsWith($Coordination+'\',[StringComparison]::OrdinalIgnoreCase)) 'Configured XML observation must be retained under coordination.'
    $definition=Read-PinnedJson $definitionPath $manifest.configured.definition.sha256 131072
    $configured=Read-PinnedJson $ConfiguredResultPath $manifest.configured.result_sha256 1048576
    $review=Read-PinnedJson $manifest.configured.review.path $manifest.configured.review.sha256 262144
    Assert-That ($review.value.status -ceq 'passed' -or ($review.value.status -ceq 'PASS' -and $review.value.accepted -eq $true)) 'Configured launch lacks an accepted independent review.'
    Assert-That ($configured.value.status -ceq 'passed' -and $configured.value.port_free -eq $true -and @($configured.value.cleanup_errors).Count -eq 0 -and @($configured.value.remaining_job_members).Count -eq 0) 'Configured launch is not accepted with completed cleanup.'
    Assert-That ($configured.value.binary_sha256 -ceq '0431a828bf95038641a0c55b4cf11c5800b52881940a13bd2f56b02f0b27177a' -and $configured.value.build_id -ceq 'YIOHeRJTEdlOszyc4LyHr') 'Configured runtime identity differs.'
    Assert-That ($configured.value.job_measurements.cleanup_assisted -eq $false -and $configured.value.job_measurements.budget_exceeded -eq $false) 'Configured launch needed assisted cleanup or exceeded its budget.'
    $created=$creation.value
    Assert-That ($created.status -ceq 'registered_before_run' -and $created.task -ceq $ConfiguredName -and $created.user -ceq 'DESKTOP-NRIGAJU\YossiMH' -and $created.session_id -eq 1) 'Configured creation receipt differs.'
    Assert-That ($created.registration_flags -eq 2 -and $created.run_flags -eq 4 -and $created.run_level -eq 0 -and $created.priority -eq 7) 'Configured registration contract differs.'
    $helperInput=@($created.inputs|Where-Object{$_.path -ceq (Join-Path $TaskRoot 'final-installation-v9-20261125-1151\windows-configured-launch-host-memory-20261127.ps1')})
    Assert-That ($helperInput.Count -eq 1 -and $helperInput[0].sha256 -ceq $ConfiguredHelperSha) 'Configured creation was not bound to the accepted helper.'
    Assert-That ($definition.value.status -ceq 'passed' -and @($definition.value.tasks).Count -eq 1) 'Expected one accepted configured task definition.'
    $configuredRow=@($definition.value.tasks)[0]
    Assert-That ($configuredRow.name -ceq $ConfiguredName -and $configuredRow.path -ceq ('\'+$ConfiguredName) -and @($configuredRow.actions).Count -eq 1) 'Configured definition identity differs.'
    $action=@($configuredRow.actions)[0]
    Assert-That ($action.type -eq 0 -and $action.path -ceq $created.action_path -and $action.arguments -ceq $created.action_arguments -and $action.working_directory -ceq $created.working_directory) 'Configured definition differs from its accepted creation action.'
    Assert-That ($configuredRow.principal.run_level -eq 0 -and $configuredRow.principal.logon_type -eq 3 -and $configuredRow.settings.priority -eq 7 -and $configuredRow.settings.hidden -eq $true -and $configuredRow.settings.enabled -eq $true -and $configuredRow.settings.execution_time_limit -ceq 'PT2M30S' -and $configuredRow.settings.multiple_instances -eq 2) 'Configured task settings differ.'
    Assert-That (@($baseline.value.tasks).Count -eq 19) 'Expected exactly nineteen original task definitions.'
    $rows=@($baseline.value.tasks)+@($configuredRow);$names=@($OriginalNames)+@($ConfiguredName)
    $expected=[Collections.Generic.List[object]]::new()
    for($i=0;$i -lt $names.Count;$i++){
        $row=$rows[$i]
        Assert-That ($row.name -ceq $names[$i] -and $row.path -ceq ('\'+$names[$i])) 'Original task-definition set/order differs.'
        Assert-That ($row.state -eq 3 -and $row.running_instances -eq 0 -and $row.xml -is [string] -and $row.xml.Length -gt 0 -and $row.xml.Length -le 65536) 'Retained task definition is not a complete idle observation.'
        $expected.Add(@{name=$names[$i];path=('\'+$names[$i]);xml=$row.xml;xml_sha256=(Hash-Bytes ($Utf8.GetBytes($row.xml)))})
    }
    $identity=[Security.Principal.WindowsIdentity]::GetCurrent()
    try{$principal=[Security.Principal.WindowsPrincipal]::new($identity);Assert-That ($principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) 'An elevated root-owned inspection is required to see all task instances.'}finally{$identity.Dispose()}
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
'@
    Assert-That ([TaskRegistrationCleanup20261127Guard]::AvailablePhysical() -ge 1GB) 'Memory fell below 1 GiB before cleanup.'
    Assert-That (-not(Test-Path -LiteralPath $out)) 'Cleanup output appeared during validation.'
    [void](New-Item -Path $out -ItemType Directory -ErrorAction Stop);$Output=$out
    Save-Json 'attempt-started.json' @{status='started';utc=[DateTime]::UtcNow.ToString('o');request_sha256=$InputSha256;helper_sha256=$manifest.helper_sha256;replay_allowed=$false;task_count=20}
    $GuardStarted=$true;[TaskRegistrationCleanup20261127Guard]::Start([int](60000-$Clock.ElapsedMilliseconds),(Join-Path $Output 'guard-interrupted.json'))
    foreach($item in @(@{name='request.json';pin=$manifestPin},@{name='original-definitions.json';pin=$baseline},@{name='configured-creation.json';pin=$creation},@{name='configured-definition.json';pin=$definition},@{name='configured-result.json';pin=$configured},@{name='configured-review.json';pin=$review})){
        Check-Budget;Save-Bytes (Join-Path $Output $item.name) $item.pin.bytes
        Assert-That ((Hash (Join-Path $Output $item.name))-ceq $item.pin.sha256) 'Private raw input copy differs.'
    }
    $Result['retained_inputs']=@(@{path=$BaselinePath;sha256=$BaselineSha},@{path=$CreationPath;sha256=$creation.sha256},@{path=$definition.path;sha256=$definition.sha256},@{path=$ConfiguredResultPath;sha256=$configured.sha256},@{path=$review.path;sha256=$review.sha256})
    $Service=New-Object -ComObject 'Schedule.Service';Check-Budget;$Service.Connect();Check-Budget;$Folder=$Service.GetFolder('\');Check-Budget
    $preflight=[Collections.Generic.List[object]]::new()
    for($i=0;$i -lt $expected.Count;$i++){
        $row=$expected[$i];$record=Check-Task $row
        $backupName=('{0:D2}-{1}.xml' -f ($i+1),$row.name);$backupPath=Join-Path $Output $backupName
        $xmlBytes=[byte[]]($XmlEncoding.GetPreamble()+$XmlEncoding.GetBytes($row.xml));Save-Bytes $backupPath $xmlBytes
        Assert-That ([string]::Equals([IO.File]::ReadAllText($backupPath),$row.xml,[StringComparison]::Ordinal)) 'Private XML backup text differs.'
        $record['backup_file']=$backupName;$record['backup_sha256']=Hash $backupPath;$record['backup_bytes']=$xmlBytes.Length;$record['backup_encoding']='UTF-16LE with BOM'
        $preflight.Add($record)
    }
    Save-Json 'preflight.json' @{status='passed';utc=[DateTime]::UtcNow.ToString('o');tasks=@($preflight);all_definitions_exact=$true;all_ready_and_idle=$true}
    for($i=0;$i -lt $expected.Count;$i++){
        Check-Budget;$row=$expected[$i];$record=$preflight[$i]
        Save-Json ('delete-intended-{0:D2}.json' -f ($i+1)) @{status='intended';task=$row.name;path=$row.path;xml_utf8_sha256=$row.xml_sha256;backup_sha256=$record.backup_sha256;utc=[DateTime]::UtcNow.ToString('o');requires_immediate_xml_and_idle_recheck=$true;replay_allowed=$false}
        $null=Check-Task $row
        [void]$Folder.DeleteTask($row.name,0)
        Save-Json ('delete-returned-{0:D2}.json' -f ($i+1)) @{status='returned_success';task=$row.name;utc=[DateTime]::UtcNow.ToString('o')}
        Require-Absent $row.name
        $deleted=@{name=$row.name;path=$row.path;xml_utf8_sha256=$row.xml_sha256;backup_file=$record.backup_file;backup_sha256=$record.backup_sha256;absent=$true;utc=[DateTime]::UtcNow.ToString('o')}
        Save-Json ('deleted-{0:D2}.json' -f ($i+1)) $deleted;$Removed.Add($deleted)
    }
    foreach($name in $names){Require-Absent $name}
    Assert-That ($Removed.Count -eq 20) 'The exact requested task set was not removed.'
    $Result['all_exact_tasks_absent']=$true;$Result.status='passed'
}catch{
    $Errors.Add(('Failure at script line {0}: {1} (HRESULT {2}). Inspect retained private attempt records.' -f $_.InvocationInfo.ScriptLineNumber,$_.Exception.GetType().FullName,$_.Exception.HResult));$Result.status='failed'
}finally{
    foreach($com in @($Folder,$Service)){try{Release-Com $com}catch{$Errors.Add('COM release failed: '+$_.Exception.GetType().FullName);$Result.status='failed'}}
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
