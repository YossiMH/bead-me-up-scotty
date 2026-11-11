param([Parameter(Mandatory)][string]$Invocation, [Parameter(Mandatory)][string]$Wrapper, [ValidateSet('Run','Verify')][string]$Mode='Run')
$ErrorActionPreference = 'Stop'
$run = Get-Content -LiteralPath $Invocation -Raw | ConvertFrom-Json
if ($Mode -eq 'Run') { & $Wrapper -Invocation $Invocation }
$outer = Get-Content -LiteralPath (Join-Path $run.records 'result.json') -Raw | ConvertFrom-Json
if ($outer.state -cne 'PASS' -or $outer.remainingFixtureBirths.Count -ne 0) { throw 'Resource-bounded calibration failed' }
$result = Get-Content -LiteralPath (Join-Path $run.fixture 'contained-debugger-result.json') -Raw | ConvertFrom-Json
if ($result.phase -cne 'complete' -or $result.members.Count -ne 2 -or $result.innerMemoryBytes -ne 768MB) { throw 'Debugger and target containment was not verified' }
if ($result.remaining.Count -ne 0 -or $result.targetExit -ne 1) { throw 'Expected failed mkdir and no surviving owned processes' }
$trace = Get-Content -LiteralPath (Join-Path $run.fixture 'debugger.log') -Raw
if ($trace -notmatch 'BOOL=0 LastError=b7' -or $trace -notmatch 'path=already-present') { throw 'Expected real CreateDirectoryW ERROR_ALREADY_EXISTS result' }
if ((Get-ChildItem -LiteralPath (Join-Path $run.cwd 'already-present') -Force).Count -ne 0) { throw 'Known-existing calibration directory changed' }
'PASS: real failed directory creation, debugger and target contained before resume, owned processes exited.'
