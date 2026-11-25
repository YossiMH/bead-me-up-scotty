#requires -Version 5.1
# Hosted-only synthetic fixtures exercise the existing read-only installer checks.
[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$Directory,[Parameter(Mandatory=$true)][string]$ManifestSha256)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$Utf8=[Text.UTF8Encoding]::new($false)
if($env:GITHUB_ACTIONS -cne 'true' -or -not $env:RUNNER_TEMP -or -not $env:GITHUB_RUN_ID){throw 'Hosted Actions fixtures only.'}
$manifestPath=Join-Path $Directory 'parse-inputs.json'
if((Get-FileHash -LiteralPath $manifestPath -Algorithm SHA256).Hash.ToLowerInvariant() -cne $ManifestSha256){throw 'Input manifest changed.'}
$inputs=[IO.File]::ReadAllText($manifestPath,$Utf8)|ConvertFrom-Json
$installer=Join-Path $Directory 'windows-install-tray-host-20261125.ps1'
if((Get-FileHash -LiteralPath $installer -Algorithm SHA256).Hash.ToLowerInvariant() -cne $inputs.files.'windows-install-tray-host-20261125.ps1'){throw 'Installer changed.'}
$tokens=$null;$errors=$null
$ast=[Management.Automation.Language.Parser]::ParseFile($installer,[ref]$tokens,[ref]$errors)
if(@($errors).Count){throw 'Installer parse failed.'}
# Load only these read-only functions, preserving their exact source bodies.
# No top-level installer statement, baseline adoption, move, pin or push runs.
foreach($name in @('Assert-That','Hash','Safe-Path','Quote-Argument','Run-Native','Git','Assert-DocumentedDescendant','Verify-Runtime')){
    $function=@($ast.FindAll({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -ceq $name},$true))
    if($function.Count -ne 1){throw ('Unexpected function inventory: '+$name)}
    Invoke-Expression $function[0].Extent.Text
}
$GitExe=(Get-Command git.exe -CommandType Application -ErrorAction Stop|Select-Object -First 1).Source
$output=Join-Path $env:RUNNER_TEMP ('bead-binding-checks-'+$env:GITHUB_RUN_ID+'-'+$env:GITHUB_RUN_ATTEMPT)
if(-not(Test-Path -LiteralPath $output)){throw 'Parser output is required first.'}
$fixture=Join-Path $env:RUNNER_TEMP ('bead-binding-fixture-'+$env:GITHUB_RUN_ID+'-'+$env:GITHUB_RUN_ATTEMPT)
if(Test-Path -LiteralPath $fixture){throw 'Fresh fixture required.'}
[void][IO.Directory]::CreateDirectory($fixture)
$mapped=$false;$runtimeRoot=$null;$runtimeCreated=$false
$result=[ordered]@{schema_version=1;status='failed';operation='synthetic-installer-refusals';source_sha256=$inputs.files.'windows-install-tray-host-20261125.ps1';cases=@();installer_executed=$false;native_commands=0;pc_actions=0}
function Refused([string]$Name,[scriptblock]$Action,[string]$Expected){
    $message=$null
    try{& $Action}catch{$message=$_.Exception.Message}
    if($null -eq $message -or $message -notmatch $Expected){throw ('Unexpected refusal for '+$Name+': '+$message)}
    $result.cases+=@{name=$Name;result='passed';expected_refusal=$message}
}
function Inventory([string]$Root){
    return @([IO.Directory]::GetFiles($Root,'*',[IO.SearchOption]::AllDirectories)|Sort-Object|ForEach-Object{@{path=$_.Substring($Root.Length);sha256=Hash $_;bytes=(Get-Item -LiteralPath $_).Length}})|ConvertTo-Json -Depth 4 -Compress
}
try{
    # The real path verifier accepts only F:. The hosted runner owns this
    # fresh mapping or fresh child; no F:/Dev path is opened or constructed.
    if(-not(Test-Path -LiteralPath 'F:\')){
        & subst.exe F: $fixture
        if($LASTEXITCODE -ne 0){throw 'Could not map the fresh hosted fixture.'}
        $mapped=$true
    }
    $runtimeRoot='F:\bead-binding-runtime-'+$env:GITHUB_RUN_ID+'-'+$env:GITHUB_RUN_ATTEMPT
    if(Test-Path -LiteralPath $runtimeRoot){throw 'Fresh runtime fixture required.'}
    [void][IO.Directory]::CreateDirectory($runtimeRoot);$runtimeCreated=$true
    [IO.File]::WriteAllText((Join-Path $runtimeRoot 'BUILD_ID'),'binding-mock'+[char]10,$Utf8)
    [IO.File]::WriteAllText((Join-Path $runtimeRoot 'server.js'),'synthetic runtime bytes'+[char]10,$Utf8)
    $Runtime=[pscustomobject]@{build_id='binding-mock';files=@(
        [pscustomobject]@{path='.next/BUILD_ID';sha256=(Hash (Join-Path $runtimeRoot 'BUILD_ID'));bytes=(Get-Item (Join-Path $runtimeRoot 'BUILD_ID')).Length},
        [pscustomobject]@{path='.next/server.js';sha256=(Hash (Join-Path $runtimeRoot 'server.js'));bytes=(Get-Item (Join-Path $runtimeRoot 'server.js')).Length}
    )}
    Verify-Runtime $runtimeRoot
    $result.cases+=@{name='matching-runtime';result='passed'}
    $before=Inventory $runtimeRoot
    $originalHash=$Runtime.files[1].sha256;$Runtime.files[1].sha256='0'*64
    Refused 'runtime-hash' {Verify-Runtime $runtimeRoot} 'Runtime hash/size differs'
    $Runtime.files[1].sha256=$originalHash
    $originalSize=$Runtime.files[1].bytes;$Runtime.files[1].bytes=$originalSize+1
    Refused 'runtime-size' {Verify-Runtime $runtimeRoot} 'Runtime hash/size differs'
    $Runtime.files[1].bytes=$originalSize
    $Runtime.build_id='wrong-build'
    Refused 'runtime-build-id' {Verify-Runtime $runtimeRoot} 'Runtime BUILD_ID differs'
    $Runtime.build_id='binding-mock'
    $Runtime.files[1].path='.next/../outside.js'
    Refused 'runtime-traversal' {Verify-Runtime $runtimeRoot} 'Unexpected runtime manifest path'
    $Runtime.files[1].path='.next/server.js'
    $Runtime.files+=@($Runtime.files[1])
    Refused 'runtime-duplicate' {Verify-Runtime $runtimeRoot} 'Duplicate runtime manifest path'
    $Runtime.files=@($Runtime.files[0],$Runtime.files[1])
    if((Inventory $runtimeRoot) -cne $before){throw 'A read-only runtime verifier changed fixture bytes.'}
    $result['runtime_bytes_unchanged']=$true

    $repo=Join-Path $fixture 'source'
    [void][IO.Directory]::CreateDirectory((Join-Path $repo 'lib'))
    $null=Git $repo @('init','--initial-branch=main')
    $null=Git $repo @('config','user.name','Binding fixture')
    $null=Git $repo @('config','user.email','binding-fixture@example.invalid')
    $null=Git $repo @('config','commit.gpgsign','false')
    [IO.File]::WriteAllText((Join-Path $repo 'README.md'),'initial'+[char]10,$Utf8)
    [IO.File]::WriteAllText((Join-Path $repo 'lib/native-edit.ts'),'initial'+[char]10,$Utf8)
    $null=Git $repo @('add','README.md','lib/native-edit.ts')
    $null=Git $repo @('commit','-m','Synthetic source baseline')
    $built=(Git $repo @('rev-parse','HEAD')).Trim()
    [IO.File]::WriteAllText((Join-Path $repo 'README.md'),'documented'+[char]10,$Utf8)
    $null=Git $repo @('add','README.md')
    $null=Git $repo @('commit','-m','Synthetic documentation descendant')
    $documented=(Git $repo @('rev-parse','HEAD')).Trim()
    $allow='^(?:README\.md$|AGENTS\.md$|\.gitignore$|docs/|scripts/test[^/]*$|scripts/fixtures/|scripts/support/)'
    Assert-DocumentedDescendant $repo $built $documented $allow
    $result.cases+=@{name='documentation-descendant';result='passed'}
    [IO.File]::WriteAllText((Join-Path $repo 'lib/native-edit.ts'),'unbuilt adapter change'+[char]10,$Utf8)
    $null=Git $repo @('add','lib/native-edit.ts')
    $null=Git $repo @('commit','-m','Synthetic unbuilt adapter descendant')
    $changed=(Git $repo @('rev-parse','HEAD')).Trim()
    $sourceBefore=Inventory $repo
    Refused 'unbuilt-adapter-source' {Assert-DocumentedDescendant $repo $built $changed $allow} 'Runtime differs from accepted source: lib/native-edit.ts'
    Refused 'non-descendant-source' {Assert-DocumentedDescendant $repo $changed $built $allow} 'Install command failed'
    if((Inventory $repo) -cne $sourceBefore){throw 'Read-only source verification changed fixture bytes.'}
    $result['source_bytes_unchanged']=$true
    $result.status='passed'
}catch{$result['error']=$_.Exception.ToString()}
finally{
    if($runtimeCreated -and (Test-Path -LiteralPath $runtimeRoot)){Remove-Item -LiteralPath $runtimeRoot -Recurse -Force}
    if($mapped){& subst.exe F: /D;if($LASTEXITCODE -ne 0){$result.status='failed';$result['cleanup_error']='Fixture drive mapping remains.'}}
    if(Test-Path -LiteralPath $fixture){Remove-Item -LiteralPath $fixture -Recurse -Force}
    $bytes=$Utf8.GetBytes(($result|ConvertTo-Json -Depth 8)+[char]10)
    [IO.File]::WriteAllBytes((Join-Path $output 'installer-refusals.json'),$bytes)
    Write-Output ('BINDING_INSTALLER_REFUSALS_BASE64 '+[Convert]::ToBase64String($bytes))
}
if($result.status -ne 'passed'){exit 1}
