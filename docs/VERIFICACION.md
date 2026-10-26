# Verificación de la implementación

Fecha de desarrollo: 26 de octubre de 2026.

## Comprobado

- TypeScript en modo estricto: `npm run typecheck`.
- 17 pruebas automatizadas: `npm test`.
- Vector BER SNMPv1 independiente y parsing del mismo vector.
- Longitudes BER largas, OIDs con arcos multi-byte y Counter64 sin pérdida.
- Rechazo de cada truncamiento del paquete de referencia, longitudes indefinidas y datos adicionales.
- Validación de correlación, community, versión, PDU, OIDs y avance de GETNEXT.
- Cliente SNMP contra un socket UDP real en loopback e interfaz con índice no consecutivo.
- Estados/reintentos offline, backoff, recuperación de sending y exclusión de workers duplicados.
- Conflictos y bloqueo de sucesoras por entidad; propagación de la versión confirmada.
- Backend HTTP con token, conflictos, idempotencia persistida tras reiniciar y adjuntos.
- Exportación web mediante Metro.
- Revisión visual de pantallas y navegación en el navegador.
- Alta manual de un equipo en la UI, registro de fallo SNMP explicando la necesidad de Android, asociación de ficha MikroTik desde el backend, recarga conservando equipo/historial y envío de la cola al backend.

## Verificaciones físicas pendientes

- Ejecutar el APK en un teléfono Android real (no había dispositivos en `adb devices`).
- Descubrir un router/ONT/switch en una LAN física y contrastar la respuesta SNMP.
- Conexión SSH real con verificación de huella y credenciales.
- Cámara/lector de código, GPS y PDF completo con evidencia capturada en Android.
- Video de campo conforme a `docs/DEMO.md`.

Se intentó preparar un emulador, pero el almacenamiento disponible resultó insuficiente; se retiraron exclusivamente esos archivos generados. La vista web sirve para QA de UI y persistencia, y no se usa como prueba de funcionamiento de sockets/cámara/GPS nativos.

## Build Android

Build release completado correctamente: APK de 29,66 MiB, Android mínimo API 24, target API 36 y ABI arm64-v8a. Se verificó la firma APK v2 y el inventario de bibliotecas (Expo Modules Core, Hermes, React Native y libc++). El bundle JavaScript está incluido para funcionar sin Metro.

El hash SHA-256 y los resultados de la entrega están en `deliverables/BUILD.txt`. Un APK no prueba por sí mismo el acceso a una LAN física ni el comportamiento de permisos en cada fabricante Android.
