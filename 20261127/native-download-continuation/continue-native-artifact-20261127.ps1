#requires -Version 5.1
# Complete only the missing native archive after the exact recorded failure.
# The existing gh authentication stays inside gh; downloaded bytes are never
# decoded as PowerShell text. Preserve the verified app and previous attempt.
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$JobHelperPath
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue'
# These delivery limits match the accepted copy-only archive supervisor.
$TimeoutSeconds=180;$MaxOwnedResidentMiB=512
$Utf8=[Text.UTF8Encoding]::new($false,$true)
$Self=[Diagnostics.Process]::GetCurrentProcess()
$Clock=[Diagnostics.Stopwatch]::StartNew();$Started=[DateTime]::UtcNow
$ArtifactRoot=$null;$Job=[IntPtr]::Zero;$PeakResident=0L;$MinimumFree=[uint64]::MaxValue
$Owned=[Collections.Generic.List[object]]::new();$Known=@{}
$CleanupErrors=[Collections.Generic.List[string]]::new()
# The preserved Job sampler also accepts stream records. Pipe reads below use
# stricter per-response byte bounds and keep this inherited collection empty.
$StreamEntries=[Collections.Generic.List[object]]::new()
$Commands=[Collections.Generic.List[object]]::new();$Downloads=[Collections.Generic.List[object]]::new()
$PinnedInputs=[Collections.Generic.List[object]]::new()
$PreviousResultSha256='a8219c011bdf2abe056679efefc100f6967ec67139a9ac12109e8c78da243778'
$AppArtifact=@{id=15003467178L;bytes=7056005L
    sha256='15a503c45ded58ea48fcce7dd293b563d741a3424b64a39a6bd05edf5b1d409d';filename='scotty-15003467178.zip'}
$EmptySha256='e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
# Reuse these fixed buffers for every sequential child and metadata response.
$StdoutBuffer=New-Object byte[] 65536;$StderrBuffer=New-Object byte[] 4096
$MetadataBuffer=[IO.MemoryStream]::new(65536)
$Result=[ordered]@{schema_version=1;status='failed';phase='native-download-continuation';started_utc=$Started.ToString('o')
    timeout_seconds=$TimeoutSeconds;work_stop_seconds=($TimeoutSeconds-12);max_total_resident_mib=512
    baseline_free_required_gib=1;live_free_required_gib=1;priority='BelowNormal';sample_interval_ms=100
    cleanup_errors=$CleanupErrors;cleanup_assisted=$false;owned_processes=$Owned;replay_allowed=$false
    commands=$Commands;downloads=$Downloads}
