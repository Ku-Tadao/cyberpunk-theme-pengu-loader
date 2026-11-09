@echo off
rem Double-click after adding or removing files: updates index.json so CustomClient shows them.
cd /d "%~dp0"
powershell -NoProfile -Command "$f = @(Get-ChildItem -File | Where-Object { $_.Extension -match '^\.(jpe?g|png|gif|webp|avif|bmp|mp4|webm)$' } | Sort-Object Name | ForEach-Object { $_.Name + '|' + $_.LastWriteTimeUtc.Ticks }); [IO.File]::WriteAllText((Join-Path (Get-Location) 'index.json'), (ConvertTo-Json -InputObject $f -Compress), (New-Object Text.UTF8Encoding $false)); Write-Host ($f.Count.ToString() + ' file(s) listed. CustomClient picks them up in a few seconds.')"
timeout /t 3 >nul
