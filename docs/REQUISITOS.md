# Matriz de trazabilidad

Esta matriz distingue implementación de verificación de campo. El código no incluye dispositivos ni mediciones ficticias precargadas.

| ID    | Requisito                                  | Resolución                                                                                                              | Evidencia / límite                                                                                                                  |
| ----- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| RF-01 | Descubrir hosts y listar IP, MAC, hostname | NsdManager/mDNS, pool TCP/UDP, caché ARP y alta manual. Lista persistente y progreso/cancelación.                       | Pruebas de CIDR. MAC y hostname se muestran si el sistema los proporciona. El descubrimiento físico necesita prueba en LAN.         |
| RF-02 | SNMP: uptime, sysName y tráfico            | Encoder/parser BER propio, v1/v2c, UDP, GET y GETNEXT de índices de interfaces.                                         | Vector BER independiente, parser truncado, correlación y consulta real UDP loopback. Pendiente contraste con un equipo SNMP físico. |
| RF-03 | SSH con comandos de diagnóstico            | Bridge JSch, catálogo Linux/OpenWrt/MikroTik/Cisco, pinning de clave y cierre de sesión.                                | Lista validada en JS/Kotlin. Prueba con equipo SSH de campo pendiente.                                                              |
| RF-04 | QR/barras y ficha remota                   | Cámara/ML Kit, extracción segura del código, catálogo remoto, caché local.                                              | Asociación y consulta de ficha comprobadas en UI web mediante código manual. Cámara/lectura física requiere Android.                |
| RF-05 | Instalación, fotos, GPS y notas            | Formulario validado, borrador persistente, fotos en documentos privados y coordenadas individuales con precisión/fecha. | Código implementado. Captura/precisión requieren teléfono y permisos.                                                               |
| RF-06 | Reporte PDF                                | A4 offline con imágenes base64, ubicación y diagnósticos; archivo persistente y compartir.                              | Generador implementado. Validación visual de un reporte capturado en Android pendiente.                                             |
| RF-07 | Operación offline y outbox                 | Entidad+acción atómicas en WatermelonDB, worker con recuperación, backoff, recibos idempotentes y conflictos.           | Tests del motor/backend y guardado/recarga/envío desde UI. Sin servicio permanente al cerrar la app.                                |
| RF-08 | Historial por equipo/sitio offline         | Diagnósticos exitosos y fallidos persistidos, búsqueda por equipo/IP/sitio/protocolo y detalle.                         | Alta y recarga del registro comprobadas en UI.                                                                                      |

## Requisitos técnicos y arquitectura

| Punto de consigna                             | Implementación                                                                                 |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| React Native                                  | React Native 0.81.5, React 19, TypeScript, proyecto Android generado y conservado              |
| TCP/UDP sin abstracción HTTP para diagnóstico | Sockets Java/Kotlin, bridge local Expo Modules                                                 |
| mDNS/Bonjour y/o ARP-like                     | NsdManager, TCP scan, lectura de caché ARP cuando está permitida                               |
| Paquetes SNMP propios                         | `src/protocol/snmp.ts`, BER/ASN.1 manual                                                       |
| SSH embebido                                  | `modules/field-network/.../FieldNetworkModule.kt` y catálogo de comandos                       |
| No guardar contraseñas en texto plano         | SecureStore/Android Keystore; recordar optativo; eliminación disponible                        |
| Fotos y lector QR                             | expo-camera / ML Kit, equivalente del stack sugerido                                           |
| GPS                                           | expo-location, equivalente del stack sugerido                                                  |
| PDF                                           | expo-print y HTML propio, equivalente del stack sugerido                                       |
| WatermelonDB                                  | SQLite nativo, escritores y batches atómicos; adaptador LokiJS/IndexedDB solo para preview web |
| Outbox persistente y NetInfo                  | Motor propio probado, conectividad LAN, resolución de conflictos y reintento                   |
| Capas separadas                               | Módulos de dominio, protocolos, almacenamiento, servicios, reporting, sync y UI                |
| Flujo incluye SNMP inicial                    | Se consulta cada equipo encontrado por el escaneo                                              |
| Registro incluye PDF y cola                   | Se persiste primero; se genera PDF y queda acción con reintento ante error                     |

## Entregables

| Entregable                       | Archivo / estado                                                                                          |
| -------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Código fuente en repositorio Git | Repositorio local inicializado en esta carpeta; sin publicación remota                                    |
| APK de prueba                    | `deliverables/fieldkit-1.0.0.apk`, release arm64-v8a de 29,66 MiB; compilación y firma verificadas              |
| Documento técnico                | `docs/TECNICO.md`                                                                                         |
| Backend mínimo                   | `backend/server.mjs`, persistencia e integración de adjuntos                                              |
| Video demo con equipo real       | Guía en `docs/DEMO.md`. No se presenta una simulación como evidencia física; grabación de campo pendiente |
| Verificación de entrega          | `docs/VERIFICACION.md`                                                                                    |

No se requieren servicios pagos ni credenciales externas para ejecutar las pruebas del protocolo y del backend. Para las pruebas físicas se requiere un equipo con SNMP v1/v2c habilitado y un servidor SSH administrado por el técnico.
