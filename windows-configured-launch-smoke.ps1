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
    [ValidateRange(45,180)][int]$TimeoutSeconds=120,
    [ValidateRange(256,768)][int]$MaxOwnedResidentMiB=512
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
$Result=[ordered]@{schema_version=1;status='failed';started_utc=$Started.ToString('o');repository=$RepositoryPath
    port=$Port;priority='BelowNormal';node_heap_mib=256;timeout_seconds=$TimeoutSeconds
    owned_resident_limit_mib=$MaxOwnedResidentMiB;interactive_session_id=$SessionId
    commands=$Commands;requests=$Requests;cleanup='pending'}

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
    $record=$records[0];$fileIndex=[Array]::IndexOf([object[]]$record.args,'-File')
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
    return @{helper_script=$helper;helper_sha256=$helperHash;executed_script=$executed;fixture_sha256=$fixtureHash}
}
function Observe-Record($Record){
    Assert-That ($Record.kind -in @('controller','server','tray','native') -and $Record.pid -gt 0) 'Invalid process ownership record.'
    $key=[string]$Record.kind+':'+[string]$Record.pid+':'+[string]$Record.startedAfter
    if($Seen.Contains($key)){return}
    $process=Get-Process -Id $Record.pid -ErrorAction SilentlyContinue
    if($null -eq $process){return}
    try{
        [void]$process.Handle
        $birth=([DateTimeOffset]$process.StartTime.ToUniversalTime()).ToUnixTimeMilliseconds()
        Assert-That ($birth -ge ($Record.startedAfter-50) -and $birth -le ($Record.recordedAt+50)) 'Recorded PID has a different birth time.'
        Assert-That ($process.MainModule.FileName -ieq [IO.Path]::GetFullPath([string]$Record.command)) 'Recorded PID has a different executable.'
        if($Record.kind -eq 'controller'){
            Assert-That ($null -ne $Launcher -and $Record.parentPid -eq $Launcher.process.Id) 'The controller is not owned by this batch launch.'
            $identity=Get-CimInstance -ClassName Win32_Process -Filter ('ProcessId = '+$Record.pid) -OperationTimeoutSec 2
            Assert-That ($null -ne $identity -and $identity.ParentProcessId -eq $Launcher.process.Id) 'Controller OS parent differs.'
            Assert-That ([IO.Path]::GetFullPath([string]$Record.entry)-ieq $EntryPoint -and ([string]$identity.CommandLine)-match '[\\/]bin[\\/]bead-me-up-scotty\.mjs') 'Controller is not the installed CLI entrypoint.'
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
    foreach($record in @(Read-Lines 'processes.jsonl')){Observe-Record $record}
    $native=@(Read-Lines 'native.jsonl')
    foreach($record in @($native|Where-Object{$_.phase -eq 'start'})){
        # Completed short commands need their close receipt, not a fresh lookup
        # of a PID that Windows may have already reassigned.
        if(@($native|Where-Object{$_.phase -eq 'close' -and $_.pid -eq $record.pid -and $_.startedAfter -eq $record.startedAfter}).Count -eq 0){Observe-Record $record}
    }
}
function Check-Budget{
    Observe-Processes
    $resident=0L
    foreach($entry in $Owned){if(-not $entry.process.HasExited){$entry.process.Refresh();$resident+=$entry.process.WorkingSet64}}
    $Self.Refresh();$resident+=$Self.WorkingSet64;$script:PeakResident=[Math]::Max($script:PeakResident,$resident)
    foreach($kind in @('controller','server','tray')){Assert-That (@($Owned|Where-Object{$_.kind -eq $kind -and -not $_.process.HasExited}).Count -le 1) ('More than one owned '+$kind+' is live.')}
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
    $NodePath=(Get-Command node.exe).Source;$CmdPath=Join-Path $env:SystemRoot 'System32\cmd.exe'
    $Result['node_executable']=$NodePath
    $Result['source_sha256']=@{}
    foreach($file in @($Batch,$EntryPoint,$Observer,(Join-Path $RepositoryPath 'scripts\fixtures\windows-tray-click.ps1'),(Join-Path $RepositoryPath 'bin\windows-tray.ps1'),$EnvironmentFile,$JobHelper)){$Result.source_sha256[$file]=Hash $file}
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
    $null=Native 'init' @('init','--prefix','launchsmoke')
    $Preload=Join-Path $ArtifactRoot 'configured-launch-observer.mjs'
    [IO.File]::WriteAllText($Preload,@'
import fs from 'node:fs';
import path from 'node:path';
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
}
'@,$Utf8)
    $start=[Diagnostics.ProcessStartInfo]::new();$start.FileName=$CmdPath
    $start.Arguments='/d /s /c ""'+$Batch+'" --no-open --port '+$Port+'"'
    $start.WorkingDirectory=$RepositoryPath;$start.UseShellExecute=$false;$start.CreateNoWindow=$true
    $start.RedirectStandardInput=$true;$start.RedirectStandardOutput=$true;$start.RedirectStandardError=$true
    foreach($key in @('BEAD_BIN','BEAD_WORKSPACE_ROOT','BEADS_REPO','NEEDLE_BEAD_ID','NEEDLE_BEAD_FENCING_TOKEN','BMUS_SERVE_CMD')){$start.EnvironmentVariables.Remove($key)}
    foreach($pair in @{
        NODE_OPTIONS=('--max-old-space-size=256 --import='+([Uri]$Preload).AbsoluteUri)
        XDG_CONFIG_HOME=$ConfigDirectory;TEMP=$TempDirectory;TMP=$TempDirectory;BEADS_ACTOR='scotty-launcher-smoke';RAYON_NUM_THREADS='1';NEXT_TELEMETRY_DISABLED='1'
        BMUS_TRAY='1';SCOTTY_TRAY_SMOKE_DIR=$ArtifactRoot;SCOTTY_TRAY_SMOKE_ACTION='exit'
        SCOTTY_SMOKE_ENTRY=$EntryPoint;SCOTTY_SMOKE_EXPECTED_BEAD=$BeadExe;SCOTTY_SMOKE_WORKSPACE=$Workspace;SCOTTY_SMOKE_TRAY_OBSERVER=$Observer
    }.GetEnumerator()){$start.EnvironmentVariables[$pair.Key]=[string]$pair.Value}
    $process=[Diagnostics.Process]::new();$process.StartInfo=$start
    Assert-That ($process.Start()) 'The installed batch launcher did not start.'
    $entry=Add-Owned $process 'batch'
    $Launcher=@{process=$process;stdout=$null;stderr=$null};$process.StandardInput.Close()
    $Launcher.stdout=$process.StandardOutput.ReadToEndAsync();$Launcher.stderr=$process.StandardError.ReadToEndAsync()
    Add-Type -AssemblyName System.Net.Http
    $handler=[Net.Http.HttpClientHandler]::new();$handler.UseProxy=$false
    $Client=[Net.Http.HttpClient]::new($handler);$Client.Timeout=[TimeSpan]::FromSeconds(20);$Client.MaxResponseContentBufferSize=262144
    Wait-Until {
        Assert-That (-not $Launcher.process.HasExited) 'The batch launcher exited before readiness.'
        return @($Owned|Where-Object{$_.kind -in @('controller','server','tray') -and -not $_.process.HasExited}).Count -eq 3
    } 'The controller, Next server and tray did not all start.' 30
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
    Wait-Until {@($Owned|Where-Object{$_.kind -in @('batch','controller','server','tray') -and -not $_.process.HasExited}).Count -eq 0} 'Tray Exit left an owned launcher, controller, server or helper running.' 15
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
    Assert-That (@($children|Where-Object{$_.kind -eq 'server'}).Count -eq 1 -and @($children|Where-Object{$_.kind -eq 'tray'}).Count -eq 1) 'The configured launch did not use exactly one server and one tray helper.'
    $native=@(Read-Lines 'native.jsonl' -Final);$invocations=@($native|Where-Object{$_.phase -eq 'start'})
    Assert-That ($invocations.Count -gt 0) 'No actual default-pin invocations were observed.'
    foreach($call in $invocations){
        Assert-That ([IO.Path]::GetFullPath($call.command)-ieq $BeadExe -and [IO.Path]::GetFullPath($call.envPin)-ieq $BeadExe -and [IO.Path]::GetFullPath($call.cwd)-ieq $Workspace) 'An actual native invocation used a different pin or workspace.'
        $closed=@($native|Where-Object{$_.phase -eq 'close' -and $_.pid -eq $call.pid -and $_.startedAfter -eq $call.startedAfter})
        Assert-That ($closed.Count -eq 1 -and $closed[0].code -eq 0 -and $null -eq $closed[0].signal) 'A native API invocation lacks successful process completion.'
    }
    $Result['native_invocations']=$invocations.Count;$Result.status='passed'
}catch{$Result['error']=$_.Exception.Message}
finally{
    if($null -ne $Client){$Client.CancelPendingRequests();$Client.Dispose()}
    if($null -ne $ArtifactRoot){try{Observe-Processes}catch{$CleanupErrors.Add($_.Exception.Message)}}
    foreach($kind in @('batch','controller','server','tray','native','fixture-cli')){
        foreach($entry in @($Owned|Where-Object{$_.kind -eq $kind})){
            try{if(-not $entry.process.HasExited){$entry.process.Kill();Assert-That ($entry.process.WaitForExit(2000)) 'An owned process did not stop.'};$entry.exit_code=$entry.process.ExitCode}
            catch{$CleanupErrors.Add($_.Exception.Message)}
        }
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
    $Result['cleanup_errors']=@($CleanupErrors)
    if($CleanupErrors.Count -gt 0 -or -not $Result.port_free){$Result.status='failed'}
    $Result.cleanup=if($Result.status -eq 'passed'){'passed; all observed owned processes exited and port is free'}else{'owned handles stopped where possible; the dedicated PowerShell Job reclaims any unobserved descendants on this process exit'}
    $Result['completed_utc']=[DateTime]::UtcNow.ToString('o')
    foreach($entry in $Owned){$entry.process.Dispose()}
    $json=ConvertTo-Json -InputObject $Result -Depth 8
    if($null -ne $ArtifactRoot){[IO.File]::WriteAllText((Join-Path $ArtifactRoot 'result.json'),$json,$Utf8)}
    Write-Output $json
}
if($Result.status -ne 'passed'){exit 1}
