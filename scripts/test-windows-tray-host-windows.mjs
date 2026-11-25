import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repository = fileURLToPath(new URL('../', import.meta.url));
const observer = path.join(repository, 'scripts', 'fixtures', 'windows-tray-observer.mjs');
const sourceFiles = ['bin/windows-tray.mjs', 'bin/windows-tray-host.mjs', 'bin/windows-tray.ps1',
  'scripts/fixtures/windows-tray-observer.mjs', 'scripts/test-windows-tray-host-windows.mjs'];
const digest = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const json = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });

// This controller uses the public production API. KILL ends the original Node
// process abruptly, so neither its JavaScript finally nor exit handler can run.
const controllerSource = `
import fs from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { createWindowsTray } from ${JSON.stringify(pathToFileURL(path.join(repository, 'bin', 'windows-tray.mjs')).href)};
const root = process.argv[2];
let failure;
const fail = error => { failure = error; process.stdin.destroy(); };
const tray = createWindowsTray({ url: 'http://127.0.0.1:43971',
  onExit: () => fail(new Error('Unexpected menu action in the host lifecycle check')), onFailure: fail });
try {
  await tray.ready;
  await new Promise((resolve, reject) => process.stdout.write('READY\\n', error => error ? reject(error) : resolve()));
  fs.writeFileSync(path.join(root, 'controller-ready'), 'READY\\n', { flag: 'wx' });
  for await (const line of createInterface({ input: process.stdin, crlfDelay: Infinity })) {
    if (line === 'STOP') {
      await tray.stop();
      fs.writeFileSync(path.join(root, 'controller-stopped'), 'STOPPED\\n', { flag: 'wx' });
      console.log('STOPPED');
      break;
    }
    if (line === 'KILL') {
      fs.writeFileSync(path.join(root, 'controller-kill-requested'), 'SIGKILL\\n', { flag: 'wx' });
      process.kill(process.pid, 'SIGKILL');
      throw new Error('SIGKILL returned without terminating its controller');
    }
    throw new Error('Unexpected controller command: ' + line);
  }
  if (failure) throw failure;
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
} finally {
  try { await tray.stop(); }
  catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
  process.stdin.destroy();
}
`;

