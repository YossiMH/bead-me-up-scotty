#requires -Version 5.1
# Hosted fixtures load exact helper functions; the PC entry points are never run.
[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$Directory,[Parameter(Mandatory=$true)][string]$ManifestSha256)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue'
$Utf8=[Text.UTF8Encoding]::new($false,$true)
if($env:GITHUB_ACTIONS -cne 'true' -or -not $env:RUNNER_TEMP -or -not $env:GITHUB_RUN_ID){throw 'Hosted Actions fixtures only.'}
$manifestFile=Join-Path $Directory 'check-inputs.json'
if((Get-FileHash -LiteralPath $manifestFile -Algorithm SHA256).Hash.ToLowerInvariant() -cne $ManifestSha256){throw 'Check input manifest changed.'}
$inputs=[IO.File]::ReadAllText($manifestFile,$Utf8)|ConvertFrom-Json
$output=Join-Path $env:RUNNER_TEMP ('scotty-stage-checks-'+$env:GITHUB_RUN_ID+'-'+$env:GITHUB_RUN_ATTEMPT)
if(Test-Path -LiteralPath $output){throw 'Fresh hosted output required.'}
[void][IO.Directory]::CreateDirectory($output)
$fixture=Join-Path $output 'fixtures';[void][IO.Directory]::CreateDirectory($fixture)
$result=[ordered]@{schema_version=1;status='failed';operation='hosted-archive-staging-checks';input_sha256=$ManifestSha256;files=@();parsed=@();embedded_declarations=0;cases=@();app_or_native_execution=$false;pc_actions=0}
Add-Type -AssemblyName System.IO.Compression
function Fixture-Bytes([object]$Value){return ,$Utf8.GetBytes((ConvertTo-Json -InputObject $Value -Depth 20)+[char]10)}
function Row([string]$Name,[byte[]]$Bytes){return [pscustomobject]@{path=$Name;sha256=(Hash-Bytes $Bytes);bytes=$Bytes.Length}}
function Passed([string]$Name){$result.cases+=@{name=$Name;result='passed'};Write-Output ('PASS '+$Name)}
function Refused([string]$Name,[scriptblock]$Action,[string]$Expected){
    $message=$null
    try{& $Action|Out-Null}catch{$message=$_.Exception.Message}
    if($null -eq $message -or $message -notmatch $Expected){throw ('Unexpected refusal for '+$Name+': '+$message)}
    $result.cases+=@{name=$Name;result='passed';refusal=$message};Write-Output ('PASS '+$Name)
}
function New-FixtureZip([string]$Path,[object[]]$Members){
    $stream=[IO.File]::Open($Path,[IO.FileMode]::CreateNew,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
    $zip=[IO.Compression.ZipArchive]::new($stream,[IO.Compression.ZipArchiveMode]::Create,$true)
    try{
        foreach($member in $Members){
            $entry=$zip.CreateEntry([string]$member.path,[IO.Compression.CompressionLevel]::Optimal)
            if($null -ne $member.PSObject.Properties['attributes']){$entry.ExternalAttributes=[int]$member.attributes}
            $writer=$entry.Open()
            try{$writer.Write($member.data,0,$member.data.Length)}finally{$writer.Dispose()}
        }
    }finally{$zip.Dispose();$stream.Dispose()}
    return [pscustomobject]@{path=$Path;sha256=(Hash $Path);bytes=(Get-Item -LiteralPath $Path).Length}
}
function New-StageFixture([string]$Name,[string]$Defect=''){
    $inputRoot=Join-Path $fixture ('inputs-'+$Name);[void][IO.Directory]::CreateDirectory($inputRoot)
    $appSource='a'*40;$appTree='b'*40;$nativeSource='c'*40;$nativeTree='d'*40;$workflow='e'*40
    $buildId='synthetic-runtime';$lockHash='1'*64;$lockBlob='2'*40
    $commands=@('npm-ci','adapter-tests','lint','committed-diff-check','diff-check','build','type-check','tracked-source-check')
    $buildFile=if($Defect -ceq 'build-id'){'different-build'}else{$buildId}
    $payload=$Utf8.GetBytes(('x'*131089))
    $runtimeMembers=@(
        [pscustomobject]@{path='.next/BUILD_ID';data=$Utf8.GetBytes($buildFile+[char]10)},
        [pscustomobject]@{path='.next/server/app/page.js';data=$payload},
        [pscustomobject]@{path='.next/empty.json';data=[byte[]]::new(0)}
    )
    $runtimeRows=@($runtimeMembers|ForEach-Object{Row $_.path $_.data})
    if($Defect -ceq 'runtime-hash'){$runtimeRows[1].sha256='0'*64}
    if($Defect -ceq 'runtime-size'){$runtimeRows[1].bytes++}
    $innerPath=Join-Path $inputRoot 'inner.zip'
    $null=New-FixtureZip $innerPath $runtimeMembers;$innerBytes=[IO.File]::ReadAllBytes($innerPath)
    $runtimeRecord=Row 'scotty-runtime.zip' $innerBytes
    $runtime=[ordered]@{source_commit=$appSource;build_id=$buildId;sha256=$runtimeRecord.sha256;bytes=$runtimeRecord.bytes;node_modules_transferred=$false;dependency_lock_sha256=$lockHash;dependency_lock_git_blob=$lockBlob;files=$runtimeRows}
    $runtimeBytes=Fixture-Bytes $runtime
    $sourceBytes=Fixture-Bytes @([pscustomobject]@{path='package-lock.json';sha256=$lockHash;git_blob=$lockBlob;bytes=1})
    $buildResult=[ordered]@{status='passed';source_commit=$appSource;source_tree=$appTree;commands=@($commands|ForEach-Object{[pscustomobject]@{name=$_;exit=0}})}
    $buildResultBytes=Fixture-Bytes $buildResult
    $appMembers=@(
        [pscustomobject]@{path='workflow-commit.txt';data=$Utf8.GetBytes($workflow+[char]10)},
        [pscustomobject]@{path='scotty-runtime.json';data=$runtimeBytes},
        [pscustomobject]@{path='source-sha256.json';data=$sourceBytes},
        [pscustomobject]@{path='result.json';data=$buildResultBytes},
        [pscustomobject]@{path='scotty-runtime.zip';data=$innerBytes}
    )
    foreach($commandName in $commands){foreach($streamName in @('stdout','stderr')){$appMembers+=@([pscustomobject]@{path=$commandName+'.'+$streamName;data=$Utf8.GetBytes('synthetic '+$commandName+[char]10)})}}
    $appArchive=New-FixtureZip (Join-Path $inputRoot 'app-output.zip') $appMembers
    $expanded=0L;foreach($row in $runtimeRows){$expanded+=[long]$row.bytes}
    $app=[pscustomobject]@{source_commit=$appSource;source_tree=$appTree;archive_sha256=$appArchive.sha256;archive_bytes=$appArchive.bytes;manifest=(Row 'scotty-runtime.json' $runtimeBytes);runtime=$runtimeRecord;sources=(Row 'source-sha256.json' $sourceBytes);result=(Row 'result.json' $buildResultBytes);build_id=$buildId;file_count=$runtimeRows.Count;expanded_bytes=$expanded;lock_sha256=$lockHash;lock_git_blob=$lockBlob;command_names=$commands}

    $exeBytes=$Utf8.GetBytes('MZ synthetic fixture, never executable'+[char]10)
    $exe=Row ('release/bead-checkpoint-'+$nativeSource.Substring(0,12)+'.exe') $exeBytes
    $metadataSource=if($Defect -ceq 'native-provenance'){'f'*40}else{$nativeSource}
    $metadata=[ordered]@{git_commit_sha=$metadataSource;build_target='x86_64-pc-windows-msvc';build_host_target='x86_64-pc-windows-msvc';binary_sha256=$exe.sha256;source='git-archive';build_profile='release';execution_verification='executed'}
    $metadataBytes=Fixture-Bytes $metadata;$metadataRow=Row ($exe.path+'.metadata.json') $metadataBytes
    $resultTree=if($Defect -ceq 'native-build-tree'){'f'*40}else{$nativeTree}
    $nativeResult=[ordered]@{status='passed';source_commit=$nativeSource;source_tree=$resultTree;target='x86_64-pc-windows-msvc';run_id='123';workflow_commit=$workflow;release=@{executable=$exe;metadata=$metadataRow}}
    $nativeResultBytes=Fixture-Bytes $nativeResult;$nativeResultRow=Row 'build-result.json' $nativeResultBytes
    $nativeRows=@($exe,$metadataRow,$nativeResultRow)
    if($Defect -ceq 'native-duplicate'){$nativeRows=@($exe,$exe,$metadataRow)}
    $nativeManifest=[ordered]@{source_commit=$nativeSource;target='x86_64-pc-windows-msvc';files=$nativeRows}
    $nativeManifestBytes=Fixture-Bytes $nativeManifest;$nativeManifestRow=Row 'artifact-manifest.json' $nativeManifestBytes
    $nativeMembers=@(
        [pscustomobject]@{path=$nativeManifestRow.path;data=$nativeManifestBytes},
        [pscustomobject]@{path=$exe.path;data=$exeBytes},
        [pscustomobject]@{path=$metadataRow.path;data=$metadataBytes},
        [pscustomobject]@{path=$nativeResultRow.path;data=$nativeResultBytes}
    )
    $nativeArchive=New-FixtureZip (Join-Path $inputRoot 'native-output.zip') $nativeMembers
    $request=[pscustomobject]@{schema_version=1;operation='stage-qualified-scotty-artifacts';stage_directory=(Join-Path $fixture ('stage-artifacts-v9-'+$Name));app_archive=$appArchive;native=[pscustomobject]@{source_commit=$nativeSource;source_tree=$nativeTree;workflow_commit=$workflow;run_id='123';artifact_id=456;archive=$nativeArchive;manifest=$nativeManifestRow;executable=$exe;metadata=$metadataRow;build_result=$nativeResultRow}}
    return @{request=$request;app=$app;runtime_rows=$runtimeRows;runtime_members=$runtimeMembers;native_rows=@($exe,$metadataRow,$nativeResultRow)}
}
function Refuse-Stage([string]$Name,[object]$Case,[string]$Expected){
    Refused $Name {Stage-Archives $Case.request $Case.app $fixture ('9'*64)} $Expected
    Assert-That (-not(Test-Path -LiteralPath $Case.request.stage_directory) -and -not(Test-Path -LiteralPath ($Case.request.stage_directory+'.claim'))) 'Invalid archive input created a stage or ownership claim.'
}
try{
    $asts=@{}
    foreach($property in $inputs.files.PSObject.Properties){
        $name=$property.Name
        if($name -notmatch '^[a-zA-Z0-9._-]+$'){throw 'Unexpected check input path.'}
        $path=Join-Path $Directory $name
        $digest=(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
        if($digest -cne $property.Value){throw ('Check source changed: '+$name)}
        $result.files+=@{path=$name;sha256=$digest;bytes=(Get-Item -LiteralPath $path).Length}
        if($name.EndsWith('.ps1')){
            $tokens=$null;$errors=$null
            $asts[$name]=[Management.Automation.Language.Parser]::ParseFile($path,[ref]$tokens,[ref]$errors)
            if(@($errors).Count){throw (($errors|ForEach-Object{$_.ToString()})-join [char]10)}
            $result.parsed+=@($name)
        }elseif($name.EndsWith('.json')){$null=[IO.File]::ReadAllText($path,$Utf8)|ConvertFrom-Json}
    }
    $helper=$asts['stage-artifacts-20261125.ps1']
    $names=@('Assert-That','Check-Deadline','Hash','Hash-Bytes','Safe-Path','Assert-ZipPath','Assert-Record','Get-ZipIndex','Copy-VerifiedStream','Read-EntryBytes','Check-Entry','Open-Archive','Copy-Entry','Write-NewBytes','Verify-Runtime','Get-AppBinding','Stage-Archives')
    $definitions=@($helper.FindAll({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst]},$true))
    if($definitions.Count -ne $names.Count){throw 'Unexpected helper function inventory.'}
    foreach($name in $names){
        $definition=@($definitions|Where-Object{$_.Name -ceq $name})
        if($definition.Count -ne 1){throw ('Unexpected helper function: '+$name)}
        Invoke-Expression $definition[0].Extent.Text
    }
    $supervisorText=[IO.File]::ReadAllText((Join-Path $Directory 'stage-artifacts-supervisor-20261125.ps1'),$Utf8)
    $declarations=[regex]::Matches($supervisorText,"(?ms)Add-Type -TypeDefinition @'\r?\n(.*?)\r?\n'@")
    Assert-That ($declarations.Count -eq 1) 'Expected one unchanged inspector declaration.'
    Add-Type -TypeDefinition $declarations[0].Groups[1].Value
    $result.embedded_declarations=1
    Passed 'power-shell-parsing-and-inspector-compilation'
    $StageDeadline=[DateTime]::UtcNow.AddMinutes(3)
    $fixed=Get-AppBinding
    $repository=[IO.Path]::GetFullPath((Join-Path $Directory '../../..'))
    $retained=Join-Path $repository '20261125/revision-8/results/runtime-manifest-recovery-45594231069'
    foreach($pair in @(@('linux-scotty-runtime.json',$fixed.manifest),@('linux-source-sha256.json',$fixed.sources),@('linux-result.json',$fixed.result))){
        $file=Join-Path $retained $pair[0]
        Assert-That ((Hash $file) -ceq $pair[1].sha256 -and (Get-Item -LiteralPath $file).Length -eq $pair[1].bytes) 'Fixed app binding differs from recovered evidence.'
    }
    $recorded=[IO.File]::ReadAllText((Join-Path $retained 'linux-scotty-runtime.json'),$Utf8)|ConvertFrom-Json
    $recordedTotal=0L;foreach($row in $recorded.files){Assert-Record $row;$recordedTotal+=[long]$row.bytes}
    Assert-That ($recorded.source_commit -ceq $fixed.source_commit -and $recorded.build_id -ceq $fixed.build_id -and @($recorded.files).Count -eq $fixed.file_count -and $recordedTotal -eq $fixed.expanded_bytes -and $recorded.sha256 -ceq $fixed.runtime.sha256 -and $recorded.bytes -eq $fixed.runtime.bytes) 'Fixed runtime inventory differs.'
    Passed 'fixed-560-file-runtime-binding'

    $template=[IO.File]::ReadAllText((Join-Path $Directory 'request-template.json'),$Utf8)|ConvertFrom-Json
    Assert-That ($null -eq $template.native.source_commit -and $null -eq $template.native.archive.sha256 -and $template.app_archive.sha256 -ceq $fixed.archive_sha256 -and $template.app_archive.bytes -eq $fixed.archive_bytes) 'Template is bound to an unreviewed native candidate or different app.'
    Passed 'native-template-remains-unbound'

    $outside=Join-Path $output 'outside-canary.txt';[IO.File]::WriteAllText($outside,'unchanged outside bytes',$Utf8);$outsideHash=Hash $outside
    $downloadRoot=Join-Path $env:RUNNER_TEMP ('scotty-stage-inputs-'+$env:GITHUB_RUN_ID+'-'+$env:GITHUB_RUN_ATTEMPT)
    $download=[IO.File]::ReadAllText((Join-Path $downloadRoot 'download-result.json'),$Utf8)|ConvertFrom-Json
    Assert-That ($download.status -ceq 'passed' -and $download.artifact_id -eq 15003467178 -and $download.producer_run_id -eq 45573503400 -and $download.sha256 -ceq $fixed.archive_sha256 -and $download.bytes -eq $fixed.archive_bytes) 'Actual download receipt differs.'
    $actual=New-StageFixture 'actual-runtime'
    $actualArchive=Join-Path $fixture 'actual-app-output.zip'
    [IO.File]::Copy((Join-Path $downloadRoot 'app-output.zip'),$actualArchive,$false)
    $actual.request.app_archive=[pscustomobject]@{path=$actualArchive;sha256=$fixed.archive_sha256;bytes=$fixed.archive_bytes}
    $actualResult=Stage-Archives $actual.request $fixed $fixture ('8'*64)
    Assert-That ($actualResult.status -ceq 'passed' -and $actualResult.runtime_files -eq 560 -and $actualResult.runtime_bytes -eq 27426391 -and $actualResult.runtime_build_id -ceq $fixed.build_id) 'Actual runtime did not copy completely.'
    $observed=[Collections.Generic.List[object]]::new();$observedBytes=0L
    foreach($row in $recorded.files){
        $filename=Join-Path (Join-Path $actual.request.stage_directory 'runtime') $row.path
        $entry=[ordered]@{path=$row.path;sha256=(Hash $filename);bytes=(Get-Item -LiteralPath $filename).Length}
        Assert-That ($entry.sha256 -ceq $row.sha256 -and $entry.bytes -eq $row.bytes) 'Actual copied runtime differs.'
        $observed.Add($entry);$observedBytes+=$entry.bytes
    }
    $inventory=[ordered]@{status='passed';source_commit=$fixed.source_commit;build_id=$fixed.build_id;archive_sha256=$fixed.archive_sha256;file_count=$observed.Count;expanded_bytes=$observedBytes;native_package='synthetic copy-only fixture';files=@($observed.ToArray())}
    $inventoryBytes=Fixture-Bytes $inventory;$inventoryPath=Join-Path $output 'actual-runtime-inventory.json'
    [IO.File]::WriteAllBytes($inventoryPath,$inventoryBytes)
    $inventoryText=$Utf8.GetString($inventoryBytes);$parts=[int][Math]::Ceiling($inventoryText.Length/4096.0)
    Write-Output ('RETAIN_FILE '+([ordered]@{path='actual-runtime-inventory.json';bytes=$inventoryBytes.Length;sha256=(Hash-Bytes $inventoryBytes);parts=$parts}|ConvertTo-Json -Compress))
    for($index=0;$index -lt $parts;$index++){
        $part=$inventoryText.Substring($index*4096,[Math]::Min(4096,$inventoryText.Length-$index*4096))
        Write-Output ('RETAIN_PART '+([ordered]@{path='actual-runtime-inventory.json';part=$index;content=$part}|ConvertTo-Json -Compress))
    }
    [IO.File]::Copy((Join-Path $downloadRoot 'download-result.json'),(Join-Path $output 'download-result.json'),$false)
    $result['actual_runtime']=[ordered]@{file_count=$observed.Count;expanded_bytes=$observedBytes;build_id=$fixed.build_id;inventory_sha256=(Hash-Bytes $inventoryBytes);source_commit=$fixed.source_commit;native_package='synthetic copy-only fixture'}
    Passed 'actual-560-file-runtime-copy'
    $base=New-StageFixture 'success'
    $success=Stage-Archives $base.request $base.app $fixture ('9'*64)
    Assert-That ($success.status -ceq 'passed' -and $success.runtime_files -eq 3 -and $success.native_files -eq 3) 'Matching archive pair did not stage.'
    foreach($row in $base.runtime_rows){
        $path=Join-Path (Join-Path $base.request.stage_directory 'runtime') $row.path
        Assert-That ((Hash $path) -ceq $row.sha256 -and (Get-Item -LiteralPath $path).Length -eq $row.bytes) 'Copied runtime fixture differs.'
    }
    $saved=[IO.File]::ReadAllText((Join-Path $base.request.stage_directory 'stage-result.json'),$Utf8)|ConvertFrom-Json
    Assert-That ($saved.status -ceq 'passed' -and $saved.installer_inputs.BeadExe -ceq $success.installer_inputs.BeadExe -and [IO.File]::Exists($saved.installer_inputs.RuntimeManifest) -and [IO.File]::Exists($saved.installer_inputs.BeadProvenance)) 'Installer contract is missing.'
    Assert-That ((Hash $base.request.app_archive.path) -ceq $base.request.app_archive.sha256 -and (Hash $base.request.native.archive.path) -ceq $base.request.native.archive.sha256) 'Input archive changed.'
    Passed 'complete-copy-and-installer-contract'
    $savedHash=Hash (Join-Path $base.request.stage_directory 'stage-result.json')
    Refused 'existing-stage-refuses-replay' {Stage-Archives $base.request $base.app $fixture ('9'*64)} 'Existing staging attempt'
    Assert-That ((Hash (Join-Path $base.request.stage_directory 'stage-result.json')) -ceq $savedHash) 'Replay changed the existing receipt.'

    $claimed=New-StageFixture 'claimed';[IO.File]::WriteAllText(($claimed.request.stage_directory+'.claim'),'retained prior intent',$Utf8)
    Refused 'existing-claim-refuses-replay' {Stage-Archives $claimed.request $claimed.app $fixture ('9'*64)} 'Existing staging attempt'
    Assert-That (-not(Test-Path -LiteralPath $claimed.request.stage_directory)) 'Claim refusal created a stage.'
    $case=New-StageFixture 'app-identity';$case.request.app_archive.sha256='0'*64;Refuse-Stage 'wrong-app-archive-identity' $case 'App archive differs'
    $case=New-StageFixture 'archive-size';$case.request.native.archive.bytes++;Refuse-Stage 'wrong-native-archive-size' $case 'Archive size differs'
    $case=New-StageFixture 'archive-hash';$case.request.native.archive.sha256='0'*64;Refuse-Stage 'wrong-native-archive-hash' $case 'Entry hash/size differs'
    $case=New-StageFixture 'manifest-hash';$case.app.manifest.sha256='0'*64;Refuse-Stage 'wrong-runtime-manifest-hash' $case 'Entry hash/size differs'
    $case=New-StageFixture 'runtime-count';$case.app.file_count++;Refuse-Stage 'wrong-runtime-count' $case 'Runtime file count differs'
    $case=New-StageFixture 'runtime-total';$case.app.expanded_bytes++;Refuse-Stage 'wrong-runtime-expanded-bytes' $case 'Runtime expanded byte count differs'
    $case=New-StageFixture 'app-source';$case.app.source_commit='f'*40;Refuse-Stage 'wrong-app-source' $case 'App build result differs'
    foreach($pair in @(@('build-id','Runtime BUILD_ID differs'),@('runtime-hash','Entry hash/size differs'),@('runtime-size','Entry size differs'),@('native-provenance','Native executable provenance differs'),@('native-build-tree','Native build result differs'),@('native-duplicate','Duplicate native manifest path'))){
        $case=New-StageFixture $pair[0] $pair[0];Refuse-Stage $pair[0] $case $pair[1]
    }
    $case=New-StageFixture 'deadline';$StageDeadline=[DateTime]::UtcNow.AddSeconds(-1)
    Refuse-Stage 'expired-copy-deadline' $case 'Archive staging deadline expired'
    $StageDeadline=[DateTime]::UtcNow.AddMinutes(3)
    $case=New-StageFixture 'unbound-native';$case.request.native.source_commit=$null
    Refuse-Stage 'unbound-native-template' $case 'Final native identity is unbound'

    $zipNumber=0
    foreach($name in @('../escape','/absolute','C:/absolute','back\slash','stream:ads','trailing.','CON.txt','empty//segment')){
        $zipNumber++
        $path=Join-Path $fixture ('unsafe-'+$zipNumber+'.zip')
        $row=New-FixtureZip $path @([pscustomobject]@{path=$name;data=$Utf8.GetBytes('unsafe')})
        $opened=Open-Archive $row $fixture
        try{Refused ('unsafe-zip-path-'+$zipNumber) {Get-ZipIndex $opened.archive @('safe.txt')} 'Unsafe ZIP path'}finally{$opened.archive.Dispose();$opened.stream.Dispose()}
    }
    foreach($variant in @('duplicate','case-collision','missing','extra','symlink','directory-payload','directory-reparse')){
        $members=@([pscustomobject]@{path='safe.txt';data=$Utf8.GetBytes('safe')})
        $expected=@('safe.txt');$pattern='Duplicate or case-colliding ZIP entry'
        switch($variant){
            'duplicate'{$members+=@([pscustomobject]@{path='safe.txt';data=$Utf8.GetBytes('again')})}
            'case-collision'{$members+=@([pscustomobject]@{path='SAFE.TXT';data=$Utf8.GetBytes('again')})}
            'missing'{$expected+=@('missing.txt');$pattern='Missing ZIP entry'}
            'extra'{$members+=@([pscustomobject]@{path='extra.txt';data=$Utf8.GetBytes('extra')});$pattern='Unexpected ZIP entry'}
            'symlink'{$members=@([pscustomobject]@{path='safe.txt';data=$Utf8.GetBytes('target');attributes=[int](-1577123840)});$pattern='Nonregular ZIP entry'}
            'directory-payload'{$members+=@([pscustomobject]@{path='folder/';data=$Utf8.GetBytes('not empty')});$pattern='Unexpected ZIP directory'}
            'directory-reparse'{$members=@([pscustomobject]@{path='folder/';data=[byte[]]::new(0);attributes=1040},[pscustomobject]@{path='folder/safe.txt';data=$Utf8.GetBytes('safe')});$expected=@('folder/safe.txt');$pattern='Unexpected ZIP directory'}
        }
        $row=New-FixtureZip (Join-Path $fixture ($variant+'.zip')) $members
        $opened=Open-Archive $row $fixture
        try{Refused ('zip-'+$variant) {Get-ZipIndex $opened.archive $expected} $pattern}finally{$opened.archive.Dispose();$opened.stream.Dispose()}
    }
    $junction=Join-Path $fixture 'junction'
    $null=New-Item -ItemType Junction -Path $junction -Target $output
    try{Refused 'reparse-ancestor' {Safe-Path (Join-Path $junction 'outside-canary.txt') $fixture} 'Reparse point'}finally{[IO.Directory]::Delete($junction)}
    $partial=New-StageFixture 'partial'
    $copyDefinition=@($definitions|Where-Object{$_.Name -ceq 'Copy-Entry'})[0].Extent.Text
    $originalCopy=(Get-Item Function:Copy-Entry).ScriptBlock;$script:FixtureCopies=0
    function Copy-Entry([IO.Compression.ZipArchiveEntry]$Entry,[object]$Row,[string]$Destination){
        $script:FixtureCopies++
        if($script:FixtureCopies -eq 2){throw 'Injected owned copy interruption.'}
        & $originalCopy $Entry $Row $Destination
    }
    try{Refused 'partial-copy-retains-evidence' {Stage-Archives $partial.request $partial.app $fixture ('9'*64)} 'Injected owned copy interruption'}
    finally{Invoke-Expression $copyDefinition}
    $firstFile=Join-Path $partial.request.stage_directory 'runtime/.next/BUILD_ID'
    $failureFile=Join-Path $partial.request.stage_directory 'stage-result.json'
    Assert-That ([IO.File]::Exists($firstFile) -and [IO.File]::Exists(($partial.request.stage_directory+'.claim')) -and [IO.File]::Exists($failureFile)) 'Partial evidence was removed.'
    $failure=[IO.File]::ReadAllText($failureFile,$Utf8)|ConvertFrom-Json
    Assert-That ($failure.status -ceq 'failed' -and $failure.error -match 'Injected owned copy interruption') 'Partial copy failure was not recorded.'
    $firstHash=Hash $firstFile;$failureHash=Hash $failureFile
    Refused 'partial-copy-refuses-replay' {Stage-Archives $partial.request $partial.app $fixture ('9'*64)} 'Existing staging attempt'
    Assert-That ((Hash $firstFile) -ceq $firstHash -and (Hash $failureFile) -ceq $failureHash) 'Partial evidence changed during replay refusal.'
    Assert-That ((Hash $outside) -ceq $outsideHash) 'Archive tests changed bytes outside the owned fixture.'
    $result['outside_canary_unchanged']=$true
    Assert-That ($result.cases.Count -eq 40) 'Focused case inventory differs.'
    $result.status='passed'
}catch{$result['error']=$_.Exception.ToString()}
finally{
    $result['case_count']=$result.cases.Count
    $bytes=Fixture-Bytes $result
    [IO.File]::WriteAllBytes((Join-Path $output 'result.json'),$bytes)
    Write-Output ('STAGING_CHECK_RESULT_BASE64 '+[Convert]::ToBase64String($bytes))
}
if($result.status -ne 'passed'){exit 1}
