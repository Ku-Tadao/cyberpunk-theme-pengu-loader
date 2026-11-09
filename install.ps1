# Installs or updates the Cyberpunk theme in Pengu Loader's plugins folder.
# Run Install.cmd from the downloaded folder, or straight from PowerShell:
#   irm https://raw.githubusercontent.com/Ku-Tadao/cyberpunk-theme-pengu-loader/main/install.ps1 | iex
# Your own pictures (icons, wallpapers, profile backgrounds) are never removed.

param([string]$Pengu)

$ErrorActionPreference = 'Stop'
$Repo = 'Ku-Tadao/cyberpunk-theme-pengu-loader'
$Name = 'CyberpunkTheme'
# files that are part of the download but not of the plugin
$SkipFiles = @('Install.cmd', 'install.ps1', '.gitignore')
$SkipDirs = @('.git', '.github', 'docs')

function Say($text, $color = 'Gray') { Write-Host $text -ForegroundColor $color }

function Test-Pengu($dir) {
  $dir -and (Test-Path -LiteralPath $dir) -and
    ((Test-Path -LiteralPath (Join-Path $dir 'core.dll')) -or (Test-Path -LiteralPath (Join-Path $dir 'Pengu Loader.exe')))
}

# Pengu activates itself through this registry key, which holds the path to its core.dll
function Find-Pengu {
  $key = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\LeagueClientUx.exe'
  $debugger = (Get-ItemProperty -LiteralPath $key -Name Debugger -ErrorAction SilentlyContinue).Debugger
  if ($debugger -match '"([^"]+)\\core\.dll"' -and (Test-Pengu $Matches[1])) { return $Matches[1] }

  $running = Get-Process -Name 'Pengu Loader' -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($running -and $running.Path) {
    $dir = Split-Path $running.Path
    if (Test-Pengu $dir) { return $dir }
  }

  $guesses = @(
    "$env:ProgramFiles\Pengu Loader", "${env:ProgramFiles(x86)}\Pengu Loader",
    "$env:LOCALAPPDATA\Pengu Loader", "$env:APPDATA\Pengu Loader", 'C:\Pengu Loader',
    "$env:USERPROFILE\Desktop\Pengu Loader", "$env:USERPROFILE\Downloads\Pengu Loader"
  )
  foreach ($dir in $guesses) { if (Test-Pengu $dir) { return $dir } }

  Say 'Could not find Pengu Loader automatically. Pick its folder (the one with Pengu Loader.exe).' Yellow
  Add-Type -AssemblyName System.Windows.Forms
  $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
  $dialog.Description = 'Select your Pengu Loader folder'
  if ($dialog.ShowDialog() -eq 'OK' -and (Test-Pengu $dialog.SelectedPath)) { return $dialog.SelectedPath }
  return $null
}

