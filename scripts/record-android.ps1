param([int] $Duration = 0)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$connection = Get-Content -LiteralPath (Join-Path $taskRoot '.cache/emulator-connection.json') -Raw | ConvertFrom-Json
$drive = Get-Content -LiteralPath (Join-Path $taskRoot '.cache/emulator-drive.json') -Raw | ConvertFrom-Json
$adb = Join-Path $taskRoot '.tools/android-sdk/platform-tools/adb.exe'
$name = 'video-demo-android.webm'
if (Test-Path (Join-Path $taskRoot "deliverables/$name")) { $name = 'video-demo-android-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.webm' }
$recordPath = Join-Path $drive.root "deliverables/$name"
Write-Host 'Iniciando grabacion de la pantalla del Android virtual (sin voz)...'
& $adb -s $connection.serial emu screenrecord start --time-limit 900 --bit-rate 4000000 --fps 24 $recordPath
if ($LASTEXITCODE -ne 0) { throw 'No se pudo iniciar. Abrir INICIAR_ANDROID.cmd y comprobar que no haya otra grabacion activa.' }
if ($Duration -gt 0) { Start-Sleep -Seconds $Duration }
else { Read-Host 'Volve al emulador y realiza el recorrido. Al terminar, volve a esta ventana y presiona ENTER' | Out-Null }
& $adb -s $connection.serial emu screenrecord stop
$localFile = Join-Path $taskRoot "deliverables/$name"
if (-not (Test-Path $localFile) -or (Get-Item -LiteralPath $localFile).Length -lt 1000) { throw 'No se encontro una grabacion valida.' }
Write-Host "Video guardado: $localFile"
Write-Host 'Abrilo y revisalo antes de entregar. No se sobrescriben grabaciones anteriores.'
