param([int]$ParentProcessId = 0, [string]$Url = '')
$ErrorActionPreference = 'Stop'

function New-ScottyTrayContext {
    param(
        [Parameter(Mandatory = $true)][int]$ParentProcessId,
        [Parameter(Mandatory = $true)][string]$Url
    )
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing
    $parent = [System.Diagnostics.Process]::GetProcessById($ParentProcessId)
    $context = [System.Windows.Forms.ApplicationContext]::new()
    $menu = [System.Windows.Forms.ContextMenuStrip]::new()
    $exitItem = [System.Windows.Forms.ToolStripMenuItem]::new('Exit')
    $icon = [System.Windows.Forms.NotifyIcon]::new()
    $timer = [System.Windows.Forms.Timer]::new()
    # Console.In.ReadLineAsync runs synchronously. A StreamReader over the
    # redirected pipe keeps Windows Forms responsive while waiting for input.
    $reader = [System.IO.StreamReader]::new([Console]::OpenStandardInput())
    $state = @{ phase = 'active'; error = $null; read = $reader.ReadLineAsync() }

    $dispose = {
        if ($state.phase -eq 'disposed') { return }
        $state.phase = 'disposed'
        $timer.Stop()
        $icon.Visible = $false
        $icon.Dispose()
        $menu.Dispose()
        $timer.Dispose()
        $context.Dispose()
        $reader.Dispose()
        $parent.Dispose()
    }.GetNewClosure()

    try {
        $exitItem.Add_Click({
            if ($state.phase -ne 'active') { return }
            $state.phase = 'exit-requested'
            try { [Console]::Out.WriteLine('EXIT'); [Console]::Out.Flush() }
            catch { $state.error = $_.Exception.Message }
            $context.ExitThread()
        }.GetNewClosure())
        [void]$menu.Items.Add($exitItem)
        $icon.ContextMenuStrip = $menu
        $icon.Icon = [System.Drawing.SystemIcons]::Application
        $icon.Text = 'Bead Me Up, Scotty'
        $icon.Visible = $true
        $timer.Interval = 500
        $timer.Add_Tick({
            if ($state.phase -ne 'active') { return }
            try {
                if ($parent.HasExited) {
                    $state.phase = 'parent-lost'
                    $context.ExitThread()
                } elseif ($state.read.IsCompleted) {
                    $line = $state.read.GetAwaiter().GetResult()
                    if ($null -eq $line -or $line -eq 'STOP') {
                        $state.phase = 'stopping'
                        $context.ExitThread()
                    } else {
                        throw 'Unknown tray control message'
                    }
                }
            } catch {
                $state.error = $_.Exception.Message
                $state.phase = 'failed'
                $context.ExitThread()
            }
        }.GetNewClosure())
        $timer.Start()
        [Console]::Out.WriteLine('READY')
        [Console]::Out.Flush()
        return @{ Context = $context; Icon = $icon; ExitItem = $exitItem; State = $state; Dispose = $dispose }
    } catch {
        & $dispose
        throw
    }
}

if ($MyInvocation.InvocationName -ne '.') {
    $tray = $null
    $result = 0
    try {
        $tray = New-ScottyTrayContext -ParentProcessId $ParentProcessId -Url $Url
        [System.Windows.Forms.Application]::Run($tray.Context)
        if ($tray.State.error) { throw $tray.State.error }
    } catch {
        [Console]::Error.WriteLine('Windows tray: ' + $_.Exception.Message)
        $result = 1
    } finally {
        if ($null -ne $tray) { & $tray.Dispose }
    }
    exit $result
}
