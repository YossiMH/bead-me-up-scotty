#requires -Version 5.1
<#
Install accepted, already-qualified source/runtime bytes. Run in a fresh hidden
PowerShell process after root accepts the execution/review receipts. The sibling
windows-task-job.ps1 must be hash-verified by the outer delivery manifest.
No application, browser, package installation or build is started. The result
and rollback copies stay in the new task-owned OutputDirectory.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][ValidatePattern('^[0-9a-f]{40}$')][string]$ScottySourceCommit,
    [Parameter(Mandatory=$true)][ValidatePattern('^[0-9a-f]{40}$')][string]$BackendSourceCommit,
    [Parameter(Mandatory=$true)][string]$PreservationManifest,
    [Parameter(Mandatory=$true)][string]$RuntimeManifest,
    [Parameter(Mandatory=$true)][string]$StageNextDirectory,
    [Parameter(Mandatory=$true)][string]$BeadExe,
    [Parameter(Mandatory=$true)][ValidatePattern('^[0-9a-f]{64}$')][string]$BeadSha256,
    [Parameter(Mandatory=$true)][string]$BeadProvenance,
    [Parameter(Mandatory=$true)][string]$OutputDirectory,
    [ValidateRange(1,65535)][int[]]$ScottyPorts=@(3000)
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
[Diagnostics.Process]::GetCurrentProcess().PriorityClass='BelowNormal'
$Utf8=[Text.UTF8Encoding]::new($false,$true)
$TaskRoot='F:\Dev\.bead-edit-20261111'
$Scotty='F:\Dev\bead-me-up-scotty'
$Backend='F:\Dev\bead-rs'
$ScottyBefore='459a74537cbbe1dff521c6fc7ad1ce3ec2890683'
$ScottyBaseline='55f17568be93442abc6e4725d3e159448e0c9ab5'
$BackendBefore='afac9fa0ce9533a707d745018d16a25e4ccff492'
$PushUrls=@{$Scotty='https://github.com/YossiMH/bead-me-up-scotty.git';$Backend='https://github.com/YossiMH/bead-rs.git'}
$OldPinSha='376537b7917f18d33383a3e4bd3eb9e0955bb42d1a60b73aef5c81865662af28'
$OldPin=Join-Path $Scotty '.scotty-local\bin\bead-376537b7917f.exe'
$ExpectedPaths=@('.gitignore','bin/backend-binary.mjs','bin/bead-me-up-scotty.mjs',
    'docs/backend-compatibility.md','launch-scotty.bat','package.json',
    'scripts/fixtures/owned-process-tree.mjs','scripts/support/git-fixture.mjs',
    'scripts/support/owned-process.mjs','scripts/support/register-source.mjs',
    'scripts/test-bead-binary-option.mjs','scripts/test-local-bead-rs-browser.mjs',
    'scripts/test-local-bead-rs.mjs','scripts/test-owned-process.mjs',
    'scripts/test-windows-cdb-containment.ps1')
$Events=[Collections.Generic.List[object]]::new()
$Result=[ordered]@{status='failed';started_utc=[DateTime]::UtcNow.ToString('o');
    requested_source=@{scotty=$ScottySourceCommit;backend=$BackendSourceCommit};
    binary_sha256=$BeadSha256;events=$Events;application='not_started_by_installer';rollback='not_required'}

