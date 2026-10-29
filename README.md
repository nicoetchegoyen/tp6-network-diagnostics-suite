# Fieldkit · Network Diagnostics Suite

TP6 de Desarrollo de Aplicaciones Móviles. Entrega principal: **APK Android 1.1.0**, React Native y TypeScript, con sockets TCP/UDP, cliente SNMP propio, SSH embebido, WatermelonDB, evidencia, PDF y sincronización offline.

Repositorio: [nicoetchegoyen/tp6-network-diagnostics-suite](https://github.com/nicoetchegoyen/tp6-network-diagnostics-suite). Es privado: el docente necesita acceso o una copia de las fuentes como respaldo.

## Abrir sin teléfono Android

En esta PC, hacer doble clic en **INICIAR_ANDROID.cmd**. Abre el emulador Fieldkit_TP6, instala el APK actual e inicia el backend y el agente SNMP de Windows. Después ejecutar **PREPARAR_GPS.cmd** para enviar una ubicación de ejemplo simulada.

- [Abrir y configurar el emulador](docs/ANDROID_SIN_TELEFONO.md).
- [Grabar el video sin hablar](docs/VIDEO_ANDROID_SIN_VOZ.md).
- [Archivos que se entregan](docs/ENTREGA.md).
- [Documento técnico Android](docs/TECNICO_ANDROID.md).
- [Verificación y límites de la prueba](docs/VERIFICACION_ANDROID.md).

El APK incluye JavaScript/Hermes y no necesita Metro ni Expo Go. La PC se usa como backend de sincronización y como equipo SNMP de demostración. Los sockets SNMP/SSH se abren dentro de Android; no atraviesan el puente HTTP de la adaptación anterior.

## Alcance de la demostración

El agente `scripts/snmp-host-agent.ts` consulta interfaces y contadores reales con `Get-NetAdapterStatistics` de Windows y responde en UDP/1162. La PC física es el equipo consultado; no se presenta como router. Sus índices de interfaz y contadores no son los fixtures del agente anterior en UDP/1161.

El emulador usa cámara y ubicación simuladas. La app y el PDF lo indican expresamente. Esta prueba no acredita uso de cámara/GPS ni instalación en un Android físico; la aceptación de la demostración en emulador corresponde al docente.

## Desarrollo y compilación

Entorno: Node.js 24, Expo SDK 58, React Native 0.88, React 19.3, JDK 17, Android SDK y NDK 27.1.12297006. Las dependencias exactas están fijadas en `package-lock.json`.

```powershell
npm ci
npm run typecheck
npm test
npm run build:apk
npm run demo:android
```

El build de Windows utiliza las herramientas de `.tools/`, un alias temporal de ruta y una corrección idempotente del cálculo de rutas de React Native. No requiere cambiar el registro de Windows. El APK universal contiene `arm64-v8a` y `x86_64`, para teléfonos de prueba y el emulador de esta PC. Lleva firma de desarrollo y no se distribuye como una aplicación de producción.

Backend de Android sin abrir el emulador: `npm run backend:android`. Solo sincroniza entidades, fotos y PDF, y sirve el catálogo; el puente de diagnósticos está deshabilitado en ese proceso. URL desde el emulador: `http://10.0.2.2:8790`; token público de laboratorio: `fieldkit-demo-local`. Usar HTTPS y autenticación adecuada antes de exponer un backend fuera del laboratorio.

## Organización

| Carpeta                  | Contenido                                                               |
| ------------------------ | ----------------------------------------------------------------------- |
| `src/`                   | Interfaz, protocolo BER/SNMP, evidencia, WatermelonDB y motor de outbox |
| `modules/field-network/` | Módulo Android: UDP/TCP, mDNS, SSH, detección de emulador y visor PDF   |
| `android/`               | Proyecto nativo actual generado con SDK 58                              |
| `backend/`               | Sincronización persistente, idempotencia, adjuntos y conflictos         |
| `scripts/`               | Compilación, emulador, servicios de demostración y agente de Windows    |
| `tests/`                 | Pruebas de protocolo, persistencia, cola, seguridad y transporte        |
| `deliverables/`          | APK, hashes, guías/evidencia distribuidas y video cuando se grabe       |
| `legacy/`                | Proyecto Android anterior SDK 54, conservado como historial             |

## Vista complementaria en iPhone

`npm start` conserva la adaptación de Expo Go SDK 58 mediante un puente de red en la PC. Su almacenamiento es Expo SQLite y sus diagnósticos salen de la computadora. Esa vista no sustituye la entrega Android. Ver [la guía complementaria](docs/EXPO_GO_COMPLEMENTARIA.md). Los documentos `TECNICO.md`, `REQUISITOS.md`, `DEMO.md` y `VIDEO_SIN_VOZ.md` describen esa adaptación anterior; las guías Android enlazadas arriba son las correspondientes a la entrega actual.