// Keep real Windows process handles until exit is observed. PID and creation
// time checks establish ownership before any fallback cleanup uses a handle.
// Hosted execution also places this bounded supervisor in its outer Job.
const supervisorSource = String.raw`
param([string]$Root, [string]$NodePath, [string]$Observer, [ValidateSet('stop', 'parent-loss')][string]$Action)
$ErrorActionPreference = 'Stop'
$utf8 = New-Object System.Text.UTF8Encoding($false)
$children = @{}
$registrationErrors = New-Object System.Collections.Generic.HashSet[string]
$records = @()
$controller = $null
$controllerStarted = $false
$stdout = $null
$stderr = $null
$forced = New-Object System.Collections.Generic.List[int]
$result = @{ schema_version = 1; status = 'failed'; action = $Action; started = [DateTime]::UtcNow.ToString('o') }
$powershell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
function Save-Json([string]$Name, $Value) {
    [System.IO.File]::WriteAllText((Join-Path $Root $Name), ($Value | ConvertTo-Json -Depth 15), $utf8)
}
function Register-Children {
    $file = Join-Path $Root 'processes.jsonl'
    if (-not [System.IO.File]::Exists($file)) { return }
    $text = [System.IO.File]::ReadAllText($file)
    if ($text.Length -gt 65536) { throw 'Oversized process journal' }
    $lines = $text -split "\n"
    $seen = New-Object System.Collections.Generic.HashSet[int]
    $valid = New-Object System.Collections.Generic.List[object]
    for ($index = 0; $index -lt $lines.Length - 1; $index++) {
        $process = $null
        try {
            $record = $lines[$index] | ConvertFrom-Json
            if ($record.kind -notin @('tray-host', 'tray') -or $record.pid -lt 1 -or -not $seen.Add([int]$record.pid)) {
                throw 'Unexpected or duplicate child identity'
            }
            $valid.Add($record)
            if ($children.ContainsKey([int]$record.pid)) { continue }
            $expected = if ($record.kind -eq 'tray-host') { $NodePath } else { $powershell }
            if ([System.IO.Path]::GetFullPath($record.command) -ine [System.IO.Path]::GetFullPath($expected)) {
                throw 'Recorded executable differs from the expected owned executable'
            }
            $process = [System.Diagnostics.Process]::GetProcessById([int]$record.pid)
            $null = $process.Handle
            $created = ([DateTimeOffset]$process.StartTime.ToUniversalTime()).ToUnixTimeMilliseconds()
            $image = $process.MainModule.FileName
            if ($created -lt ($record.startedAfter - 50) -or $created -gt ($record.recordedAt + 50) -or
                [System.IO.Path]::GetFullPath($image) -ine [System.IO.Path]::GetFullPath($expected)) {
                throw 'Recorded PID no longer identifies this invocation child'
            }
            $children[[int]$record.pid] = @{ process = $process; record = $record; created = $created; image = $image }
            $process = $null
        } catch {
            [void]$registrationErrors.Add('Process journal line ' + ($index + 1) + ': ' + $_.Exception.Message)
        } finally { if ($null -ne $process) { $process.Dispose() } }
    }
    $script:records = $valid.ToArray()
    if ($controllerStarted -and $controller.HasExited -and $text.Length -gt 0 -and -not $text.EndsWith([string][char]10)) {
        [void]$registrationErrors.Add('Incomplete process journal after controller exit')
    }
}
function Wait-Until([scriptblock]$Condition, [int]$Seconds, [string]$Message) {
    $deadline = [DateTime]::UtcNow.AddSeconds($Seconds)
    do {
        Register-Children
        if (& $Condition) { return }
        Start-Sleep -Milliseconds 50
    } while ([DateTime]::UtcNow -lt $deadline)
    throw $Message
}
function Cleanup-Step([scriptblock]$Work) {
    try { & $Work }
    catch { $result.cleanup_error = $_.Exception.Message; $result.status = 'failed' }
}
try {
    foreach ($value in @($NodePath, $Observer, $Root)) { if ($value.Contains('"')) { throw 'Unsupported quote in test path' } }
    $start = New-Object System.Diagnostics.ProcessStartInfo
    $start.FileName = $NodePath
    $start.Arguments = '--max-old-space-size=64 --import "' + ([Uri]$Observer).AbsoluteUri + '" "' +
        (Join-Path $Root 'controller.mjs') + '" "' + $Root + '"'
    $start.WorkingDirectory = $Root
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardInput = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    $controller = New-Object System.Diagnostics.Process
    $controller.StartInfo = $start
    if (-not $controller.Start()) { throw 'Controller did not start' }
    $controllerStarted = $true
    $null = $controller.Handle
    $result.controller_pid = $controller.Id
    $stdout = $controller.StandardOutput.ReadToEndAsync()
    $stderr = $controller.StandardError.ReadToEndAsync()
    Wait-Until {
        if ($controller.HasExited) { throw 'Controller exited before real helper readiness' }
        [System.IO.File]::Exists((Join-Path $Root 'controller-ready')) -and $children.Count -eq 2
    } 20 'Real PowerShell helper did not become ready'
    if ($registrationErrors.Count -ne 0 -or $records.Count -ne 2) { throw 'Child ownership registration failed' }
    $hostRecord = @($records | Where-Object { $_.kind -eq 'tray-host' })
    $trayRecord = @($records | Where-Object { $_.kind -eq 'tray' })
    if ($hostRecord.Count -ne 1 -or $trayRecord.Count -ne 1) { throw 'Expected exactly one host and one PowerShell helper' }
    $hostRecord = $hostRecord[0]
    $trayRecord = $trayRecord[0]
    if ($hostRecord.parentPid -ne $controller.Id -or $trayRecord.parentPid -ne $hostRecord.pid) { throw 'Wrong controller/host/helper parent chain' }
    if ($children[[int]$hostRecord.pid].process.HasExited -or $children[[int]$trayRecord.pid].process.HasExited) {
        throw 'Host or PowerShell exited before the lifecycle action'
    }
    $cache = [System.IO.Path]::GetDirectoryName([string]$trayRecord.helperScript)
    $cacheRoot = Join-Path $env:LOCALAPPDATA 'bead-me-up-scotty\tray'
    if ([System.IO.Path]::GetDirectoryName($cache) -ine $cacheRoot -or
        [System.IO.Path]::GetFileName($cache) -notmatch '^session-[A-Za-z0-9]+$' -or
        $trayRecord.helperScript -ine (Join-Path $cache 'windows-tray.ps1') -or
        -not [System.IO.File]::Exists($trayRecord.helperScript)) { throw 'Unexpected production helper cache' }
    $result.helper_sha256_before = (Get-FileHash -LiteralPath $trayRecord.helperScript -Algorithm SHA256).Hash.ToLowerInvariant()
    $result.ready_observed = $true
    $result.action_started = [DateTime]::UtcNow.ToString('o')
    $controller.StandardInput.WriteLine($(if ($Action -eq 'stop') { 'STOP' } else { 'KILL' }))
    $controller.StandardInput.Flush()
    Wait-Until { $controller.HasExited } 6 'Controller did not finish its requested action'
    Wait-Until {
        $children[[int]$hostRecord.pid].process.HasExited -and $children[[int]$trayRecord.pid].process.HasExited
    } 5 'Host or PowerShell survived controller shutdown'
    if ($Action -eq 'stop' -and $controller.ExitCode -ne 0) { throw 'Normal controller shutdown failed' }
    if ($Action -eq 'parent-loss' -and ($controller.ExitCode -eq 0 -or
        -not [System.IO.File]::Exists((Join-Path $Root 'controller-kill-requested')))) { throw 'Controller was not killed abruptly' }
    foreach ($child in $children.Values) { if ($child.process.ExitCode -ne 0) { throw 'Host or PowerShell cleanup failed' } }
    if ([System.IO.Directory]::Exists($cache) -or [System.IO.File]::Exists($trayRecord.helperScript)) { throw 'Owned production cache survived cleanup' }
    $result.cache_removed = $true
    $result.status = 'passed'
} catch { $result.error = $_.Exception.Message }
finally {
    # Each fallback targets a held, verified handle. No name-based or PID-tree kill.
    Cleanup-Step {
        if ($controllerStarted -and -not $controller.HasExited) {
            $controller.StandardInput.Close()
            if (-not $controller.WaitForExit(3500)) {
                $forced.Add($controller.Id)
                $controller.Kill()
                if (-not $controller.WaitForExit(2000)) { throw 'Controller fallback exit unobserved' }
            }
        }
    }
    Cleanup-Step { Register-Children }
    foreach ($kind in @('tray', 'tray-host')) {
        foreach ($child in @($children.Values | Where-Object { $_.record.kind -eq $kind })) {
            Cleanup-Step {
                if (-not $child.process.WaitForExit(2500)) {
                    $forced.Add($child.process.Id)
                    $child.process.Kill()
                    if (-not $child.process.WaitForExit(2000)) { throw 'Owned child fallback exit unobserved' }
                }
            }
        }
    }
    $result.records = @($records)
    $result.registration_errors = @($registrationErrors)
    $result.forced_cleanup = @($forced)
    $result.children = @($children.Values | ForEach-Object {
        @{ kind = $_.record.kind; pid = $_.process.Id; image = $_.image; created_ms = $_.created;
           exited = $_.process.HasExited; exit_code = $(if ($_.process.HasExited) { $_.process.ExitCode } else { $null }) }
    })
    if ($forced.Count -ne 0 -or $registrationErrors.Count -ne 0 -or @($result.children | Where-Object { -not $_.exited }).Count -ne 0) {
        $result.status = 'failed'
    }
    if ($controllerStarted) {
        $result.controller_exited = $controller.HasExited
        if ($controller.HasExited) { $result.controller_exit_code = $controller.ExitCode }
        foreach ($stream in @(@('stdout', $stdout), @('stderr', $stderr))) {
            if ($null -ne $stream[1] -and $stream[1].Wait(1500)) {
                [System.IO.File]::WriteAllText((Join-Path $Root ('controller.' + $stream[0])), $stream[1].Result, $utf8)
            } else { $result.status = 'failed'; $result.stream_error = 'Controller stream did not close' }
        }
    }
    $result.finished = [DateTime]::UtcNow.ToString('o')
    Save-Json 'process-result.json' $result
    foreach ($child in $children.Values) { $child.process.Dispose() }
    if ($null -ne $controller) { $controller.Dispose() }
}
if ($result.status -eq 'passed') { exit 0 } else { exit 1 }
`;

