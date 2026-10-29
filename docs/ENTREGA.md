# Archivos para entregar

## Entregables principales

| Entregable                              | Archivo o ubicación                                                                                                              |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Repositorio Git completo                | https://github.com/nicoetchegoyen/tp6-network-diagnostics-suite                                                                  |
| APK Android de prueba actual            | `deliverables/fieldkit-1.1.0.apk`                                                                                                |
| Documento técnico Android               | `output/pdf/Fieldkit_Documento_Tecnico_Android.pdf` y fuente `docs/TECNICO_ANDROID.md`                                                                    |
| Backend mínimo y agente SNMP real de PC | `backend/`, `scripts/android-demo-server.mjs`, `scripts/snmp-host-agent.ts` y `scripts/host-mib.ts`, incluidos en el repositorio |
| Video de demostración                   | `deliverables/video-demo-android.webm`, que se graba siguiendo la guía                                                           |

Agregar `deliverables/reporte-ejemplo-android.pdf`, `deliverables/BUILD_ANDROID_1.1.0.txt` y `deliverables/fieldkit-1.1.0.apk.sha256` como evidencia complementaria. La carpeta `entrega/` del ZIP contiene estos archivos junto con el APK y los documentos. El video final se agrega después de grabarlo. El APK `fieldkit-1.0.0.apk` pertenece a la versión anterior; el que corresponde a esta entrega es **1.1.0**.

## Cómo presentar

1. Compartir el enlace del repositorio y dar acceso al docente, porque es privado. Si se envía un ZIP de fuentes como respaldo, conservar también el enlace Git solicitado.
2. Adjuntar el APK 1.1.0, el documento técnico, el video y el PDF de ejemplo.
3. Indicar expresamente: **demostración del APK en emulador; consulta SNMP de una PC física con datos reales; cámara y ubicación simuladas**.
4. No incluir `node_modules`, `.tools`, `.cache`, claves privadas, tokens personales ni los datos privados de Expo Go. El token `fieldkit-demo-local` es una clave pública del laboratorio incluida en las instrucciones, no una credencial de un equipo.

Después de grabar y revisar el video, hacer doble clic en **ARMAR_ENTREGA.cmd**. Crea `deliverables/TP6_Entrega_Android_1.1.0.zip` con la última toma, el APK, PDFs, hash y una copia de las fuentes guardadas en Git. Si todavía no existe video, el ZIP lo indica como pendiente. Entregar ese ZIP y el enlace del repositorio.

La consigna exige un dispositivo real en la LAN y foto/GPS. El recorrido consulta una computadora física; la evidencia fotográfica y la ubicación del emulador son simuladas. Su aceptación en reemplazo de una prueba en teléfono físico debe acordarse con el docente. La entrega no afirma haber probado un router físico ni un Android físico.
