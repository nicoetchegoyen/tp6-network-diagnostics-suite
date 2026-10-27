# Verificación · Expo Go

Adaptación: 27 de octubre de 2026.

## Comprobado en la computadora

- TypeScript estricto sin errores: `npm run typecheck`.
- 23 pruebas automatizadas aprobadas: `npm test`.
- Compatibilidad de versiones del SDK: `npx expo install --check`.
- Exportación iOS/Hermes correcta, sin importar WatermelonDB ni depender de un módulo de sockets instalado en Expo Go.
- Backend autenticado: idempotencia persistida, conflictos y transferencia de adjuntos.
- SNMP con bytes BER propios atravesando HTTP y un socket UDP real en loopback.
- Servidor SSH real de prueba: obtención de huella sin autenticar, rechazo de huella distinta antes de enviar credenciales, ejecución correcta y rechazo de comandos fuera del catálogo.
- Repositorio persistente: entidad+outbox atómicas, reapertura, error de disco sin cambios en memoria, escritores simultáneos y respaldo de conflictos.
- Regresión: desconexión prolongada no agota reintentos; reconexión fuerza pendientes sin esperar el backoff.
- Regresión: IP repetida entre sitios y MAC diferente no mezclan equipos.
- Inicio de Expo CLI en modo Expo Go y QR para la LAN de la computadora.
- Prueba de interfaz en vista móvil: conexión autenticada al puente, alta de un equipo de laboratorio identificado como fixture, consulta SNMP correcta con interfaces 1 y 3, sincronización automática hasta cola vacía y recarga conservando equipo e historial. Se usó un servidor de prueba separado de los datos del iPhone.

## Pendiente de comprobar con el iPhone

- Apertura efectiva en la versión de Expo Go instalada por el usuario.
- Permiso de Red local y alcance del servidor desde la Wi-Fi del teléfono.
- Captura de foto, lectura física de QR/barras, GPS y persistencia tras reabrir Expo Go.
- PDF completo generado y compartido con evidencia real.
- Descubrimiento y diagnóstico de un router/ONT/switch físico, y contraste de sus valores.
- Video de demostración del recorrido completo.

La exportación iOS y las pruebas de Node verifican partes concretas; no equivalen a una ejecución en un iPhone físico. La vista web permite comprobar interfaz/IndexedDB y usar el puente, pero las funciones de evidencia/PDF se verifican en Expo Go.

## Artefacto Android anterior

El APK `deliverables/fieldkit-1.0.0.apk` corresponde al 26 de octubre y a la implementación Android anterior (arm64-v8a, firma de prueba). No se recompiló para esta adaptación. Su hash/BUILD.txt describen solo ese archivo; no prueban la versión de Expo Go. El código anterior se conserva en el historial Git.
