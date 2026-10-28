# Verificación · Expo Go

Adaptación: 27 de octubre de 2026.

## Compatibilidad del iPhone

La captura del teléfono confirmó Expo Go SDK 58.0.0 y el rechazo del proyecto SDK 54. Se actualizó el proyecto a Expo 58.0.20, React Native 0.88.0, React 19.3.0 y las versiones correspondientes de cámara, ubicación, archivos, impresión, almacenamiento seguro y SQLite. TypeScript 6 y Babel también se alinearon. `expo-doctor` aprobó sus 20 comprobaciones y `expo install --check` no detectó versiones fuera de rango.

El proyecto Android generado con SDK 54 se conserva en `legacy/android-sdk54/`, fuera de la aplicación actual. Se mantiene el mismo enlace LAN de Expo; el launcher muestra y registra el SDK que está sirviendo para evitar reutilizar por error un servidor anterior.

## Comprobado en la computadora

- TypeScript estricto sin errores: `npm run typecheck`.
- 27 pruebas automatizadas aprobadas: `npm test`.
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

## Corrección SNMP del 28 de octubre de 2026

Se reprodujo el mensaje «La respuesta SNMP no corresponde a la solicitud» al ejecutar el protocolo con el Buffer JavaScript de la app y una implementación de `subarray()` que devuelve una vista `Uint8Array` sin los métodos de Buffer. La lectura de OCTET STRING producía una lista decimal de bytes en lugar de texto UTF-8, alterando la community y los nombres.

El lector BER ahora normaliza cada vista mediante `Buffer.from()` antes de decodificar texto/hexadecimal. Dos pruebas aisladas con el polyfill móvil reproducen el fallo anterior y comprueban la corrección con SNMPv1/v2c, identificadores de distintos tamaños y caracteres Unicode. Se conserva el rechazo de respuestas de otra consulta; los mensajes distinguen el campo que no coincide sin exponer credenciales. Falta confirmar el resultado al volver a consultar desde el iPhone del usuario.

## Corrección de cámara del 28 de octubre de 2026

El lector QR se presenta dentro de la ficha del equipo que ya está abierta, evitando intentar presentar un segundo modal hermano sobre el primero en iOS. La pantalla de permiso o cámara aparece inmediatamente al tocar el botón. Al cerrar el lector se regresa a la ficha sin perder el equipo seleccionado; un bloqueo evita procesar varias veces el mismo escaneo.

En iPhone, tanto QR como fotos solicitan explícitamente la cámara física ultra gran angular (0,5×) desde el primer montaje. No se espera a que la cámara predeterminada esté lista, porque la cámara 1× del usuario podría no funcionar. Los identificadores de lente son los `deviceType` estables de Expo Camera SDK 58; la aplicación enumera las lentes disponibles y permite elegir otra, reintentar o usar la frontal. Si no hay ultra gran angular, se usa una cámara disponible. Se muestran errores de inicio y permisos, y la captura se habilita después de `onCameraReady`.

Dos pruebas comprueban la preferencia de 0,5× con orden de dispositivos y nombres localizados diferentes, la conservación de una selección manual y el cambio a una lente disponible cuando desaparece la anterior. Falta confirmar la apertura y lectura física con la cámara 0,5× del iPhone del usuario.

## Artefacto Android anterior

El APK `deliverables/fieldkit-1.0.0.apk` corresponde al 26 de octubre y a la implementación Android anterior (arm64-v8a, firma de prueba). No se recompiló para esta adaptación. Su hash/BUILD.txt describen solo ese archivo; no prueban la versión de Expo Go. El código anterior se conserva en el historial Git.