# Artifact IDs, producer heads, raw archive digests and destinations are the
# accepted final-installation binding. The producer heads identify workflows.
$Artifacts=@(
    @{id=15014634952L;name='checkpoint-windows-release-45600413942-1';run_id=45600413942L
      workflow_sha='975d21cca470dbca61a9221391b98eeebcba9d1d';bytes=4524263L
      sha256='6bdb10496f976621d0b5545a8ef3b591a317e4a07d7e1f9276eb42d5fa09bba8';filename='bead-15014634952.zip'}
)
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
        Assert-That ($Clock.Elapsed.TotalSeconds -lt $TimeoutSeconds-12) 'Archive staging work deadline expired.'
        $free=[Scotty20261125ArchiveInspector]::AvailablePhysical()
        if($free -lt $script:MinimumFree){$script:MinimumFree=$free}
        Assert-That ($free -ge 1GB) 'Free physical RAM fell below the 1 GiB staging gate.'
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
# The gh calls are sequential. Each owns its pipes until EOF and retains only
# byte counts for stderr, which can otherwise disclose a redirected signed URL.
function Invoke-GhBytes([string[]]$Arguments,[IO.Stream]$Output,[long]$Limit,[int]$CommandSeconds){
    $start=[Diagnostics.ProcessStartInfo]::new();$start.FileName=$GhPath
    $start.Arguments=($Arguments|ForEach-Object{Quote-Argument $_})-join ' '
    $start.WorkingDirectory=$ArtifactRoot;$start.UseShellExecute=$false;$start.CreateNoWindow=$true
    $start.RedirectStandardInput=$true;$start.RedirectStandardOutput=$true;$start.RedirectStandardError=$true
    $start.EnvironmentVariables.Remove('GH_DEBUG');$start.EnvironmentVariables.Remove('GH_FORCE_TTY')
    $start.EnvironmentVariables['GH_PROMPT_DISABLED']='1'
    $start.EnvironmentVariables['GH_NO_UPDATE_NOTIFIER']='1'
    $start.EnvironmentVariables['GH_NO_EXTENSION_UPDATE_NOTIFIER']='1'
    $process=[Diagnostics.Process]::new();$process.StartInfo=$start
    $outTask=$null;$errTask=$null;$stdoutBytes=0L;$stderrBytes=0L
    $record=[ordered]@{arguments=$Arguments;stdout_bytes=0L;stderr_bytes=0L;stderr_retained=$false;exit_code=$null}
    $Commands.Add($record)
    try{
        Assert-That ($process.Start()) 'Could not start the existing GitHub CLI.'
        [void]$process.Handle;$process.StandardInput.Close()
        $record['pid']=$process.Id;$record['start_ticks']=$process.StartTime.ToUniversalTime().Ticks
        Refresh-Owned
        Assert-That ([Scotty20261125ArchiveInspector]::IsMember($process.Handle,$Job)) 'GitHub CLI escaped the owned Job.'
        $commandDeadline=$Clock.Elapsed.TotalSeconds+$CommandSeconds
        $outTask=$process.StandardOutput.BaseStream.ReadAsync($StdoutBuffer,0,$StdoutBuffer.Length)
        $errTask=$process.StandardError.BaseStream.ReadAsync($StderrBuffer,0,$StderrBuffer.Length)
        while($null -ne $outTask -or $null -ne $errTask -or -not $process.HasExited){
            Sample-Budget
            Assert-That ($Clock.Elapsed.TotalSeconds -lt $commandDeadline) 'A GitHub CLI operation exceeded its deadline.'
            $progressed=$false
            if($null -ne $outTask -and $outTask.IsCompleted){
                $progressed=$true
                $count=$outTask.GetAwaiter().GetResult();$outTask=$null
                if($count -gt 0){
                    Assert-That ($stdoutBytes+$count -le $Limit) 'GitHub response exceeded the expected byte bound.'
                    $Output.Write($StdoutBuffer,0,$count);$stdoutBytes+=$count
                    $record.stdout_bytes=$stdoutBytes
                    $outTask=$process.StandardOutput.BaseStream.ReadAsync($StdoutBuffer,0,$StdoutBuffer.Length)
                }
            }
            if($null -ne $errTask -and $errTask.IsCompleted){
                $progressed=$true
                $count=$errTask.GetAwaiter().GetResult();$errTask=$null
                if($count -gt 0){
                    $stderrBytes+=$count;$record.stderr_bytes=$stderrBytes
                    Assert-That ($stderrBytes -le 65536) 'GitHub CLI error output exceeded 64 KiB.'
                    $errTask=$process.StandardError.BaseStream.ReadAsync($StderrBuffer,0,$StderrBuffer.Length)
                }
            }
            if(-not $progressed -and ($null -ne $outTask -or $null -ne $errTask -or -not $process.HasExited)){Start-Sleep -Milliseconds 50}
        }
        $record.exit_code=$process.ExitCode
        Assert-That ($process.ExitCode -eq 0) ('GitHub CLI exited with code '+$process.ExitCode+'; its error byte count is retained.')
        $Output.Flush()
        return $stdoutBytes
    }finally{
        # The retained Job handle authorizes only this operation's descendants.
        # Closing both read streams completes pending pipe tasks on interruption.
        if($record.Contains('pid')){
            if(-not $process.HasExited){Stop-Owned;[void]$process.WaitForExit(2000)}
            $process.StandardOutput.Close();$process.StandardError.Close()
            foreach($pending in @($outTask,$errTask)){
                if($null -ne $pending){
                    try{
                        if(-not $pending.Wait(250)){$CleanupErrors.Add('An owned GitHub CLI pipe read did not finish.')}
                    }catch{$CleanupErrors.Add('An owned GitHub CLI pipe read ended during interrupted cleanup.')}
                }
            }
        }
        $process.Dispose()
    }
}

