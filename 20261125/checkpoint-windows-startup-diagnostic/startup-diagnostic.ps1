#requires -Version 5.1
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][ValidateSet('build','check')][string]$Phase,
    [Parameter(Mandatory=$true)][string]$PythonHelper,
    [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$HelperSha256,
    [Parameter(Mandatory=$true)][string]$InputManifest,
    [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$InputsSha256,
    [Parameter(Mandatory=$true)][string]$JobHelper,
    [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$SupervisorSha256,
    [string]$Checkout,
    [string]$ArtifactDirectory,
    [string]$BuildHelper,
    [string]$CorpusHelper,
    [string]$CorpusInputs,
    [string]$SmokeHelper
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
trap {
    $failure = [ordered]@{ status='failed_startup'; exception_type=$_.Exception.GetType().FullName;
        message=$_.Exception.Message; script_stack=$_.ScriptStackTrace;
        position=$_.InvocationInfo.PositionMessage; statement=$_.InvocationInfo.Line }
    [Console]::WriteLine('CHECKPOINT_STARTUP_FAILURE ' + (ConvertTo-Json -InputObject $failure -Depth 8 -Compress))
    exit 1
}
$ProgressPreference = 'SilentlyContinue'
$Utf8 = [Text.UTF8Encoding]::new($false)
$JobSha256 = '2758a6ff94c0eecdfa360363469069dfa8470efc1f91228812146919a978921f'
$LimitSeconds = if ($Phase -eq 'build') { 2520 } else { 8460 }

function Get-SafePath([string]$Value, [bool]$Directory=$false) {
    if ($Value -notmatch '^[A-Za-z]:[\\/]') { throw 'A full local Windows path is required.' }
    $trace = [ordered]@{ input_type=$Value.GetType().FullName; value=$Value; directory=$Directory;
        caller=(Get-PSCallStack | Select-Object -Skip 1 -First 1 | ForEach-Object { $_.ScriptName + ':' + $_.ScriptLineNumber }) }
    [Console]::WriteLine('CHECKPOINT_STARTUP_PATH ' + (ConvertTo-Json -InputObject $trace -Depth 8 -Compress))
    $path = [IO.Path]::GetFullPath($Value).TrimEnd('\','/')
    $item = Get-Item -LiteralPath $path -Force
    if ($Directory -ne [bool]$item.PSIsContainer) { throw 'Unexpected path type.' }
    $cursor = $path
    while ($cursor) {
        $entry = Get-Item -LiteralPath $cursor -Force
        if (($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Reparse path refused.' }
        $parent = [IO.Directory]::GetParent($cursor)
        $cursor = if ($parent) { $parent.FullName } else { $null }
    }
    return $path
}
function Get-Sha([string]$Path) { return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant() }
function Quote-Argument([string]$Value) {
    $builder = [Text.StringBuilder]::new()
    [void]$builder.Append('"')
    $slashes = 0
    foreach ($c in $Value.ToCharArray()) {
        if ($c -eq '\') { $slashes++; continue }
        if ($c -eq '"') { [void]$builder.Append(('\' * (2 * $slashes + 1))) }
        else { [void]$builder.Append(('\' * $slashes)) }
        [void]$builder.Append($c)
        $slashes = 0
    }
    [void]$builder.Append(('\' * (2 * $slashes)))
    [void]$builder.Append('"')
    return $builder.ToString()
}
function Write-NewJson([string]$Path, $Value) {
    $bytes = $Utf8.GetBytes((ConvertTo-Json -InputObject $Value -Depth 30) + [string][char]10)
    $stream = [IO.File]::Open($Path, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::Read)
    try { $stream.Write($bytes,0,$bytes.Length); $stream.Flush($true) } finally { $stream.Dispose() }
}
$PythonHelper = Get-SafePath $PythonHelper
$InputManifest = Get-SafePath $InputManifest
$JobHelper = Get-SafePath $JobHelper
$ownPath = Get-SafePath $PSCommandPath
if ((Get-Sha $ownPath) -cne $SupervisorSha256 -or (Get-Sha $PythonHelper) -cne $HelperSha256 -or
    (Get-Sha $InputManifest) -cne $InputsSha256 -or (Get-Sha $JobHelper) -cne $JobSha256) {
    throw 'An exact reviewed script or input hash differs.'
}
if ((Get-Item -LiteralPath $InputManifest).Length -gt 1MB) { throw 'Inputs exceed the metadata bound.' }
$temp = Get-SafePath $env:RUNNER_TEMP $true
if ($env:GITHUB_RUN_ID -notmatch '^[0-9]+$' -or $env:GITHUB_RUN_ATTEMPT -notmatch '^[1-9][0-9]*$') {
    throw 'Invalid hosted run identity.'
}
$root = Join-Path $temp ("bead-checkpoint-windows-supervisor-$Phase-$($env:GITHUB_RUN_ID)-$($env:GITHUB_RUN_ATTEMPT)")
if (Test-Path -LiteralPath $root) { throw 'Supervisor output exists; reconcile this attempt before any retry.' }
[void][IO.Directory]::CreateDirectory($root)
$arguments = @($PythonHelper, '--inputs', $InputManifest, '--inputs-sha256', $InputsSha256, '--helper-sha256', $HelperSha256)
if ($Phase -eq 'build') {
    $Checkout = Get-SafePath $Checkout $true
    $arguments += @('--checkout', $Checkout)
} else {
    $ArtifactDirectory = Get-SafePath $ArtifactDirectory $true
    $BuildHelper = Get-SafePath $BuildHelper
    $CorpusHelper = Get-SafePath $CorpusHelper
    $CorpusInputs = Get-SafePath $CorpusInputs
    $SmokeHelper = Get-SafePath $SmokeHelper
    $arguments += @('--artifact-directory', $ArtifactDirectory, '--build-helper', $BuildHelper,
                    '--corpus-helper', $CorpusHelper, '--corpus-inputs', $CorpusInputs, '--smoke-helper', $SmokeHelper)
}
$pythonCommands = @(Get-Command python.exe -CommandType Application -ErrorAction Stop)
[Console]::WriteLine('CHECKPOINT_STARTUP_PYTHON_CANDIDATES ' + (ConvertTo-Json -InputObject @($pythonCommands | ForEach-Object { [ordered]@{ type=$_.GetType().FullName; source=$_.Source } }) -Depth 8 -Compress))
$python = Get-SafePath (Get-Command python.exe -CommandType Application -ErrorAction Stop).Source
[Console]::WriteLine('CHECKPOINT_STARTUP_SUCCESS ' + (ConvertTo-Json -InputObject ([ordered]@{ status='startup_paths_passed'; python=$python; supervisor_root=$root; powershell_version=$PSVersionTable.PSVersion.ToString(); no_python_or_cargo_execution=$true }) -Depth 8 -Compress))
exit 0
