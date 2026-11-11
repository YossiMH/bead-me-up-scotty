#requires -Version 5.1
[CmdletBinding()]
param(
 [Parameter(Mandatory=$true)][ValidatePattern('^[0-9a-f]{40}$')][string]$ExpectedCommit,
 [Parameter(Mandatory=$true)][ValidatePattern('^[0-9a-f]{64}$')][string]$ExpectedManifestSha256,
 [Parameter(Mandatory=$true)][ValidatePattern('^transfer-v[0-9]+$')][string]$TransferName
)
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
[Diagnostics.Process]::GetCurrentProcess().PriorityClass='BelowNormal'
$env:GCM_INTERACTIVE='Never'
$job=Join-Path $PSScriptRoot 'windows-task-job.ps1'
if((Get-FileHash -LiteralPath $job -Algorithm SHA256).Hash.ToLowerInvariant()-ne '2758a6ff94c0eecdfa360363469069dfa8470efc1f91228812146919a978921f'){throw 'Task Job helper differs.'}
. $job
Enter-ScottyTaskJob
function Assert-That([bool]$Condition,[string]$Message) { if(-not $Condition){throw $Message} }
function Hash([string]$Path) { return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant() }
function Quote-Argument([string]$Value) {
    $builder=[Text.StringBuilder]::new()
    [void]$builder.Append('"')
    $slashes=0
    foreach($character in $Value.ToCharArray()){
        if($character -eq '\'){$slashes++;continue}
        $count=if($character -eq '"'){2*$slashes+1}else{$slashes}
        [void]$builder.Append(('\'*$count));[void]$builder.Append($character);$slashes=0
    }
    [void]$builder.Append(('\'*(2*$slashes)));[void]$builder.Append('"')
    return $builder.ToString()
}
function Run-Native([string]$Program,[string[]]$Arguments,[string]$Directory){
    $start=[Diagnostics.ProcessStartInfo]::new()
    $start.FileName=$Program
    $start.Arguments=(($Arguments|ForEach-Object{Quote-Argument $_}) -join ' ')
    $start.WorkingDirectory=$Directory
    $start.UseShellExecute=$false;$start.CreateNoWindow=$true
    $start.RedirectStandardOutput=$true;$start.RedirectStandardError=$true
    $start.EnvironmentVariables['GIT_TERMINAL_PROMPT']='0'
    $child=[Diagnostics.Process]::new();$child.StartInfo=$start
    $started=$false
    try{
        $started=$child.Start()
        Assert-That $started 'Could not start owned staging command.'
        try{$child.PriorityClass='BelowNormal'}catch{if(-not $child.HasExited){throw}}
        $out=$child.StandardOutput.ReadToEndAsync();$err=$child.StandardError.ReadToEndAsync()
        Assert-That ($child.WaitForExit(45000)) 'Staging command exceeded45seconds; reconcile before retry.'
        Assert-That ($out.Wait(3000) -and $err.Wait(3000)) 'Staging command streams did not close within their bound.'
        $stdout=$out.GetAwaiter().GetResult();$stderr=$err.GetAwaiter().GetResult()
        Assert-That ($child.ExitCode -eq 0) ('Staging command failed: '+$Program+' '+($Arguments -join ' ')+' '+$stderr)
        return [string]$stdout
    }finally{
        if($started -and -not $child.HasExited){$child.Kill();[void]$child.WaitForExit(3000)}
        $child.Dispose()
    }
}

$repository='F:\Dev\bead-me-up-scotty'
$taskRoot='F:\Dev\.bead-edit-20261111'
$inputRoot=Join-Path $taskRoot $TransferName
Assert-That (-not(Test-Path -LiteralPath $inputRoot)) 'Transfer directory exists; inspect before retry.'
[void][IO.Directory]::CreateDirectory($inputRoot)
$git=(Get-Command git.exe).Source
$ref='refs/remotes/origin/task/build-transfer-20261111'
$null=Run-Native $git @('-C',$repository,'fetch','--quiet','--no-write-fetch-head','--no-auto-maintenance','--no-tags','--no-recurse-submodules','--no-write-commit-graph','origin',('task/build-transfer-20261111:'+ $ref)) $repository
$commit=(Run-Native $git @('-C',$repository,'rev-parse',$ref) $repository).Trim()
Assert-That ($commit -eq $ExpectedCommit) 'Transfer branch moved unexpectedly.'
$tar=Join-Path $taskRoot ($TransferName+'.tar')
Assert-That (-not(Test-Path -LiteralPath $tar)) 'Transfer archive exists; inspect before retry.'
$null=Run-Native $git @('-C',$repository,'-c','core.autocrlf=false','archive','--format=tar',('--output='+$tar),$commit) $repository
$null=Run-Native (Get-Command tar.exe).Source @('-xf',$tar,'-C',$inputRoot) $taskRoot
$manifestPath=Join-Path $inputRoot 'delivery-manifest.json'
Assert-That ((Hash $manifestPath) -eq $ExpectedManifestSha256) 'Manifest hash differs.'
$manifest=[IO.File]::ReadAllText($manifestPath)|ConvertFrom-Json
foreach($entry in $manifest.files){
 Assert-That ($entry.path -match '^[A-Za-z0-9_.-]+$') 'Manifest entries must be simple filenames.'
 Assert-That ((Hash (Join-Path $inputRoot $entry.path)) -eq $entry.sha256) ('Transfer hash differs: '+$entry.path)
 if($entry.path.EndsWith('.ps1')){
  $tokens=$null;$errors=$null
  [void][Management.Automation.Language.Parser]::ParseFile((Join-Path $inputRoot $entry.path),[ref]$tokens,[ref]$errors)
  Assert-That (@($errors).Count -eq 0) ('PowerShell parse errors: '+$entry.path+' '+($errors|Out-String))
 }
}
$baseline=[IO.File]::ReadAllText((Join-Path $inputRoot 'pc-preservation-raw.json'))|ConvertFrom-Json
$mismatch=@($baseline.files|Where-Object{(Hash (Join-Path $repository $_.path)) -ne $_.sha256}|ForEach-Object{$_.path})
$os=Get-CimInstance Win32_OperatingSystem
$result=[ordered]@{status='passed';transfer_commit=$commit;input_directory=$inputRoot;verified_files=@($manifest.files).Count;source_unchanged=($mismatch.Count -eq 0);mismatch=$mismatch;free_mib=[math]::Round($os.FreePhysicalMemory/1024);session_id=[Diagnostics.Process]::GetCurrentProcess().SessionId;backend_head=(Run-Native $git @('-C','F:\Dev\bead-rs','rev-parse','HEAD') 'F:\Dev\bead-rs').Trim();app_head=(Run-Native $git @('-C',$repository,'rev-parse','HEAD') $repository).Trim();backend_status=(Run-Native $git @('-C','F:\Dev\bead-rs','status','--porcelain=v1') 'F:\Dev\bead-rs');app_status=(Run-Native $git @('-C',$repository,'status','--porcelain=v1') $repository)}
$json=ConvertTo-Json -InputObject $result -Depth 5
[IO.File]::WriteAllText((Join-Path $taskRoot ($TransferName+'-result.json')),$json,[Text.UTF8Encoding]::new($false))
Write-Output $json
