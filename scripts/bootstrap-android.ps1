$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$taskRoot = Split-Path -Parent $PSScriptRoot
function Assert-TaskPath([string] $target) {
  $resolvedTarget = [IO.Path]::GetFullPath($target)
  if (-not $resolvedTarget.StartsWith($taskRoot + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Ruta fuera del proyecto.' }
  return $resolvedTarget
}
$toolsDir = Join-Path $taskRoot '.tools'
New-Item -ItemType Directory -Force -Path $toolsDir | Out-Null
$jdkDir = Join-Path $toolsDir 'jdk'
if (-not (Test-Path (Join-Path $jdkDir 'bin\java.exe'))) {
  Write-Host 'Descargando JDK 17 (OpenJDK RI)...'
  $zip = Join-Path $toolsDir 'jdk.zip'
  & curl.exe -L --fail --retry 2 --max-time 300 'https://download.java.net/openjdk/jdk17/ri/openjdk-17+35_windows-x64_bin.zip' -o $zip
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo descargar OpenJDK.' }
  $extract = Join-Path $toolsDir 'jdk-extract'
  Expand-Archive -LiteralPath $zip -DestinationPath $extract -Force
  $jdkSource = (Get-ChildItem -LiteralPath $extract -Directory | Select-Object -First 1).FullName
  $jdkSource = Assert-TaskPath $jdkSource
  $jdkDir = Assert-TaskPath $jdkDir
  Move-Item -LiteralPath $jdkSource -Destination $jdkDir
}
$sdkDir = Join-Path $toolsDir 'android-sdk'
$manager = Join-Path $sdkDir 'cmdline-tools\latest\bin\sdkmanager.bat'
if (-not (Test-Path $manager)) {
  Write-Host 'Descargando Android command line tools...'
  $zip = Join-Path $toolsDir 'android-tools.zip'
  & curl.exe -L --fail --retry 2 --max-time 300 'https://dl.google.com/android/repository/commandlinetools-win-13114758_latest.zip' -o $zip
  if ($LASTEXITCODE -ne 0) { throw 'No se pudieron descargar Android tools.' }
  $extract = Join-Path $toolsDir 'android-extract'
  Expand-Archive -LiteralPath $zip -DestinationPath $extract -Force
  New-Item -ItemType Directory -Force -Path (Join-Path $sdkDir 'cmdline-tools') | Out-Null
  $sdkSource = Assert-TaskPath (Join-Path $extract 'cmdline-tools')
  $sdkTarget = Assert-TaskPath (Join-Path $sdkDir 'cmdline-tools\latest')
  Move-Item -LiteralPath $sdkSource -Destination $sdkTarget
}
$env:JAVA_HOME = $jdkDir
$env:ANDROID_HOME = $sdkDir
$env:Path = "$jdkDir\bin;$env:Path"
$env:SKIP_JDK_VERSION_CHECK = '1'
# Android SDK solicita aceptar sus licencias; este script automatiza el entorno de build local.
(1..100 | ForEach-Object { 'y' }) | & $manager --sdk_root=$sdkDir --licenses
if ($LASTEXITCODE -ne 0) { throw 'No se pudieron aceptar las licencias Android.' }
& $manager --sdk_root=$sdkDir 'platform-tools' 'platforms;android-36' 'platforms;android-37.0' 'build-tools;37.0.0' 'ndk;27.1.12297006' 'cmake;3.22.1'
if ($LASTEXITCODE -ne 0) { throw 'No se pudo instalar Android SDK.' }
Write-Host 'Toolchain listo en .tools/'
