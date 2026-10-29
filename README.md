# Network Diagnostics Suite

Aplicación Android para descubrir equipos en una LAN, consultar su estado por SNMP, ejecutar diagnósticos SSH y registrar instalaciones con fotos, ubicación y reportes PDF. Los registros se guardan localmente y se sincronizan al recuperar conectividad.

Desarrollada con React Native, TypeScript, módulos nativos Android y WatermelonDB sobre SQLite.

## Funciones

- Descubrimiento mDNS y sondeo TCP/UDP de subredes IPv4.
- Cliente SNMP v1/v2c con encoder y parser BER propios: nombre, uptime y contadores de interfaces.
- SSH embebido con verificación de huella y comandos predefinidos.
- Lectura de QR/barras y consulta de fichas técnicas.
- Instalaciones con notas, fotos georreferenciadas y PDF disponible sin conexión.
- Historial por equipo/sitio y outbox con reintentos y resolución de conflictos.

## Compilación

Requisitos: Node.js 24, JDK 17, Android SDK 37, Build Tools 37.0.0 y NDK 27.1.12297006. Configurar `JAVA_HOME` y `ANDROID_HOME`.

```powershell
npm ci
npm run build:apk
```

El script de Windows genera el APK y su SHA-256 en `deliverables/`. Incluye las arquitecturas arm64-v8a y x86_64 y usa una firma de prueba. Para desarrollo se dispone de `npm run android` y `npm start`, con una compilación nativa instalada.

## Backend

Servidor Node para catálogo, sincronización, versiones y adjuntos:

```powershell
$env:SYNC_TOKEN = "fieldkit-demo-local"
npm run backend
```

Escucha en el puerto 8790. En el emulador, configurar `http://10.0.2.2:8790` y el mismo token. En un teléfono de la LAN, usar la IP de la computadora. HTTP se admite para el laboratorio; un despliegue externo requiere HTTPS y autenticación adecuada.

SNMP y SSH se ejecutan dentro del APK. El backend recibe registros, fotos y reportes.

## Agente SNMP de laboratorio

`npm run lab:host` inicia un agente de Windows en UDP/1162 con community `public`. Lee el nombre de la PC, sus interfaces y los contadores reales con `Get-NetAdapterStatistics`. En la app se puede consultar ese puerto o usar el 161 para otro agente SNMP.

## Pruebas

```powershell
npm run typecheck
npm test
```

Las pruebas cubren BER/SNMP, UDP real, identificación de equipos, persistencia, outbox, conflictos y backend con adjuntos. La demostración se realizó en Android Emulator; cámara y GPS simulados se identifican en la interfaz y en los reportes.

## Documentación y APK

- [Documento técnico](docs/TECNICO.md).
- [Documento técnico en PDF](docs/TECNICO.pdf).
- [APK de prueba](https://github.com/nicoetchegoyen/tp6-network-diagnostics-suite/releases/latest).
