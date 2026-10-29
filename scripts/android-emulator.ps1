param([switch] $InstallApk)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$driveFile = Join-Path $taskRoot '.cache/emulator-drive.json'
New-Item -ItemType Directory -Force -Path (Join-Path $taskRoot '.cache') | Out-Null
$runtimeRoot = $null
foreach ($mapping in (& subst.exe)) {
  if ($mapping -match '^([A-Z]):\\: => (.+)$' -and $Matches[2].TrimEnd('\') -eq $taskRoot.TrimEnd('\')) { $runtimeRoot = "$($Matches[1]):\"; break }
}
if (-not $runtimeRoot) {
  foreach ($letter in @('T','U','V','W')) {
    if (-not (Test-Path "$letter`:\")) {
      & subst.exe "$letter`:" $taskRoot
      if ($LASTEXITCODE -eq 0) { $runtimeRoot = "$letter`:\"; break }
    }
  }
}
if (-not $runtimeRoot) { throw 'No hay una letra de unidad libre para ejecutar Android sin espacios en la ruta.' }
@{root=$runtimeRoot;target=$taskRoot} | ConvertTo-Json | Set-Content -LiteralPath $driveFile
$env:JAVA_HOME = Join-Path $runtimeRoot '.tools/jdk'
$env:ANDROID_HOME = Join-Path $runtimeRoot '.tools/android-sdk'
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:ANDROID_USER_HOME = Join-Path $runtimeRoot '.tools/android-user'
$env:ANDROID_AVD_HOME = Join-Path $runtimeRoot '.tools/avd'
$env:SKIP_JDK_VERSION_CHECK = '1'
$adb = Join-Path $env:ANDROID_HOME 'platform-tools/adb.exe'
$emulator = Join-Path $env:ANDROID_HOME 'emulator/emulator.exe'
if (-not (Test-Path $emulator)) { throw 'Falta instalar el emulador. Consultar docs/ANDROID_SIN_TELEFONO.md.' }
New-Item -ItemType Directory -Force -Path $env:ANDROID_USER_HOME,$env:ANDROID_AVD_HOME | Out-Null
$avdName = 'Fieldkit_TP6'
$avdPath = Join-Path $env:ANDROID_AVD_HOME "$avdName.avd"
if (-not (Test-Path (Join-Path $avdPath 'config.ini'))) {
  Write-Host 'Creando Android virtual para Fieldkit...'
  'no' | & (Join-Path $env:ANDROID_HOME 'cmdline-tools/latest/bin/avdmanager.bat') create avd --name $avdName --package 'system-images;android-35;default;x86_64' --device 'pixel_5' --path $avdPath
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear el dispositivo Android virtual.' }
}
$configPath = Join-Path $avdPath 'config.ini'
$configLines = @(Get-Content -LiteralPath $configPath)
$options = @{'hw.ramSize'='2048';'vm.heapSize'='256';'hw.lcd.width'='720';'hw.lcd.height'='1280';'hw.lcd.density'='320';'hw.keyboard'='yes';'hw.camera.back'='virtualscene';'hw.camera.front'='emulated';'disk.dataPartition.size'='2G';'showDeviceFrame'='no';'skin.name'='720x1280'}
foreach ($name in $options.Keys) {
  $configLines = @($configLines | Where-Object { $_ -notmatch ('^' + [regex]::Escape($name) + '\s*=') }) + "$name=$($options[$name])"
}
$configLines | Set-Content -LiteralPath $configPath -Encoding ascii
& $adb start-server | Out-Null
$serial = $null
foreach ($device in (& $adb devices)) {
  if ($device -match '^(emulator-\d+)\s+device') {
    $candidate = $Matches[1]
    if ((& $adb -s $candidate emu avd name) -contains $avdName) { $serial = $candidate; break }
  }
}
if (-not $serial) {
  $port = 5554
  while ((Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)) { $port += 2 }
  $serial = "emulator-$port"
  Write-Host 'Abriendo el emulador Android. La primera vez puede tardar...'
  $emulatorArgs = @('-avd',$avdName,'-port',"$port",'-no-snapshot','-no-boot-anim','-no-audio','-gpu','swiftshader','-memory','2048','-cores','2','-skin','720x1280')
  # Ventana visible: es el teléfono virtual que el usuario debe ver y grabar.
  Start-Process -FilePath $emulator -ArgumentList $emulatorArgs -WindowStyle Normal -RedirectStandardOutput (Join-Path $taskRoot '.cache/emulator.stdout.log') -RedirectStandardError (Join-Path $taskRoot '.cache/emulator.stderr.log') | Out-Null
}
$booted = $false
for ($attempt = 0; $attempt -lt 120; $attempt++) {
  try { $status = & $adb -s $serial shell getprop sys.boot_completed 2>$null } catch { $status = '' }
  if ($status -eq '1') { $booted = $true; break }
  if ($attempt % 10 -eq 0) { Write-Host 'Esperando que Android termine de iniciar...' }
  Start-Sleep -Seconds 2
}
if (-not $booted) { throw 'Android no terminó de iniciar. Revisar .cache/emulator.stderr.log.' }
@{serial=$serial;avd=$avdName;sdk=$env:ANDROID_HOME} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $taskRoot '.cache/emulator-connection.json')
& $adb -s $serial shell settings put global window_animation_scale 0.5 | Out-Null
& $adb -s $serial shell settings put global transition_animation_scale 0.5 | Out-Null
& $adb -s $serial shell settings put system screen_off_timeout 1800000 | Out-Null
& $adb -s $serial shell settings put secure show_ime_with_hard_keyboard 1 | Out-Null
& $adb -s $serial shell settings put global auto_time_zone 0 | Out-Null
& $adb -s $serial shell cmd alarm set-timezone America/Argentina/Buenos_Aires | Out-Null
& $adb -s $serial shell settings put system time_12_24 24 | Out-Null
& $adb -s $serial shell input keyevent 82 | Out-Null
$qr = Join-Path $runtimeRoot 'deliverables/qr-equipo-PC-REAL.png'
if (Test-Path $qr) {
  & $adb -s $serial emu virtualscene-image wall $qr | Out-Null
  & $adb -s $serial emu virtualscene-image table $qr | Out-Null
}
& $adb -s $serial shell cmd location set-location-enabled true | Out-Null
& $adb -s $serial emu geo fix -58.3816 -34.6037 | Out-Null
if ($InstallApk) {
  $apk = Join-Path $taskRoot 'deliverables/fieldkit-1.1.0.apk'
  if (-not (Test-Path $apk)) { throw 'Primero generar deliverables/fieldkit-1.1.0.apk con npm run build:apk.' }
  & $adb -s $serial install -r $apk
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo instalar el APK.' }
  & $adb -s $serial shell am start -n ar.edu.fcyt.fieldkit/.MainActivity
}
Write-Host "Android listo: $serial. Ubicacion y camara del emulador son simuladas."
