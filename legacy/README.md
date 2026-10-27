# Código nativo anterior

`android-sdk54/` conserva el proyecto Android generado con SDK 54. Se archivó al actualizar el destino principal a Expo Go SDK 58 para evitar mezclar configuración nativa antigua con el proyecto actual. No se usa para iniciar Expo Go y no representa un proyecto Android actualizado a SDK 58.

El APK anterior y sus scripts de compilación corresponden al historial hasta el commit `7984f15`. Para reproducir exactamente ese build, usar esa revisión en una carpeta separada. No copiar la configuración Gradle de este archivo histórico al proyecto SDK 58.
