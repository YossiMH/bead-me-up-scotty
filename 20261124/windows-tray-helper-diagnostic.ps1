#requires -Version 5.1
<#
Run in a fresh interactive-session PowerShell process. Two sequential cases use
the real helper with a disposable Node parent and independently captured pipes.
The driver never removes a helper cache: surviving contents are evidence.
TraceCleanup is a second-run diagnostic, never production acceptance evidence.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$HelperPath,
    [Parameter(Mandatory=$true)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$ExpectedSha256,
    [Parameter(Mandatory=$true)][string]$EvidenceDirectory,
    [Parameter(Mandatory=$true)][string]$JobHelperPath,
    [string]$NodePath='node.exe',
    [ValidateRange(30,90)][int]$TimeoutSeconds=75,
    [ValidateRange(100,200)][int]$MaxResidentMiB=200,
    [switch]$TraceCleanup,
    [string]$PriorResultPath
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
$Utf8=[Text.UTF8Encoding]::new($false)
$Started=[DateTime]::UtcNow
$Deadline=$Started.AddSeconds($TimeoutSeconds-8)
$Self=[Diagnostics.Process]::GetCurrentProcess()
$Owned=[Collections.Generic.List[object]]::new()
$Cases=[Collections.Generic.List[object]]::new()
$CleanupErrors=[Collections.Generic.List[string]]::new()
$PeakResident=0L
$ArtifactRoot=$null
$JobSha256='2758a6ff94c0eecdfa360363469069dfa8470efc1f91228812146919a978921f'
$Result=[ordered]@{schema_version=1;status='failed';mode=if($TraceCleanup){'diagnostic-copy'}else{'production'}
    started_utc=$Started.ToString('o');session_id=$Self.SessionId;timeout_seconds=$TimeoutSeconds
    max_total_resident_mib=$MaxResidentMiB;source_sha256=$ExpectedSha256.ToLowerInvariant()
    boundary='Disposable parent is a sibling; helper stdout/stderr and stdin remain owned by this driver.'
    cases=$Cases;cleanup_errors=$CleanupErrors}

function Assert-That([bool]$Condition,[string]$Message){if(-not $Condition){throw $Message}}
function Hash([string]$Path){return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()}

# Restrict new evidence/cache locations to ordinary local directories.
function Safe-Path([string]$Value){
    Assert-That ($Value -match '^[A-Za-z]:[\\/]') 'Use a full local Windows path.'
    $full=[IO.Path]::GetFullPath($Value).TrimEnd('\','/')
    Assert-That ($full.Length -gt 3) 'A drive root cannot own this run.'
    $cursor=$full
    while($cursor){
        if(Test-Path -LiteralPath $cursor){
            Assert-That (((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)-eq 0) ('Reparse point in path: '+$cursor)
        }
        $parent=[IO.Directory]::GetParent($cursor)
        $cursor=if($parent){$parent.FullName}else{$null}
    }
    return $full
}

# Quote one Windows native argv value without shell evaluation.
function Quote-Argument([string]$Value){
    if($Value -notmatch '[\s"]' -and $Value.Length -gt 0){return $Value}
    return '"'+[regex]::Replace([regex]::Replace($Value,'(\\*)"','$1$1\"'),'(\\+)$','$1$1')+'"'
}

# The asynchronous capture keeps a writer open, so polling must share writes.
function Read-Captured([string]$Path){
    $stream=[IO.FileStream]::new($Path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::ReadWrite)
    $reader=$null
    try{$reader=[IO.StreamReader]::new($stream,[Text.Encoding]::UTF8);return $reader.ReadToEnd()}
    finally{if($null -ne $reader){$reader.Dispose()}else{$stream.Dispose()}}
}

# Include this driver and every still-live owned child in the sampled RSS bound.
function Check-Budget{
    $Self.Refresh();$resident=[long]$Self.WorkingSet64
    foreach($entry in $Owned){
        if(-not $entry.process.HasExited){$entry.process.Refresh();$resident+=$entry.process.WorkingSet64}
        foreach($file in @($entry.stdout_path,$entry.stderr_path)){
            if([IO.File]::Exists($file)){Assert-That ((Get-Item -LiteralPath $file).Length -le 65536) 'A diagnostic stream exceeded 64 KiB.'}
        }
    }
    if($resident -gt $script:PeakResident){$script:PeakResident=$resident}
    Assert-That ($resident -le $MaxResidentMiB*1MB) 'Total owned resident memory exceeded the budget.'
    Assert-That ([DateTime]::UtcNow -lt $Deadline) 'The diagnostic work deadline expired.'
}

function Wait-Until([scriptblock]$Condition,[string]$Failure,[int]$Seconds=12){
    $end=[DateTime]::UtcNow.AddSeconds($Seconds)
    do{Check-Budget;if(& $Condition){return};Start-Sleep -Milliseconds 100}while([DateTime]::UtcNow -lt $end)
    throw $Failure
}

# Capture exact stdout/stderr bytes to independently owned files while the child
# runs; neither stream is routed through the disposable parent.
function Start-Owned([string]$Command,[string[]]$Arguments,[string]$Kind,[string]$Directory){
    $start=[Diagnostics.ProcessStartInfo]::new()
    $start.FileName=$Command;$start.Arguments=($Arguments|ForEach-Object{Quote-Argument $_})-join ' '
    $start.UseShellExecute=$false;$start.CreateNoWindow=$true
    $start.RedirectStandardInput=$true;$start.RedirectStandardOutput=$true;$start.RedirectStandardError=$true
    $start.EnvironmentVariables.Remove('NODE_OPTIONS')
    $process=[Diagnostics.Process]::new();$process.StartInfo=$start
    $entry=@{process=$process;kind=$Kind;directory=$Directory;pid=$null;exit_code=$null;stdout_task=$null;stderr_task=$null
        stdout_stream=$null;stderr_stream=$null;stdout_path=(Join-Path $Directory ($Kind+'.stdout.log'))
        stderr_path=(Join-Path $Directory ($Kind+'.stderr.log'));command=$Command;arguments=$Arguments}
    Assert-That ($process.Start()) ('Could not start '+$Kind)
    $Owned.Add($entry)
    $entry.pid=$process.Id;[void]$process.Handle
    Assert-That ($process.SessionId -eq $Self.SessionId) 'An owned child escaped the selected interactive session.'
    $process.PriorityClass='BelowNormal'
    foreach($name in @('stdout','stderr')){
        $stream=[IO.FileStream]::new($entry[$name+'_path'],[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::ReadWrite,1,[IO.FileOptions]::Asynchronous)
        $entry[$name+'_stream']=$stream
        $reader=if($name -eq 'stdout'){$process.StandardOutput}else{$process.StandardError}
        $entry[$name+'_task']=$reader.BaseStream.CopyToAsync($stream)
    }
    Check-Budget
    return $entry
}

# Drain the already-running copies after process exit; never infer successful
# process completion from a closing pipe or a helper receipt alone.
function Finish-Streams($Entry){
    Assert-That ($Entry.process.HasExited) 'Cannot finish streams for a live child.'
    $Entry.exit_code=$Entry.process.ExitCode
    foreach($name in @('stdout','stderr')){
        $task=$Entry[$name+'_task'];$stream=$Entry[$name+'_stream']
        if($null -ne $task){Assert-That ($task.Wait(1000)) ('Stream did not close: '+$Entry.kind+' '+$name)}
        if($null -ne $stream){$stream.Flush();$stream.Dispose();$Entry[$name+'_stream']=$null}
    }
}

# Trace only a second-run copy. Each substitution must identify the exact known
# cleanup boundary; the production source file is never written.
function Traced-Source([string]$Source,[string]$TracePath){
    $sourceText=$Source.Replace("`r`n","`n")
    $traceLiteral=$TracePath.Replace("'","''")
    $traceDefinition=@'
function Write-ScottyCleanupTrace([string]$Stage,[string]$Directory,[string]$ScriptPath,[string]$Detail='') {
    try {
        $record=@{stage=$Stage;directory=$Directory;script_path=$ScriptPath;detail=$Detail;pid=$PID;utc=[DateTime]::UtcNow.ToString('o')}
        [IO.File]::AppendAllText('__TRACE_PATH__',($record|ConvertTo-Json -Compress)+[Environment]::NewLine,[Text.UTF8Encoding]::new($false))
    } catch {}
}
Write-ScottyCleanupTrace 'startup' $CacheDirectory $PSCommandPath
'@
    $traceDefinition=$traceDefinition.Replace('__TRACE_PATH__',$traceLiteral)
    $anchors=@(
        @{old='$ErrorActionPreference = ''Stop''';new=('$ErrorActionPreference = ''Stop''' + "`n" + $traceDefinition)},
        @{old='        try { if ($null -ne $tray) { & $tray.Dispose } }';new=("        Write-ScottyCleanupTrace 'finally-enter' `$CacheDirectory `$PSCommandPath`n"+'        try { if ($null -ne $tray) { & $tray.Dispose } }')},
        @{old='            try { Remove-ScottyTrayCopy -Directory $CacheDirectory -ScriptPath $PSCommandPath }';new=@'
            try {
                Write-ScottyCleanupTrace 'cleanup-call' $CacheDirectory $PSCommandPath
                Remove-ScottyTrayCopy -Directory $CacheDirectory -ScriptPath $PSCommandPath
                Write-ScottyCleanupTrace 'cleanup-return' $CacheDirectory $PSCommandPath
            }
'@},
        @{old='                [Console]::Error.WriteLine(''Windows tray cache: '' + $_.Exception.Message)';new=("                Write-ScottyCleanupTrace 'cleanup-error' `$CacheDirectory `$PSCommandPath (`$_.Exception.ToString())`n"+'                [Console]::Error.WriteLine(''Windows tray cache: '' + $_.Exception.Message)')}
    )
    foreach($anchor in $anchors){
        Assert-That (($sourceText.Split([string[]]@($anchor.old),[StringSplitOptions]::None).Length-1)-eq 1) 'Diagnostic trace anchor is not unique in this helper.'
        $sourceText=$sourceText.Replace($anchor.old,$anchor.new)
    }
    return $sourceText
}

try{
    $Self.PriorityClass='BelowNormal'
    Assert-That ($Self.SessionId -eq 1 -and [Environment]::UserInteractive) 'Run in the existing interactive user session 1.'
    $explorers=@(Get-Process -Name explorer -ErrorAction SilentlyContinue|Where-Object{$_.SessionId -eq 1})
    Assert-That ($explorers.Count -gt 0) 'The existing Explorer session is required.'
    foreach($explorer in $explorers){$explorer.Dispose()}
    $HelperPath=(Resolve-Path -LiteralPath $HelperPath).Path
    $JobHelperPath=(Resolve-Path -LiteralPath $JobHelperPath).Path
    Assert-That ((Hash $HelperPath)-eq $ExpectedSha256.ToLowerInvariant()) 'Helper source hash differs.'
    Assert-That ((Hash $JobHelperPath)-eq $JobSha256) 'Job containment helper differs.'
    $NodePath=(Get-Command $NodePath -ErrorAction Stop).Source
    $PowerShellPath=Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
    $cacheRoot=Safe-Path (Join-Path (Safe-Path $env:LOCALAPPDATA) 'bead-me-up-scotty\tray')
    $EvidenceDirectory=Safe-Path $EvidenceDirectory
    Assert-That (-not(Test-Path -LiteralPath $EvidenceDirectory)) 'Use a fresh evidence directory.'
    if($TraceCleanup){
        Assert-That ([IO.File]::Exists($PriorResultPath)) 'TraceCleanup requires an earlier production result.'
        $prior=[IO.File]::ReadAllText($PriorResultPath)|ConvertFrom-Json
        Assert-That ($prior.mode -eq 'production' -and $prior.status -eq 'failed' -and $prior.source_sha256 -eq $ExpectedSha256.ToLowerInvariant()) 'Trace only after reviewing a failed production run of this exact helper.'
        $Result['prior_result']=$PriorResultPath
    }
    [void][IO.Directory]::CreateDirectory($EvidenceDirectory);$ArtifactRoot=$EvidenceDirectory
    $Result['evidence_directory']=$ArtifactRoot;$Result['source_path']=$HelperPath
    . $JobHelperPath
    Enter-ScottyTaskJob
    $Result['job_helper_sha256']=$JobSha256
    [void][IO.Directory]::CreateDirectory($cacheRoot)
    foreach($action in @('stop','parent-loss')){
        Check-Budget
        $directory=Join-Path $ArtifactRoot $action;[void][IO.Directory]::CreateDirectory($directory)
        $session=Join-Path $cacheRoot ('session-'+[Guid]::NewGuid().ToString('N'))
        Assert-That (-not(Test-Path -LiteralPath $session)) 'A proposed helper session already exists.'
        [void][IO.Directory]::CreateDirectory($session)
        $scriptPath=Join-Path $session 'windows-tray.ps1'
        if($TraceCleanup){[IO.File]::WriteAllText($scriptPath,(Traced-Source ([IO.File]::ReadAllText($HelperPath)) (Join-Path $directory 'cleanup-trace.jsonl')),$Utf8)}
        else{[IO.File]::Copy($HelperPath,$scriptPath,$false)}
        $case=[ordered]@{action=$action;status='failed';helper_script=$scriptPath;helper_session=$session
            executed_sha256=(Hash $scriptPath);parent_pid=$null;helper_pid=$null;helper_exit_code=$null}
        $Cases.Add($case)
        if(-not $TraceCleanup){Assert-That ($case.executed_sha256 -eq $ExpectedSha256.ToLowerInvariant()) 'Copied production helper differs.'}
        $parent=$null;$helper=$null
        try{
            $parent=Start-Owned $NodePath @('--max-old-space-size=16','-e','setInterval(() => {}, 1000);') 'parent' $directory
            $case.parent_pid=$parent.pid
            $helper=Start-Owned $PowerShellPath @('-NoLogo','-NoProfile','-NonInteractive','-STA','-WindowStyle','Hidden','-File',$scriptPath,'-ParentProcessId',[string]$parent.pid,'-Url','http://127.0.0.1:1','-CacheDirectory',$session) 'helper' $directory
            $case.helper_pid=$helper.pid
            Wait-Until {
                if($helper.process.HasExited){throw 'Helper exited before READY.'}
                (Read-Captured $helper.stdout_path) -match '(?m)^READY\r?$'
            } 'Helper did not report READY.' 15
            $case['ready_utc']=[DateTime]::UtcNow.ToString('o')
            if($action -eq 'stop'){$helper.process.StandardInput.WriteLine('STOP');$helper.process.StandardInput.Flush()}
            else{$parent.process.Kill();Wait-Until {$parent.process.HasExited} 'Disposable parent did not exit.' 3}
            Wait-Until {$helper.process.HasExited} 'Helper did not stop.' 12
            Finish-Streams $helper;$case.helper_exit_code=$helper.exit_code
            $case['script_removed']=-not [IO.File]::Exists($scriptPath)
            $case['session_removed']=-not [IO.Directory]::Exists($session)
            Assert-That ($helper.exit_code -eq 0) 'Helper returned a failure exit status; inspect raw stderr.'
            Assert-That ($case.script_removed -and $case.session_removed) 'Helper exited but left its exact script or session.'
            $case.status='passed'
        }catch{$case['error']=$_.Exception.Message}
        finally{
            # Include a child registered by Start-Owned even if later setup threw.
            foreach($entry in @($Owned|Where-Object{$_.directory -eq $directory}|Sort-Object kind)){
                try{
                    if(-not $entry.process.HasExited){$entry.process.Kill();Assert-That ($entry.process.WaitForExit(2000)) 'Owned child did not terminate.'}
                    Finish-Streams $entry
                }catch{$CleanupErrors.Add($_.Exception.Message)}
            }
            foreach($entry in @($Owned|Where-Object{$_.directory -eq $directory})){
                $case[$entry.kind+'_pid']=$entry.pid
                $case[$entry.kind+'_exit_code']=$entry.exit_code
            }
            if([IO.Directory]::Exists($session)){
                $case['remaining_entries']=@(Get-ChildItem -LiteralPath $session -Force|Select-Object Name,Length,Attributes)
            }
            [IO.File]::WriteAllText((Join-Path $directory 'case.json'),($case|ConvertTo-Json -Depth 8),$Utf8)
        }
    }
    if(@($Cases|Where-Object{$_.status -ne 'passed'}).Count -eq 0 -and $CleanupErrors.Count -eq 0){$Result.status='passed'}
}catch{$Result['error']=$_.Exception.Message}
finally{
    foreach($entry in $Owned){
        try{
            if(-not $entry.process.HasExited){$entry.process.Kill();Assert-That ($entry.process.WaitForExit(1000)) 'Owned process survived final cleanup.'}
            Finish-Streams $entry
        }catch{$CleanupErrors.Add($_.Exception.Message)}
        finally{$entry.process.Dispose()}
    }
    if($CleanupErrors.Count -gt 0){$Result.status='failed'}
    $Result['peak_total_resident_bytes']=$PeakResident
    $Result['elapsed_seconds']=([DateTime]::UtcNow-$Started).TotalSeconds
    $Result['finished_utc']=[DateTime]::UtcNow.ToString('o')
    $Result['processes']=@($Owned|ForEach-Object{@{kind=$_.kind;pid=$_.pid;exit_code=$_.exit_code;command=$_.command;arguments=$_.arguments;stdout_path=$_.stdout_path;stderr_path=$_.stderr_path}})
    $json=$Result|ConvertTo-Json -Depth 10
    if($null -ne $ArtifactRoot){[IO.File]::WriteAllText((Join-Path $ArtifactRoot 'result.json'),$json,$Utf8)}
    [Console]::Out.WriteLine($json)
    $Self.Dispose()
}
if($Result.status -ne 'passed'){exit 1}
exit 0