# These fixed predecessor checks authorize this single continuation. The
# previous result, app archive and empty native partial stay read-only and
# cannot be replaced while held. No prior claim, log or partial is rewritten.
function Hold-QualifiedInput([string]$Path,[long]$Bytes,[string]$Sha256){
    $path=Task-Path $Path
    Assert-That (Test-Path -LiteralPath $path -PathType Leaf) 'A required predecessor file is missing.'
    $held=[IO.FileStream]::new($path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
    $PinnedInputs.Add($held)
    Assert-That ($held.Length -eq $Bytes -and (Hash $path) -ceq $Sha256) 'A predecessor file differs from the exact readback.'
}

function Assert-DownloadInventory([switch]$Completed){
    $items=@(Get-ChildItem -LiteralPath $directory -Force)
    $expected=@($AppArtifact.filename,'bead-15014634952.zip.partial')
    if($Completed){$expected+=@('bead-15014634952.zip')}
    Assert-That ((@($items|ForEach-Object{$_.Name}|Sort-Object)-join '|') -ceq (@($expected|Sort-Object)-join '|')) 'Original download directory inventory changed.'
    foreach($item in $items){
        Assert-That (-not $item.PSIsContainer -and ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)-eq 0) 'Unexpected directory or reparse point in download inventory.'
    }
    Assert-That ((Get-Item -LiteralPath $appPath).Length -eq $AppArtifact.bytes -and (Hash $appPath) -ceq $AppArtifact.sha256) 'The verified app archive changed.'
    Assert-That ((Get-Item -LiteralPath $previousPartial).Length -eq 0 -and (Hash $previousPartial) -ceq $EmptySha256) 'The previous empty native partial changed.'
    Assert-That ((Hash $previousResultPath) -ceq $PreviousResultSha256) 'The previous failure receipt changed.'
    if($Completed){
        $native=$Artifacts[0];$final=Join-Path $directory $native.filename
        Assert-That ((Get-Item -LiteralPath $final).Length -eq $native.bytes -and (Hash $final) -ceq $native.sha256) 'The final native archive differs.'
    }
}

function Assert-PreviousFailure{
    Hold-QualifiedInput $previousResultPath 11444 $PreviousResultSha256
    Hold-QualifiedInput $appPath $AppArtifact.bytes $AppArtifact.sha256
    Hold-QualifiedInput $previousPartial 0 $EmptySha256
    $previous=[IO.File]::ReadAllText($previousResultPath,$Utf8)|ConvertFrom-Json
    Assert-That ($previous.schema_version -eq 1 -and $previous.status -ceq 'failed' -and $previous.phase -ceq 'finished') 'Previous attempt is not the recorded completed failure.'
    Assert-That ($previous.helper_sha256 -ceq 'a5ba9dbfc7a56816a447d17e75131127d1e327d73b3dfd1fe158545e794e6555') 'Previous attempt used another downloader.'
    Assert-That ((Task-Path ([string]$previous.download_directory)) -ceq $directory) 'Previous download directory differs.'
    Assert-That (@($previous.cleanup_errors).Count -eq 0 -and $previous.cleanup_assisted -eq $false -and @($previous.remaining_job_members).Count -eq 0) 'Previous attempt lacks clean owned-process cleanup.'
    Assert-That (@($previous.commands).Count -eq 5 -and @($previous.downloads).Count -eq 2) 'Previous attempt has unexpected operations.'
    $app=$previous.downloads[0];$native=$previous.downloads[1];$failed=$previous.commands[4]
    Assert-That ($app.id -eq $AppArtifact.id -and $app.status -ceq 'passed' -and $app.bytes -eq $AppArtifact.bytes -and $app.sha256 -ceq $AppArtifact.sha256) 'Previous app archive was not verified.'
    Assert-That ((Task-Path ([string]$app.final_path)) -ceq $appPath) 'Previous app final path differs.'
    Assert-That ($native.id -eq 15014634952L -and $native.status -ceq 'downloading') 'Previous native state is not the recorded incomplete transfer.'
    Assert-That ((Task-Path ([string]$native.final_path)) -ceq (Join-Path $directory $Artifacts[0].filename)) 'Previous native final path differs.'
    $expectedArguments=@('api','--hostname','github.com','--method','GET','repos/YossiMH/bead-me-up-scotty/actions/artifacts/15014634952/zip')
    Assert-That ((@($failed.arguments)-join '|') -ceq ($expectedArguments-join '|')) 'Previous failed command differs.'
    Assert-That ($failed.exit_code -eq 1 -and $failed.stdout_bytes -eq 0 -and $failed.stderr_bytes -eq 128 -and $failed.stderr_retained -eq $false) 'Previous native transfer outcome differs.'
    Assert-DownloadInventory
}