for (const action of ['stop', 'parent-loss']) {
  test('real Windows tray host cleans up after ' + action, {
    skip: process.platform !== 'win32', concurrency: false, timeout: 70000,
  }, async t => {
    const base = process.env.SCOTTY_TRAY_HOST_TEST_ROOT || os.tmpdir();
    assert(path.isAbsolute(base), 'Test output parent must be absolute');
    fs.mkdirSync(base, { recursive: true });
    const root = fs.mkdtempSync(path.join(base, 'scotty-real-host-' + action + '-'));
    const local = path.join(root, 'local');
    const temporary = path.join(root, 'temp');
    fs.mkdirSync(local);
    fs.mkdirSync(temporary);
    const sentinel = path.join(local, 'unrelated-session.txt');
    fs.writeFileSync(sentinel, 'preserve this file\n', { flag: 'wx' });
    const pins = Object.fromEntries(sourceFiles.map(name => [name, digest(path.join(repository, name))]));
    const report = { schema_version: 1, status: 'failed', action, root, sources: pins,
      node: { executable: process.execPath, version: process.version },
      scope: 'Real Forms helper readiness and process/cache cleanup; interactive tray menu is checked separately.',
      started: new Date().toISOString() };
    t.after(() => {
      report.finished = new Date().toISOString();
      report.evidence = Object.fromEntries(['controller.stdout', 'controller.stderr', 'supervisor.stdout',
        'supervisor.stderr', 'processes.jsonl', 'process-result.json'].filter(name => fs.existsSync(path.join(root, name)))
        .map(name => [name, { bytes: fs.statSync(path.join(root, name)).size, sha256: digest(path.join(root, name)) }]));
      json(path.join(root, 'result.json'), report);
      t.diagnostic('Retained real Windows host evidence: ' + root);
    });
    const supervisorScript = path.join(local, 'host-check.ps1');
    fs.writeFileSync(path.join(root, 'controller.mjs'), controllerSource, { flag: 'wx' });
    fs.writeFileSync(supervisorScript, supervisorSource, { flag: 'wx' });
    const output = fs.openSync(path.join(root, 'supervisor.stdout'), 'wx');
    const error = fs.openSync(path.join(root, 'supervisor.stderr'), 'wx');
    const executable = path.join(process.env.SystemRoot || 'C:\\Windows',
      'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    const env = { ...process.env };
    for (const key of Object.keys(env)) {
      if (/^(?:NODE_OPTIONS|BMUS_TRAY|LOCALAPPDATA|TEMP|TMP|TMPDIR)$|^SCOTTY_TRAY_/i.test(key)) delete env[key];
    }
    Object.assign(env, { LOCALAPPDATA: local, TEMP: temporary, TMP: temporary, TMPDIR: temporary,
      BMUS_TRAY: '1', SCOTTY_TRAY_SMOKE_DIR: root, SCOTTY_TRAY_SMOKE_ACTION: 'host-check' });
    let child;
    try {
      child = spawn(executable, ['-NoLogo', '-NoProfile', '-NonInteractive', '-File', supervisorScript,
        '-Root', root, '-NodePath', process.execPath, '-Observer', observer, '-Action', action], {
        cwd: root, env, windowsHide: true, shell: false, stdio: ['ignore', output, error],
      });
    } finally { fs.closeSync(output); fs.closeSync(error); }
    const completion = new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', (code, signal) => resolve({ code, signal }));
    });
    // The supervisor's bounded waits normally end within 45 seconds. Its caller
    // owns the emergency Job deadline if the Windows runtime itself stalls.
    try {
      report.supervisor = await completion;
      const observed = JSON.parse(fs.readFileSync(path.join(root, 'process-result.json'), 'utf8'));
      report.processes = observed;
      assert.deepEqual(report.supervisor, { code: 0, signal: null }, fs.readFileSync(path.join(root, 'supervisor.stderr'), 'utf8'));
      assert.equal(observed.status, 'passed', JSON.stringify(observed));
      assert.equal(observed.ready_observed, true);
      assert.equal(observed.cache_removed, true);
      assert.equal(observed.controller_exited, true);
      assert.deepEqual(observed.registration_errors, []);
      assert.deepEqual(observed.forced_cleanup, []);
      assert.equal(observed.records.length, 2);
      const host = observed.records.find(row => row.kind === 'tray-host');
      const tray = observed.records.find(row => row.kind === 'tray');
      assert(host && tray);
      assert.equal(host.parentPid, observed.controller_pid);
      assert.equal(tray.parentPid, host.pid);
      for (const row of [host, tray]) {
        assert.equal(row.windowsHide, true);
        assert.deepEqual(row.stdio, ['pipe', 'pipe', 'pipe']);
      }
      assert.equal(host.detached, true);
      assert.equal(tray.detached, false);
      assert.equal(host.hostScriptSha256, pins['bin/windows-tray-host.mjs']);
      assert.equal(tray.helperScriptSha256, pins['bin/windows-tray.ps1']);
      assert.equal(observed.helper_sha256_before, pins['bin/windows-tray.ps1']);
      assert.deepEqual(host.args, ['--import', pathToFileURL(observer).href, '--max-old-space-size=64',
        path.join(repository, 'bin', 'windows-tray-host.mjs'), tray.helperScript,
        String(observed.controller_pid), 'http://127.0.0.1:43971', path.dirname(tray.helperScript)]);
      assert.deepEqual(tray.args, ['-NoLogo', '-NoProfile', '-NonInteractive', '-STA', '-WindowStyle', 'Hidden',
        '-File', tray.helperScript, '-ParentProcessId', String(observed.controller_pid),
        '-Url', 'http://127.0.0.1:43971', '-CacheDirectory', path.dirname(tray.helperScript)]);
      assert.equal(observed.children.length, 2);
      for (const row of observed.children) { assert.equal(row.exited, true); assert.equal(row.exit_code, 0); }
      assert.equal(fs.readFileSync(sentinel, 'utf8'), 'preserve this file\n');
      assert.equal(fs.existsSync(path.join(root, 'controller-stopped')), action === 'stop');
      assert.equal(fs.existsSync(path.join(root, 'controller-kill-requested')), action === 'parent-loss');
      assert.equal(fs.readFileSync(path.join(root, 'controller.stdout'), 'utf8'), action === 'stop' ? 'READY\nSTOPPED\n' : 'READY\n');
      assert.equal(fs.readFileSync(path.join(root, 'controller.stderr'), 'utf8'), '');
      for (const [name, sha] of Object.entries(pins)) assert.equal(digest(path.join(repository, name)), sha);
      report.status = 'passed';
    } catch (error) { report.error = error.stack || error.message; throw error; }
  });
}
