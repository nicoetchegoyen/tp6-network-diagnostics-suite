# Fieldkit · Network Diagnostics Suite

Aplicación Android en **React Native + TypeScript**, desarrollada a partir de `TP6_Network_Diagnostics_Suite.pdf`. El proyecto incluye código nativo Kotlin, cliente SNMP propio, almacenamiento WatermelonDB, backend persistente, pruebas y documentación.

## Inicio rápido

Requisitos: Node.js 20.19 o superior, npm, JDK 17 y Android SDK 36. Se usó Node 24. El lockfile fija las dependencias. No funciona con Expo Go: utiliza sockets y SSH nativos.

```powershell
npm ci
npm test
npm run typecheck
npm run backend
```

En otra terminal, para desarrollo con un Android conectado y depuración USB habilitada:

```powershell
npm run android
```

El APK de prueba, cuando se compila, se copia a `deliverables/fieldkit-1.0.0.apk`. Se instala sin Metro y funciona offline. Es una compilación release con firma **de desarrollo**; no es una firma de distribución comercial. Su ABI es **arm64-v8a**.

```powershell
npm run build:apk
```

Si no tenés JDK/SDK instalados, `scripts/bootstrap-android.ps1` prepara un toolchain aislado dentro de `.tools/`. Descarga OpenJDK y Android SDK y acepta las licencias necesarias para el entorno local de compilación. No modifica variables globales ni requiere Android Studio. Se aconseja disponer de al menos 10 GB libres y cerrar tareas pesadas al compilar.

## Primer uso

1. Conectar el teléfono al Wi-Fi del sitio. La LAN puede funcionar sin Internet.
2. Abrir Ajustes y completar técnico y sitio. Para el backend, usar la **IP LAN de la PC**, por ejemplo `http://192.168.1.10:8787`. `localhost` en el teléfono apunta al teléfono.
3. Configurar community, versión SNMP, puerto UDP y timeout. Para equipos reales, el puerto habitual es 161.
4. Escanear la subred. Se combinan mDNS/Bonjour y sondeo TCP/UDP. Cada equipo encontrado recibe una consulta SNMP inicial. También se puede agregar una IP manualmente.
5. Abrir un equipo para consultar interfaces, ejecutar comandos SSH y asociar un QR/código de barras a una ficha técnica.
6. Registrar una instalación con sitio, técnico, notas, GPS y al menos una foto. El reporte PDF se genera y se conserva localmente.
7. Revisar la cola. La sincronización se dispara al reconectar, al volver a primer plano y cada 20 segundos mientras la app está activa. No requiere que Internet funcione si el backend está en la LAN.

En SSH hay que verificar la huella SHA-256 del servidor con una fuente confiable antes de aceptarla. Solo se envía la contraseña si la clave presentada coincide con la huella aceptada. La opción “Recordar en Keystore” es optativa y puede revocarse desde la ficha del equipo.

## Backend de laboratorio

Sin dependencias externas. Persiste entidades y recibos en `backend/data/state.json`; los adjuntos se guardan por hash SHA-256 en `backend/data/assets/`.

```powershell
$env:SYNC_TOKEN = 'un-token-de-laboratorio'
npm run backend
```

Copiar el mismo token en Ajustes. Si no se configura, el stub funciona sin autenticación. El servicio escucha en `0.0.0.0:8787`; las reglas del firewall de Windows pueden requerir habilitar acceso desde la red privada. No es un backend listo para exposición pública. Usar HTTPS para despliegues fuera del laboratorio.

| Ruta                     | Uso                                                      |
| ------------------------ | -------------------------------------------------------- |
| `GET /v1/health`         | Disponibilidad y cantidad de entidades                   |
| `GET /v1/catalog/:code`  | Ficha técnica; ejemplos `RB750GR3`, `HG8245H`, `LAB-001` |
| `POST /v1/sync`          | Acción idempotente con versión base y adjuntos           |
| `GET /v1/entities`       | Inspección de registros recibidos                        |
| `GET /v1/assets/:sha256` | Descarga autenticada de un adjunto                       |

La ficha es un catálogo mínimo de prueba, no una integración con una API comercial de fabricantes. Un código desconocido se asocia al equipo aunque todavía no tenga ficha; se puede volver a consultar cuando exista conectividad. Un QR puede contener texto, JSON con `serial`/`code`/`model`, o una URL con identificador. La aplicación extrae el código y no navega automáticamente a la URL del QR.

## Agente SNMP para pruebas reproducibles

```powershell
npm run lab
```

En la app, agregar la IP de la PC y configurar UDP **1161**, community `public`, SNMP v2c. El agente devuelve el hostname real de la PC y dos interfaces de **laboratorio** con contadores sintéticos, identificadas como tales. El agente sirve para validar el transporte y el parser, y no sustituye la prueba final con un router, ONT o switch real.

## Verificaciones

```powershell
npm test
npm run typecheck
npx expo export --platform web --max-workers 2
```

Las pruebas verifican un vector BER independiente, paquetes truncados, OIDs multi-byte, Counter64, correlación de respuestas, GETNEXT, transporte UDP real en loopback, reintentos, concurrencia, conflictos, autenticación HTTP, persistencia tras reiniciar el backend y recepción de adjuntos. La vista web permite revisar navegación y formularios con WatermelonDB/IndexedDB. No tiene acceso a sockets, SSH, evidencia persistente ni generación nativa de PDF; no presenta mediciones simuladas como reales.

## Documentación y entrega

- [Documento técnico](docs/TECNICO.md): arquitectura, SNMP, credenciales, outbox, seguridad y límites.
- [Matriz de requisitos](docs/REQUISITOS.md): trazabilidad de RF-01 a RF-08 y entregables.
- [Guía de prueba y video](docs/DEMO.md): validación de campo paso a paso, criterios de aceptación y grabación.
- [Estado de verificación](docs/VERIFICACION.md): resultados observados y verificaciones que necesitan hardware.

La validación final de descubrimiento en una LAN física, SSH contra equipos de campo, fotos/GPS en Android y el video de la visita requieren un teléfono y equipos accesibles. Esas evidencias no se sustituyen por datos de ejemplo.
