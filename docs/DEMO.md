# Prueba de campo y guion de video

## Preparación

Usar un teléfono Android arm64 (Android 7+), un router/ONT/switch de laboratorio con SNMP habilitado, SSH habilitado y credenciales autorizadas, una red Wi-Fi sin aislamiento de clientes y una PC en esa misma LAN.

1. Instalar `deliverables/fieldkit-1.0.0.apk`.
2. Ejecutar `npm run backend` en la PC. Anotar su IPv4 con `ipconfig` y usar `http://IP_DE_LA_PC:8787` en la app. Si el firewall bloquea el acceso, permitir el proceso Node solo en la red privada de prueba.
3. En Ajustes, indicar técnico/sitio y la community real del dispositivo. Dejar UDP/161 para un equipo físico; para el agente incluido usar 1161 y ejecutar `npm run lab`.
4. Verificar la huella SSH por consola u otro canal confiable. En un Linux de laboratorio puede obtenerse con `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub -E sha256`.

## Video propuesto (3 a 5 minutos)

| Tiempo aproximado | Acción                                                                     | Criterio visible                                                                  |
| ----------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 0:00–0:30         | Mostrar el dispositivo real y la subred, iniciar escaneo                   | Al menos un host real encontrado, IP y timestamp; no usar un equipo precargado    |
| 0:30–1:10         | Abrir el equipo y consultar SNMP                                           | sysName, uptime y contadores de una interfaz coinciden con el equipo              |
| 1:10–1:40         | Verificar huella y ejecutar un comando SSH                                 | Salida real y código de retorno; evitar mostrar la contraseña                     |
| 1:40–2:00         | Escanear QR o barras y asociar ficha                                       | Código y ficha cacheada; `RB750GR3` está en el catálogo de prueba                 |
| 2:00–3:00         | Dejar el backend inaccesible sin desconectar la LAN; registrar instalación | Foto real, permiso de GPS, coordenadas/precisión, notas y PDF generado localmente |
| 3:00–3:30         | Mostrar historial y cola; reiniciar app si se desea                        | Datos y acciones persisten sin backend                                            |
| 3:30–4:00         | Restablecer backend y esperar o tocar sincronizar                          | Cola se vacía, servidor contiene reporte y adjuntos                               |

Para demostrar pérdida de backend sin perder acceso SNMP, detener Node en la PC. Para demostrar reconexión de NetInfo, desactivar/reactivar Wi-Fi y volver a la app. Si se activa modo avión, volver a habilitar Wi-Fi para diagnosticar la LAN. La ausencia de Internet no debe impedir usar el backend LAN.

El video debe mostrar datos de laboratorio y no divulgar credenciales ni información privada de clientes. El agente incluido identifica explícitamente sus valores sintéticos. No usarlo como sustituto de la evidencia de un router real si la evaluación exige hardware de red físico.

## Comprobaciones adicionales

- Negar cámara y GPS: mostrar mensaje claro y permitir reintentar después de habilitar permisos.
- Cambiar la clave de host SSH en un servidor de prueba: la ejecución debe ser rechazada hasta verificar la nueva huella.
- SNMP sin respuesta: registrar error sin bloquear navegación ni guardar un éxito falso.
- Reiniciar el backend y reenviar un mismo actionId: confirmar que la entidad no se duplica.
- Crear un conflicto enviando una versión distinta desde otra instancia del laboratorio: comprobar que aparecen ambas versiones y que se puede elegir.
- Generar un PDF con notas largas, comillas y caracteres `<>&`: debe imprimirse texto, sin interpretar HTML.
- Verificar las fotografías y el GPS impreso en todas las páginas del reporte antes de entregar el video.

## Grabación Android

Se puede usar el grabador de pantalla integrado del teléfono. Con ADB, una alternativa es:

```powershell
adb shell screenrecord --time-limit 180 /sdcard/fieldkit-demo.mp4
adb pull /sdcard/fieldkit-demo.mp4 deliverables/fieldkit-demo.mp4
```

No hay un video físico incluido porque el entorno de desarrollo no tenía un teléfono conectado. Esta guía deja identificadas las evidencias que faltan registrar sin inventarlas.
