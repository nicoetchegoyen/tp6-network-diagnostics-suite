# Abrir Fieldkit en Android sin tener un teléfono

La entrega principal es el APK Android **1.1.0**, con red nativa y WatermelonDB. Expo Go en iPhone queda como una vista complementaria. El emulador ejecuta el APK instalable y no necesita Metro ni Expo Go.

## Abrir en esta PC

1. Abrir la carpeta del proyecto en el Explorador de Windows.
2. Hacer doble clic en **INICIAR_ANDROID.cmd**.
3. Esperar el teléfono virtual llamado **Fieldkit_TP6**. La primera apertura puede tardar unos minutos.
4. El iniciador instala el APK, abre Fieldkit e inicia el backend y el agente SNMP. Mantener abierta la ventana de la consola que muestra esos servicios.
5. Hacer doble clic en **PREPARAR_GPS.cmd**. Envía al emulador un punto de ejemplo de Buenos Aires, expresamente simulado.

La configuración y los registros del Android virtual se conservan al cerrarlo. El iniciador puede ejecutarse otra vez sin borrar los datos. No usar opciones para borrar el dispositivo virtual antes de conservar los reportes necesarios.

## Configurar la app antes de grabar

En el engranaje de Ajustes completar:

| Campo                     | Valor para esta demostración |
| ------------------------- | ---------------------------- |
| Técnico                   | Tu nombre                    |
| Sitio                     | Laboratorio TP6              |
| URL del servidor          | `http://10.0.2.2:8790`       |
| Token de laboratorio      | `fieldkit-demo-local`        |
| SNMP                      | v2c                          |
| Community                 | `public`                     |
| Puerto SNMP               | `1162`                       |
| Timeout                   | `1500` ms                    |
| Sincronización automática | Activada                     |

Tocar **Probar conexión**, comprobar el resultado y luego **Guardar ajustes**. La dirección `10.0.2.2` conecta el Android virtual con esta computadora; no es una dirección para usar desde el iPhone.

En **Red local**, ingresar la IP LAN de la PC seguida de `/32`. En esta red se usó **192.168.1.4/32**. Si cambia la IP de la PC, usar la nueva. Tocar **Escanear red local**, abrir el resultado y **Consultar SNMP**. Deben aparecer el nombre de la PC y las interfaces reales de Windows, entre ellas Ethernet. Los contadores son Counter32 y pueden volver a cero al alcanzar 2^32 bytes; se informa el acumulado de 32 bits, no una velocidad.

El agente consulta Windows cada cinco segundos, sin superponer lecturas. Si Windows tarda o deja de responder, no se generan contadores de reemplazo. El puerto `1161` corresponde al agente antiguo de datos de prueba; para este recorrido usar `1162`.

## Cámara y ubicación

Aceptar los permisos de cámara y ubicación mientras se usa la app. El Android virtual usa una escena de cámara simulada. Al tomar una foto, esperar la miniatura y las coordenadas antes de continuar. El PDF identifica las ubicaciones simuladas y las capturas de demostración.

El servicio de demostración mantiene reciente la señal GPS simulada, incluso con los radios de Android apagados. Si el GPS demora, ejecutar otra vez **PREPARAR_GPS.cmd** mientras el formulario está abierto y reintentar. Si la cámara no muestra imagen, tocar **Reintentar cámara** o **Usar frontal**. La cámara emulada puede mostrar un patrón con fecha/hora. Esta prueba no acredita cámara ni GPS de un teléfono físico.

Para demostrar la cola offline, abrir **SIN_CONEXION.cmd** y esperar el indicador Offline. Para volver a conectar, abrir **RECONECTAR.cmd** y esperar En red. No cerrar el backend durante este recorrido.

## Grabar sin hablar

Seguir [VIDEO_ANDROID_SIN_VOZ.md](VIDEO_ANDROID_SIN_VOZ.md). Hacer doble clic en **GRABAR_VIDEO.cmd**, volver al emulador y hacer el recorrido. Al terminar, regresar a la consola de grabación y presionar **Enter**. El video WebM se guarda en `deliverables/`; una toma anterior se conserva agregando fecha y hora al nuevo archivo. Se captura solamente la pantalla virtual y no hace falta hablar. Como alternativa, usar **Ctrl + Shift + R** y los controles Record and Playback del propio emulador.

## Volver a instalar en otra PC

Instalar Node.js y las herramientas Android, ejecutar `npm ci` y preparar el entorno:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/bootstrap-android.ps1
```

Instalar además, mediante el SDK Manager, `emulator`, `system-images;android-35;default;x86_64`, `platforms;android-37.0` y `build-tools;37.0.0`. Ejecutar `npm run build:apk` si no se dispone del APK distribuido y luego `npm run demo:android`.

Se necesita virtualización habilitada y Windows Hypervisor Platform disponible. En esta PC se comprobó WHPX instalado. No se debe presentar esta demostración en emulador como una prueba en un Android físico; la aceptación académica de ese reemplazo corresponde al docente.
