#requires -Version 5.1
# Copy already-qualified local archives into one fresh task-owned stage.
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$RequestPath,
    [Parameter(Mandatory=$true)][ValidatePattern('^[0-9a-f]{64}$')][string]$RequestSha256,
    [Parameter(Mandatory=$true)][string]$DeadlineUtc
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue'
$Utf8=[Text.UTF8Encoding]::new($false,$true)
$StageDeadline=[DateTime]::Parse($DeadlineUtc,[Globalization.CultureInfo]::InvariantCulture,[Globalization.DateTimeStyles]::RoundtripKind).ToUniversalTime()
[Diagnostics.Process]::GetCurrentProcess().PriorityClass='BelowNormal'
Add-Type -AssemblyName System.IO.Compression

function Assert-That([bool]$Value,[string]$Message){if(-not $Value){throw $Message}}
function Check-Deadline {Assert-That ([DateTime]::UtcNow -lt $StageDeadline) 'Archive staging deadline expired.'}
function Hash([string]$Value){return (Get-FileHash -LiteralPath $Value -Algorithm SHA256).Hash.ToLowerInvariant()}
function Hash-Bytes([byte[]]$Value){
    $algorithm=[Security.Cryptography.SHA256]::Create()
    try{return ([BitConverter]::ToString($algorithm.ComputeHash($Value))).Replace('-','').ToLowerInvariant()}finally{$algorithm.Dispose()}
}
function Safe-Path([string]$Value,[string]$RequiredRoot){
    Assert-That ($Value -match '^[A-Za-z]:[\\/]') 'Use a full local Windows path.'
    $full=[IO.Path]::GetFullPath($Value).TrimEnd('\','/')
    Assert-That ($full.StartsWith($RequiredRoot+'\',[StringComparison]::OrdinalIgnoreCase)) 'Path leaves its required root.'
    $cursor=$full
    while($cursor){
        if(Test-Path -LiteralPath $cursor){Assert-That (((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0) ('Reparse point: '+$cursor)}
        $parent=[IO.Directory]::GetParent($cursor);$cursor=if($parent){$parent.FullName}else{$null}
    }
    return $full
}
function Assert-ZipPath([string]$Name){
    Assert-That ($Name.Length -gt 0 -and $Name.Length -le 180 -and $Name -notmatch '[\\:<>"|?*\x00-\x1f]') ('Unsafe ZIP path: '+$Name)
    foreach($part in $Name.Split('/')){
        Assert-That ($part.Length -gt 0 -and $part -notin @('.','..') -and $part -notmatch '[. ]$' -and $part -notmatch '^(?i:CON|PRN|AUX|NUL|COM[1-9\u00b9\u00b2\u00b3]|LPT[1-9\u00b9\u00b2\u00b3])(?:\.|$)') ('Unsafe ZIP path: '+$Name)
    }
}
function Assert-Record([object]$Row){
    Assert-ZipPath ([string]$Row.path)
    Assert-That ([string]$Row.sha256 -cmatch '^[0-9a-f]{64}$' -and [string]$Row.bytes -cmatch '^(0|[1-9][0-9]*)$' -and [decimal]$Row.bytes -le [long]::MaxValue) 'Invalid hash/size record.'
}
function Get-ZipIndex([IO.Compression.ZipArchive]$Archive,[string[]]$Expected){
    $allowed=[Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    $caseNames=[Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
    $directories=[Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    foreach($name in $Expected){
        Assert-ZipPath $name
        Assert-That ($allowed.Add($name) -and $caseNames.Add($name)) 'Duplicate expected ZIP path.'
        $parts=$name.Split('/')
        for($index=1;$index -lt $parts.Count;$index++){[void]$directories.Add(($parts[0..($index-1)] -join '/')+'/')}
    }
    $seen=[Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
    $files=[Collections.Generic.Dictionary[string,IO.Compression.ZipArchiveEntry]]::new([StringComparer]::Ordinal)
    foreach($entry in $Archive.Entries){
        Check-Deadline
        $name=[string]$entry.FullName
        Assert-That ($seen.Add($name)) 'Duplicate or case-colliding ZIP entry.'
        $kind=([long]$entry.ExternalAttributes -shr 16) -band 61440
        if($name.EndsWith('/')){
            Assert-ZipPath $name.Substring(0,$name.Length-1)
            Assert-That ($directories.Contains($name) -and $entry.Length -eq 0 -and $kind -in @(0,16384) -and ($entry.ExternalAttributes -band 1024) -eq 0) ('Unexpected ZIP directory: '+$name)
            continue
        }
        Assert-ZipPath $name
        Assert-That ($kind -in @(0,32768) -and ($entry.ExternalAttributes -band 1024) -eq 0 -and ($entry.ExternalAttributes -band 16) -eq 0) ('Nonregular ZIP entry: '+$name)
        Assert-That ($allowed.Contains($name)) ('Unexpected ZIP entry: '+$name)
        $files.Add($name,$entry)
    }
    Assert-That ($files.Count -eq $allowed.Count) 'Missing ZIP entry.'
    return ,$files
}
function Copy-VerifiedStream([IO.Stream]$InputStream,[IO.Stream]$OutputStream,[object]$Row){
    Assert-Record $Row
    $algorithm=[Security.Cryptography.SHA256]::Create();$buffer=[byte[]]::new(65536);$total=0L
    try{
        while($true){
            Check-Deadline
            $count=$InputStream.Read($buffer,0,$buffer.Length)
            if($count -eq 0){break}
            $total+=$count
            Assert-That ($total -le [long]$Row.bytes) ('Entry exceeds its measured size: '+$Row.path)
            [void]$algorithm.TransformBlock($buffer,0,$count,$buffer,0)
            if($null -ne $OutputStream){$OutputStream.Write($buffer,0,$count)}
        }
        [void]$algorithm.TransformFinalBlock([byte[]]::new(0),0,0)
        $digest=([BitConverter]::ToString($algorithm.Hash)).Replace('-','').ToLowerInvariant()
        Assert-That ($total -eq [long]$Row.bytes -and $digest -ceq $Row.sha256) ('Entry hash/size differs: '+$Row.path)
    }finally{$algorithm.Dispose()}
}
function Read-EntryBytes([IO.Compression.ZipArchiveEntry]$Entry,[object]$Row,[long]$Maximum){
    Assert-Record $Row
    Assert-That ([long]$Row.bytes -le $Maximum -and $Entry.Length -eq [long]$Row.bytes) ('Entry size differs: '+$Row.path)
    $inputStream=$Entry.Open();$memory=[IO.MemoryStream]::new([int]$Row.bytes)
    try{Copy-VerifiedStream $inputStream $memory $Row;return ,$memory.ToArray()}finally{$inputStream.Dispose();$memory.Dispose()}
}
function Check-Entry([IO.Compression.ZipArchiveEntry]$Entry,[object]$Row){
    Assert-That ($Entry.Length -eq [long]$Row.bytes) ('Entry size differs: '+$Row.path)
    $stream=$Entry.Open()
    try{Copy-VerifiedStream $stream $null $Row}finally{$stream.Dispose()}
}
function Open-Archive([object]$Row,[string]$RequiredRoot){
    Assert-That ([string]$Row.sha256 -cmatch '^[0-9a-f]{64}$' -and [string]$Row.bytes -cmatch '^[1-9][0-9]*$') 'Unbound archive identity.'
    $filename=Safe-Path ([string]$Row.path) $RequiredRoot
    $stream=[IO.File]::Open($filename,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
    try{
        Assert-That ($stream.Length -eq [long]$Row.bytes) 'Archive size differs.'
        $record=[pscustomobject]@{path=[IO.Path]::GetFileName($filename);sha256=$Row.sha256;bytes=$Row.bytes}
        Copy-VerifiedStream $stream $null $record;$stream.Position=0
        $archive=[IO.Compression.ZipArchive]::new($stream,[IO.Compression.ZipArchiveMode]::Read,$true)
        return @{stream=$stream;archive=$archive;path=$filename}
    }catch{$stream.Dispose();throw}
}
function Copy-Entry([IO.Compression.ZipArchiveEntry]$Entry,[object]$Row,[string]$Directory){
    Check-Deadline
    $target=Safe-Path (Join-Path $Directory $Row.path) $Directory
    [void][IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($target))
    $null=Safe-Path $target $Directory
    $outputStream=[IO.File]::Open($target,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
    $inputStream=$null
    try{
        Assert-That ($Entry.Length -eq [long]$Row.bytes) ('Entry size differs: '+$Row.path)
        $inputStream=$Entry.Open();Copy-VerifiedStream $inputStream $outputStream $Row
    }finally{if($null -ne $inputStream){$inputStream.Dispose()};$outputStream.Dispose()}
}
function Write-NewBytes([string]$Path,[byte[]]$Bytes,[string]$Root){
    Check-Deadline;$null=Safe-Path $Path $Root
    [void][IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($Path))
    $stream=[IO.File]::Open($Path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
    try{$stream.Write($Bytes,0,$Bytes.Length)}finally{$stream.Dispose()}
}
# Same count-independent hash, size and BUILD_ID validation as the accepted installer.
function Verify-Runtime([string]$Directory){
    $seen=[Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
    foreach($file in $Runtime.files){
        Check-Deadline
        Assert-That ($file.path -match '^\.next/[^\\:]+$' -and $file.path -notmatch '(?:^|/)\.\.?(?:/|$)') 'Unexpected runtime manifest path.'
        Assert-That ($seen.Add([string]$file.path)) 'Duplicate runtime manifest path.'
        $path=Safe-Path (Join-Path $Directory $file.path.Substring(6)) $Directory
        Assert-That ([IO.File]::Exists($path) -and (Hash $path) -eq $file.sha256 -and (Get-Item -LiteralPath $path).Length -eq $file.bytes) ('Runtime hash/size differs: '+$file.path)
    }
    Assert-That ([IO.Directory]::GetFiles($Directory,'*',[IO.SearchOption]::AllDirectories).Count -eq $seen.Count) 'Unexpected staged runtime files.'
    Assert-That ([IO.File]::ReadAllText((Join-Path $Directory 'BUILD_ID')).Trim() -eq $Runtime.build_id) 'Runtime BUILD_ID differs.'
}
function Get-AppBinding{
    return [pscustomobject]@{
        source_commit='0309539797fd7d016e2b8fd8bdc0ae9cefc20219';source_tree='84bb66cde1832ad8d30b63773efb77c952787b94'
        archive_sha256='15a503c45ded58ea48fcce7dd293b563d741a3424b64a39a6bd05edf5b1d409d';archive_bytes=7056005
        manifest=[pscustomobject]@{path='scotty-runtime.json';sha256='612790bc18617630f9257ab2a901f8e12a0cd6dda6bf566c414e646e1745f1c7';bytes=110021}
        runtime=[pscustomobject]@{path='scotty-runtime.zip';sha256='a4da62f8feadadd6a510eb2d1b0c1ab17d4a769c65e346664ba4885087b7a220';bytes=7137798}
        sources=[pscustomobject]@{path='source-sha256.json';sha256='1e114819d4366e5d33443480ef26d909881559ba3908249ff4811ca22b3de241';bytes=2308}
        result=[pscustomobject]@{path='result.json';sha256='89d15c6ba9ec3948ca1d5e0f5f04443c5dc6f865a727c337b722aabe946c0049';bytes=2414}
        build_id='YIOHeRJTEdlOszyc4LyHr';file_count=560;expanded_bytes=27426391
        lock_sha256='545c1dd88f005d1b7337907f311f8bf979bbbd34e3930cfabef1fe5f8d57f050';lock_git_blob='e8662b2df0c5172e19ec66b3ef2241ccb5798618'
        command_names=@('npm-ci','adapter-tests','lint','committed-diff-check','diff-check','build','type-check','tracked-source-check')
    }
}
function Stage-Archives([object]$Request,[object]$App,[string]$RequiredRoot,[string]$InputSha256){
    Assert-That ($Request.schema_version -eq 1 -and $Request.operation -ceq 'stage-qualified-scotty-artifacts') 'Unexpected staging request.'
    $stage=Safe-Path ([string]$Request.stage_directory) $RequiredRoot
    Assert-That ([IO.Path]::GetDirectoryName($stage).Equals($RequiredRoot,[StringComparison]::OrdinalIgnoreCase) -and [IO.Path]::GetFileName($stage) -cmatch '^stage-artifacts-v9-[a-z0-9][a-z0-9-]{0,80}$') 'Use a fresh immediate task-owned stage.'
    $claim=$stage+'.claim'
    Assert-That (-not(Test-Path -LiteralPath $stage) -and -not(Test-Path -LiteralPath $claim)) 'Existing staging attempt; reconcile before a new request.'
    Assert-That ($Request.app_archive.sha256 -ceq $App.archive_sha256 -and $Request.app_archive.bytes -eq $App.archive_bytes) 'App archive differs from the accepted runtime.'
    $native=$Request.native
    Assert-That ([string]$native.source_commit -cmatch '^[0-9a-f]{40}$' -and [string]$native.source_tree -cmatch '^[0-9a-f]{40}$' -and [string]$native.workflow_commit -cmatch '^[0-9a-f]{40}$' -and [string]$native.run_id -cmatch '^[1-9][0-9]*$' -and [string]$native.artifact_id -cmatch '^[1-9][0-9]*$') 'Final native identity is unbound.'
    foreach($row in @($native.manifest,$native.executable,$native.metadata,$native.build_result)){Assert-Record $row}
    Assert-That ($native.manifest.path -ceq 'artifact-manifest.json' -and $native.build_result.path -ceq 'build-result.json') 'Unexpected native manifest/result path.'
    Assert-That ($native.executable.path -ceq ('release/bead-checkpoint-'+$native.source_commit.Substring(0,12)+'.exe') -and $native.metadata.path -ceq ($native.executable.path+'.metadata.json')) 'Native executable/provenance path differs from its source.'
    $opened=[Collections.Generic.List[object]]::new();$inner=$null;$innerStream=$null;$created=$false
    $result=[ordered]@{schema_version=1;status='failed';operation=$Request.operation;request_sha256=$InputSha256;started_utc=[DateTime]::UtcNow.ToString('o');stage_directory=$stage;replay_allowed=$false;app_or_native_execution=$false;application='not_started';source_commit=$App.source_commit;native_source_commit=$native.source_commit}
    try{
        $appZip=Open-Archive $Request.app_archive $RequiredRoot;$opened.Add($appZip)
        $outerPaths=@('workflow-commit.txt',$App.manifest.path,$App.runtime.path,$App.sources.path,$App.result.path)
        foreach($name in $App.command_names){$outerPaths+=@(($name+'.stdout'),($name+'.stderr'))}
        $appFiles=Get-ZipIndex $appZip.archive $outerPaths
        $manifestBytes=Read-EntryBytes $appFiles[$App.manifest.path] $App.manifest 1MB
        $Runtime=$Utf8.GetString($manifestBytes)|ConvertFrom-Json
        $sourceBytes=Read-EntryBytes $appFiles[$App.sources.path] $App.sources 1MB
        $sources=@($Utf8.GetString($sourceBytes)|ConvertFrom-Json)
        $resultBytes=Read-EntryBytes $appFiles[$App.result.path] $App.result 1MB
        $built=$Utf8.GetString($resultBytes)|ConvertFrom-Json
        Assert-That ($built.status -ceq 'passed' -and $built.source_commit -ceq $App.source_commit -and $built.source_tree -ceq $App.source_tree -and @($built.commands).Count -eq $App.command_names.Count -and @($built.commands|Where-Object{$_.exit -ne 0}).Count -eq 0) 'App build result differs.'
        Assert-That (($built.commands.name -join ',') -ceq ($App.command_names -join ',')) 'App command inventory differs.'
        Assert-That ($Runtime.source_commit -ceq $App.source_commit -and $Runtime.build_id -ceq $App.build_id -and $Runtime.sha256 -ceq $App.runtime.sha256 -and $Runtime.bytes -eq $App.runtime.bytes -and $Runtime.node_modules_transferred -eq $false -and $Runtime.dependency_lock_sha256 -ceq $App.lock_sha256 -and $Runtime.dependency_lock_git_blob -ceq $App.lock_git_blob) 'Runtime source/build/archive identity differs.'
        $lock=@($sources|Where-Object{$_.path -ceq 'package-lock.json'})
        Assert-That ($lock.Count -eq 1 -and $lock[0].sha256 -ceq $App.lock_sha256 -and $lock[0].git_blob -ceq $App.lock_git_blob) 'Source lockfile identity differs.'
        $records=@($Runtime.files);$expanded=0L
        Assert-That ($records.Count -eq $App.file_count) 'Runtime file count differs.'
        foreach($row in $records){Assert-Record $row;Assert-That ($row.path.StartsWith('.next/',[StringComparison]::Ordinal)) 'Runtime path leaves .next.';$expanded+=[long]$row.bytes}
        Assert-That ($expanded -eq $App.expanded_bytes) 'Runtime expanded byte count differs.'
        $innerBytes=Read-EntryBytes $appFiles[$App.runtime.path] $App.runtime $App.runtime.bytes
        $innerStream=[IO.MemoryStream]::new($innerBytes,$false)
        $inner=[IO.Compression.ZipArchive]::new($innerStream,[IO.Compression.ZipArchiveMode]::Read,$true)
        $runtimeFiles=Get-ZipIndex $inner @($records|ForEach-Object{$_.path})
        foreach($row in $records){Check-Entry $runtimeFiles[$row.path] $row}
        $buildRow=@($records|Where-Object{$_.path -ceq '.next/BUILD_ID'})
        Assert-That ($buildRow.Count -eq 1) 'Missing unique runtime BUILD_ID.'
        $buildBytes=Read-EntryBytes $runtimeFiles['.next/BUILD_ID'] $buildRow[0] 4096
        Assert-That ($Utf8.GetString($buildBytes).Trim() -ceq $App.build_id) 'Runtime BUILD_ID differs.'

        $nativeZip=Open-Archive $native.archive $RequiredRoot;$opened.Add($nativeZip)
        $nativeRows=@($native.executable,$native.metadata,$native.build_result)
        $nativeFiles=Get-ZipIndex $nativeZip.archive @($native.manifest.path;$nativeRows|ForEach-Object{$_.path})
        $nativeManifestBytes=Read-EntryBytes $nativeFiles[$native.manifest.path] $native.manifest 1MB
        $nativeManifest=$Utf8.GetString($nativeManifestBytes)|ConvertFrom-Json
        Assert-That ($nativeManifest.source_commit -ceq $native.source_commit -and $nativeManifest.target -ceq 'x86_64-pc-windows-msvc' -and @($nativeManifest.files).Count -eq 3) 'Native manifest identity/count differs.'
        $nativeSeen=[Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase);$nativeTotal=0L
        foreach($row in $nativeManifest.files){
            Assert-Record $row;Assert-That ($nativeSeen.Add([string]$row.path)) 'Duplicate native manifest path.'
            $expected=@($nativeRows|Where-Object{$_.path -ceq $row.path})
            Assert-That ($expected.Count -eq 1 -and $row.sha256 -ceq $expected[0].sha256 -and $row.bytes -eq $expected[0].bytes) 'Native manifest record differs.'
            Check-Entry $nativeFiles[$row.path] $row;$nativeTotal+=[long]$row.bytes
        }
        $metadataBytes=Read-EntryBytes $nativeFiles[$native.metadata.path] $native.metadata 1MB
        $metadata=$Utf8.GetString($metadataBytes)|ConvertFrom-Json
        Assert-That ($metadata.git_commit_sha -ceq $native.source_commit -and $metadata.build_target -ceq 'x86_64-pc-windows-msvc' -and $metadata.build_host_target -ceq 'x86_64-pc-windows-msvc' -and $metadata.binary_sha256 -ceq $native.executable.sha256 -and $metadata.source -ceq 'git-archive' -and $metadata.build_profile -ceq 'release' -and $metadata.execution_verification -ceq 'executed') 'Native executable provenance differs.'
        $nativeResultBytes=Read-EntryBytes $nativeFiles[$native.build_result.path] $native.build_result 1MB
        $nativeResult=$Utf8.GetString($nativeResultBytes)|ConvertFrom-Json
        Assert-That ($nativeResult.status -ceq 'passed' -and $nativeResult.source_commit -ceq $native.source_commit -and $nativeResult.source_tree -ceq $native.source_tree -and $nativeResult.target -ceq 'x86_64-pc-windows-msvc' -and [string]$nativeResult.run_id -ceq [string]$native.run_id -and $nativeResult.workflow_commit -ceq $native.workflow_commit) 'Native build result differs.'
        foreach($name in @('executable','metadata')){
            Assert-That ($nativeResult.release.$name.path -ceq $native.$name.path -and $nativeResult.release.$name.sha256 -ceq $native.$name.sha256 -and $nativeResult.release.$name.bytes -eq $native.$name.bytes) 'Native build release record differs.'
        }
        Check-Deadline
        $requiredBytes=$expanded+$nativeTotal+$manifestBytes.Length+$sourceBytes.Length+$resultBytes.Length+$nativeManifestBytes.Length+65536L
        $drive=[IO.DriveInfo]::new([IO.Path]::GetPathRoot($stage))
        Assert-That ($drive.AvailableFreeSpace -ge $requiredBytes) 'Insufficient free space for the exact staging inventory.'
        Assert-That (-not(Test-Path -LiteralPath $stage)) 'Stage appeared during verification.'
        $intent=$Utf8.GetBytes((ConvertTo-Json -InputObject $result -Depth 6)+[char]10)
        Write-NewBytes $claim $intent $RequiredRoot
        Assert-That (-not(Test-Path -LiteralPath $stage)) 'Stage appeared after ownership claim.'
        [void][IO.Directory]::CreateDirectory($stage);$created=$true
        $null=Safe-Path $stage $RequiredRoot
        Write-NewBytes (Join-Path $stage 'intent.json') $intent $stage
        $runtimeRoot=Join-Path $stage 'runtime';$nativeRoot=Join-Path $stage 'native'
        foreach($row in $records){Copy-Entry $runtimeFiles[$row.path] $row $runtimeRoot}
        foreach($row in $nativeRows){Copy-Entry $nativeFiles[$row.path] $row $nativeRoot}
        Write-NewBytes (Join-Path $stage 'manifests/scotty-runtime.json') $manifestBytes $stage
        Write-NewBytes (Join-Path $stage 'manifests/source-sha256.json') $sourceBytes $stage
        Write-NewBytes (Join-Path $stage 'manifests/app-result.json') $resultBytes $stage
        Write-NewBytes (Join-Path $stage 'manifests/native-artifact-manifest.json') $nativeManifestBytes $stage
        $next=Join-Path $runtimeRoot '.next';Verify-Runtime $next
        foreach($row in $nativeRows){
            $filename=Safe-Path (Join-Path $nativeRoot $row.path) $nativeRoot
            Assert-That ((Hash $filename) -ceq $row.sha256 -and (Get-Item -LiteralPath $filename).Length -eq $row.bytes) 'Staged native file differs.'
        }
        $result['installer_inputs']=[ordered]@{
            RuntimeManifest=(Join-Path $stage 'manifests/scotty-runtime.json');StageNextDirectory=$next
            BeadExe=(Join-Path $nativeRoot $native.executable.path);BeadSha256=$native.executable.sha256
            BeadProvenance=(Join-Path $nativeRoot $native.metadata.path)
        }
        $result['runtime_build_id']=$Runtime.build_id;$result['runtime_files']=$records.Count;$result['runtime_bytes']=$expanded
        $result['native_files']=$nativeRows.Count;$result['native_bytes']=$nativeTotal
        $result['app_archive_sha256']=$Request.app_archive.sha256;$result['native_archive_sha256']=$native.archive.sha256
        $result['runtime_manifest_sha256']=$App.manifest.sha256;$result['native_manifest_sha256']=$native.manifest.sha256
        $result['source_manifest_sha256']=$App.sources.sha256;$result['native_metadata_sha256']=$native.metadata.sha256
        $result['native_build_result_sha256']=$native.build_result.sha256;$result['status']='passed'
        return $result
    }catch{$result['error']=$_.Exception.Message;throw}
    finally{
        $result['completed_utc']=[DateTime]::UtcNow.ToString('o')
        if($null -ne $inner){$inner.Dispose()};if($null -ne $innerStream){$innerStream.Dispose()}
        foreach($item in $opened){$item.archive.Dispose();$item.stream.Dispose()}
        if($created){[IO.File]::WriteAllText((Join-Path $stage 'stage-result.json'),(ConvertTo-Json -InputObject $result -Depth 10)+[char]10,$Utf8)}
    }
}
try{
    $taskRoot='F:\Dev\.bead-edit-20261111'
    $RequestPath=Safe-Path $RequestPath $taskRoot
    Assert-That ((Get-Item -LiteralPath $RequestPath).Length -le 65536 -and (Hash $RequestPath) -ceq $RequestSha256) 'Staging request changed or exceeds 64 KiB.'
    $requestBytes=[IO.File]::ReadAllBytes($RequestPath)
    Assert-That ((Hash-Bytes $requestBytes) -ceq $RequestSha256) 'Staging request changed while reading.'
    $request=$Utf8.GetString($requestBytes)|ConvertFrom-Json
    $result=Stage-Archives $request (Get-AppBinding) $taskRoot $RequestSha256
    $result|ConvertTo-Json -Depth 10
}catch{
    [ordered]@{status='failed';error=$_.Exception.ToString();request_sha256=$RequestSha256;replay_allowed=$false;app_or_native_execution=$false}|ConvertTo-Json -Depth 5
    exit 1
}
