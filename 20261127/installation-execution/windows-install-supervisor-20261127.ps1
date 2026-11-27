#requires -Version 5.1
# Run the exact accepted installer once under the existing owned Job limits.
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$JobHelperPath,
    [Parameter(Mandatory=$true)][ValidatePattern('^[0-9a-f]{64}$')][string]$StageResultSha256,
    [Parameter(Mandatory=$true)][ValidatePattern('^[0-9a-f]{64}$')][string]$StageSupervisorResultSha256,
    [Parameter(Mandatory=$true)][ValidateRange(1,65535)][int[]]$ScottyPorts
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue'
$TimeoutSeconds=180;$MaxOwnedResidentMiB=512
$Utf8=[Text.UTF8Encoding]::new($false)
$Self=[Diagnostics.Process]::GetCurrentProcess()
$Clock=[Diagnostics.Stopwatch]::StartNew();$Started=[DateTime]::UtcNow
$ArtifactRoot=$null;$Job=[IntPtr]::Zero;$Child=$null;$PeakResident=0L;$MinimumFree=[uint64]::MaxValue
$Owned=[Collections.Generic.List[object]]::new();$Known=@{}
$CleanupErrors=[Collections.Generic.List[string]]::new()
$StreamEntries=[Collections.Generic.List[object]]::new()
$Result=[ordered]@{schema_version=1;status='failed';phase='installation';started_utc=$Started.ToString('o')
    timeout_seconds=$TimeoutSeconds;work_stop_seconds=($TimeoutSeconds-12);max_total_resident_mib=512
    baseline_free_required_gib=3;live_free_required_gib=1;priority='BelowNormal';sample_interval_ms=100
    cleanup_errors=$CleanupErrors;cleanup_assisted=$false;owned_processes=$Owned;replay_allowed=$false}
