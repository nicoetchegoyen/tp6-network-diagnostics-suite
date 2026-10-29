param([string] $Architectures = 'arm64-v8a,x86_64')
$ErrorActionPreference = 'Stop'
if ($Architectures -notmatch '^(arm64-v8a|x86_64)(,(arm64-v8a|x86_64))*$') { throw 'Arquitectura no admitida.' }
$taskRoot = Split-Path -Parent $PSScriptRoot
$appVersion = (Get-Content -LiteralPath (Join-Path $taskRoot 'package.json') -Raw | ConvertFrom-Json).version
$buildRoot = $taskRoot
$mountRoot = Split-Path -Parent $taskRoot
$folderName = Split-Path -Leaf $taskRoot
$mappedDrive = $null
foreach ($mapping in (& subst.exe)) {
  if ($mapping -match '^([A-Z]):\\: => (.+)$' -and $Matches[2].TrimEnd('\') -eq $mountRoot.TrimEnd('\')) { $buildRoot = "$($Matches[1]):\$folderName"; break }
}
# Unidad temporal hacia este proyecto para evitar rutas >260 caracteres en Ninja.
foreach ($letter in @('R','S','T','U','V')) {
  if ($buildRoot -ne $taskRoot) { break }
  if (-not (Test-Path "$letter`:\")) {
    & subst.exe "$letter`:" $mountRoot
    if ($LASTEXITCODE -eq 0) { $mappedDrive = "$letter`:"; $buildRoot = "$letter`:\$folderName"; break }
  }
}
try {
  Set-Location -LiteralPath $buildRoot
  if (Test-Path '.tools\jdk\bin\java.exe') { $env:JAVA_HOME = Join-Path $buildRoot '.tools\jdk' }
  if (Test-Path '.tools\android-sdk') { $env:ANDROID_HOME = Join-Path $buildRoot '.tools\android-sdk' }
  if (-not $env:JAVA_HOME -or -not $env:ANDROID_HOME) { throw 'Configura JAVA_HOME con JDK 17 y ANDROID_HOME con el SDK de Android.' }
  $env:Path = "$env:JAVA_HOME\bin;$env:Path"
  $env:GRADLE_USER_HOME = Join-Path $buildRoot '.cache\gradle'
  $env:CI = '1'
  $env:NODE_ENV = 'production'
  if (-not $env:EXPO_PUBLIC_FIELDKIT_BACKEND) { $env:EXPO_PUBLIC_FIELDKIT_BACKEND = 'http://10.0.2.2:8790' }
  if (-not $env:EXPO_PUBLIC_FIELDKIT_TOKEN) { $env:EXPO_PUBLIC_FIELDKIT_TOKEN = 'fieldkit-demo-local' }
  & node scripts/prepare-native.cjs
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo preparar el enlace nativo.' }
  if (-not (Test-Path 'android\gradlew.bat')) { & npm.cmd run prebuild; if ($LASTEXITCODE -ne 0) { throw 'Fallo prebuild.' } }
  Push-Location android
  try { & .\gradlew.bat :app:assembleRelease --init-script ../scripts/windows-native.init.gradle --no-daemon --no-parallel --max-workers=2 "-PreactNativeArchitectures=$Architectures" '-Pkotlin.compiler.execution.strategy=in-process' '-Dorg.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m'; if ($LASTEXITCODE -ne 0) { throw 'Fallo Gradle.' } } finally { Pop-Location }
  New-Item -ItemType Directory -Force -Path 'deliverables' | Out-Null
  $apkFile = "fieldkit-$appVersion.apk"
  $apkPath = Join-Path $buildRoot "deliverables/$apkFile"
  Copy-Item -LiteralPath 'android\app\build\outputs\apk\release\app-release.apk' -Destination $apkPath -Force
  $apkStream = [IO.File]::OpenRead($apkPath)
  try { $apkHash = [BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash($apkStream)).Replace('-','').ToLowerInvariant() } finally { $apkStream.Dispose() }
  "$apkHash  $apkFile" | Set-Content -LiteralPath "$apkPath.sha256" -Encoding ascii
  Write-Host "APK generado: deliverables/$apkFile ($Architectures)"
} finally {
  Set-Location -LiteralPath $taskRoot
  if ($mappedDrive) { & subst.exe $mappedDrive /D }
}
