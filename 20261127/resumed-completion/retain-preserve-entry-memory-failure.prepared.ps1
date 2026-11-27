# Prepared cloud-side. Root may execute once after retaining the raw receipt,
# confirming no active helper and retention-root absence, and owning the writer window.
# Run with a fresh bounded Emergency proposal; this is not a replay or a phase run.
#requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Diagnostics.Process]::GetCurrentProcess().PriorityClass = 'BelowNormal'
$clock = [Diagnostics.Stopwatch]::StartNew()
$source = 'F:\Dev\.bead-edit-20261111\coordination-20261124\checkpoint-only-supervision-preserve-20261127-v1'
$destination = $source + '-entry-memory-20261127-151643Z'
$retention = 'F:\Dev\.bead-edit-20261111\preservation-checkpoint-only-20261127-v1'
$expected = '45b534444efe459e62c44a94ded1271b8afb5cc8e569989cff39aae3f5266709'
function Assert-That([bool]$value, [string]$message) { if (-not $value) { throw $message } }
Assert-That (-not (Test-Path -LiteralPath $destination)) 'Failure archive already exists; reconcile the previous archive action.'
Assert-That (-not (Test-Path -LiteralPath $retention)) 'History retention root exists; reconcile the phase attempt before retry.'
$directory = Get-Item -LiteralPath $source -Force
Assert-That ($directory.PSIsContainer -and (($directory.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0)) 'Expected the ordinary failed supervisor directory.'
$entries = [IO.Directory]::EnumerateFileSystemEntries($source).GetEnumerator()
try {
    Assert-That ($entries.MoveNext()) 'Failed supervisor directory is empty.'
    Assert-That ([string]::Equals($entries.Current, (Join-Path $source 'result.json'), [StringComparison]::OrdinalIgnoreCase)) 'Unexpected failed supervisor artifact.'
    Assert-That (-not $entries.MoveNext()) 'Unexpected additional failed supervisor artifacts.'
} finally { $entries.Dispose() }
$receipt = Get-Item -LiteralPath (Join-Path $source 'result.json') -Force
Assert-That (-not $receipt.PSIsContainer -and (($receipt.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0) -and $receipt.Length -eq 1749) 'Unexpected failed supervisor receipt shape.'
Assert-That ((Get-FileHash -LiteralPath $receipt.FullName -Algorithm SHA256).Hash.ToLowerInvariant() -eq $expected) 'Failed supervisor receipt differs from the collected attempt.'
Assert-That ($clock.Elapsed.TotalSeconds -lt 10) 'Archive preflight exceeded its short work budget.'
[IO.Directory]::Move($source, $destination)
Assert-That (-not (Test-Path -LiteralPath $source)) 'Original supervisor output still exists.'
Assert-That (-not (Test-Path -LiteralPath $retention)) 'History retention root appeared during archive action.'
Assert-That ((Get-FileHash -LiteralPath (Join-Path $destination 'result.json') -Algorithm SHA256).Hash.ToLowerInvariant() -eq $expected) 'Archived receipt differs.'
[ordered]@{
    status = 'passed'
    operation = 'retain prelaunch memory-guard failure'
    source = $source
    archive = $destination
    receipt_sha256 = $expected
    receipt_bytes = 1749
    retention_root_absent = $true
    elapsed_seconds = [Math]::Round($clock.Elapsed.TotalSeconds, 3)
} | ConvertTo-Json -Depth 3
