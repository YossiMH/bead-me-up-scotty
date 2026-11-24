#requires -Version 5.1
# Retain PowerShell startup output before the browser supervisor creates its
# evidence directory. The call operator keeps both scripts in one process.
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][ValidateSet('flows','recovery','priority')][string]$Flow,
    [Parameter(Mandatory=$true)][ValidateRange(1,99)][int]$Attempt
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
[Diagnostics.Process]::GetCurrentProcess().PriorityClass='BelowNormal'
$CaptureRoot='F:\Dev\.bead-edit-20261111\browser-fallback-20261124'
$CaptureName=$Flow+'-'+[string]$Attempt
$CaptureDirectory=Join-Path $CaptureRoot ('captures\'+$CaptureName)
$CaptureEvidence=Join-Path $CaptureRoot ('results\'+$CaptureName)
$CaptureRunner=Join-Path $PSScriptRoot 'windows-browser-run.ps1'
$CaptureManifest=Join-Path $PSScriptRoot 'windows-browser-input-local.json'
$CapturePorts=@{flows=43976;recovery=43977;priority=43978}
$CaptureEncoding=[Text.UTF8Encoding]::new($false)
$CaptureExit=1
$CaptureReport=[ordered]@{schema_version=1;status='failed';phase='starting';flow=$Flow;attempt=$Attempt
    pid=$PID;session_id=[Diagnostics.Process]::GetCurrentProcess().SessionId
    started_utc=[DateTime]::UtcNow.ToString('o');runner=$CaptureRunner;input_manifest=$CaptureManifest
    evidence_directory=$CaptureEvidence;capture_directory=$CaptureDirectory;runner_exit_code=$null
    stream_encoding='PowerShell5.1 redirection: UTF-16LE';outer_exit_code=1}

$CaptureCursor=$CaptureDirectory
while($CaptureCursor){
    if(Test-Path -LiteralPath $CaptureCursor){
        if(((Get-Item -LiteralPath $CaptureCursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)-ne 0){throw ('Reparse point in capture path: '+$CaptureCursor)}
    }
    $CaptureParent=[IO.Directory]::GetParent($CaptureCursor)
    $CaptureCursor=if($CaptureParent){$CaptureParent.FullName}else{$null}
}
if(Test-Path -LiteralPath $CaptureDirectory){throw 'Capture directory already exists; inspect the earlier invocation.'}
[void][IO.Directory]::CreateDirectory($CaptureDirectory)
$CaptureRecord=Join-Path $CaptureDirectory 'capture-result.json'
try{
    if(Test-Path -LiteralPath $CaptureEvidence){throw 'Run evidence already exists; inspect the earlier invocation.'}
    if((Get-FileHash -LiteralPath $CaptureRunner -Algorithm SHA256).Hash.ToLowerInvariant() -ne '1cb1073d95c9588f5a2797a8e79262eb3e19a6c94960c02d689b90d68eadd2ea'){throw 'Reviewed browser supervisor hash differs.'}
    if((Get-FileHash -LiteralPath $CaptureManifest -Algorithm SHA256).Hash.ToLowerInvariant() -ne '2c689e960998deaf41c13b507f3596cb3c5c56000e826416cac9357fc55f8b86'){throw 'Reviewed browser input hash differs.'}
    $CaptureReport['phase']='running'
    [IO.File]::WriteAllText($CaptureRecord,($CaptureReport|ConvertTo-Json -Depth 8),$CaptureEncoding)
    $CaptureArguments=@{InputManifest=$CaptureManifest;Flow=$Flow;EvidenceDirectory=$CaptureEvidence
        Port=$CapturePorts[$Flow];TimeoutSeconds=180;MaxOwnedResidentMiB=512;NodePath='node.exe'}
    & $CaptureRunner @CaptureArguments 1> (Join-Path $CaptureDirectory 'outer.stdout.log') 2> (Join-Path $CaptureDirectory 'outer.stderr.log')
    $CaptureReport['runner_exit_code']=$LASTEXITCODE
    if($LASTEXITCODE -isnot [int]){throw 'Browser supervisor did not return an integer exit code.'}
    if($LASTEXITCODE -ne 0){$CaptureExit=[int]$LASTEXITCODE;throw 'Browser supervisor returned a failure; inspect its captured streams.'}
    $CaptureActual=[IO.File]::ReadAllText((Join-Path $CaptureEvidence 'result.json'))|ConvertFrom-Json
    if($CaptureActual.phase -ne 'finished' -or $CaptureActual.status -ne 'passed'){throw 'Browser supervisor did not record a finished successful result.'}
    $CaptureExit=0;$CaptureReport['status']='passed'
}catch{
    $CaptureReport['error']=[ordered]@{exception=$_.Exception.ToString();id=$_.FullyQualifiedErrorId
        position=$_.InvocationInfo.PositionMessage;script_stack_trace=$_.ScriptStackTrace}
}finally{
    $CaptureReport['phase']='finished';$CaptureReport['outer_exit_code']=$CaptureExit
    $CaptureReport['finished_utc']=[DateTime]::UtcNow.ToString('o')
    [IO.File]::WriteAllText($CaptureRecord,($CaptureReport|ConvertTo-Json -Depth 8),$CaptureEncoding)
}
exit $CaptureExit
