$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $taskRoot
$files = @{
  'deliverables/fieldkit-1.1.0.apk' = 'fieldkit-1.1.0.apk'
  'deliverables/fieldkit-1.1.0.apk.sha256' = 'fieldkit-1.1.0.apk.sha256'
  'deliverables/BUILD_ANDROID_1.1.0.txt' = 'BUILD_ANDROID_1.1.0.txt'
  'deliverables/reporte-ejemplo-android.pdf' = 'reporte-ejemplo-android.pdf'
  'output/pdf/Fieldkit_Documento_Tecnico_Android.pdf' = 'Documento_Tecnico_Android.pdf'
  'output/pdf/Fieldkit_Guia_Video_Sin_Voz.pdf' = 'Guia_Video_Sin_Voz.pdf'
}
foreach ($file in $files.Keys) {
  if (-not (Test-Path -LiteralPath (Join-Path $taskRoot $file))) { throw "Falta el archivo $file" }
}
$dirty = & git status --porcelain
if ($LASTEXITCODE -ne 0) { throw 'No se pudo leer el repositorio Git.' }
if ($dirty) { throw 'Hay fuentes sin guardar en Git. Confirmar los cambios antes de preparar una entrega que coincida con el repositorio.' }
$revision = & git rev-parse HEAD
$sourceZip = Join-Path $taskRoot 'deliverables/TP6_Codigo_Fuente_1.1.0.zip'
& git archive --format=zip --output=$sourceZip HEAD
if ($LASTEXITCODE -ne 0) { throw 'No se pudo exportar el codigo fuente.' }
$stage = Join-Path $taskRoot ('.cache/entrega-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path (Join-Path $stage 'entrega') -Force | Out-Null
try {
  foreach ($file in $files.Keys) { Copy-Item -LiteralPath (Join-Path $taskRoot $file) -Destination (Join-Path $stage ('entrega/' + $files[$file])) }
  Copy-Item -LiteralPath $sourceZip -Destination (Join-Path $stage 'codigo-fuente.zip')
  $video = Get-ChildItem -LiteralPath (Join-Path $taskRoot 'deliverables') -Filter 'video-demo-android*.webm' -File | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  $videoMessage = 'PENDIENTE: grabar el video final con GRABAR_VIDEO.cmd y volver a ejecutar ARMAR_ENTREGA.cmd.'
  if ($video) {
    Copy-Item -LiteralPath $video.FullName -Destination (Join-Path $stage 'entrega/video-demo-android.webm')
    $videoMessage = "Video incluido: $($video.Name). Revisar esta toma antes de entregar."
  }
  @"
TP6 - Fieldkit Android 1.1.0
Repositorio: https://github.com/nicoetchegoyen/tp6-network-diagnostics-suite
Revision de fuentes: $revision
El repositorio es privado: dar acceso al docente. codigo-fuente.zip es un respaldo.

La carpeta entrega contiene el APK, documento tecnico, guia, reporte de ejemplo y hash.
El backend de sincronizacion esta incluido en codigo-fuente.zip, carpeta backend/.
$videoMessage

Prueba realizada en Android Emulator. SNMP consulta una PC fisica de la LAN.
Camara y GPS del emulador son simulados y se identifican asi en la app y el PDF.
La aceptacion de esa modalidad de demostracion corresponde al docente.
No se afirma haber probado un router ni un telefono Android fisico.

Abrir y configurar: docs/ANDROID_SIN_TELEFONO.md dentro de las fuentes.
Resultados y limites: docs/VERIFICACION_ANDROID.md dentro de las fuentes.
"@ | Set-Content -LiteralPath (Join-Path $stage 'LEEME_ENTREGA.txt') -Encoding utf8
  $destination = Join-Path $taskRoot 'deliverables/TP6_Entrega_Android_1.1.0.zip'
  Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $destination -CompressionLevel Optimal -Force
  Write-Host "Entrega preparada: $destination"
  Write-Host $videoMessage
} finally {
  $resolvedStage = [IO.Path]::GetFullPath($stage)
  $allowedPrefix = [IO.Path]::GetFullPath((Join-Path $taskRoot '.cache')) + [IO.Path]::DirectorySeparatorChar
  if (-not $resolvedStage.StartsWith($allowedPrefix, [StringComparison]::OrdinalIgnoreCase) -or (Split-Path -Leaf $resolvedStage) -notlike 'entrega-*') { throw 'No se elimino la carpeta temporal porque su ruta no es valida.' }
  Remove-Item -LiteralPath $resolvedStage -Recurse -Force
}
