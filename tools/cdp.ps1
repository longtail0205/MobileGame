<#
  cdp.ps1 - Headless Chrome driver for automated browser testing (Chrome DevTools Protocol).

  Usage:
    powershell -ExecutionPolicy Bypass -File tools\cdp.ps1 -Steps tools\steps\smoke.json -OutDir out\smoke
    powershell -ExecutionPolicy Bypass -File tools\cdp.ps1 -StepsJson '[{"eval":"1+1"}]'

  Steps (JSON array, executed in order):
    { "goto": "index.html?x=1" }            relative to project root, or absolute URL
    { "wait": 500 }                          milliseconds
    { "eval": "js expression", "timeout": 60000 }   result printed; Promises are awaited (timeout ms, default 20000)
    { "waitFor": "js expression", "timeout": 5000 }   poll until truthy
    { "key": "ArrowUp", "hold": 300 }        key down, hold ms, key up  (names: ArrowUp/Down/Left/Right, Enter, Escape, KeyZ, KeyX, Space, ...)
    { "keys": ["KeyZ","KeyZ"], "gap": 200 }  several taps
    { "click": "#css-selector" }             element.click()
    { "shot": "name" }                       screenshot -> OutDir\name.png
    { "clearStorage": true }                 localStorage.clear()

  Output: console messages, page exceptions, eval results. Exit code 1 if any uncaught exception occurred.