# The plugin files: next to this script, or downloaded from the latest GitHub release
function Get-Source {
  if ($PSScriptRoot -and (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'index.js'))) { return $PSScriptRoot }

  Say 'Downloading the latest version...'
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  $tmp = Join-Path $env:TEMP ("$Name-" + [guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $tmp | Out-Null
  $zip = Join-Path $tmp 'download.zip'
  try {
    Invoke-WebRequest -UseBasicParsing -Uri "https://github.com/$Repo/releases/latest/download/$Name.zip" -OutFile $zip
  } catch {
    Invoke-WebRequest -UseBasicParsing -Uri "https://github.com/$Repo/archive/refs/heads/main.zip" -OutFile $zip
  }
  Expand-Archive -LiteralPath $zip -DestinationPath $tmp -Force
  $index = Get-ChildItem -LiteralPath $tmp -Recurse -Filter 'index.js' | Sort-Object { $_.FullName.Length } | Select-Object -First 1
  if (-not $index) { throw 'The download does not contain the plugin.' }
  return $index.DirectoryName
}

# An earlier install (any folder name) is updated in place, so the plugin never loads twice
function Find-Existing($plugins, $source) {
  foreach ($dir in Get-ChildItem -LiteralPath $plugins -Directory -ErrorAction SilentlyContinue) {
    $index = Join-Path $dir.FullName 'index.js'
    if ($dir.FullName -ne $source -and (Test-Path -LiteralPath $index) -and
        (Select-String -LiteralPath $index -Pattern '@name\s+CustomClient' -Quiet)) { return $dir.FullName }
  }
  return $null
}

function Test-Writable($dir) {
  try {
    $probe = Join-Path $dir ".write-test-$PID"
    [IO.File]::WriteAllText($probe, '')
    Remove-Item -LiteralPath $probe -Force
    return $true
  } catch { return $false }
}

# index.json files are rebuilt afterwards, so an update never hides the user's own pictures
function Copy-Plugin($from, $to) {
  New-Item -ItemType Directory -Path $to -Force | Out-Null
  foreach ($item in Get-ChildItem -LiteralPath $from -Force) {
    if ($item.PSIsContainer) {
      if ($SkipDirs -contains $item.Name) { continue }
      Copy-Plugin $item.FullName (Join-Path $to $item.Name)
    } elseif ($SkipFiles -notcontains $item.Name -and $item.Name -ne 'index.json') {
      Copy-Item -LiteralPath $item.FullName -Destination (Join-Path $to $item.Name) -Force
    }
  }
}

# Same as double-clicking each folder's "_Refresh list.cmd": lists bundled and user files
function Update-Lists($plugin) {
  foreach ($cmd in Get-ChildItem -LiteralPath (Join-Path $plugin 'assets') -Recurse -Filter '_Refresh list.cmd') {
    if ((Get-Content -LiteralPath $cmd.FullName -Raw) -notmatch "match '([^']+)'") { continue }
    $pattern = $Matches[1]
    $files = @(Get-ChildItem -LiteralPath $cmd.DirectoryName -File | Where-Object { $_.Extension -match $pattern } |
      Sort-Object Name | ForEach-Object { $_.Name + '|' + $_.LastWriteTimeUtc.Ticks })
    $json = ConvertTo-Json -InputObject $files -Compress
    [IO.File]::WriteAllText((Join-Path $cmd.DirectoryName 'index.json'), $json, (New-Object Text.UTF8Encoding $false))
  }
}

# Returns an exit code instead of calling exit, which would close the window under irm | iex
function Install {
  Say ''
  Say '  CYBERPUNK THEME // installer' Yellow
  Say ''

  try {
    if (-not (Test-Pengu $Pengu)) { $Pengu = Find-Pengu }
    if (-not $Pengu) {
      Say 'Pengu Loader was not found. Install it from https://pengu.lol first, then run this again.' Red
      return 1
    }
    Say "Pengu Loader: $Pengu"

    $source = (Resolve-Path -LiteralPath (Get-Source)).Path
    $plugins = Join-Path $Pengu 'plugins'
    if (-not (Test-Path -LiteralPath $plugins)) { New-Item -ItemType Directory -Path $plugins -Force | Out-Null }

    if (-not (Test-Writable $plugins)) {
      $admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
        [Security.Principal.WindowsBuiltInRole]::Administrator)
      if ($admin) { throw "Cannot write to $plugins." }
      Say 'The plugins folder needs administrator rights. Asking Windows for permission...' Yellow
      $script = Join-Path $source 'install.ps1'
      Start-Process powershell -Verb RunAs -ArgumentList @(
        '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$script`"", '-Pengu', "`"$Pengu`"")
      return 0
    }

    if ((Split-Path $source) -eq (Resolve-Path -LiteralPath $plugins).Path) {
      Say 'This folder is already inside Pengu Loader''s plugins folder, so it is installed.' Green
    } else {
      $target = Find-Existing $plugins $source
      if ($target) { Say "Updating the existing install: $target" } else { $target = Join-Path $plugins $Name }
      Copy-Plugin $source $target
      Update-Lists $target
      Say "Installed to $target" Green
    }

    Say ''
    Say 'Done. Fully close and reopen the League client, then open its Settings:' Green
    Say 'the new CustomClient tab has all the options.' Green
    if (Get-Process -Name 'LeagueClientUx' -ErrorAction SilentlyContinue) {
      Say 'The League client is running right now: restart it to load the theme.' Yellow
    }
    Say ''
    return 0
  } catch {
    Say ''
    Say "Install failed: $($_.Exception.Message)" Red
    Say "You can still install by hand: copy the plugin folder into $(if ($Pengu) { "$Pengu\plugins" } else { 'Pengu Loader\plugins' })." Red
    return 1
  }
}

$code = Install
# keeps the Install.cmd window open so the result can be read
if ($PSCommandPath -and $Host.Name -eq 'ConsoleHost') { Read-Host 'Press Enter to close' | Out-Null }
if ($PSCommandPath) { exit $code }
