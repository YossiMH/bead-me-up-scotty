#requires -Version 5.1
# Qualify one command-local private-index correction in a fresh tiny fixture.
[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$JobHelperPath)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue'
$TimeoutSeconds=60;$MaxOwnedResidentMiB=256
$Utf8=[Text.UTF8Encoding]::new($false)
$Self=[Diagnostics.Process]::GetCurrentProcess()
$Clock=[Diagnostics.Stopwatch]::StartNew();$Started=[DateTime]::UtcNow
$ArtifactRoot=$null;$Job=[IntPtr]::Zero;$Child=$null;$PeakResident=0L;$MinimumFree=[uint64]::MaxValue
$Owned=[Collections.Generic.List[object]]::new();$Known=@{}
$CleanupErrors=[Collections.Generic.List[string]]::new()
$StreamEntries=[Collections.Generic.List[object]]::new()
$Commands=[Collections.Generic.List[object]]::new()
$Result=[ordered]@{schema_version=1;status='failed';phase='index-refresh-qualification';started_utc=$Started.ToString('o')
    timeout_seconds=$TimeoutSeconds;work_stop_seconds=($TimeoutSeconds-12);max_total_resident_mib=256
    baseline_free_required_gib=1;live_free_required_gib=1;priority='BelowNormal';sample_interval_ms=100
    cleanup_errors=$CleanupErrors;cleanup_assisted=$false;owned_processes=$Owned;commands=$Commands;replay_allowed=$false}
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

function Hash-Text([string]$Text){
    $algorithm=[Security.Cryptography.SHA256]::Create()
    try{return ([BitConverter]::ToString($algorithm.ComputeHash($Utf8.GetBytes($Text)))).Replace('-','').ToLowerInvariant()}finally{$algorithm.Dispose()}
}
function Run-Git([string]$Directory,[string[]]$Arguments,[string]$IndexPath,[int[]]$AllowedExitCodes=@(0)){
    Sample-Budget
    $start=[Diagnostics.ProcessStartInfo]::new();$start.FileName=$GitExe
    $gitArguments=@('-C',$Directory,'-c','gc.auto=0','-c','maintenance.auto=false','-c',('core.hooksPath='+$EmptyHooks))+$Arguments
    $start.Arguments=($gitArguments|ForEach-Object{Quote-Argument $_}) -join ' '
    $start.WorkingDirectory=$Directory;$start.UseShellExecute=$false;$start.CreateNoWindow=$true
    $start.RedirectStandardInput=$true;$start.RedirectStandardOutput=$true;$start.RedirectStandardError=$true
    $start.StandardOutputEncoding=$Utf8;$start.StandardErrorEncoding=$Utf8
    foreach($name in @('GIT_DIR','GIT_WORK_TREE','GIT_COMMON_DIR','GIT_INDEX_FILE','GIT_CONFIG_COUNT')){$start.EnvironmentVariables.Remove($name)}
    $start.EnvironmentVariables['GIT_OPTIONAL_LOCKS']='0'
    $start.EnvironmentVariables['GIT_TERMINAL_PROMPT']='0'
    $start.EnvironmentVariables['GCM_INTERACTIVE']='never'
    $start.EnvironmentVariables['GIT_CONFIG_NOSYSTEM']='1'
    $start.EnvironmentVariables['GIT_CONFIG_GLOBAL']=$EmptyConfig
    if($IndexPath){$start.EnvironmentVariables['GIT_INDEX_FILE']=$IndexPath}
    $process=[Diagnostics.Process]::new();$process.StartInfo=$start;$launched=$false
    $commandClock=[Diagnostics.Stopwatch]::StartNew()
    try{
        $launched=$process.Start();Assert-That $launched 'Could not start the owned Git fixture command.'
        [void]$process.Handle;$process.StandardInput.Close()
        $stdout=$process.StandardOutput.ReadToEndAsync();$stderr=$process.StandardError.ReadToEndAsync()
        do{Sample-Budget;Assert-That ($commandClock.Elapsed.TotalSeconds -lt 10) 'Git fixture command exceeded 10 seconds.';if($process.HasExited -and $stdout.IsCompleted -and $stderr.IsCompleted){break};Start-Sleep -Milliseconds 100}while($true)
        $out=[string]$stdout.GetAwaiter().GetResult();$err=[string]$stderr.GetAwaiter().GetResult()
        Assert-That ($out.Length -le 262144 -and $err.Length -le 32768) 'Git fixture output exceeded its bound.'
        $Commands.Add(@{arguments=@($Arguments);repository=$Directory;index=$IndexPath;exit_code=$process.ExitCode;stdout_characters=$out.Length;stderr_characters=$err.Length})
        Assert-That ($AllowedExitCodes -contains $process.ExitCode) ('Git fixture command failed: '+($Arguments -join ' '))
        return @{stdout=$out;exit_code=$process.ExitCode}
    }finally{
        if($launched -and -not $process.HasExited){
            Assert-That ([Scotty20261125ArchiveInspector]::IsMember($process.Handle,$Job)) 'Refuse to stop a process outside the fixture Job.'
            $Result.cleanup_assisted=$true;$process.Kill();[void]$process.WaitForExit(2000)
        }
        $process.Dispose()
    }
}

