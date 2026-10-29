# Video sin voz: APK Android en emulador

Duración orientativa: 4 a 6 minutos. Grabar la pantalla del Android virtual. El video debe dejar visible que se usa un emulador, que SNMP consulta la PC física y que cámara/GPS son simulados. El resultado de laboratorio no acredita una visita de campo.

## Antes de grabar

1. Abrir **INICIAR_ANDROID.cmd**, esperar Fieldkit y mantener los servicios abiertos. Ejecutar **RECONECTAR.cmd** y **PREPARAR_GPS.cmd**.
2. Completar Ajustes según [ANDROID_SIN_TELEFONO.md](ANDROID_SIN_TELEFONO.md). Probar conexión y guardar.
3. Ensayar el escaneo de `192.168.1.4/32` y la consulta SNMP en UDP/1162. Deben verse el nombre de esta PC, su descripción de agente real de Windows y las interfaces con contadores.
4. Ensayar una instalación con foto y ubicación. Aceptar los permisos antes de la grabación. Comprobar que el PDF se pueda abrir o compartir; conservar un reporte de ejemplo.
5. Con conexión, entrar en **Cola**, tocar **Sincronizar ahora** y esperar la cola vacía. Volver a **Red local**.
6. Hacer doble clic en **GRABAR_VIDEO.cmd**. Cuando indique que graba, volver al emulador y realizar el recorrido. Mantener abierta esa consola: al terminar se vuelve allí y se presiona **Enter** para guardar. Se graba solamente la pantalla del Android virtual, sin voz.

Valores en Ajustes: técnico (tu nombre), sitio **Laboratorio TP6**, servidor **http://10.0.2.2:8790**, token **fieldkit-demo-local**, SNMP **v2c**, community **public**, puerto **1162**, timeout **1500** y sincronización automática activada. Tocar **Probar conexión** y **Guardar ajustes**. No usar Expo Go para este recorrido.

## Durante el video

| Paso                 | Acciones                                                                                                                                                | Resultado que debe quedar visible                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 1. Presentación      | Mostrar Red local y la tarjeta **Demostración en emulador** durante 6 segundos.                                                                         | APK Android; cámara y ubicación simuladas declaradas.                                                             |
| 2. Descubrimiento    | Ingresar la IP actual de la PC con `/32`, tocar **Escanear red local** y esperar. Abrir el resultado.                                                   | Equipo encontrado por una respuesta de red; no agregado manualmente durante esta escena.                          |
| 3. SNMP              | Tocar **Consultar SNMP** y recorrer despacio el resultado.                                                                                              | Estado Correcto, nombre, uptime del agente, descripción de PC real y contadores de Ethernet e interfaces Windows. |
| 4. Historial         | Cerrar el equipo y abrir **Historial**. Entrar en el diagnóstico recién realizado.                                                                      | Fecha, equipo, sitio y resultado persistido.                                                                      |
| 5. Desconexión       | En Windows, abrir **SIN_CONEXION.cmd** y volver al emulador. También se puede activar modo avión y apagar Wi-Fi/datos desde la barra de Android. | Indicador **Offline**. La grabación continúa capturando únicamente Android.                         |
| 6. Registro offline  | **Instalaciones → Nueva instalación**. Seleccionar la PC, completar sitio, técnico y las notas de abajo.                                                | Formulario completo mientras sigue Offline.                                                                       |
| 7. Evidencia offline | **Obtener ubicación GPS**. Esperar coordenadas. **Tomar foto georreferenciada → Capturar evidencia**. Esperar la miniatura.                             | Ubicación simulada identificada, foto de la escena del emulador y precisión.                                      |
| 8. Reporte y cola    | **Guardar y generar PDF**. Cerrar el aviso y entrar en **Cola**.                                                                                        | Instalación guardada y acciones pendientes sin conexión.                                                          |
| 9. PDF offline       | Volver a Instalaciones. Tocar **Ver PDF** y recorrer las páginas con Anterior y Siguiente.                                                              | Sitio, técnico, notas, foto, coordenadas y rótulo de ubicación simulada.                                          |
| 10. Persistencia     | Volver a la app y mostrar la instalación y el historial disponibles sin conexión.                                                                       | Los registros siguen accesibles.                                                                                  |
| 11. Reconexión       | En Windows, abrir **RECONECTAR.cmd**. Regresar a Fieldkit y entrar en **Cola**.                                                  | Indicador En red y sincronización automática hasta vaciar la cola.                                                |
| 12. Cierre           | Mostrar la cola vacía y volver a la instalación guardada.                                                                                               | Reporte conservado después de sincronizar.                                                                        |

Notas para copiar en la instalación:

> Prueba en emulador. PC real por SNMP. Foto y GPS simulados. PDF offline.

## Terminar y guardar

1. Volver a la consola de **GRABAR_VIDEO.cmd** y presionar **Enter**.
2. Esperar el mensaje **Video guardado**. El archivo queda en `deliverables/video-demo-android.webm`; si ya existe, se agrega fecha y hora para conservar la toma anterior.
3. Abrir el video y comprobar el recorrido completo y la ausencia de voz.
4. Hacer doble clic en **ARMAR_ENTREGA.cmd**. Reúne la última toma y los archivos en `deliverables/TP6_Entrega_Android_1.1.0.zip`. Revisar y entregar ese ZIP junto con el enlace Git. Los detalles están en [ENTREGA.md](ENTREGA.md).

Como alternativa, el grabador oficial se abre con **Ctrl + Shift + R** en la ventana del emulador: Record and Playback, Start recording, Stop recording, formato WebM y Save.

Dejar cada resultado entre 4 y 6 segundos, desplazarse lentamente y cerrar el teclado con el triángulo de Android cuando tape datos. Desplazar la pantalla hasta ver completos los botones antes de tocarlos. Si la cámara trasera simulada no da imagen, usar **Usar frontal**: también es una cámara emulada y puede mostrar un patrón con fecha/hora. Se pueden recortar esperas largas, conservando continua la secuencia de cola pendiente, reconexión y cola vacía. Si se agrega SSH al video, usar un servidor autorizado y contrastar su huella antes de ejecutar; el agente SNMP no crea un servidor SSH.

Grabador oficial del emulador: [Android Developers](https://developer.android.com/studio/run/emulator-record-screen).