try{
    $Self.PriorityClass='BelowNormal'
    $directory=Task-Path 'F:\Dev\.bead-edit-20261111\downloads-v9-final-20261125-1151'
    $continuation=Task-Path 'F:\Dev\.bead-edit-20261111\native-download-continuation-20261127-2889282bfcec'
    $evidence=Task-Path ($continuation+'.supervisor');$claimPath=Task-Path ($continuation+'.claim')
    $previousResultPath=Task-Path (Join-Path ($directory+'.supervisor') 'result.json')
    $appPath=Task-Path (Join-Path $directory $AppArtifact.filename)
    $previousPartial=Task-Path (Join-Path $directory 'bead-15014634952.zip.partial')
    $jobHelper=Safe-Path $JobHelperPath
    Assert-That ((Hash $jobHelper) -ceq '2758a6ff94c0eecdfa360363469069dfa8470efc1f91228812146919a978921f') 'Qualified task Job helper differs.'
    $GhPath=Safe-Path ([string](Get-Command gh.exe -CommandType Application -ErrorAction Stop).Source)
    foreach($attempt in @($continuation,$evidence,$claimPath)){
        Assert-That (-not(Test-Path -LiteralPath $attempt)) 'Existing download attempt; preserve and reconcile without replay.'
    }
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
    Assert-That ($available -ge 1GB) 'At least 1 GiB free physical RAM is required for transfer.'
    $members=@([Scotty20261125ArchiveInspector]::Members($Job))
    Assert-That ($members.Count -eq 1 -and $members[0] -eq $Self.Id) 'The task Job must initially contain only this downloader.'
    Sample-Budget
    [Scotty20261125ArchiveInspector]::ArmDeadline($Job,[int][Math]::Floor(($TimeoutSeconds-$Clock.Elapsed.TotalSeconds)*1000))
    Assert-PreviousFailure
    Sample-Budget
    $claim=[IO.FileStream]::new($claimPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
    try{
        $claimBytes=$Utf8.GetBytes(($Started.ToString('o')+' '+(Hash $PSCommandPath)))
        $claim.Write($claimBytes,0,$claimBytes.Length);$claim.Flush()
    }finally{$claim.Dispose()}
    [void][IO.Directory]::CreateDirectory($evidence);$ArtifactRoot=$evidence
    [void][IO.Directory]::CreateDirectory($continuation)
    $Result['download_directory']=$directory;$Result['helper_sha256']=Hash $PSCommandPath
    $Result['continuation_directory']=$continuation
    $Result['previous_attempt']=@{result_path=$previousResultPath;result_sha256=$PreviousResultSha256
        partial_path=$previousPartial;partial_bytes=0;partial_sha256=$EmptySha256;preserved=$true}
    $Result['preserved_app']=@{id=$AppArtifact.id;path=$appPath;bytes=$AppArtifact.bytes;sha256=$AppArtifact.sha256;status='verified_before_transfer'}
    $Result['job_helper_sha256']=Hash $jobHelper;$Result['gh_path']=$GhPath;$Result['gh_sha256']=Hash $GhPath
    $Result['session_id']=$Self.SessionId;$Result['phase']='running';$Result['hard_deadline_exit_code']=124
    [IO.File]::WriteAllText((Join-Path $ArtifactRoot 'before.json'),($Result|ConvertTo-Json -Depth 12),$Utf8)
    $MetadataBuffer.SetLength(0)
    $null=Invoke-GhBytes @('--version') $MetadataBuffer 4096 10
    $Result['gh_version']=$Utf8.GetString($MetadataBuffer.GetBuffer(),0,[int]$MetadataBuffer.Length).Trim()
    foreach($artifact in $Artifacts){
        Sample-Budget
        $endpoint='repos/YossiMH/bead-me-up-scotty/actions/artifacts/'+$artifact.id
        $MetadataBuffer.SetLength(0)
        $null=Invoke-GhBytes @('api','--hostname','github.com','--method','GET',$endpoint) $MetadataBuffer 65536 25
        $metadata=$Utf8.GetString($MetadataBuffer.GetBuffer(),0,[int]$MetadataBuffer.Length)|ConvertFrom-Json
        Assert-That ($metadata.id -eq $artifact.id -and $metadata.name -ceq $artifact.name) 'Artifact identity changed.'
        Assert-That ($metadata.size_in_bytes -eq $artifact.bytes -and $metadata.digest -ceq ('sha256:'+$artifact.sha256)) 'Artifact size or digest changed.'
        Assert-That ($metadata.expired -eq $false -and [DateTimeOffset]::Parse($metadata.expires_at) -gt [DateTimeOffset]::UtcNow) 'Required artifact is expired.'
        Assert-That ($metadata.workflow_run.id -eq $artifact.run_id -and $metadata.workflow_run.head_sha -ceq $artifact.workflow_sha) 'Artifact producer changed.'
        $record=[ordered]@{id=$metadata.id;name=$metadata.name;bytes=$metadata.size_in_bytes;sha256=$artifact.sha256
            run_id=$metadata.workflow_run.id;workflow_sha=$metadata.workflow_run.head_sha;expires_at=$metadata.expires_at
            final_path=(Join-Path $directory $artifact.filename);status='metadata_verified'}
        $Downloads.Add($record)
        [IO.File]::WriteAllText((Join-Path $ArtifactRoot ('artifact-'+$artifact.id+'-metadata.json')),($record|ConvertTo-Json),$Utf8)
        $partial=Join-Path $continuation ($artifact.filename+'.partial')
        $record['partial_path']=$partial
        Assert-That (-not(Test-Path -LiteralPath $record.final_path) -and -not(Test-Path -LiteralPath $partial)) 'Download output already exists.'
        $output=[IO.FileStream]::new($partial,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read,65536,[IO.FileOptions]::SequentialScan)
        try{
            $record.status='downloading'
            $written=Invoke-GhBytes @('api','--hostname','github.com','--method','GET',($endpoint+'/zip')) $output $artifact.bytes 60
            Assert-That ($written -eq $artifact.bytes) 'Artifact download is incomplete.'
        }finally{$output.Dispose()}
        Sample-Budget
        Assert-That ((Get-Item -LiteralPath $partial).Length -eq $artifact.bytes -and (Hash $partial) -ceq $artifact.sha256) 'Downloaded archive hash or size differs.'
        Assert-DownloadInventory
        [IO.File]::Move($partial,$record.final_path)
        $record.status='passed'
        [IO.File]::WriteAllText((Join-Path $ArtifactRoot ('artifact-'+$artifact.id+'-result.json')),($record|ConvertTo-Json),$Utf8)
    }
    Sample-Budget
    Assert-DownloadInventory -Completed
    $Result.preserved_app.status='verified_before_and_after_transfer'
    $Result['both_final_archives_verified']=$true
    $Result['status']='passed'
}catch{
    # Process stderr and HTTP URLs never enter the receipt. All local failures
    # have a bounded message; the type plus named phase also identifies refusal.
    $message=$_.Exception.Message
    $message=[regex]::Replace($message,'(?i)https?://\S+','[URL omitted]')
    if($message.Length -gt 1024){$message=$message.Substring(0,1024)}
    $Result['error']=$message;$Result['error_type']=$_.Exception.GetType().FullName;$Result['status']='failed'
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
    foreach($entry in $Owned){
        try{if($entry.process.HasExited){$entry.exit_code=$entry.process.ExitCode}}catch{}
        $entry.process.Dispose();$entry.Remove('process')
    }
    $MetadataBuffer.Dispose()
    foreach($held in $PinnedInputs){try{$held.Dispose()}catch{$CleanupErrors.Add('A predecessor read handle did not close.') }}
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
