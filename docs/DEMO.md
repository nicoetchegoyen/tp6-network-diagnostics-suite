# Prueba desde iPhone y guion de video

Para grabar mostrando únicamente las pantallas, seguir [el paso a paso del video sin voz](VIDEO_SIN_VOZ.md).

## Preparación

1. PC y iPhone en la misma red; iniciar `npm start` y dejar la terminal abierta.
2. Escanear QR con Cámara de iOS, abrir Expo Go y permitir Red local si se solicita.
3. En Ajustes, completar técnico y sitio. Probar conexión al servidor que se configuró automáticamente.
4. Para equipo real, configurar community y puerto SNMP del router. La PC debe llegar a su IP. Para un laboratorio sin router administrable, `npm run lab` inicia un agente identificado como fixture en UDP/1161 en la PC; no confundir sus contadores sintéticos con evidencia física.
5. Para SSH, disponer de equipo/servidor autorizado y contrastar la huella por otro canal antes de aceptarla.

## Recorrido de 3–5 minutos

| Paso                                                      | Evidencia visible                                        |
| --------------------------------------------------------- | -------------------------------------------------------- |
| Mostrar iPhone, PC y equipo, indicar que se usa un puente | Alcance real de esta adaptación                          |
| Escanear LAN de la PC                                     | IP y fecha de un host que responde; no equipo precargado |
| Abrir equipo y consultar SNMP                             | Nombre, uptime, interfaces y bytes acumulados            |
| Verificar huella y ejecutar SSH                           | Comando de consulta, salida y estado real                |
| Leer QR, por ejemplo RB750GR3                             | Código asociado y ficha descargada/cacheada              |
| Registrar instalación                                     | Foto real, GPS/precisión, notas y técnico/sitio          |
| Abrir/compartir PDF                                       | Imágenes y datos de la visita, sin depender del servidor |
| Dejar backend inaccesible y guardar otra visita           | Registro disponible en historial y acción pendiente      |
| Recuperar conexión y volver al primer plano               | Envío automático, cola vacía y adjuntos en servidor      |

Para desconectar el servidor sin cerrar Metro, se puede cambiar temporalmente su URL en Ajustes a un puerto sin servicio y luego restaurarla. Al guardar la URL correcta se reintenta; Sincronizar ahora permite forzar inmediatamente. Para demostrar NetInfo, desactivar/reactivar Wi-Fi y volver a Expo Go con la app ya cargada. El GPS puede funcionar sin Internet, pero puede demorar en interiores. Recargar el bundle o abrir un proyecto por primera vez necesita acceso a Metro.

Activar el grabador de pantalla desde el Centro de control del iPhone. Evitar mostrar contraseñas y datos reales de clientes. No hay un video físico incluido: debe grabarse con el dispositivo disponible.

## Comprobaciones adicionales

- Negar y luego habilitar permisos de cámara/ubicación; comprobar mensajes y reintento.
- Guardar datos, cerrar/abrir el proyecto sin borrar Expo Go y comprobar persistencia.
- Usar la misma IP en dos sitios; comprobar equipos e historiales separados.
- Cambiar huella SSH; verificar rechazo antes de autenticar.
- Mantener el servidor inaccesible durante más de ocho intentos; comprobar que la acción sigue pendiente y se recupera.
- Revisar el PDF con notas largas y caracteres `<>&` como texto.
- Reiniciar backend/repetir actionId; comprobar que no duplica la entidad.