try{
    $Self.PriorityClass='BelowNormal'
    $output=Task-Path 'F:\Dev\.bead-edit-20261111\index-refresh-qualification-20261127-2889282bfcec'
    $jobHelper=Safe-Path $JobHelperPath
    $GitExe=Safe-Path 'C:\Program Files\Git\cmd\git.exe'
    Assert-That ((Hash $jobHelper) -ceq '2758a6ff94c0eecdfa360363469069dfa8470efc1f91228812146919a978921f') 'Accepted task Job helper differs.'
    Assert-That ((Hash $GitExe) -ceq '20d0dde30a65afb6e5810a883700a94dcd77fbf3b44b32868d45bf7c9b30137c') 'Observed Git executable differs.'
    Assert-That (-not(Test-Path -LiteralPath $output)) 'Existing fixture attempt; reconcile without replay.'
    [void][IO.Directory]::CreateDirectory($output);$ArtifactRoot=$output
    $Result['helper_sha256']=Hash $PSCommandPath;$Result['job_helper_sha256']=Hash $jobHelper;$Result['git_sha256']=Hash $GitExe
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
    Assert-That ($available -ge 1GB) 'At least 1 GiB free physical RAM is required for the Git fixture.'
    $initialMembers=@([Scotty20261125ArchiveInspector]::Members($Job))
    Assert-That ($initialMembers.Count -eq 1 -and $initialMembers[0] -eq $Self.Id) 'The task Job must initially contain only this controller.'
    [Scotty20261125ArchiveInspector]::ArmDeadline($Job,[int][Math]::Floor(($TimeoutSeconds-$Clock.Elapsed.TotalSeconds)*1000))
    $EmptyHooks=Join-Path $output 'empty-hooks';[void][IO.Directory]::CreateDirectory($EmptyHooks)
    $EmptyConfig=Join-Path $output 'empty.gitconfig';[IO.File]::WriteAllText($EmptyConfig,'',$Utf8)
    $Source='F:\Dev\bead-me-up-scotty';$Baseline='55f17568be93442abc6e4725d3e159448e0c9ab5'
    $Retained=Task-Path 'F:\Dev\.bead-edit-20261111\install-v9-retry-20261127-2889282bfcec\scotty-index.prepared'
    $RealIndex=Safe-Path (Join-Path $Source '.git\index')
    $RetainedHash='13af66e5997b12b75d8ef920eb7e9310968ce5b7b676a1dcc8bc35a46278a887'
    $RealHash='8b9de62e05335aa677de1a20642f031883bd8a7e7ef6a878dda3337c0d6c9b5f'
    Assert-That ((Hash $Retained) -ceq $RetainedHash -and (Hash $RealIndex) -ceq $RealHash) 'Retained or real index changed before read-only comparison.'
    $actualEntries=(Run-Git $Source @('ls-files','--stage','-z') $Retained).stdout
    $treeEntries=(Run-Git $Source @('ls-tree','-r','-z','--full-tree',$Baseline) $Retained).stdout
    $expectedEntries=[Text.StringBuilder]::new();$entryCount=0
    foreach($entry in $treeEntries.Split([char]0)){
        if(-not $entry){continue}
        Assert-That ($entry -cmatch '^(100644|100755|120000) blob ([0-9a-f]{40})\t([\s\S]+)$') 'Unexpected baseline tree entry.'
        [void]$expectedEntries.Append($Matches[1]+' '+$Matches[2]+' 0'+[char]9+$Matches[3]+[char]0);$entryCount++
    }
    Assert-That ($entryCount -gt 0 -and $actualEntries -ceq $expectedEntries.ToString()) 'Retained private index mode/blob/path/stage map differs from the complete baseline.'
    Assert-That ((Hash $Retained) -ceq $RetainedHash -and (Hash $RealIndex) -ceq $RealHash) 'Read-only comparison changed an index.'
    $Result['retained_index_comparison']=@{status='passed';baseline=$Baseline;entries=$entryCount;entries_sha256=(Hash-Text $actualEntries);retained_before_sha256=$RetainedHash;retained_after_sha256=(Hash $Retained);real_before_sha256=$RealHash;real_after_sha256=(Hash $RealIndex);all_stages_zero=$true}

    $Fixture=Join-Path $output 'repo';[void][IO.Directory]::CreateDirectory($Fixture)
    $null=Run-Git $Fixture @('init','--quiet','--initial-branch=main',('--template='+$EmptyHooks))
    [IO.File]::WriteAllText((Join-Path $Fixture '.gitattributes'),"*.txt text eol=crlf`n",$Utf8)
    [IO.File]::WriteAllText((Join-Path $Fixture 'tracked.txt'),"before`r`n",$Utf8)
    $null=Run-Git $Fixture @('add','--','.gitattributes','tracked.txt')
    $null=Run-Git $Fixture @('-c','user.name=Index fixture','-c','user.email=index-fixture@example.invalid','commit','--quiet','-m','Fixture baseline')
    $fixtureIndex=Join-Path $Fixture '.git\index';$fixtureIndexHash=Hash $fixtureIndex
    $fixtureHead=(Run-Git $Fixture @('rev-parse','HEAD')).stdout.Trim()
    [IO.File]::WriteAllText((Join-Path $Fixture 'tracked.txt'),"accepted tracked`r`n",$Utf8)
    [IO.File]::WriteAllText((Join-Path $Fixture 'added.txt'),"accepted added`r`n",$Utf8)
    $Prepared=Join-Path $output 'prepared.index';[IO.File]::Copy($fixtureIndex,$Prepared,$false)
    $cache=@('update-index','--add')
    foreach($name in @('tracked.txt','added.txt')){
        $blob=(Run-Git $Fixture @('hash-object','-w',('--path='+$name),'--',$name)).stdout.Trim()
        Assert-That ($blob -cmatch '^[0-9a-f]{40}$') 'Fixture blob identity differs.'
        $cache+=@('--cacheinfo',('100644,'+$blob+','+$name))
    }
    $null=Run-Git $Fixture $cache $Prepared
    $expectedTree=(Run-Git $Fixture @('write-tree') $Prepared).stdout.Trim()
    $fixtureEntries=(Run-Git $Fixture @('ls-files','--stage','-z') $Prepared).stdout
    $preparedHash=Hash $Prepared;$cases=[Collections.Generic.List[object]]::new()
    foreach($case in @(@{name='control';prefix=@()},@{name='command-local-false';prefix=@('-c','diff.autoRefreshIndex=false')})){
        $index=Join-Path $output ($case.name+'.index');[IO.File]::Copy($Prepared,$index,$false)
        $before=Hash $index
        $diff=Run-Git $Fixture ($case.prefix+@('diff','--exit-code','--quiet','--')) $index
        $afterDiff=Hash $index
        $others=(Run-Git $Fixture @('ls-files','--others','--exclude-standard','-z') $index).stdout
        $afterOthers=Hash $index
        $entries=(Run-Git $Fixture @('ls-files','--stage','-z') $index).stdout
        $tree=(Run-Git $Fixture @('write-tree') $index).stdout.Trim()
        Assert-That ($others.Length -eq 0 -and $entries -ceq $fixtureEntries -and $tree -ceq $expectedTree) 'Fixture content mapping changed during validation.'
        $cases.Add(@{name=$case.name;exit_code=$diff.exit_code;before_sha256=$before;after_diff_sha256=$afterDiff;after_ls_files_sha256=$afterOthers;final_sha256=(Hash $index);bytes=(Get-Item -LiteralPath $index).Length;stage_mode_blob_path_entries_equal=$true;tree_equal=$true;tree=$tree;untracked_paths=0})
    }
    Assert-That ($cases[0].before_sha256 -cne $cases[0].after_diff_sha256) 'The Windows control did not reproduce the private-index refresh.'
    $fixed=$cases[1]
    Assert-That ($fixed.before_sha256 -ceq $fixed.after_diff_sha256 -and $fixed.before_sha256 -ceq $fixed.after_ls_files_sha256 -and $fixed.before_sha256 -ceq $fixed.final_sha256) 'Command-local false did not preserve exact prepared bytes.'
    [IO.File]::WriteAllText((Join-Path $Fixture 'tracked.txt'),"unexpected edit`r`n",$Utf8)
    $corrected=Join-Path $output 'command-local-false.index';$before=Hash $corrected
    $negative=Run-Git $Fixture @('-c','diff.autoRefreshIndex=false','diff','--exit-code','--quiet','--') $corrected @(1)
    Assert-That ((Hash $corrected) -ceq $before) 'Changed-content refusal changed the private index.'
    Assert-That ((Hash $fixtureIndex) -ceq $fixtureIndexHash -and (Run-Git $Fixture @('rev-parse','HEAD')).stdout.Trim() -ceq $fixtureHead) 'Fixture real index or HEAD changed.'
    Assert-That ((Hash $Retained) -ceq $RetainedHash -and (Hash $RealIndex) -ceq $RealHash) 'Retained or real product index changed.'
    $Result['git_version']=(Run-Git $Fixture @('--version')).stdout.Trim()
    $Result['optional_locks']='0';$Result['crlf_attributes']='*.txt text eol=crlf'
    $Result['prepared_sha256']=$preparedHash;$Result['expected_tree']=$expectedTree;$Result['cases']=@($cases.ToArray())
    $Result['changed_content_refusal']=@{exit_code=$negative.exit_code;prepared_index_bytes_unchanged=$true}
    $Result['fixture_original_index_and_head_unchanged']=$true;$Result['product_indexes_unchanged']=$true
    $Result['product_execution']=$false;$Result['status']='passed'
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
