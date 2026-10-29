# Verificación de la entrega Android 1.1.0

Entorno de prueba: Windows 10 con WHPX, Android Emulator 15/API 35 x86_64, APK release instalado mediante ADB. La PC física de la LAN ejecuta un agente SNMP que lee sus interfaces y contadores de Windows. El servidor HTTP de Android tiene el puente de diagnósticos deshabilitado.

## Requisitos y evidencia

| Requisito | Implementación y comprobación |
| --- | --- |
| RF-01 Descubrimiento | NsdManager/mDNS y sondeo TCP/UDP nativos. El APK descubrió `192.168.1.4` por respuesta UDP durante un escaneo `/32`. MAC y hostname se muestran solo si están disponibles. |
| RF-02 SNMP | BER propio, v1/v2c, GET y GETNEXT, correlación estricta. Desde Android se obtuvo sysName Nicolas, uptime del agente e interfaces reales de Windows con índices 13, 17 y 28 y contadores Counter32. |
| RF-03 SSH | JSch dentro del APK: huella SHA-256 contrastada sin intentos de autenticación, aviso de cambio de clave al reiniciar el servidor efímero y ejecución correcta de `uptime` contra un servidor SSH local de prueba en `10.0.2.2:8022`. El servidor registró la autenticación y el comando. No se afirma una conexión a un router físico. |
| RF-04 Identificación | Cámara nativa para QR/barras, asociación y catálogo remoto con caché. El código PC-REAL corresponde a la PC de laboratorio; LAB-001 identifica datos de prueba. La lectura óptica en un teléfono físico no fue comprobada. |
| RF-05 Instalación | Se capturó una foto de cámara emulada y una posición GPS simulada con radios de Android apagados. La app conserva notas, precisión y fecha de cada foto. |
| RF-06 PDF | Se generó y abrió un PDF de tres páginas sin conexión, con foto, coordenadas, notas y diagnósticos. Se revisó también el archivo recibido por el backend. |
| RF-07 Offline y outbox | WatermelonDB/SQLite nativo. Instalación y dos acciones outbox sobrevivieron al cierre forzado y reinicio offline. Al recuperar radios, la cola se vació automáticamente y el backend recibió JPEG y PDF; conservó versiones y recibos. |
| RF-08 Historial | Diagnósticos y registros permanecen consultables sin conexión. La separación por equipo/sitio y las IP repetidas se cubren además mediante pruebas automatizadas. |

## Comprobaciones automáticas y del artefacto

- `npm run typecheck`: correcto.
- `npm test`: 30 pruebas aprobadas, incluyendo transporte UDP real, parser móvil, SSH del puente, atomicidad, orden FIFO, conflictos, idempotencia y reconexión prolongada.
- APK release con JavaScript incluido; no requiere Metro ni Expo Go.
- Prueba del APK final con radios apagados: **Sincronizar ahora** conserva los datos y espera la conexión, sin iniciar un envío.
- Arquitecturas arm64-v8a y x86_64; compilación, hash y validación de firma en `deliverables/BUILD_ANDROID_1.1.0.txt`.
- Grabación breve del emulador: contenedor WebM válido, vídeo VP9. La toma de verificación no sustituye el video final que debe grabar el alumno.
- Capturas de la prueba en `deliverables/android-*.png` y reporte exportado en `deliverables/reporte-ejemplo-android.pdf`.

## Límite de esta evidencia

La PC consultada es física; la cámara y el GPS del emulador son simulados y se identifican así. No se ha probado el APK en teléfono Android físico, ni cámara/GPS físicos, ni un router de producción. No se presenta esa evidencia como una visita de campo. La aceptación de esta modalidad corresponde al docente.

El video final sigue pendiente de la grabación del alumno. El repositorio es privado y debe compartirse con el docente. El backend incluido permite reproducir la sincronización, sin depender de los datos privados de prueba de esta PC.
