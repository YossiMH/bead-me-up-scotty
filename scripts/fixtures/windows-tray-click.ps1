param(
    [Parameter(Mandatory = $true)][string]$TrayScript,
    [Parameter(Mandatory = $true)][int]$ParentProcessId,
    [Parameter(Mandatory = $true)][string]$Url,
    [Parameter(Mandatory = $true)][string]$ExitFile,
    [Parameter(Mandatory = $true)][string]$ReceiptFile,
    [Parameter(Mandatory = $true)][string]$FixtureDirectory
)
$ErrorActionPreference = 'Stop'
$fixtureScript = $PSCommandPath
$tray = $null
$timer = $null
$receipt = @{ iconVisible = $false; menuText = $null; clicked = $false; disposed = $false }

# Dot-sourcing exposes the normal resource constructor, without starting a
# second event loop. The real NotifyIcon, menu handler and disposal path run.
try {
    . $TrayScript -ParentProcessId $ParentProcessId -Url $Url
    $tray = New-ScottyTrayContext -ParentProcessId $ParentProcessId -Url $Url
    $receipt.iconVisible = $tray.Icon.Visible
    $receipt.menuText = $tray.ExitItem.Text
    $timer = New-Object System.Windows.Forms.Timer
    $timer.Interval = 100
    $timer.Add_Tick({
        if (Test-Path -LiteralPath $ExitFile) {
            $timer.Stop()
            $receipt.clicked = $true
            $tray.ExitItem.PerformClick()
        }
    })
    $timer.Start()
    [System.Windows.Forms.Application]::Run($tray.Context)
} finally {
    try {
        if ($null -ne $timer) { $timer.Dispose() }
        if ($null -ne $tray) { & $tray.Dispose; $receipt.disposed = -not $tray.Icon.Visible }
        $receipt | ConvertTo-Json -Compress | Set-Content -LiteralPath $ReceiptFile -Encoding UTF8
    } finally {
        # Only this copied test file and its now-empty session can be removed.
        $session = [System.IO.Path]::GetFullPath($FixtureDirectory).TrimEnd('\')
        $expectedRoot = [System.IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'bead-me-up-scotty\tray-smoke')).TrimEnd('\')
        if ([System.IO.Path]::GetDirectoryName($session) -ine $expectedRoot -or
            [System.IO.Path]::GetFileName($session) -notmatch '^session-[A-Za-z0-9]+$' -or
            [System.IO.Path]::GetFullPath($fixtureScript) -ine (Join-Path $session 'windows-tray-click.ps1')) {
            throw 'Refusing to remove an unowned click-fixture path'
        }
        [System.IO.File]::Delete($fixtureScript)
        if ([System.IO.Directory]::Exists($session)) { [System.IO.Directory]::Delete($session, $false) }
    }
}
