#requires -Version 5.1
# Parse the exact helpers and compile declarations on an isolated hosted runner.
[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$Directory,[Parameter(Mandatory=$true)][string]$ManifestSha256)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$Utf8=[Text.UTF8Encoding]::new($false)
$manifestPath=Join-Path $Directory 'parse-inputs.json'
if((Get-FileHash -LiteralPath $manifestPath -Algorithm SHA256).Hash.ToLowerInvariant() -cne $ManifestSha256){throw 'Parse inputs changed.'}
$inputs=[IO.File]::ReadAllText($manifestPath,$Utf8)|ConvertFrom-Json
if($inputs.schema_version -ne 1 -or $inputs.continuation_revision -ne 9 -or $inputs.app_source_commit -cne '0309539797fd7d016e2b8fd8bdc0ae9cefc20219' -or $null -ne $inputs.native_source_commit -or $inputs.native_qualification_pending -ne $true){throw 'Unexpected parser input contract.'}
$output=Join-Path $env:RUNNER_TEMP ('bead-binding-checks-'+$env:GITHUB_RUN_ID+'-'+$env:GITHUB_RUN_ATTEMPT)
if(Test-Path -LiteralPath $output){throw 'Parser output already exists.'}
[void][IO.Directory]::CreateDirectory($output)
$result=[ordered]@{schema_version=1;status='failed';operation='ordinary-powershell-and-node-parse';run_id=$env:GITHUB_RUN_ID;workflow_commit=$env:GITHUB_SHA;app_source_commit=$inputs.app_source_commit;native_source_commit=$inputs.native_source_commit;powershell_version=$PSVersionTable.PSVersion.ToString();files=@();declarations=@();product_execution=$false;pc_actions=0}
$classes=[Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
try{
    if($PSVersionTable.PSVersion.Major -ne 5 -or $PSVersionTable.PSVersion.Minor -ne 1){throw 'Ordinary Windows PowerShell 5.1 is required.'}
    if(@($inputs.files.PSObject.Properties).Count -ne 8){throw 'Expected exactly eight final inputs.'}
    foreach($property in $inputs.files.PSObject.Properties){
        $name=$property.Name
        if($name -notmatch '^[A-Za-z0-9.-]+\.(ps1|mjs|json)$'){throw 'Unexpected parser filename.'}
        $file=Join-Path $Directory $name
        $hash=(Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()
        if($hash -cne $property.Value){throw ('Candidate bytes changed: '+$name)}
        if($name.EndsWith('.ps1')){
            $tokens=$null;$errors=$null
            $ast=[Management.Automation.Language.Parser]::ParseFile($file,[ref]$tokens,[ref]$errors)
            $result.files+=@{path=$name;sha256=$hash;parser='PowerShell.Parser.ParseFile';error_count=@($errors).Count;errors=@($errors|ForEach-Object{$_.Message})}
            if(@($errors).Count -ne 0){throw ('PowerShell parse failed: '+$name)}
            $found=@($ast.FindAll({param($node) $node -is [Management.Automation.Language.StringConstantExpressionAst] -and $node.Value -match 'public static class (Checkpoint20261125Inspector|Scotty20261125CoordinationInspector|Scotty20261111IndexFile|Scotty20261125TrayJobInspector)'},$true))
            if($found.Count -ne 1){throw ('Expected one embedded declaration: '+$name)}
            $code=$found[0].Value
            if($code -notmatch 'public static class ([A-Za-z0-9]+)'){throw 'Missing class identity.'}
            $class=$Matches[1]
            if(-not $classes.Add($class)){throw 'Duplicate declaration.'}
            # Compile declarations only. Never invoke a Win32 method, helper or installer.
            Add-Type -TypeDefinition $code
            $digest=([BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash($Utf8.GetBytes($code)))).Replace('-','').ToLowerInvariant()
            $result.declarations+=@{class=$class;sha256=$digest;compiled=$true;methods_invoked=$false}
        }elseif($name.EndsWith('.mjs')){
            & node.exe --check $file
            $exit=$LASTEXITCODE
            $result.files+=@{path=$name;sha256=$hash;parser='node --check';exit_code=$exit}
            if($exit -ne 0){throw ('Node syntax check failed: '+$name)}
        }else{
            $null=[IO.File]::ReadAllText($file,$Utf8)|ConvertFrom-Json
            $result.files+=@{path=$name;sha256=$hash;parser='ConvertFrom-Json';status='passed'}
        }
    }
    if($classes.Count -ne 4){throw 'Incomplete declaration inventory.'}
    foreach($class in $inputs.embedded_classes){if(-not $classes.Contains([string]$class)){throw ('Missing declaration: '+$class)}}
    $result.status='passed'
}catch{$result['error']=$_.Exception.ToString()}
finally{
    $bytes=$Utf8.GetBytes(($result|ConvertTo-Json -Depth 8)+[char]10)
    $destination=Join-Path $output 'parse-result.json';[IO.File]::WriteAllBytes($destination,$bytes)
    $hash=(Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash.ToLowerInvariant()
    Write-Output ('BINDING_PARSE_RESULT_BASE64 '+[Convert]::ToBase64String($bytes))
    Write-Output ('BINDING_PARSE_RESULT_SHA256 '+$hash)
}
if($result.status -ne 'passed'){exit 1}
