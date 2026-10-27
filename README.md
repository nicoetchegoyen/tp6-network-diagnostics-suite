# Fieldkit · Network Diagnostics Suite

Aplicación React Native y TypeScript adaptada para **iPhone con Expo Go**, por pedido del usuario. No requiere Android, Xcode ni una cuenta paga de Apple para abrirla desde Expo Go instalado desde la tienda.

## Abrir en el iPhone

1. Conectar el iPhone y la computadora a la misma red Wi-Fi/LAN.
2. En esta carpeta, ejecutar:

```powershell
npm ci
npm start
```

3. Escanear el QR de la terminal con la **cámara del iPhone** y abrir en Expo Go. El mismo QR se guarda en `deliverables/expo-go-qr.png`.
4. Aceptar el permiso de **red local** si iOS lo solicita. Cámara y ubicación se solicitan al usar esas funciones.
5. En Ajustes, completar **técnico y sitio de trabajo**. El servidor y su acceso se configuran automáticamente al iniciar con `npm start`.

Mantener la terminal abierta. `Ctrl+C` detiene Expo y su servidor. El QR apunta al servidor de desarrollo de la computadora; no publica una aplicación permanente en una tienda. Si Expo Go solicita iniciar sesión, usar la misma cuenta de Expo en el teléfono y en Expo CLI.

El proyecto usa **Expo SDK 58** para coincidir con Expo Go SDK 58.0.0 instalado en el iPhone del usuario. La versión de la app y la de Expo Go deben coincidir. Las dependencias se fijan en el lockfile. Requisitos recomendados de la computadora: Node.js 24.3+ y npm; entorno verificado con Node 24.15. [Guía oficial de actualización](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/).

## Qué funciona y dónde

| En el iPhone con Expo Go                   | Mediante la computadora                                 |
| ------------------------------------------ | ------------------------------------------------------- |
| Alta manual de equipos y sitios            | Descubrimiento mDNS y sondeo TCP/UDP de la LAN de la PC |
| Cámara, QR y códigos de barras             | Transporte de datagramas SNMP reales a los equipos      |
| GPS y notas de instalación                 | Sesiones SSH reales con verificación de huella          |
| PDF con fotos y ubicación, compartir       | Catálogo remoto y sincronización persistente            |
| SQLite, historial, borrador y cola offline | Recepción de fotos y PDF para respaldarlos              |

El encoder/parser SNMP sigue siendo propio y se ejecuta en TypeScript en la app. El puente transporta sus bytes por UDP desde la PC. **No se presentan mediciones simuladas como reales.** La app informa que el diagnóstico sale de la computadora. Sin puente, se pueden registrar equipos, capturar evidencia, generar reportes y consultar el historial; las consultas de red muestran el error correspondiente.

Esta adaptación cambia la arquitectura pedida originalmente en el PDF: Expo Go no admite agregar módulos nativos propios. El puente HTTP sustituye el acceso directo a sockets/SSH desde el celular, SQLite de Expo sustituye WatermelonDB y el destino principal es Expo Go, en lugar del APK. Ver la comparación explícita en `docs/REQUISITOS.md`.

## Si no conecta

- Revisar que la computadora siga ejecutando `npm start` y que no haya aislamiento de clientes en el Wi-Fi.
- En iOS, habilitar Red local para Expo Go. Si Windows solicita acceso a Node, permitirlo en la red privada usada para la prueba.
- La terminal muestra la dirección del servidor. `localhost` y `127.0.0.1` en el iPhone apuntan al propio teléfono, no a la PC.
- Si hay varias interfaces/VPN y Expo elige otra red, iniciar con `$env:REACT_NATIVE_PACKAGER_HOSTNAME='IP_DE_LA_PC'` antes de `npm start`.
- La URL cambia si cambia la IP de la PC. Reiniciar `npm start` genera un QR nuevo; revisar la URL guardada en Ajustes si ya se había usado otra.
- El inicio usa puerto 8083 para Expo y el primero libre entre 8787 y 8797 para el servidor. Se pueden fijar `EXPO_PORT` y `FIELDKIT_PORT`.

El token del laboratorio se genera en `.cache/companion-token`, se reutiliza al reiniciar y se entrega a la app como variable pública de desarrollo. Es una clave de emparejamiento de este entorno local; no es un secreto de producción. No se versiona. El puente solo acepta IPv4 privadas/loopback y comandos de consulta predefinidos. Usar HTTPS y autenticación adecuada antes de exponerlo fuera de la LAN.

## Comprobaciones

```powershell
npm run typecheck
npm test
npx expo install --check
npx expo export --platform ios --output-dir tmp/expo-go-ios
```

Las pruebas usan sockets UDP y un servidor SSH real de prueba en loopback, además de verificar persistencia, atomicidad, reintentos prolongados y conflictos. No equivalen a haber usado la cámara/GPS de un iPhone físico; la comprobación final se hace al escanear el QR.

`npm run lab` inicia el agente SNMP incluido en UDP/1161. Sus contadores son fixtures identificados como laboratorio. Configurar puerto 1161 en la app y agregar la IP de la computadora para probar el transporte. Para medir un router real, usar su IP, su community y el puerto configurado en ese equipo.

## Archivos

- `docs/TECNICO.md`: protocolo, seguridad y cola.
- `docs/REQUISITOS.md`: requisitos y diferencias de Expo Go.
- `docs/DEMO.md`: prueba y grabación desde iPhone.
- `docs/VERIFICACION.md`: comprobaciones y pendientes físicos.
- `backend/server.mjs` y `backend/network.mjs`: sincronización y puente.

El APK `deliverables/fieldkit-1.0.0.apk` y el módulo Kotlin son artefactos de la versión Android anterior. Ese APK no contiene la adaptación actual y no se utiliza en el iPhone. El proyecto nativo anterior se conserva en `legacy/android-sdk54/`; sus scripts se reproducen desde la revisión histórica indicada en `legacy/README.md`.