function Assert-That([bool]$Value,[string]$Message){if(-not $Value){throw $Message}}
function Hash([string]$Value){return (Get-FileHash -LiteralPath $Value -Algorithm SHA256).Hash.ToLowerInvariant()}
function Task-Path([string]$Value){
    $full=Safe-Path $Value
    Assert-That ($full.StartsWith('F:\Dev\.bead-edit-20261111\',[StringComparison]::OrdinalIgnoreCase)) 'Path leaves the task-owned root.'
    return $full
}
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
    foreach($processId in [Scotty20261125ArchiveInspector]::Members($Job)){
        if($processId -eq $Self.Id){continue}
        $process=$null;$tracked=$false
        try{
            $process=[Diagnostics.Process]::GetProcessById([int]$processId)
            [void]$process.Handle
            if(-not [Scotty20261125ArchiveInspector]::IsMember($process.Handle,$Job)){$process.Dispose();continue}
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
            Assert-That ([Scotty20261125ArchiveInspector]::IsMember($process.Handle,$Job)) 'An owned process left the task Job.'
            $process.Refresh();$value=[long]$process.WorkingSet64;$resident+=$value
            if($value -gt $entry.peak_resident_bytes){$entry.peak_resident_bytes=$value}
        }
    }
    if($resident -gt $script:PeakResident){$script:PeakResident=$resident}
    if(-not $Cleanup){
        Assert-That ($resident -le $MaxOwnedResidentMiB*1MB) 'Aggregate task Job resident memory exceeded the budget.'
        Assert-That ($Clock.Elapsed.TotalSeconds -lt $TimeoutSeconds-12) 'Installation work deadline expired.'
        $free=[Scotty20261125ArchiveInspector]::AvailablePhysical()
        if($free -lt $script:MinimumFree){$script:MinimumFree=$free}
        Assert-That ($free -ge 1GB) 'Free physical RAM fell below the 1 GiB installation requirement.'
        foreach($stream in $StreamEntries){Assert-That ($stream.file.Length -le 8MB) 'A driver output stream exceeded 8 MiB.'}
    }
}
function Stop-Owned{
    Refresh-Owned
    foreach($entry in $Owned){
        try{
            if(-not $entry.process.HasExited){
                Assert-That ([Scotty20261125ArchiveInspector]::IsMember($entry.process.Handle,$Job)) 'Refuse to stop a process outside the task Job.'
                $entry.process.Kill();$entry.killed_by_supervisor=$true;$Result.cleanup_assisted=$true
            }
        }catch{if(-not $entry.process.HasExited){$CleanupErrors.Add($_.Exception.Message)}}
    }
}
try{
    $Self.PriorityClass='BelowNormal'
    $delivery=Task-Path 'F:\Dev\.bead-edit-20261111\final-installation-v9-20261125-1151'
    $stage=Task-Path 'F:\Dev\.bead-edit-20261111\stage-artifacts-v9-final-20261125-1151'
    $install=Task-Path 'F:\Dev\.bead-edit-20261111\install-v9-final-20261125-1151'
    $driver=Task-Path (Join-Path $delivery 'windows-install-tray-host-20261125.ps1')
    $jobHelper=Safe-Path $JobHelperPath
    $siblingJob=Task-Path (Join-Path $delivery 'windows-task-job.ps1')
    $PowerShellPath=Safe-Path (Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe')
    $stageResult=Task-Path (Join-Path $stage 'stage-result.json')
    $stageSupervisorResult=Task-Path (Join-Path ($stage+'.supervisor') 'result.json')
    $preservation=Task-Path (Join-Path $delivery 'pc-preservation-raw.json')
    foreach($file in @($stageResult,$stageSupervisorResult)){Assert-That ((Get-Item -LiteralPath $file).Length -le 1MB) 'Stage result exceeds 1 MiB.'}
    $source=@{scotty='0309539797fd7d016e2b8fd8bdc0ae9cefc20219';backend='2d801ba455b7a722daf644a7615445117d57e8e9'}
    $expected=[ordered]@{
        RuntimeManifest=(Join-Path $stage 'manifests\scotty-runtime.json')
        StageNextDirectory=(Join-Path $stage 'runtime\.next')
        BeadExe=(Join-Path $stage 'native\release\bead-checkpoint-2d801ba455b7.exe')
        BeadSha256='0431a828bf95038641a0c55b4cf11c5800b52881940a13bd2f56b02f0b27177a'
        BeadProvenance=(Join-Path $stage 'native\release\bead-checkpoint-2d801ba455b7.exe.metadata.json')
    }
    $fixedInputs=@(
        @{path=$driver;sha256='3c7e2b5ccbe5d31b32a236d9b336feffa868ffc12bbf8ee2db2e9d9f3ad214c0'},
        @{path=$jobHelper;sha256='2758a6ff94c0eecdfa360363469069dfa8470efc1f91228812146919a978921f'},
        @{path=$siblingJob;sha256='2758a6ff94c0eecdfa360363469069dfa8470efc1f91228812146919a978921f'},
        @{path=$preservation;sha256='70d934585d06c76787e5293a93f7960d6594e869cd719bf0f62ad46a532fa362'},
        @{path=$expected.RuntimeManifest;sha256='612790bc18617630f9257ab2a901f8e12a0cd6dda6bf566c414e646e1745f1c7'},
        @{path=$expected.BeadExe;sha256=$expected.BeadSha256},
        @{path=$expected.BeadProvenance;sha256='21ca90e29fc4588d23b31210cd5ffe6838c136ce70b76458b71370beeeff18f5'},
        @{path=$stageResult;sha256=$StageResultSha256},
        @{path=$stageSupervisorResult;sha256=$StageSupervisorResultSha256}
    )
    foreach($inputFile in $fixedInputs){
        $null=Safe-Path $inputFile.path
        Assert-That ((Hash $inputFile.path) -ceq $inputFile.sha256) ('Accepted installation input changed: '+$inputFile.path)
    }
    Assert-That ($ScottyPorts.Count -gt 0 -and @($ScottyPorts|Sort-Object -Unique).Count -eq $ScottyPorts.Count) 'Supply the unique observed Scotty port inventory.'
    $staged=[IO.File]::ReadAllText($stageResult,$Utf8)|ConvertFrom-Json
    $staging=[IO.File]::ReadAllText($stageSupervisorResult,$Utf8)|ConvertFrom-Json
    Assert-That ($staged.status -ceq 'passed' -and $staged.operation -ceq 'stage-qualified-scotty-artifacts' -and $staged.app_or_native_execution -eq $false) 'No successful copy-only staging result.'
    Assert-That ($staged.request_sha256 -ceq '9908164d28852fdb0bdfc8fd33c0f0632620b7adbbfbb031f67d1bea8ffd67b9' -and $staged.stage_directory -ceq $stage) 'Stage result belongs to another request or directory.'
    Assert-That ($staged.source_commit -ceq $source.scotty -and $staged.native_source_commit -ceq $source.backend) 'Staged source differs.'
    Assert-That ($staged.runtime_build_id -ceq 'YIOHeRJTEdlOszyc4LyHr' -and $staged.runtime_files -eq 560 -and $staged.runtime_bytes -eq 27426391) 'Staged runtime differs.'
    Assert-That (@($staged.installer_inputs.PSObject.Properties).Count -eq $expected.Count) 'Staged installer parameter count differs.'
    foreach($name in $expected.Keys){Assert-That ([string]$staged.installer_inputs.$name -ceq [string]$expected[$name]) ('Staged installer input differs: '+$name)}
    Assert-That ($staging.status -ceq 'passed' -and $staging.phase -ceq 'finished' -and $staging.driver_exit_code -eq 0) 'Stage supervisor did not pass.'
    Assert-That ($staging.supervisor_sha256 -ceq '9c69f55d98c634013ec596398cae1c2c822d373647abd8c4cb863ca405b32d4d' -and $staging.helper_sha256 -ceq 'bdf5323e125e49193fdecd8e44d126a1f9e7746797a33c9fc0967b1546d69ea1') 'Stage execution used another helper.'
    Assert-That ($staging.request_sha256 -ceq $staged.request_sha256 -and $staging.stage_result_sha256 -ceq $StageResultSha256 -and $staging.stage_result -ceq $stageResult) 'Stage supervisor names another result.'
    Assert-That ($staging.cleanup_assisted -eq $false -and @($staging.cleanup_errors).Count -eq 0 -and @($staging.remaining_job_members).Count -eq 0) 'Stage cleanup did not complete normally.'
    Assert-That ($staging.peak_total_resident_bytes -le 512MB -and $staging.duration_seconds -le 180) 'Stage execution exceeded its limits.'
    $EvidenceDirectory=Task-Path ($install+'.supervisor')
    foreach($attempt in @($install,$EvidenceDirectory)){Assert-That (-not(Test-Path -LiteralPath $attempt)) 'Existing installation attempt; reconcile without replay.'}
    [void][IO.Directory]::CreateDirectory($EvidenceDirectory);$ArtifactRoot=$EvidenceDirectory
    $Result['install_directory']=$install;$Result['helper_sha256']=Hash $driver
    $Result['supervisor_sha256']=Hash $PSCommandPath;$Result['job_helper_sha256']=Hash $jobHelper
    $Result['stage_result_sha256']=$StageResultSha256;$Result['stage_supervisor_result_sha256']=$StageSupervisorResultSha256
    $Result['source_commits']=$source;$Result['scotty_ports']=@($ScottyPorts);$Result['fixed_inputs']=$fixedInputs
    $Result['powershell']=$PowerShellPath;$Result['session_id']=$Self.SessionId
    . $jobHelper
    Enter-ScottyTaskJob
    $field=[Scotty20261111TaskJob].GetField('ownedJob',[Reflection.BindingFlags]'Static,NonPublic')
    $Job=[IntPtr]$field.GetValue($null)
    Assert-That ($Job -ne [IntPtr]::Zero) 'Qualified helper did not retain its task Job handle.'
    Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
public static class Scotty20261125ArchiveInspector {
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
    $available=[Scotty20261125ArchiveInspector]::AvailablePhysical()
    $Result['baseline_free_physical_bytes']=$available;$MinimumFree=$available
    Assert-That ($available -ge 3GB) 'At least 3 GiB free physical RAM is required before installation.'
    $initialMembers=@([Scotty20261125ArchiveInspector]::Members($Job))
    Assert-That ($initialMembers.Count -eq 1 -and $initialMembers[0] -eq $Self.Id) 'The task Job must initially contain only this supervisor.'
    Sample-Budget
    $Result['phase']='running';$Result['hard_deadline_exit_code']=124
    [Scotty20261125ArchiveInspector]::ArmDeadline($Job,[int][Math]::Floor(($TimeoutSeconds-$Clock.Elapsed.TotalSeconds)*1000))
    # A literal PowerShell array preserves multiple observed ports through the
    # child command line. Every interpolated value above is fixed or an integer.
    $invocation=@"
& '$driver' -ScottySourceCommit '$($source.scotty)' -BackendSourceCommit '$($source.backend)' -PreservationManifest '$preservation' -RuntimeManifest '$($expected.RuntimeManifest)' -StageNextDirectory '$($expected.StageNextDirectory)' -BeadExe '$($expected.BeadExe)' -BeadSha256 '$($expected.BeadSha256)' -BeadProvenance '$($expected.BeadProvenance)' -OutputDirectory '$install' -ScottyPorts @($($ScottyPorts -join ','))
"@
    [IO.File]::WriteAllText((Join-Path $ArtifactRoot 'invocation.ps1'),$invocation,$Utf8)
    $Result['invocation_sha256']=Hash (Join-Path $ArtifactRoot 'invocation.ps1')
    $encoded=[Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($invocation))
    $start=[Diagnostics.ProcessStartInfo]::new();$start.FileName=$PowerShellPath
    $arguments=@('-NoLogo','-NoProfile','-NonInteractive','-WindowStyle','Hidden','-ExecutionPolicy','Bypass','-EncodedCommand',$encoded)
    $start.Arguments=($arguments|ForEach-Object{Quote-Argument $_})-join ' '
    $start.WorkingDirectory=$ArtifactRoot;$start.UseShellExecute=$false;$start.CreateNoWindow=$true
    $start.RedirectStandardInput=$true;$start.RedirectStandardOutput=$true;$start.RedirectStandardError=$true
    foreach($inputFile in $fixedInputs){Assert-That ((Hash $inputFile.path) -ceq $inputFile.sha256) ('Installation input changed before start: '+$inputFile.path)}
    Assert-That (-not(Test-Path -LiteralPath $install)) 'Installation directory appeared before start.'
    Sample-Budget
    $immediate=[Scotty20261125ArchiveInspector]::AvailablePhysical()
    Assert-That ($immediate -ge 3GB) 'Installation postponed: less than 3 GiB free physical RAM immediately before start.'
    $Result['immediate_free_physical_bytes']=$immediate
    [IO.File]::WriteAllText((Join-Path $ArtifactRoot 'before.json'),($Result|ConvertTo-Json -Depth 12),$Utf8)
    $Child=[Diagnostics.Process]::new();$Child.StartInfo=$start
    Assert-That ($Child.Start()) 'Could not start the accepted installer.'
    [void]$Child.Handle;$Child.StandardInput.Close()
    $Result['driver_pid']=$Child.Id;$Result['command']=@($PowerShellPath)+$arguments
    foreach($name in @('stdout','stderr')){
        $filename=Join-Path $ArtifactRoot ('driver.'+$name+'.log')
        $stream=[IO.FileStream]::new($filename,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::ReadWrite,4096,[IO.FileOptions]::Asynchronous)
        $reader=if($name -eq 'stdout'){$Child.StandardOutput}else{$Child.StandardError}
        $task=$reader.BaseStream.CopyToAsync($stream)
        $StreamEntries.Add(@{name=$name;path=$filename;file=$stream;task=$task})
    }
    do{Sample-Budget;if($Child.HasExited){break};Start-Sleep -Milliseconds 100}while($true)
    $Result['driver_exit_code']=$Child.ExitCode
    Assert-That ($Child.ExitCode -eq 0) 'Installation failed; reconcile the preserved phase and backups before another mutation.'
    $phaseResult=Join-Path $install 'install-result.json'
    Assert-That ((Get-Item -LiteralPath $phaseResult).Length -le 1MB) 'Installation result exceeds 1 MiB.'
    $driverResult=[IO.File]::ReadAllText($phaseResult,$Utf8)|ConvertFrom-Json
    Assert-That ($driverResult.status -ceq 'passed' -and $driverResult.application -ceq 'stopped_at_completion') 'No successful stopped installation result.'
    foreach($name in @('scotty','backend')){Assert-That ($driverResult.requested_source.$name -ceq $source[$name] -and $driverResult.source_heads.$name -ceq $source[$name]) 'Installed source differs.'}
    $installedPin='F:\Dev\bead-me-up-scotty\.scotty-local\bin\bead-0431a828bf95.exe'
    Assert-That ($driverResult.selected_pin -ceq $installedPin -and $driverResult.binary_sha256 -ceq $expected.BeadSha256 -and (Hash $installedPin) -ceq $expected.BeadSha256) 'Installed native pin differs.'
    Assert-That ($driverResult.runtime_build_id -ceq 'YIOHeRJTEdlOszyc4LyHr' -and [IO.File]::ReadAllText('F:\Dev\bead-me-up-scotty\.next\BUILD_ID').Trim() -ceq 'YIOHeRJTEdlOszyc4LyHr') 'Installed runtime identity differs.'
    Assert-That ($driverResult.job_helper_sha256 -ceq '2758a6ff94c0eecdfa360363469069dfa8470efc1f91228812146919a978921f') 'Installer used another task Job helper.'
    Assert-That ($driverResult.input_hashes.preservation_manifest -ceq '70d934585d06c76787e5293a93f7960d6594e869cd719bf0f62ad46a532fa362' -and $driverResult.input_hashes.runtime_manifest -ceq '612790bc18617630f9257ab2a901f8e12a0cd6dda6bf566c414e646e1745f1c7' -and $driverResult.input_hashes.binary_provenance -ceq '21ca90e29fc4588d23b31210cd5ffe6838c136ce70b76458b71370beeeff18f5') 'Installer consumed different input bytes.'
    foreach($inputFile in $fixedInputs){Assert-That ((Hash $inputFile.path) -ceq $inputFile.sha256) ('Preserved installation input changed: '+$inputFile.path)}
    Sample-Budget
    $Result['install_result']=$phaseResult;$Result['install_result_sha256']=Hash $phaseResult
    $Result['selected_pin']=$installedPin;$Result['runtime_build_id']=$driverResult.runtime_build_id
    $Result['application']=$driverResult.application
    $Result['status']='passed'
}catch{
    $Result['error']=$_.Exception.ToString();$Result['status']='failed'
}finally{
    if($Job -ne [IntPtr]::Zero -and ('Scotty20261125ArchiveInspector' -as [type])){
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
            $Result['remaining_job_members']=@([Scotty20261125ArchiveInspector]::Members($Job)|Where-Object{$_ -ne $Self.Id})
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
    if($MinimumFree -ne [uint64]::MaxValue){$Result['minimum_observed_free_physical_bytes']=$MinimumFree}
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
