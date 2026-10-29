$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $taskRoot
& (Join-Path $PSScriptRoot 'android-emulator.ps1') -InstallApk
if ($LASTEXITCODE -ne 0) { throw 'No se pudo iniciar el emulador.' }
Write-Host 'Iniciando backend y SNMP de la PC. Mantener esta ventana abierta.'
$running = $false
try {
  $health = Invoke-RestMethod -Uri 'http://127.0.0.1:8790/v1/health' -Headers @{Authorization='Bearer fieldkit-demo-local'} -TimeoutSec 3
  $running = $health.ok -and $health.service -eq 'fieldkit-sync' -and -not $health.gateway
} catch { }
if ($running) { Write-Host 'El servidor de demostracion ya estaba ejecutandose. Android esta listo.'; exit 0 }
& node scripts/android-demo-server.mjs
