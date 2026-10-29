param([ValidateSet('Offline','Online')][string] $Mode)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$connection = Get-Content -LiteralPath (Join-Path $taskRoot '.cache/emulator-connection.json') -Raw | ConvertFrom-Json
$adb = Join-Path $taskRoot '.tools/android-sdk/platform-tools/adb.exe'
if ($Mode -eq 'Offline') {
  & $adb -s $connection.serial shell cmd connectivity airplane-mode enable
  & $adb -s $connection.serial shell svc wifi disable
  & $adb -s $connection.serial shell svc data disable
  Write-Host 'Modo avion activado en Android; Wi-Fi y datos apagados. Esperar Offline en Fieldkit.'
} else {
  & $adb -s $connection.serial shell cmd connectivity airplane-mode disable
  & $adb -s $connection.serial shell svc wifi enable
  & $adb -s $connection.serial shell svc data enable
  Write-Host 'Radios de Android activadas. Esperar En red y la sincronizacion en Fieldkit.'
}
if ($LASTEXITCODE -ne 0) { throw 'No se pudo cambiar la red del emulador. Abrir INICIAR_ANDROID.cmd.' }
