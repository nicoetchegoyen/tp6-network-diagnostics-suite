# Video de demostración sin voz

Duración orientativa: 5 a 7 minutos. Grabación vertical de la pantalla del iPhone. Los tiempos son orientativos: primero debe verse el resultado y después continuar.

Este recorrido usa la PC como agente SNMP de laboratorio y como puente de red para Expo Go. Las interfaces y sus contadores son datos de prueba identificados como tales; no equivalen a mediciones de un router físico. La consigna, página 8, solicita descubrimiento de un dispositivo real en la LAN, consulta SNMP exitosa, PDF con foto/GPS y sincronización al recuperar conectividad. La adaptación a Expo Go y el uso del agente de laboratorio deben quedar identificados al presentar el trabajo.

## Antes de grabar

1. **Mantener los dos servicios de la PC abiertos.** En esta computadora ya se dejaron iniciados. Si se retoma otro día, abrir dos terminales dentro del proyecto: `npm start` en una y `npm run lab` en otra. La terminal de Expo muestra la dirección actual de la PC; si cambia, actualizar las direcciones de esta guía.
2. **Conectar el iPhone a la misma red que la PC.** Abrir la versión actualizada desde el QR de Expo Go y aceptar el permiso de Red local si aparece.
3. **Completar Ajustes.** Técnico: tu nombre; sitio: `Laboratorio TP6`; servidor actual: `http://192.168.1.4:8787`; conservar el token cargado automáticamente; SNMP v2c, community `public`, UDP `1161`, timeout `1500`, sincronización automática activada. Tocar Probar conexión y luego Guardar ajustes.
4. **Preparar el equipo.** En Red local, agregar o seleccionar `192.168.1.4`. Puede llamarse `PC de laboratorio`. Consultar SNMP y comprobar que aparece Correcto, nombre del sistema y las interfaces `eth0` y `wlan0`. Resolver cualquier error antes de grabar.
5. **Abrir el QR del equipo en la pantalla de la PC:** [LAB-001](../deliverables/qr-equipo-LAB-001.png). Es el QR del equipo de laboratorio; el QR de Expo Go sirve para abrir la app.
6. **Hacer un ensayo completo.** Leer LAB-001 desde Ficha técnica. El lector se abre dentro de esa ficha; en iPhone selecciona la lente **0,5×** al iniciar, tanto para escanear como para tomar fotos. Comprobar que se vea la imagen y que el botón 0,5× esté seleccionado; si demora, tocar Reintentar cámara. Probar distintas distancias al QR hasta verlo nítido. Obtener ubicación, tomar una foto y generar un PDF de prueba. Aceptar los permisos antes de grabar. Si el GPS demora, elegir un lugar donde pueda obtener posición. Probar también la captura con una grabación corta para comprobar que cámara y PDF se vean.
7. **Preparar dónde guardar el PDF.** Desde Compartir PDF, probar Guardar en Archivos y elegir una ubicación local, por ejemplo En mi iPhone. Abrirlo desde Archivos para conocer el recorrido que se mostrará después sin conexión.
8. **Dejar la cola vacía.** Con Wi-Fi, entrar en Cola, tocar Sincronizar ahora y esperar a que no queden acciones. Volver a Red local y cerrar los formularios.
9. **Preparar la grabación.** Activar No molestar, usar orientación vertical y tener batería suficiente. En el Centro de control, mantener pulsado Grabación de pantalla y comprobar que Micrófono esté apagado. Iniciar la grabación y regresar a la app.

## Durante el video

