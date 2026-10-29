$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$connection = Get-Content -LiteralPath (Join-Path $taskRoot '.cache/emulator-connection.json') -Raw | ConvertFrom-Json
$adb = Join-Path $taskRoot '.tools/android-sdk/platform-tools/adb.exe'
& $adb -s $connection.serial shell cmd location set-location-enabled true
& $adb -s $connection.serial emu geo fix -58.3816 -34.6037
if ($LASTEXITCODE -ne 0) { throw 'Abrir primero el emulador con INICIAR_ANDROID.cmd.' }
Write-Host 'Ubicacion SIMULADA de ejemplo enviada: Buenos Aires. No es un GPS fisico.'
