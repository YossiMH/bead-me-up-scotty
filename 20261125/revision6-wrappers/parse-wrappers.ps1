#requires -Version 5.1
[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$Directory,[Parameter(Mandatory=$true)][string]$ManifestSha256)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$Utf8=[Text.UTF8Encoding]::new($false)
$manifestPath=Join-Path $Directory 'parse-inputs.json'
if((Get-FileHash -LiteralPath $manifestPath -Algorithm SHA256).Hash.ToLowerInvariant() -cne $ManifestSha256){throw 'Parse inputs changed.'}
$inputs=[IO.File]::ReadAllText($manifestPath,$Utf8)|ConvertFrom-Json
if($inputs.schema_version -ne 1 -or $inputs.source_commit -cne '5232c8b94804064ab71af571ee28797667bd72bd'){throw 'Unexpected parser input contract.'}
$output=Join-Path $env:RUNNER_TEMP ('scotty-wrapper-parse-'+$env:GITHUB_RUN_ID+'-'+$env:GITHUB_RUN_ATTEMPT)
if(Test-Path -LiteralPath $output){throw 'Parser output already exists.'}
[void][IO.Directory]::CreateDirectory($output)
$result=[ordered]@{schema_version=1;status='failed';operation='ordinary-powershell-parse';run_id=$env:GITHUB_RUN_ID;run_attempt=$env:GITHUB_RUN_ATTEMPT;workflow_commit=$env:GITHUB_SHA;source_commit=$inputs.source_commit;powershell_version=$PSVersionTable.PSVersion.ToString();files=@();product_execution=$false;pc_actions=0}
$definitions=[Collections.Generic.List[string]]::new()
try{
    if($PSVersionTable.PSVersion.Major -ne 5 -or $PSVersionTable.PSVersion.Minor -ne 1){throw 'Ordinary Windows PowerShell 5.1 is required.'}
    if(@($inputs.files.PSObject.Properties).Count -ne 4){throw 'Expected exactly four final wrapper files.'}
    foreach($property in $inputs.files.PSObject.Properties){
        $name=$property.Name
        if($name -notmatch '^[A-Za-z0-9.-]+\.(ps1|mjs)$'){throw 'Unexpected parser filename.'}
        $path=Join-Path $Directory $name
        $hash=(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
        if($hash -cne $property.Value){throw ('Candidate bytes changed: '+$name)}
        if($name.EndsWith('.ps1')){
            $tokens=$null;$errors=$null
            $ast=[Management.Automation.Language.Parser]::ParseFile($path,[ref]$tokens,[ref]$errors)
            $result.files+=@{path=$name;sha256=$hash;parser='PowerShell.Parser.ParseFile';error_count=@($errors).Count;errors=@($errors|ForEach-Object{$_.Message})}
            if(@($errors).Count -ne 0){throw ('PowerShell parse failed: '+$name)}
            $found=@($ast.FindAll({param($node) $node -is [Management.Automation.Language.StringConstantExpressionAst] -and $node.Value.Contains('public static class Scotty20261125TrayJobInspector')},$true))
            if($name -match '(?:smoke|launch)-host-'){
                if($found.Count -ne 1){throw 'Expected one embedded ownership inspector.'}
                $definitions.Add($found[0].Value)
            }
        }else{
            & node.exe --check $path
            $exit=$LASTEXITCODE
            $result.files+=@{path=$name;sha256=$hash;parser='node --check';exit_code=$exit}
            if($exit -ne 0){throw 'Node syntax check failed.'}
        }
    }
    if($definitions.Count -ne 2 -or $definitions[0] -cne $definitions[1]){throw 'The two ownership inspectors differ.'}
    # Compile only the exact embedded declarations. No source wrapper, Win32
    # method, deadline, child process, application or installer is executed.
    Add-Type -TypeDefinition $definitions[0]
    $result['embedded_inspector_compiles']=$true
    $result['embedded_inspector_sha256']=([BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash($Utf8.GetBytes($definitions[0])))).Replace('-','').ToLowerInvariant()
    $result.status='passed'
}catch{$result['error']=$_.Exception.ToString()}
finally{
    $bytes=$Utf8.GetBytes(($result|ConvertTo-Json -Depth 8)+"`n")
    $destination=Join-Path $output 'result.json';[IO.File]::WriteAllBytes($destination,$bytes)
    $sha=(Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash.ToLowerInvariant()
    Write-Output ('TRAY_WRAPPER_PARSE_RESULT_BASE64 '+[Convert]::ToBase64String($bytes))
    Write-Output ('TRAY_WRAPPER_PARSE_RESULT_SHA256 '+$sha)
}
if($result.status -ne 'passed'){exit 1}