#>
param(
  [string]$Steps = "",
  [string]$StepsJson = "",
  [string]$OutDir = "",
  [int]$Width = 1280,
  [int]$Height = 900,
  [string]$Browser = "C:\Program Files\Google\Chrome\Application\chrome.exe"
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$root = Split-Path -Parent $PSScriptRoot
if (-not $OutDir) { $OutDir = Join-Path $root "out\cdp" }
if (-not [System.IO.Path]::IsPathRooted($OutDir)) { $OutDir = Join-Path $root $OutDir }
New-Item -ItemType Directory -Force $OutDir | Out-Null

if ($Steps) {
  if (-not [System.IO.Path]::IsPathRooted($Steps)) { $Steps = Join-Path $root $Steps }
  $StepsJson = [System.IO.File]::ReadAllText($Steps, [System.Text.Encoding]::UTF8)
}
if (-not $StepsJson) { throw "Specify -Steps <file> or -StepsJson <json>" }
$stepList = $StepsJson | ConvertFrom-Json

$port = 9300 + (Get-Random -Maximum 600)
$prof = Join-Path $env:TEMP ("gm_cdp_" + $port + "_" + (Get-Random))
$proc = Start-Process -FilePath $Browser -PassThru -ArgumentList @(
  "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
  "--remote-debugging-port=$port", "--user-data-dir=$prof", "--window-size=$Width,$Height",
  "--autoplay-policy=no-user-gesture-required", "--allow-file-access-from-files", "about:blank")

$script:hadError = $false
$client = $null
try {
  $wsUrl = $null
  for ($i = 0; $i -lt 50 -and -not $wsUrl; $i++) {
    Start-Sleep -Milliseconds 200
    try {
      $targets = Invoke-RestMethod -Uri "http://127.0.0.1:$port/json" -TimeoutSec 2
      $page = @($targets | Where-Object { $_.type -eq "page" })[0]
      if ($page) { $wsUrl = $page.webSocketDebuggerUrl }
    } catch { }
  }
  if (-not $wsUrl) { throw "Could not connect to Chrome DevTools on port $port" }

  $client = New-Object System.Net.WebSockets.ClientWebSocket
  $client.Options.KeepAliveInterval = [TimeSpan]::FromSeconds(30)
  $client.ConnectAsync([Uri]$wsUrl, [Threading.CancellationToken]::None).Wait()
  $script:msgId = 0
  $script:pending = New-Object System.Collections.ArrayList

  # A single outstanding ReceiveAsync is kept across calls: cancelling a receive would abort the socket.
  $script:recvBuf = New-Object byte[] 262144
  $script:recvMs = New-Object System.IO.MemoryStream
  $script:recvTask = $null
  function Receive-Message {
    param([int]$TimeoutMs = 15000)
    $deadline = (Get-Date).AddMilliseconds($TimeoutMs)
    while ($true) {
      if ($null -eq $script:recvTask) {
        $seg = New-Object System.ArraySegment[byte] -ArgumentList @(, $script:recvBuf)
        $script:recvTask = $client.ReceiveAsync($seg, [Threading.CancellationToken]::None)
      }
      $left = [int](($deadline - (Get-Date)).TotalMilliseconds)
      if ($left -le 0) { return $null }
      if (-not $script:recvTask.Wait($left)) { return $null }
      $res = $script:recvTask.Result
      $script:recvTask = $null
      $script:recvMs.Write($script:recvBuf, 0, $res.Count)
      if ($res.EndOfMessage) {
        $text = [System.Text.Encoding]::UTF8.GetString($script:recvMs.ToArray())
        $script:recvMs.SetLength(0)
        return ($text | ConvertFrom-Json)
      }
    }
  }

  function Handle-Event($m) {
    if ($m.method -eq "Runtime.consoleAPICalled") {
      $parts = @()
      foreach ($a in $m.params.args) {
        if ($null -ne $a.value) { $parts += [string]$a.value }
        elseif ($a.description) { $parts += [string]$a.description }
        else { $parts += [string]$a.type }
      }
      Write-Host ("[console.{0}] {1}" -f $m.params.type, ($parts -join " "))
      if ($m.params.type -eq "error") { $script:hadError = $true }
    } elseif ($m.method -eq "Runtime.exceptionThrown") {
      $d = $m.params.exceptionDetails
      $desc = if ($d.exception -and $d.exception.description) { $d.exception.description } else { $d.text }
      Write-Host ("[EXCEPTION] {0} @ {1}:{2}" -f $desc, $d.url, $d.lineNumber)
      $script:hadError = $true
    } elseif ($m.method -eq "Log.entryAdded") {
      $e = $m.params.entry
      if ($e.level -eq "error") { Write-Host ("[log.error] {0} {1}" -f $e.text, $e.url); $script:hadError = $true }
    }
  }

  function Send-Cdp {
    param([string]$Method, $Params = @{}, [int]$TimeoutMs = 20000)
    $script:msgId++
    $id = $script:msgId
    $payload = @{ id = $id; method = $Method; params = $Params } | ConvertTo-Json -Depth 20 -Compress
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
    $seg = New-Object System.ArraySegment[byte] -ArgumentList @(, $bytes)
    $client.SendAsync($seg, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, [Threading.CancellationToken]::None).Wait()
    $deadline = (Get-Date).AddMilliseconds($TimeoutMs)
    while ((Get-Date) -lt $deadline) {
      $m = Receive-Message -TimeoutMs $TimeoutMs
      if ($null -eq $m) { break }
      if ($m.id -eq $id) { return $m }
      if ($m.method) { Handle-Event $m }
    }
    throw "CDP timeout: $Method"
  }

  function Pump-Events([int]$Ms) {
    $end = (Get-Date).AddMilliseconds($Ms)
    while ((Get-Date) -lt $end) {
      $left = [int][Math]::Max(10, ($end - (Get-Date)).TotalMilliseconds)
      $m = Receive-Message -TimeoutMs $left
      if ($null -eq $m) { break }
      if ($m.method) { Handle-Event $m }
    }
  }

  function Eval-Js([string]$Expr, [int]$TimeoutMs = 20000) {
    $r = Send-Cdp "Runtime.evaluate" @{ expression = $Expr; awaitPromise = $true; returnByValue = $true; userGesture = $true } $TimeoutMs
    if ($r.result.exceptionDetails) {
      $d = $r.result.exceptionDetails
      $desc = if ($d.exception -and $d.exception.description) { $d.exception.description } else { $d.text }
      return @{ ok = $false; text = "EVAL ERROR: $desc" }
    }
    $v = $r.result.result.value
    if ($null -eq $v) { $v = $r.result.result.description }
    if ($v -isnot [string]) { $v = ($v | ConvertTo-Json -Depth 6 -Compress) }
    return @{ ok = $true; text = [string]$v; raw = $r.result.result.value }
  }

  $keyMap = @{
    "ArrowUp" = @{ key = "ArrowUp"; code = "ArrowUp"; vk = 38 }; "ArrowDown" = @{ key = "ArrowDown"; code = "ArrowDown"; vk = 40 }
    "ArrowLeft" = @{ key = "ArrowLeft"; code = "ArrowLeft"; vk = 37 }; "ArrowRight" = @{ key = "ArrowRight"; code = "ArrowRight"; vk = 39 }
    "Enter" = @{ key = "Enter"; code = "Enter"; vk = 13 }; "Escape" = @{ key = "Escape"; code = "Escape"; vk = 27 }
    "Space" = @{ key = " "; code = "Space"; vk = 32 }; "Backspace" = @{ key = "Backspace"; code = "Backspace"; vk = 8 }
  }
  function Get-KeyInfo([string]$name) {
    if ($keyMap.ContainsKey($name)) { return $keyMap[$name] }
    if ($name -match "^Key([A-Z])$") { $c = $Matches[1]; return @{ key = $c.ToLower(); code = $name; vk = [int][char]$c } }
    return @{ key = $name; code = $name; vk = 0 }
  }
  function Send-Key([string]$name, [int]$hold = 80) {
    $k = Get-KeyInfo $name
    Send-Cdp "Input.dispatchKeyEvent" @{ type = "keyDown"; key = $k.key; code = $k.code; windowsVirtualKeyCode = $k.vk; nativeVirtualKeyCode = $k.vk } | Out-Null
    Pump-Events $hold
    Send-Cdp "Input.dispatchKeyEvent" @{ type = "keyUp"; key = $k.key; code = $k.code; windowsVirtualKeyCode = $k.vk; nativeVirtualKeyCode = $k.vk } | Out-Null
  }

  Send-Cdp "Runtime.enable" | Out-Null
  Send-Cdp "Log.enable" | Out-Null
  Send-Cdp "Page.enable" | Out-Null

  $n = 0
  foreach ($s in $stepList) {
    $n++
    if ($s.goto) {
      $u = [string]$s.goto
      if ($u -notmatch "^[a-z]+:") { $u = "file:///" + ((Join-Path $root $u) -replace "\\", "/") }
      Write-Host "[$n] goto $u"
      Send-Cdp "Page.navigate" @{ url = $u } | Out-Null
      Pump-Events 1200
    } elseif ($null -ne $s.wait) {
      Pump-Events ([int]$s.wait)
    } elseif ($s.clearStorage) {
      $r = Eval-Js "localStorage.clear(); 'cleared'"
      Write-Host "[$n] clearStorage -> $($r.text)"
    } elseif ($s.eval) {
      $r = Eval-Js ([string]$s.eval) $(if ($s.timeout) { [int]$s.timeout } else { 20000 })
      Write-Host "[$n] eval: $($s.eval)"
      Write-Host "     => $($r.text)"
      if (-not $r.ok) { $script:hadError = $true }
    } elseif ($s.waitFor) {
      $to = if ($s.timeout) { [int]$s.timeout } else { 5000 }
      $end = (Get-Date).AddMilliseconds($to)
      $ok = $false
      while ((Get-Date) -lt $end) {
        $r = Eval-Js ("!!(" + [string]$s.waitFor + ")")
        if ($r.ok -and $r.raw -eq $true) { $ok = $true; break }
        Pump-Events 150
      }
      Write-Host ("[$n] waitFor {0} -> {1}" -f $s.waitFor, $(if ($ok) { "OK" } else { "TIMEOUT" }))
      if (-not $ok) { $script:hadError = $true }
    } elseif ($s.key) {
      $hold = if ($s.hold) { [int]$s.hold } else { 80 }
      Send-Key ([string]$s.key) $hold
      Pump-Events 60
    } elseif ($s.keys) {
      $gap = if ($s.gap) { [int]$s.gap } else { 150 }
      foreach ($k in $s.keys) { Send-Key ([string]$k) 60; Pump-Events $gap }
    } elseif ($s.click) {
      $sel = ([string]$s.click) -replace "'", "\'"
      $r = Eval-Js "(function(){var e=document.querySelector('$sel'); if(!e) return 'NOT FOUND: $sel'; e.click(); return 'clicked';})()"
      Write-Host "[$n] click $($s.click) -> $($r.text)"
      if ($r.text -like "NOT FOUND*") { $script:hadError = $true }
      Pump-Events 100
    } elseif ($s.shot) {
      $r = Send-Cdp "Page.captureScreenshot" @{ format = "png" } 30000
      $file = Join-Path $OutDir ([string]$s.shot + ".png")
      [System.IO.File]::WriteAllBytes($file, [Convert]::FromBase64String($r.result.data))
      Write-Host "[$n] screenshot -> $file"
    }
  }
  Pump-Events 300
} finally {
  if ($client) { try { $client.Dispose() } catch { } }
  try { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue } catch { }
  Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like "*$prof*" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  Start-Sleep -Milliseconds 300
  Remove-Item -Recurse -Force $prof -ErrorAction SilentlyContinue
}
if ($script:hadError) { Write-Host "RESULT: ERRORS DETECTED"; exit 1 } else { Write-Host "RESULT: OK"; exit 0 }
