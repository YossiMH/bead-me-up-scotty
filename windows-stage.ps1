#requires -Version 5.1
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$InputDirectory,
    [Parameter(Mandatory=$true)][string]$StageDirectory,
    [Parameter(Mandatory=$true)][string]$ExpectedManifestSha256
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
[Diagnostics.Process]::GetCurrentProcess().PriorityClass='BelowNormal'
$Utf8=[Text.UTF8Encoding]::new($false)
$BackendRepository='F:\Dev\bead-rs'
$AppRepository='F:\Dev\bead-me-up-scotty'
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
function Safe-Path([string]$Value){
    Assert-That ($Value -match '^F:\\Dev\\\.bead-edit-20261111\\') 'Staging must stay inside this task directory.'
    $full=[IO.Path]::GetFullPath($Value).TrimEnd('\')
    Assert-That ($full.StartsWith('F:\Dev\.bead-edit-20261111\',[StringComparison]::OrdinalIgnoreCase)) 'Normalized staging path leaves this task directory.'
    $cursor=$full
    while($cursor){
        if(Test-Path -LiteralPath $cursor){
            Assert-That (((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)-eq 0) ('Reparse point in staging path: '+$cursor)
        }
        $parent=[IO.Directory]::GetParent($cursor);$cursor=if($parent){$parent.FullName}else{$null}
    }
    return $full
}
$InputDirectory=Safe-Path $InputDirectory
$StageDirectory=Safe-Path $StageDirectory
Assert-That (-not(Test-Path -LiteralPath $StageDirectory)) 'StageDirectory already exists; reconcile it before retry.'
$manifestPath=Join-Path $InputDirectory 'delivery-manifest.json'
Assert-That ((Hash $manifestPath)-eq $ExpectedManifestSha256) 'Delivery manifest hash differs.'
$manifest=[IO.File]::ReadAllText($manifestPath,$Utf8)|ConvertFrom-Json
[void][IO.Directory]::CreateDirectory($StageDirectory)
[IO.File]::WriteAllText((Join-Path $StageDirectory 'task-owner.txt'),'bead-edit-20261111',$Utf8)
$result=[ordered]@{status='failed';directory=$StageDirectory;started_utc=[DateTime]::UtcNow.ToString('o');source=$manifest.source}
try{
    foreach($entry in $manifest.files){
        Assert-That ($entry.path -match '^[A-Za-z0-9_.-]+$') 'Manifest file path must be a simple filename.'
        $path=Join-Path $InputDirectory $entry.path
        Assert-That ((Hash $path)-eq $entry.sha256) ('Input hash differs: '+$entry.path)
    }
    Assert-That (@($manifest.files | Where-Object { $_.path -eq 'windows-task-job.ps1' }).Count -eq 1) 'The task Job helper must have exactly one verified manifest entry.'
    . (Join-Path $InputDirectory 'windows-task-job.ps1')
    Enter-ScottyTaskJob
    foreach($archive in $manifest.archives){
        Assert-That ($archive.path -match '^[A-Za-z0-9_.-]+$') 'Archive path must be a simple filename.'
        $destination=Join-Path $StageDirectory $archive.path
        $output=[IO.File]::Open($destination,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
        try{
            foreach($part in $archive.parts){
                Assert-That ($part -match '^[A-Za-z0-9_.-]+$') 'Part path must be a simple filename.'
                $partStream=[IO.File]::OpenRead((Join-Path $InputDirectory $part))
                try{$partStream.CopyTo($output)}finally{$partStream.Dispose()}
            }
        }finally{$output.Dispose()}
        Assert-That ((Hash $destination)-eq $archive.sha256) ('Reassembled archive hash differs: '+$archive.path)
    }
    foreach($script in @('windows-native-smoke.ps1','windows-tray-smoke.ps1','windows-task-job.ps1')){
        $tokens=$null;$errors=$null
        [void][Management.Automation.Language.Parser]::ParseFile((Join-Path $InputDirectory $script),[ref]$tokens,[ref]$errors)
        Assert-That (@($errors).Count -eq 0) ('PowerShell parse failed: '+$script+' '+($errors|Out-String))
    }
    $git=(Get-Command git.exe).Source
    foreach($repo in @(@{path=$BackendRepository;file='backend-source.bundle';branch='feat/bead-complete-20261111';sha=$manifest.source.backend},@{path=$AppRepository;file='scotty-source.bundle';branch='feat/scotty-complete-20261111';sha=$manifest.source.scotty})){
        $bundle=Join-Path $InputDirectory $repo.file
        $null=Run-Native $git @('-C',$repo.path,'bundle','verify',$bundle) $repo.path
        $ref='refs/heads/'+$repo.branch
        $null=Run-Native $git @('-C',$repo.path,'fetch','--quiet',$bundle,($ref+':'+$ref)) $repo.path
        $actual=(Run-Native $git @('-C',$repo.path,'rev-parse',$ref) $repo.path).Trim()
        Assert-That ($actual -eq $repo.sha) 'Fetched source commit differs.'
    }
    $app=Join-Path $StageDirectory 'scotty'
    [void][IO.Directory]::CreateDirectory($app)
    $tar=Join-Path $StageDirectory 'scotty-source.tar'
    $null=Run-Native $git @('-C',$AppRepository,'-c','core.autocrlf=false','archive','--format=tar',('--output='+$tar),$manifest.source.scotty) $AppRepository
    $null=Run-Native (Get-Command tar.exe).Source @('-xf',$tar,'-C',$app) $StageDirectory
    Expand-Archive -LiteralPath (Join-Path $StageDirectory 'scotty-runtime.zip') -DestinationPath $app
    $runtime=[IO.File]::ReadAllText((Join-Path $InputDirectory 'scotty-runtime.json'),$Utf8)|ConvertFrom-Json
    foreach($file in $runtime.files){
        Assert-That ($file.path.StartsWith('.next/') -and -not $file.path.Contains('..')) 'Unexpected runtime path.'
        Assert-That ((Hash (Join-Path $app $file.path))-eq $file.sha256) ('Runtime hash differs: '+$file.path)
    }
    Assert-That (([IO.File]::ReadAllText((Join-Path $AppRepository 'node_modules\next\package.json'))|ConvertFrom-Json).version -eq '16.3.8') 'Existing Next version differs.'
    Assert-That (([IO.File]::ReadAllText((Join-Path $AppRepository 'node_modules\react\package.json'))|ConvertFrom-Json).version -eq '19.2.4') 'Existing React version differs.'
    $null=New-Item -ItemType Junction -Path (Join-Path $app 'node_modules') -Value (Join-Path $AppRepository 'node_modules')
    Expand-Archive -LiteralPath (Join-Path $StageDirectory 'backend-windows.zip') -DestinationPath (Join-Path $StageDirectory 'backend')
    $bead=Join-Path (Join-Path $StageDirectory 'backend') $manifest.binary.filename
    Assert-That ((Hash $bead)-eq $manifest.binary.sha256) 'Windows executable hash differs.'
    $result['app_directory']=$app;$result['bead_exe']=$bead;$result['binary_sha256']=$manifest.binary.sha256
    $result['runtime_build_id']=[IO.File]::ReadAllText((Join-Path $app '.next\BUILD_ID')).Trim()
    $result.status='passed'
}catch{$result['error']=$_.Exception.Message}
$result['completed_utc']=[DateTime]::UtcNow.ToString('o')
$json=ConvertTo-Json -InputObject $result -Depth 8
[IO.File]::WriteAllText((Join-Path $StageDirectory 'stage-result.json'),$json,$Utf8)
Write-Output $json
if($result.status -ne 'passed'){exit 1}
