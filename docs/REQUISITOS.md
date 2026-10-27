# Comparación de requisitos · adaptación Expo Go

El usuario pidió priorizar **iPhone con Expo Go**. Esto modifica el destino de ejecución y algunas decisiones técnicas del PDF. La tabla distingue capacidades disponibles y cambios de arquitectura; no declara equivalencia completa con la consigna Android original.

| Requisito                         | Implementación para Expo Go                                                        | Límite / estado de comprobación                                                                                                                        |
| --------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| RF01 · Descubrimiento LAN         | mDNS y sondeo TCP/UDP desde la PC, lista en el iPhone                              | Requiere puente y acceso de la PC a la LAN. MAC no disponible; hostname solo si mDNS lo publica. No prueba el estado de la LAN del iPhone por sí sola. |
| RF02 · SNMP uptime/nombre/tráfico | BER propio en TypeScript y UDP real mediante la PC                                 | Protocolo y transporte probados con agente UDP en loopback; pendiente equipo de campo.                                                                 |
| RF03 · SSH                        | Sesión real desde la PC, huella fijada, comandos cerrados                          | Handshake, rechazo de huella y ejecución probados con servidor SSH local. Pendiente router real.                                                       |
| RF04 · QR/barras y ficha          | expo-camera en iPhone, catálogo remoto y caché                                     | Lectura física pendiente; catálogo de ejemplo reducido.                                                                                                |
| RF05 · Instalación/foto/GPS/notas | Captura y archivos privados en Expo Go, borrador persistente                       | Requiere permisos y prueba en iPhone.                                                                                                                  |
| RF06 · PDF                        | expo-print con fotos base64, GPS y compartir                                       | Paquete iOS compilado; captura y revisión del PDF en teléfono pendientes.                                                                              |
| RF07 · Offline/outbox             | SQLite de Expo, escrituras atómicas, reintentos sin agotarse, NetInfo y conflictos | Repositorio/motor/backend probados. Funciona con app activa; no servicio permanente con Expo Go cerrado.                                               |
| RF08 · Historial por equipo/sitio | Registros offline y IDs separados por sitio                                        | Regresión de IP repetida entre sitios probada.                                                                                                         |

## Cambios frente a la consigna original

| Punto                                              | Adaptación explícita                                                                                             |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| APK de prueba / no Expo Go                         | Se prioriza abrir mediante QR en Expo Go, por pedido del usuario. El APK anterior no representa esta adaptación. |
| TCP/UDP y SSH embebidos en el teléfono             | Se trasladan a un puente Node en la computadora, accedido por HTTP/HTTPS.                                        |
| WatermelonDB                                       | Se reemplaza por expo-sqlite y un repositorio propio, porque WatermelonDB requiere código nativo adicional.      |
| React Native, SNMP propio, evidencia, PDF y outbox | Se conservan las funcionalidades y la separación por capas.                                                      |
| Video de campo                                     | Se graba con el iPhone y se muestra explícitamente que la PC ejecuta los diagnósticos. Pendiente.                |

Los cambios permiten usar el hardware disponible, pero no satisfacen literalmente los puntos de APK, WatermelonDB y transporte directo del teléfono. Esta distinción debe acompañar la presentación académica.

## Archivos de entrega

Fuente en el repositorio privado [nicoetchegoyen/tp6-network-diagnostics-suite](https://github.com/nicoetchegoyen/tp6-network-diagnostics-suite), `README.md`, documentos de esta carpeta, backend y launcher `npm start`. El QR se regenera en `deliverables/expo-go-qr.png`. No se requiere una cuenta paga ni publicar en App Store para este flujo. La conexión al servidor de desarrollo debe mantenerse para cargar la app en Expo Go; una vez cargada, los registros y reportes locales pueden usarse sin el backend.
