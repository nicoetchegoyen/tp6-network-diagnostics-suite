$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$buildRoot = $taskRoot
$mountRoot = Split-Path -Parent $taskRoot
$folderName = Split-Path -Leaf $taskRoot
$mappedDrive = $null
# Unidad temporal hacia este proyecto para evitar rutas >260 caracteres en Ninja.
foreach ($letter in @('R','S','T','U','V')) {
  if (-not (Test-Path "$letter`:\")) {
    & subst.exe "$letter`:" $mountRoot
    if ($LASTEXITCODE -eq 0) { $mappedDrive = "$letter`:"; $buildRoot = "$letter`:\$folderName"; break }
  }
}
try {
  Set-Location -LiteralPath $buildRoot
  if (Test-Path '.tools\jdk\bin\java.exe') { $env:JAVA_HOME = Join-Path $buildRoot '.tools\jdk' }
  if (Test-Path '.tools\android-sdk') { $env:ANDROID_HOME = Join-Path $buildRoot '.tools\android-sdk' }
  if (-not $env:JAVA_HOME -or -not $env:ANDROID_HOME) { throw 'Configura JAVA_HOME y ANDROID_HOME o ejecuta scripts/bootstrap-android.ps1.' }
  $env:Path = "$env:JAVA_HOME\bin;$env:Path"
  $env:GRADLE_USER_HOME = Join-Path $buildRoot '.cache\gradle'
  $env:CI = '1'
  $env:NODE_ENV = 'production'
  & node scripts/prepare-native.cjs
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo preparar el enlace nativo.' }
  if (-not (Test-Path 'android\gradlew.bat')) { & npm.cmd run prebuild; if ($LASTEXITCODE -ne 0) { throw 'Fallo prebuild.' } }
  Push-Location android
  try { & .\gradlew.bat :app:assembleRelease --no-daemon --no-parallel --max-workers=1 '-PreactNativeArchitectures=arm64-v8a' '-Pkotlin.compiler.execution.strategy=in-process' '-Dorg.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=768m'; if ($LASTEXITCODE -ne 0) { throw 'Fallo Gradle.' } } finally { Pop-Location }
  New-Item -ItemType Directory -Force -Path 'deliverables' | Out-Null
  Copy-Item -LiteralPath 'android\app\build\outputs\apk\release\app-release.apk' -Destination 'deliverables\fieldkit-1.0.0.apk' -Force
  Get-FileHash -LiteralPath 'deliverables\fieldkit-1.0.0.apk' -Algorithm SHA256
} finally {
  Set-Location -LiteralPath $taskRoot
  if ($mappedDrive) { & subst.exe $mappedDrive /D }
}