function Assert-That([bool]$Condition,[string]$Message){if(-not $Condition){throw $Message}}
function Hash([string]$Path){return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()}
function Hash-Bytes([byte[]]$Bytes){
    $algorithm=[Security.Cryptography.SHA256]::Create()
    try{return ([BitConverter]::ToString($algorithm.ComputeHash($Bytes))).Replace('-','').ToLowerInvariant()}finally{$algorithm.Dispose()}
}
function Safe-Path([string]$Value,[string]$RequiredRoot){
    Assert-That ($Value -match '^F:[\\/]') 'Use an absolute path on F:.'
    $full=[IO.Path]::GetFullPath($Value).TrimEnd('\','/')
    Assert-That ($full.StartsWith($RequiredRoot+'\',[StringComparison]::OrdinalIgnoreCase) -or $full.Equals($RequiredRoot,[StringComparison]::OrdinalIgnoreCase)) 'Path leaves its required root.'
    $cursor=$full
    while($cursor){
        if(Test-Path -LiteralPath $cursor){Assert-That (((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0) ('Reparse point: '+$cursor)}
        $parent=[IO.Directory]::GetParent($cursor);$cursor=if($parent){$parent.FullName}else{$null}
    }
    return $full
}
function Save-Result{
    $Result['updated_utc']=[DateTime]::UtcNow.ToString('o')
    $destination=Join-Path $OutputDirectory 'install-result.json'
    $temporary=Join-Path $OutputDirectory 'install-result.json.next'
    [IO.File]::WriteAllText($temporary,(ConvertTo-Json -InputObject $Result -Depth 10),$Utf8)
    if([IO.File]::Exists($destination)){[IO.File]::Replace($temporary,$destination,$null)}else{[IO.File]::Move($temporary,$destination)}
}
function Record([string]$Phase,[object]$Detail){
    $Events.Add(@{phase=$Phase;utc=[DateTime]::UtcNow.ToString('o');detail=$Detail})
    Save-Result
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
function Run-Native([string]$Program,[string[]]$Arguments,[string]$Directory,[int[]]$AllowedExitCodes=@(0),[string]$IndexFile){
    $start=[Diagnostics.ProcessStartInfo]::new();$start.FileName=$Program
    $start.Arguments=(($Arguments|ForEach-Object{Quote-Argument $_}) -join ' ')
    $start.WorkingDirectory=$Directory;$start.UseShellExecute=$false;$start.CreateNoWindow=$true
    $start.RedirectStandardOutput=$true;$start.RedirectStandardError=$true
    $start.EnvironmentVariables['GIT_TERMINAL_PROMPT']='0'
    $start.EnvironmentVariables['GCM_INTERACTIVE']='never'
    $start.EnvironmentVariables['GIT_OPTIONAL_LOCKS']='0'
    if($IndexFile){$start.EnvironmentVariables['GIT_INDEX_FILE']=$IndexFile}
    $child=[Diagnostics.Process]::new();$child.StartInfo=$start
    $started=$false
    try{
        $started=$child.Start();Assert-That $started 'Could not start owned install command.'
        try{$child.PriorityClass='BelowNormal'}catch{if(-not $child.HasExited){throw}}
        $out=$child.StandardOutput.ReadToEndAsync();$err=$child.StandardError.ReadToEndAsync()
        Assert-That ($child.WaitForExit(45000)) 'Install command exceeded 45 seconds; reconcile its outcome before retry.'
        Assert-That ($out.Wait(3000) -and $err.Wait(3000)) 'Install command streams did not close within 3 seconds.'
        $stdout=$out.GetAwaiter().GetResult();$stderr=$err.GetAwaiter().GetResult()
        Assert-That ($stdout.Length -le 262144 -and $stderr.Length -le 32768) 'Install command output exceeded its expected bound.'
        Assert-That ($AllowedExitCodes -contains $child.ExitCode) ('Install command failed: '+$Program+' '+($Arguments -join ' ')+' '+$stderr)
        return [string]$stdout
    }finally{
        if($started -and -not $child.HasExited){$child.Kill();[void]$child.WaitForExit(3000)}
        $child.Dispose()
    }
}
function Git([string]$Repository,[string[]]$Arguments,[int[]]$AllowedExitCodes=@(0),[string]$IndexFile){
    return Run-Native $GitExe (@('-C',$Repository,'-c','gc.auto=0','-c','maintenance.auto=false')+$Arguments) $Repository $AllowedExitCodes $IndexFile
}
function Git-Index([string]$Repository,[string]$IndexFile,[string[]]$Arguments){
    return Git $Repository $Arguments @(0) $IndexFile
}
function Head([string]$Repository){return (Git $Repository @('rev-parse','HEAD')).Trim()}
function Status([string]$Repository){return Git $Repository @('status','--porcelain=v1','-z','--untracked-files=all')}
function Assert-Head([string]$Repository,[string]$Expected){
    Assert-That ((Git $Repository @('symbolic-ref','--quiet','HEAD')).Trim() -eq 'refs/heads/main') ('Expected main in '+$Repository)
    Assert-That ((Head $Repository) -eq $Expected) ('HEAD changed in '+$Repository)
}
function Assert-Clean([string]$Repository){Assert-That ((Status $Repository).Length -eq 0) ('Unexpected working/index changes in '+$Repository)}
function Remote-Main([string]$Repository){
    $value=(Git $Repository @('ls-remote','--heads',$PushUrls[$Repository],'refs/heads/main')).Trim()
    Assert-That ($value -match '^([0-9a-f]{40})\s+refs/heads/main$') 'Could not identify exact user-fork main.'
    return $Matches[1]
}
function Assert-NoAutomaticHooks([string]$Repository){
    $directory=(Git $Repository @('config','--path','--get','core.hooksPath') @(0,1)).Trim()
    if(-not $directory){$directory=(Git $Repository @('rev-parse','--git-path','hooks')).Trim()}
    if(-not [IO.Path]::IsPathRooted($directory)){$directory=Join-Path $Repository $directory}
    foreach($hook in @('post-index-change','reference-transaction','post-merge','pre-push')){
        Assert-That (-not [IO.File]::Exists((Join-Path $directory $hook))) ('Existing '+$hook+' hook needs review before this bounded install: '+$directory)
    }
}
function Assert-NoProtectedDiff([string]$Repository,[string]$Before,[string]$After){
    $names=(Git $Repository @('diff','--name-only','-z',$Before,$After,'--')).Split([char]0)|Where-Object{$_}
    foreach($name in $names){Assert-That ($name -notmatch '^(?:\.env(?:[./]|$)|\.beads(?:/|$)|\.dolt(?:/|$)|\.scotty-local(?:/|$)|node_modules(?:/|$)|\.next(?:/|$))') ('Incoming source touches protected state: '+$name)}
}
function Assert-DocumentedDescendant([string]$Repository,[string]$Built,[string]$Final,[string]$Allowed){
    $null=Git $Repository @('merge-base','--is-ancestor',$Built,$Final)
    $names=(Git $Repository @('diff','--name-only','-z',$Built,$Final,'--')).Split([char]0)|Where-Object{$_}
    foreach($name in $names){Assert-That ($name -match $Allowed) ('Runtime differs from accepted source: '+$name)}
}
function Assert-NoServer{
    $candidates=Get-CimInstance Win32_Process -Filter "Name='node.exe' OR Name='powershell.exe' OR Name='pwsh.exe' OR Name='cmd.exe'" -OperationTimeoutSec 5
    $active=@($candidates|Where-Object{
        $line=([string]$_.CommandLine).Replace('/','\')
        $_.ProcessId -ne $PID -and $line.IndexOf($Scotty+'\',[StringComparison]::OrdinalIgnoreCase) -ge 0 -and
        ($_.Name -eq 'node.exe' -or $line -match 'windows-tray\.ps1|launch-scotty\.bat')
    })
    Assert-That ($active.Count -eq 0) ('Existing Scotty process must be stopped by its owner; PIDs: '+(($active|ForEach-Object{$_.ProcessId}) -join ','))
    $listeners=[Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners()
    $occupied=@($listeners|Where-Object{$ScottyPorts -contains $_.Port}|ForEach-Object{$_.Port}|Select-Object -Unique)
    Assert-That ($occupied.Count -eq 0) ('Expected Scotty port is active: '+($occupied -join ','))
    $Result['last_server_absence_check_utc']=[DateTime]::UtcNow.ToString('o')
}
function Verify-Baseline{
    foreach($file in $Preserved.files){
        $path=Safe-Path (Join-Path $Scotty $file.path) $Scotty
        Assert-That ([IO.File]::Exists($path) -and (Hash $path) -eq $file.sha256 -and (Get-Item -LiteralPath $path).Length -eq $file.bytes) ('Preserved raw source changed: '+$file.path)
    }
}
function Verify-Runtime([string]$Directory){
    $seen=[Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
    foreach($file in $Runtime.files){
        Assert-That ($file.path -match '^\.next/[^\\:]+$' -and $file.path -notmatch '(?:^|/)\.\.?(?:/|$)') 'Unexpected runtime manifest path.'
        Assert-That ($seen.Add([string]$file.path)) 'Duplicate runtime manifest path.'
        $path=Safe-Path (Join-Path $Directory $file.path.Substring(6)) $Directory
        Assert-That ([IO.File]::Exists($path) -and (Hash $path) -eq $file.sha256 -and (Get-Item -LiteralPath $path).Length -eq $file.bytes) ('Runtime hash/size differs: '+$file.path)
    }
    Assert-That ([IO.Directory]::GetFiles($Directory,'*',[IO.SearchOption]::AllDirectories).Count -eq $seen.Count) 'Unexpected staged runtime files.'
    Assert-That ([IO.File]::ReadAllText((Join-Path $Directory 'BUILD_ID')).Trim() -eq $Runtime.build_id) 'Runtime BUILD_ID differs.'
}
function Prepare-Env([string]$NewPin){
    foreach($scope in @('Process','User','Machine')){Assert-That ([string]::IsNullOrEmpty([Environment]::GetEnvironmentVariable('BEAD_BIN',$scope))) ('Higher-precedence BEAD_BIN exists in '+$scope+' environment.')}
    $productionLocal=Join-Path $Scotty '.env.production.local'
    if([IO.File]::Exists($productionLocal)){Assert-That ([IO.File]::ReadAllText($productionLocal,$Utf8) -notmatch '(?m)^(?:\uFEFF)?[ \t]*(?:export[ \t]+)?BEAD_BIN[ \t]*=') 'Higher-precedence .env.production.local BEAD_BIN exists.'}
    $file=Safe-Path (Join-Path $Scotty '.env.local') $Scotty
    Assert-That ([IO.File]::Exists($file)) 'Expected existing .env.local.'
    $bytes=[IO.File]::ReadAllBytes($file);$text=$Utf8.GetString($bytes)
    $assignments=[regex]::Matches($text,'(?m)^(?:\uFEFF)?[ \t]*(?:export[ \t]+)?BEAD_BIN[ \t]*=[ \t]*(?<value>[^\r\n]*)')
    Assert-That ($assignments.Count -eq 1) 'Expected one unambiguous BEAD_BIN assignment.'
    $value=$assignments[0].Groups['value'];$raw=$value.Value
    Assert-That ($raw.Length -gt 0) 'Empty existing BEAD_BIN assignment.'
    $offset=$value.Index;$length=0
    if($raw[0] -eq '"' -or $raw[0] -eq "'"){
        $end=$raw.IndexOf($raw[0],1);Assert-That ($end -gt 0) 'Unterminated BEAD_BIN quote.'
        $old=$raw.Substring(1,$end-1);$tail=$raw.Substring($end+1);$offset++;$length=$end-1
    }else{
        $token=[regex]::Match($raw,'^[^\s#]+');Assert-That $token.Success 'Unrecognized BEAD_BIN value.'
        $old=$token.Value;$tail=$raw.Substring($old.Length);$length=$old.Length
    }
    Assert-That ($tail -match '^[ \t]*(?:#.*)?$') 'Ambiguous content after BEAD_BIN value.'
    Assert-That ($old.Replace('/','\').Equals($OldPin,[StringComparison]::OrdinalIgnoreCase)) 'Existing BEAD_BIN does not select the recorded rollback pin.'
    $replacement=$NewPin.Replace('\','/')
    $updated=$text.Remove($offset,$length).Insert($offset,$replacement)
    $updatedBytes=$Utf8.GetBytes($updated)
    return @{path=$file;before_hash=(Hash-Bytes $bytes);after_hash=(Hash-Bytes $updatedBytes);bytes=$bytes;updated=$updatedBytes}
}

$OutputDirectory=Safe-Path $OutputDirectory $TaskRoot
Assert-That (-not(Test-Path -LiteralPath $OutputDirectory)) 'OutputDirectory must be new; reconcile a prior transaction before retry.'
[void][IO.Directory]::CreateDirectory($OutputDirectory)
[IO.File]::WriteAllText((Join-Path $OutputDirectory 'task-owner.txt'),'bead-edit-20261111 install',$Utf8)
$RuntimeBackup=Join-Path $OutputDirectory 'previous.next'
$RuntimeDestination=Join-Path $Scotty '.next'
$EnvChange=$null
try{
    Assert-That ($ScottyPorts.Count -gt 0) 'Supply the observed Scotty port inventory.'
    foreach($selector in @('GIT_DIR','GIT_WORK_TREE','GIT_COMMON_DIR','GIT_INDEX_FILE')){
        Assert-That ([string]::IsNullOrEmpty([Environment]::GetEnvironmentVariable($selector))) ('Unexpected inherited repository selector: '+$selector)
    }
    $null=Safe-Path $Scotty $Scotty;$null=Safe-Path $Backend $Backend
    $PreservationManifest=Safe-Path $PreservationManifest $TaskRoot
    $RuntimeManifest=Safe-Path $RuntimeManifest $TaskRoot
    $StageNextDirectory=Safe-Path $StageNextDirectory $TaskRoot
    $BeadExe=Safe-Path $BeadExe $TaskRoot
    $BeadProvenance=Safe-Path $BeadProvenance $TaskRoot
    $Preserved=[IO.File]::ReadAllText($PreservationManifest,$Utf8)|ConvertFrom-Json
    $Runtime=[IO.File]::ReadAllText($RuntimeManifest,$Utf8)|ConvertFrom-Json
    $Provenance=[IO.File]::ReadAllText($BeadProvenance,$Utf8)|ConvertFrom-Json
    $provenanceHash=Hash $BeadProvenance
    $Result['input_hashes']=@{preservation_manifest=(Hash $PreservationManifest);runtime_manifest=(Hash $RuntimeManifest);binary_provenance=$provenanceHash}
    Assert-That ($Preserved.commit -eq $ScottyBaseline -and @($Preserved.files).Count -eq 15) 'Preservation manifest identity differs.'
    Assert-That (@(Compare-Object ($ExpectedPaths|Sort-Object) (@($Preserved.files|ForEach-Object{$_.path})|Sort-Object)).Count -eq 0) 'Preservation path allowlist differs.'
    Assert-That ((Hash $BeadExe) -eq $BeadSha256 -and $Provenance.binary_sha256 -eq $BeadSha256) 'Windows binary/provenance hash differs.'
    Assert-That ($Provenance.build_target -in @('x86_64-pc-windows-gnu','x86_64-pc-windows-msvc') -and $Provenance.git_commit_sha -match '^[0-9a-f]{40}$') 'Unexpected Windows binary provenance.'
    Assert-That ($Runtime.source_commit -match '^[0-9a-f]{40}$') 'Invalid runtime source identity.'
    Assert-That ((Hash $OldPin) -eq $OldPinSha) 'Previous pinned binary differs.'
    Verify-Baseline;Verify-Runtime $StageNextDirectory;Assert-NoServer
    foreach($package in @(@('next','16.3.8'),@('react','19.2.4'),@('react-dom','19.2.4'))){
        $manifest=Join-Path $Scotty ('node_modules\'+$package[0]+'\package.json')
        Assert-That (([IO.File]::ReadAllText($manifest,$Utf8)|ConvertFrom-Json).version -eq $package[1]) ('Installed dependency differs: '+$package[0])
    }
    $jobHelper=Join-Path $PSScriptRoot 'windows-task-job.ps1'
    $Result['job_helper_sha256']=Hash $jobHelper
    . $jobHelper
    Enter-ScottyTaskJob
    # Identify the owned index lock even if a failed rename completed before
    # reporting an error and another Git process subsequently acquired a lock.
    Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;
public static class Scotty20261111IndexFile {
    [StructLayout(LayoutKind.Sequential)]
    struct Information {
        public ulong Volume, IndexLow, IndexHigh;
    }
    [DllImport("kernel32.dll", SetLastError=true)]
    static extern bool GetFileInformationByHandleEx(SafeFileHandle file, int type, out Information information, uint size);
    public static string Identity(SafeFileHandle file) {
        Information information;
        // FileIdInfo contains the full 128-bit ReFS identifier. The older
        // BY_HANDLE_FILE_INFORMATION index is not unique on that filesystem.
        if(!GetFileInformationByHandleEx(file,18,out information,24))
            throw new Win32Exception(Marshal.GetLastWin32Error());
        if(information.Volume==0 || (information.IndexHigh==0 && information.IndexLow==0) ||
            (information.IndexHigh==ulong.MaxValue && information.IndexLow==ulong.MaxValue))
            throw new InvalidOperationException("Invalid Windows file identity.");
        return information.Volume.ToString("x16")+":"+
            information.IndexHigh.ToString("x16")+information.IndexLow.ToString("x16");
    }
}
'@
    $GitExe=(Get-Command git.exe -ErrorAction Stop).Source
    foreach($repo in @(@{path=$Scotty;origin='https://github.com/YossiMH/bead-me-up-scotty.git';before=$ScottyBefore;final=$ScottySourceCommit},@{path=$Backend;origin='https://github.com/jedarden/bead-rs.git';before=$BackendBefore;final=$BackendSourceCommit})){
        Assert-Head $repo.path $repo.before
        Assert-That ((Git $repo.path @('remote','get-url','origin')).Trim() -eq $repo.origin) 'Repository origin differs.'
        Assert-NoAutomaticHooks $repo.path
        $null=Git $repo.path @('cat-file','-e',($repo.final+'^{commit}'))
        $null=Git $repo.path @('merge-base','--is-ancestor',$repo.before,$repo.final)
        Assert-NoProtectedDiff $repo.path $repo.before $repo.final
        $remote=Remote-Main $repo.path
        Assert-That ($remote -eq $repo.before) 'User-fork main advanced since the authorized baseline; reconcile before installation.'
        $repo['remote_before']=$remote
        Record 'repository_preflight' $repo
    }
    Assert-Clean $Backend
    Assert-That ((Git $Scotty @('write-tree')).Trim() -eq (Git $Scotty @('rev-parse','HEAD^{tree}')).Trim()) 'Scotty index contains unexpected staged changes.'
    $entries=@((Status $Scotty).Split([char]0)|Where-Object{$_})
    Assert-That ($entries.Count -eq 15) 'Scotty has unexpected additional or missing dirty paths.'
    $tracked=@((Git $Scotty (@('ls-files','-z','--')+$ExpectedPaths)).Split([char]0)|Where-Object{$_})
    foreach($entry in $entries){
        $name=$entry.Substring(3);$expected=if($tracked -contains $name){' M'}else{'??'}
        Assert-That ($ExpectedPaths -contains $name -and $entry.Substring(0,2) -eq $expected) ('Unexpected source status: '+$entry)
    }
    $null=Git $Scotty @('merge-base','--is-ancestor',$ScottyBefore,$ScottyBaseline)
    $null=Git $Scotty @('merge-base','--is-ancestor',$ScottyBaseline,$ScottySourceCommit)
    $lockBlob=(Git $Scotty @('rev-parse',($ScottyBaseline+':package-lock.json'))).Trim()
    Assert-That ((Git $Scotty @('rev-parse',($ScottySourceCommit+':package-lock.json'))).Trim() -eq $lockBlob) 'Final source changes the installed dependency lockfile.'
    Assert-That ((Git $Scotty @('hash-object','--','package-lock.json')).Trim() -eq $lockBlob) 'Installed dependency lockfile differs.'
    Assert-DocumentedDescendant $Scotty $Runtime.source_commit $ScottySourceCommit '^(?:README\.md$|AGENTS\.md$|\.gitignore$|docs/|scripts/test[^/]*$|scripts/fixtures/|scripts/support/)'
    Assert-DocumentedDescendant $Backend $Provenance.git_commit_sha $BackendSourceCommit '^(?:[^/]+\.md$|\.gitignore$|docs/|research/|man/|tests/|\.marathon/)'
    $newPin=Safe-Path (Join-Path $Scotty ('.scotty-local\bin\bead-'+$BeadSha256.Substring(0,12)+'.exe')) $Scotty
    $newProvenance=$newPin+'.metadata.json'
    Assert-That (-not(Test-Path -LiteralPath $newPin) -and -not(Test-Path -LiteralPath $newProvenance)) 'New pin destination already exists; reconcile before retry.'
    $EnvChange=Prepare-Env $newPin
    [IO.File]::WriteAllBytes((Join-Path $OutputDirectory 'env.local.before'),$EnvChange.bytes)
    foreach($file in $Preserved.files){
        $backup=Join-Path (Join-Path $OutputDirectory 'source-before') $file.path
        [void][IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($backup))
        [IO.File]::Copy((Join-Path $Scotty $file.path),$backup,$false)
        Assert-That ((Hash $backup) -eq $file.sha256) 'Source changed during backup.'
    }
    $indexPath=Join-Path $Scotty '.git\index';$indexHash=Hash $indexPath
    [IO.File]::Copy($indexPath,(Join-Path $OutputDirectory 'scotty-index.before'),$false)
    $sourceStatus=Status $Scotty
    Record 'preservation_ready' @{baseline=$ScottyBaseline;source_count=15;index_sha256=$indexHash;environment_sha256=$EnvChange.before_hash;old_pin=$OldPin;old_pin_sha256=$OldPinSha}

    $preparedIndex=Join-Path $OutputDirectory 'scotty-index.prepared'
    [IO.File]::Copy((Join-Path $OutputDirectory 'scotty-index.before'),$preparedIndex,$false)
    Assert-That ((Hash $preparedIndex) -eq $indexHash) 'Preserved index backup differs.'
    $cacheArguments=[Collections.Generic.List[string]]::new()
    $cacheArguments.Add('update-index');$cacheArguments.Add('--add')
    $treeEntries=@((Git $Scotty (@('ls-tree','-z',$ScottyBaseline,'--')+$ExpectedPaths)).Split([char]0)|Where-Object{$_})
    Assert-That ($treeEntries.Count -eq 15) 'Baseline tree does not contain the complete source allowlist.'
    foreach($entry in $treeEntries){
        Assert-That ($entry -match '^(100644|100755) blob ([0-9a-f]{40})\t(.+)$') 'Unexpected baseline tree entry.'
        $mode=$Matches[1];$blob=$Matches[2];$name=$Matches[3]
        $file=@($Preserved.files|Where-Object{$_.path -ceq $name})
        Assert-That ($file.Count -eq 1 -and $file[0].git_blob -eq $blob) ('Preserved Git blob differs: '+$name)
        $cacheArguments.Add('--cacheinfo');$cacheArguments.Add($mode+','+$blob+','+$name)
    }
    # The verified raw bytes stay untouched, including the four recorded CRLF
    # files. Only the accepted baseline blob/mode mapping enters this private index.
    $null=Git-Index $Scotty $preparedIndex $cacheArguments.ToArray()
    Assert-That ((Git-Index $Scotty $preparedIndex @('write-tree')).Trim() -eq (Git $Scotty @('rev-parse',($ScottyBaseline+'^{tree}'))).Trim()) 'Prepared index tree does not exactly match the preserved baseline.'
    $preparedIndexHash=Hash $preparedIndex
    Record 'private_index_prepared' @{path=$preparedIndex;sha256=$preparedIndexHash;tree=$ScottyBaseline;raw_files_unchanged=15}

    Verify-Baseline;Assert-Head $Scotty $ScottyBefore;Assert-Head $Backend $BackendBefore;Assert-Clean $Backend;Assert-NoServer
    Assert-That ((Hash $indexPath) -eq $indexHash -and (Status $Scotty) -eq $sourceStatus) 'Scotty index/source changed before adoption.'
    Assert-That ((Remote-Main $Scotty) -eq $ScottyBefore -and (Remote-Main $Backend) -eq $BackendBefore) 'User-fork main changed before baseline adoption.'
    Record 'baseline_adoption_started' @{expected_old=$ScottyBefore;new=$ScottyBaseline}
    $indexLockPath=$indexPath+'.lock';$indexLock=$null;$ownedLock=$null
    try{
        $indexLock=[IO.File]::Open($indexLockPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
        $ownedLock=@{path=$indexLockPath;identity=$null}
        $ownedLock.identity=[Scotty20261111IndexFile]::Identity($indexLock.SafeFileHandle)
        Record 'index_lock_acquired' $ownedLock
        Assert-That ((Hash $indexPath) -eq $indexHash) 'Another Git operation changed the index; its staged content is preserved.'
        Assert-Head $Scotty $ScottyBefore;Verify-Baseline
        $null=Git-Index $Scotty $preparedIndex @('diff','--exit-code','--quiet','--')
        Assert-That ((Git-Index $Scotty $preparedIndex @('ls-files','--others','--exclude-standard','-z')).Length -eq 0) 'New untracked source appeared before baseline adoption.'
        Assert-That ((Hash $preparedIndex) -eq $preparedIndexHash) 'Prepared index changed during validation.'
        $preparedBytes=[IO.File]::ReadAllBytes($preparedIndex)
        Assert-That ((Hash-Bytes $preparedBytes) -eq $preparedIndexHash) 'Prepared index bytes changed before publication.'
        $indexLock.Write($preparedBytes,0,$preparedBytes.Length);$indexLock.Flush($true)
        $indexLock.Dispose();$indexLock=$null
        $replacedIndex=Join-Path $OutputDirectory 'scotty-index.replaced'
        Record 'index_publication_started' @{expected_old=$indexHash;prepared=$preparedIndexHash;replaced_backup=$replacedIndex;lock_identity=$ownedLock.identity}
        [IO.File]::Replace($indexLockPath,$indexPath,$replacedIndex)
        $ownedLock=$null
        Assert-That ((Hash $replacedIndex) -eq $indexHash) 'Unexpected index replacement detected; replaced bytes retained for reconciliation.'
        Assert-That ((Hash $indexPath) -eq $preparedIndexHash) 'Published index changed before baseline ref adoption.'
        Record 'index_published' @{sha256=$preparedIndexHash;replaced_backup=$replacedIndex}
    }finally{
        if($null -ne $indexLock){$indexLock.Dispose()}
        if($null -ne $ownedLock -and [IO.File]::Exists($ownedLock.path)){
            $inspection=$null
            try{
                if($null -eq $ownedLock.identity){
                    # Identity lookup failed immediately after our successful
                    # CreateNew; publication has not been attempted.
                    [IO.File]::Delete($ownedLock.path)
                }else{
                    $inspection=[IO.File]::Open($ownedLock.path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
                    $identity=[Scotty20261111IndexFile]::Identity($inspection.SafeFileHandle)
                    $inspection.Dispose();$inspection=$null
                    if($identity -eq $ownedLock.identity){[IO.File]::Delete($ownedLock.path)}
                    else{$Result['index_lock_cleanup']='A different lock identity was preserved.'}
                }
            }catch{$Result['index_lock_cleanup']='Lock identity could not be verified/removed: '+$_.Exception.Message}
            finally{if($null -ne $inspection){$inspection.Dispose()}}
        }
    }
    Assert-Head $Scotty $ScottyBefore
    $null=Git $Scotty @('update-ref','-m','Adopt verified preserved Scotty source baseline','refs/heads/main',$ScottyBaseline,$ScottyBefore)
    Assert-Head $Scotty $ScottyBaseline;Assert-Clean $Scotty
    Record 'baseline_adopted' @{commit=$ScottyBaseline}
    foreach($repo in @(@{path=$Scotty;before=$ScottyBaseline;final=$ScottySourceCommit},@{path=$Backend;before=$BackendBefore;final=$BackendSourceCommit})){
        Assert-Head $repo.path $repo.before;Assert-Clean $repo.path;Assert-NoServer
        Record 'source_fast_forward_started' $repo
        $null=Git $repo.path @('merge','--ff-only',$repo.final)
        Assert-Head $repo.path $repo.final;Assert-Clean $repo.path
        Record 'source_fast_forwarded' $repo
    }

    Assert-NoServer;Verify-Runtime $StageNextDirectory
    $null=Safe-Path $RuntimeDestination $Scotty
    Assert-That ([IO.Directory]::Exists($RuntimeDestination)) 'Expected previous .next runtime for rollback.'
    Record 'runtime_swap_started' @{staged=$StageNextDirectory;destination=$RuntimeDestination;backup=$RuntimeBackup;build_id=$Runtime.build_id}
    [IO.Directory]::Move($RuntimeDestination,$RuntimeBackup)
    try{[IO.Directory]::Move($StageNextDirectory,$RuntimeDestination)}catch{
        [IO.Directory]::Move($RuntimeBackup,$RuntimeDestination)
        Record 'runtime_restored_after_move_failure' @{destination=$RuntimeDestination}
        throw
    }
    Record 'runtime_installed' @{build_id=$Runtime.build_id;rollback_directory=$RuntimeBackup}
    Assert-That ((Hash $BeadExe) -eq $BeadSha256 -and (Hash $BeadProvenance) -eq $provenanceHash) 'Staged executable/provenance changed before installation.'
    Record 'pin_copy_started' @{path=$newPin;sha256=$BeadSha256}
    [IO.File]::Copy($BeadExe,$newPin,$false);[IO.File]::Copy($BeadProvenance,$newProvenance,$false)
    Assert-That ((Hash $newPin) -eq $BeadSha256 -and (Hash $OldPin) -eq $OldPinSha -and (Hash $newProvenance) -eq $provenanceHash) 'Installed/previous pin or provenance hash differs.'
    Record 'pin_copied' @{path=$newPin;provenance=$newProvenance;sha256=$BeadSha256}
    Assert-That ((Hash $EnvChange.path) -eq $EnvChange.before_hash) 'Environment changed before pin selection.'
    $temporary=Join-Path $Scotty ('.env.local.bead-install-'+[Guid]::NewGuid().ToString('N')+'.tmp')
    $stream=[IO.File]::Open($temporary,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
    try{$stream.Write($EnvChange.updated,0,$EnvChange.updated.Length)}finally{$stream.Dispose()}
    Record 'pin_selection_started' @{environment_before=$EnvChange.before_hash;temporary=$temporary;selected_pin=$newPin}
    $atomicBackup=Join-Path $OutputDirectory 'env.local.replaced'
    Assert-That ((Hash $EnvChange.path) -eq $EnvChange.before_hash -and (Hash $temporary) -eq $EnvChange.after_hash) 'Environment changed immediately before replacement.'
    [IO.File]::Replace($temporary,$EnvChange.path,$atomicBackup)
    Assert-That ((Hash $atomicBackup) -eq $EnvChange.before_hash) 'Concurrent environment replacement detected; both versions retained for reconciliation.'
    Assert-That ((Hash $EnvChange.path) -eq $EnvChange.after_hash) 'Installed environment bytes differ.'
    Record 'pin_selected' @{path=$newPin;environment_after=(Hash $EnvChange.path);backup=$atomicBackup}

    foreach($repo in @(@{path=$Scotty;before=$ScottyBefore;final=$ScottySourceCommit},@{path=$Backend;before=$BackendBefore;final=$BackendSourceCommit})){
        Assert-Head $repo.path $repo.final;Assert-Clean $repo.path
        $remote=Remote-Main $repo.path
        Assert-That ($remote -eq $repo.before) 'User-fork main changed before publication; reconcile without force.'
        Record 'source_push_started' @{repository=$repo.path;url=$PushUrls[$repo.path];expected_remote=$remote;commit=$repo.final}
        $null=Git $repo.path @('push',$PushUrls[$repo.path],($repo.final+':refs/heads/main'))
        Assert-That ((Remote-Main $repo.path) -eq $repo.final) 'Remote main differs after normal push; reconcile before retry.'
        Record 'source_published' @{repository=$repo.path;commit=$repo.final}
    }
    Assert-NoServer
    Assert-Head $Scotty $ScottySourceCommit;Assert-Clean $Scotty
    Assert-Head $Backend $BackendSourceCommit;Assert-Clean $Backend
    Assert-That ((Hash $EnvChange.path) -eq $EnvChange.after_hash) 'Environment changed during publication; reconcile the final selection.'
    $Result.application='stopped_at_completion'
    $Result['selected_pin']=$newPin;$Result['runtime_build_id']=$Runtime.build_id
    $Result['source_heads']=@{scotty=(Head $Scotty);backend=(Head $Backend)}
    $Result.status='passed';Record 'completed' @{application='stopped';old_pin_retained=$OldPin;previous_runtime=$RuntimeBackup}
}catch{
    $Result.status='failed'
    $Result['error']=$_.Exception.Message
    $Result['rollback']='Reconcile the recorded phase before retry; preserved files and previous runtime are retained. No automatic Git/index reset or process restart.'
}finally{
    $Result['completed_utc']=[DateTime]::UtcNow.ToString('o');Save-Result
    Write-Output (ConvertTo-Json -InputObject $Result -Depth 10)
}
if($Result.status -ne 'passed'){exit 1}
