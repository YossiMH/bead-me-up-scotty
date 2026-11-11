param(
    [Parameter(Mandatory = $true)][string]$TrayScript,
    [Parameter(Mandatory = $true)][int]$ParentProcessId,
    [Parameter(Mandatory = $true)][string]$Url,
    [Parameter(Mandatory = $true)][string]$ExitFile,
    [Parameter(Mandatory = $true)][string]$ReceiptFile
)
$ErrorActionPreference = 'Stop'

# Dot-sourcing exposes the normal resource constructor, without starting a
# second event loop. The real NotifyIcon, menu handler and disposal path run.
. $TrayScript -ParentProcessId $ParentProcessId -Url $Url
$tray = New-ScottyTrayContext -ParentProcessId $ParentProcessId -Url $Url
$receipt = @{ iconVisible = $tray.Icon.Visible; menuText = $tray.ExitItem.Text; clicked = $false; disposed = $false }
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 100
$timer.Add_Tick({
    if (Test-Path -LiteralPath $ExitFile) {
        $timer.Stop()
        $receipt.clicked = $true
        $tray.ExitItem.PerformClick()
    }
})
try {
    $timer.Start()
    [System.Windows.Forms.Application]::Run($tray.Context)
} finally {
    $timer.Dispose()
    & $tray.Dispose
    $receipt.disposed = -not $tray.Icon.Visible
    $receipt | ConvertTo-Json -Compress | Set-Content -LiteralPath $ReceiptFile -Encoding UTF8
}