| Paso                     | Qué tocar y mostrar                                                                                                                                                                             | Qué debe quedar visible                                                                                  | Tiempo aproximado |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------- |
| 1. Presentación          | Mostrar Red local y bajar hasta la tarjeta Expo Go · Conexión con tu computadora.                                                                                                               | Nombre de la app y explicación del puente en PC.                                                         | 10 s              |
| 2. Descubrimiento        | En Subred IPv4 / CIDR, usar `192.168.1.4/32` para sondear la PC. Tocar Escanear red local y esperar. Pueden aparecer también servicios mDNS de otros equipos. Abrir el resultado `192.168.1.4`. | Resultado del escaneo y dirección del equipo, sin agregarlo manualmente durante esta escena.             | 20–40 s           |
| 3. SNMP                  | Tocar Consultar SNMP. Desplazarse lentamente por el resultado.                                                                                                                                  | Correcto, nombre, tiempo activo, descripción del agente de laboratorio y contadores de ambas interfaces. | 25–40 s           |
| 4. Identificación        | Abrir Ficha técnica, tocar Escanear QR / código de barras y apuntar al QR LAB-001 abierto en la PC. Cerrar el aviso con OK si aparece.                                                          | Código asociado, ficha del Agente SNMP de prueba y ficha guardada sin conexión.                          | 20–30 s           |
| 5. Historial             | Cerrar el equipo, entrar en Historial y abrir el diagnóstico correcto más reciente.                                                                                                             | Equipo, sitio, fecha y resultado guardado.                                                               | 15–20 s           |
| 6. Desconexión           | Abrir el Centro de control, activar modo avión y comprobar que Wi-Fi esté apagado. Regresar a la app sin recargar el proyecto.                                                                  | Cambio del indicador de la app a Offline.                                                                | 10–15 s           |
| 7. Instalación offline   | Entrar en Instalaciones → Nueva instalación. Seleccionar la PC, completar sitio, técnico y las notas de abajo.                                                                                  | Formulario completo mientras continúa Offline.                                                           | 30–45 s           |
| 8. Evidencia offline     | Tocar Obtener ubicación GPS y esperar coordenadas. Tocar Tomar foto georreferenciada y fotografiar la computadora o equipo documentado. Volver al formulario.                                   | Coordenadas, precisión y miniatura de la foto.                                                           | 30–60 s           |
| 9. Guardado              | Tocar Guardar y generar PDF. Cerrar el aviso. Entrar en Cola.                                                                                                                                   | Instalación guardada y una o más acciones pendientes sin conexión.                                       | 15–25 s           |
| 10. PDF offline          | Volver a Instalaciones y tocar Compartir PDF. Guardarlo en Archivos en una ubicación local y abrirlo allí. Recorrer el documento despacio.                                                      | Sitio, técnico, notas, foto y coordenadas GPS en el PDF.                                                 | 30–45 s           |
| 11. Persistencia offline | Volver a Expo Go y mostrar brevemente Historial o la instalación registrada.                                                                                                                    | Los datos siguen accesibles sin conexión.                                                                | 10–15 s           |
| 12. Reconexión           | Abrir el Centro de control, desactivar modo avión, activar Wi-Fi y esperar conexión a la red de la PC. Volver a Expo Go y entrar en Cola.                                                       | Indicador En red; las acciones se sincronizan hasta quedar la cola vacía.                                | 20–40 s           |
| 13. Cierre               | Mostrar la cola vacía y regresar a la instalación guardada. Detener la grabación.                                                                                                               | Reporte conservado y sincronización completada.                                                          | 10 s              |

Notas listas para usar en la escena 7:

> Registro de prueba en laboratorio. Consulta SNMP realizada mediante el puente local. Se adjuntan fotografía y ubicación GPS. Instalación registrada sin conexión.

## Rótulos opcionales al editar

El recorrido puede mostrarse sin narración. Si se agregan rótulos, usar una sola frase por escena y dejarlos visibles el tiempo suficiente para leerlos:

1. `Fieldkit · Demo de laboratorio · Expo Go en iPhone`
2. `Descubrimiento de un equipo en la LAN mediante la PC`
3. `Consulta SNMP: nombre, uptime e interfaces · datos de laboratorio`
4. `Identificación por QR y ficha técnica guardada`
5. `Historial por equipo y sitio`
6. `Sin conexión: registro de instalación, foto y GPS`
7. `PDF generado localmente sin conexión`
8. `Acciones pendientes guardadas en el teléfono`
9. `Conectividad recuperada: sincronización automática`
10. `Reporte conservado y cola sincronizada`

## Cómo mostrar SSH si está preparado

Insertar esta escena después de SNMP solo cuando se disponga de un servidor SSH autorizado y se haya ensayado una ejecución correcta. Dentro del equipo, abrir SSH, comprobar la huella por otro canal, aceptarla y ejecutar Tiempo activo o un diagnóstico de consulta del fabricante correspondiente. Mostrar salida y código de retorno. Cargar las credenciales antes de grabar. El agente iniciado con `npm run lab` solo ofrece SNMP: no crea un servidor SSH.

## Para que la grabación quede clara

- Dejar cada resultado entre 4 y 6 segundos antes de cambiar de pantalla.
- Desplazarse despacio y cerrar el teclado cuando tape información.
- Recortar esperas largas del escaneo o del GPS si se edita el video.
- Mantener continua la parte de cola pendiente → reconexión → cola vacía para que se vea el cambio.
- Esperar el envío automático al volver a la app. Si se usa Sincronizar ahora, describirlo como reintento manual, no como sincronización automática.
- Mantener Expo Go cargado durante la parte offline. Abrir o recargar el proyecto requiere acceso al servidor de desarrollo.
- Revisar la grabación final: lectura legible, foto visible, coordenadas en el PDF y cola vacía al terminar.

## Referencias

- [Consigna del TP, entregables en página 8](../TP6_Network_Diagnostics_Suite.pdf).
- [Diferencias de la adaptación Expo Go](REQUISITOS.md).
- [Grabación de pantalla en iPhone — Apple](https://support.apple.com/es-es/guide/iphone/iph52f6e1987/ios).
