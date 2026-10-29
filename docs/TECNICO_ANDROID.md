# Fieldkit 1.1.0 · Documento técnico Android

Trabajo práctico 6: Network Diagnostics Suite. Destino de entrega: APK Android instalable. La vista complementaria de Expo Go se conserva para iPhone, con un alcance distinto, y no sustituye el APK.

## 1. Arquitectura

| Capa          | Implementación del APK                                                        |
| ------------- | ----------------------------------------------------------------------------- |
| Presentación  | React Native 0.88, React 19.3 y TypeScript 6                                  |
| Discovery     | Android NsdManager para mDNS; sockets Java TCP/UDP para sondeo de subred      |
| Protocol      | Encoder/parser BER y cliente SNMP propio en TypeScript; UDP nativo            |
| Acceso remoto | JSch embebido en Android, huella de host fijada y comandos cerrados           |
| Evidence      | Módulos nativos Expo Camera, Location y FileSystem compilados dentro del APK  |
| Local Store   | WatermelonDB 0.28 sobre SQLite; repositorio serializado y escrituras atómicas |
| Sync          | Outbox persistente, NetInfo, reintentos, versiones y resolución de conflictos |
| Reporting     | HTML escapado, Expo Print, PDF local y visor Android PdfRenderer              |

El APK no depende de Expo Go. SNMP y SSH abren sockets dentro de Android mediante el módulo local `FieldNetwork`. HTTP se utiliza para sincronización y catálogo. El backend de demostración deshabilita el puente HTTP de diagnósticos, permitiendo distinguir los dos caminos. Las bibliotecas de la consigna se presentan como stack sugerido: se usan APIs nativas equivalentes para descubrimiento, sockets, cámara, GPS y PDF, y se conserva WatermelonDB.

## 2. Descubrimiento e identidad de equipos

Se aceptan subredes IPv4 /22 a /32, hasta 1024 hosts. mDNS busca servicios SSH, HTTP, HTTPS, workstation y SNMP con una ventana acotada. Un multicast lock se libera al terminar. El sondeo TCP prueba 22, 80, 443 y 8291, y realiza una consulta UDP al puerto SNMP configurado cuando no hubo conexión TCP. Se consideran encontrados los hosts que aceptan una conexión o responden un datagrama; no se infiere actividad a partir de un rechazo de conexión, que el NAT del emulador podría sintetizar.

La app informa progreso y permite cancelar. IP, puertos y origen se conservan; hostname/nombre de servicio y MAC solo se muestran cuando están disponibles. Android moderno puede impedir leer `/proc/net/arp`, por lo que MAC ausente no se reemplaza por un valor inventado. Filtrado de puertos, aislamiento Wi-Fi y límites de mDNS pueden impedir detectar un host; existe alta manual.

El identificador persistido es independiente de la IP. La coincidencia requiere el mismo sitio y compara MAC cuando ambos registros la tienen; en otro caso compara IP dentro del sitio. Esto evita mezclar historiales de sitios que reutilizan direcciones privadas.

## 3. Subset SNMP implementado

`src/protocol/snmp.ts` construye GetRequest y GetNextRequest y decodifica GetResponse. Soporta SNMPv1 y SNMPv2c con community; los valores de versión BER son 0 y 1. Transporte UDP/161 por defecto, con puerto configurable, timeout de 100 a 15000 ms y un reintento de transporte. El emisor UDP se conecta al destino para filtrar respuestas de otro host/puerto.

El parser BER admite SEQUENCE, INTEGER con signo, OCTET STRING, NULL, OID base-128, IpAddress, Counter32, Gauge32, TimeTicks y Counter64 como cadena decimal. Soporta longitudes definidas cortas y largas. Rechaza truncamientos, longitudes indefinidas, tipos no admitidos y bytes adicionales. Cada vista binaria se normaliza a Buffer antes de decodificar cadenas para evitar diferencias del runtime móvil.

La correlación valida request-id, versión, community, tipo de PDU y OIDs. GETNEXT exige avance lexicográfico y finaliza ante fin de MIB o noSuchName de v1. Se recorre ifIndex y se consultan hasta 64 interfaces utilizando índices reales, incluso cuando no son consecutivos.

| Dato        | OID                  |
| ----------- | -------------------- |
| sysDescr.0  | 1.3.6.1.2.1.1.1.0    |
| sysUpTime.0 | 1.3.6.1.2.1.1.3.0    |
| sysName.0   | 1.3.6.1.2.1.1.5.0    |
| ifIndex     | 1.3.6.1.2.1.2.2.1.1  |
| ifDescr     | 1.3.6.1.2.1.2.2.1.2  |
| ifInOctets  | 1.3.6.1.2.1.2.2.1.10 |
| ifOutOctets | 1.3.6.1.2.1.2.2.1.16 |

Los octetos se muestran como contadores acumulados de 32 bits, con vuelta al alcanzar 2^32, y no como velocidad instantánea. No se implementan SET, traps, GetBulk, SNMPv3 ni MIBs de fabricantes. SNMPv1/v2c transmite la community sin cifrar; este subset es para una LAN de laboratorio y no sustituye SNMPv3 en entornos que requieran confidencialidad/autenticación fuerte.

## 4. SSH y manejo de credenciales

Android establece SSH directamente con JSch. Primero obtiene la clave pública del host sin enviar credenciales del equipo. La app muestra su huella SHA-256 y exige aceptarla; debe contrastarse por otro canal. Al autenticar, un HostKeyRepository estricto comprueba la misma huella y rechaza cualquier cambio antes de enviar la contraseña.

El usuario elige comandos predefinidos por fabricante: Linux/OpenWrt (`uptime`, `ip -s address show`, `ip route show`), MikroTik (`/system resource print`, `/interface print stats`, `/ip route print`) y Cisco (`show version`, `show interfaces`, `show ip route`). Android vuelve a validar la lista y no concatena entrada de usuario en comandos. No hay shell interactiva ni autenticación con clave privada. La ejecución tiene plazo de 20 segundos y límite de salida de 1 MiB.

Las credenciales se guardan solo al activar Recordar de forma segura. Expo SecureStore usa el almacenamiento protegido de Android y Keystore. Contraseñas, community, token y huellas quedan fuera de WatermelonDB y de la outbox; se ofrece olvidarlos. Los secretos se eliminan de memoria de formularios al cerrar la ficha cuando corresponde. En la vista web son efímeros. No hay un backend intermediario que reciba contraseñas SSH en el APK.

## 5. Evidencia, QR y reportes

La cámara reconoce QR, EAN-8/13, Code128/39, PDF417 y DataMatrix. Los contenidos se convierten en identificadores y no se navega automáticamente a URLs de códigos. La ficha remota se consulta al backend y se conserva localmente. El catálogo incluye ejemplos HG8245H, RB750GR3, LAB-001 y PC-REAL, distinguiendo datos de prueba y el equipo físico de demostración.

Una instalación requiere equipo, sitio, técnico, notas, ubicación y al menos una foto, hasta seis. Cada foto conserva fecha, coordenadas, precisión y un archivo privado de la app. Se solicitan permisos en primer plano, sin usar micrófono ni ubicación de fondo. El GPS tiene un plazo de 25 segundos; no se reemplazan coordenadas faltantes por valores ficticios. El borrador se persiste automáticamente.

En Android se usa el proveedor Android de expo-location/next, basado en LocationManager, sin depender de Google Play Services. Se exige una lectura reciente. El servicio de laboratorio envía periódicamente una señal al GPS del emulador; esta señal se identifica como simulada y no requiere Internet ni radios activos.

La instalación se guarda antes de generar el PDF. Expo Print produce un A4 con notas escapadas, fotos base64, ubicación y hasta veinte diagnósticos del mismo equipo/sitio. Se mueve a almacenamiento privado y se puede compartir. El visor PdfRenderer de Android abre únicamente archivos dentro de los directorios privados de archivos/caché de la app; no necesita Internet ni otro visor instalado. Un error de PDF conserva la instalación para reintentar.

En emulador se identifican la ubicación simulada y la captura de demostración tanto en la interfaz como en el PDF. El agente SNMP de Windows sí obtiene datos del equipo físico. Un reporte de emulador no acredita una visita de campo. No hay firma digital ni cifrado integral de SQLite/evidencia.

## 6. WatermelonDB y outbox

`LocalStore` separa la lógica de persistencia del runtime y serializa escritores. En el APK Android, el adaptador WatermelonDB guarda filas con clave compuesta y payload JSON que incluye tipo de entidad, ID, versión y fecha. Un writer prepara altas, cambios y bajas y los confirma en un único batch SQLite. Entidad y acción outbox se confirman juntas antes de publicar cambios en la interfaz.

Cada edición produce un snapshot inmutable con actionId y createdAt estrictamente creciente. La sincronización es FIFO y un único worker evita envíos simultáneos. Las acciones sucesoras de una entidad esperan cuando la anterior tiene conflicto o error. Al confirmar, se elimina la acción y se propaga la versión remota a sus sucesoras sin sobrescribir ediciones locales posteriores. Al reiniciar se recupera el estado sending.

Estados: pending, sending, conflict y failed; una acción confirmada se elimina. Los errores transitorios vuelven a pending sin agotar un número fijo de intentos, con backoff de 2 segundos a 5 minutos y jitter. Los 4xx permanentes, salvo 408/429, requieren revisión. NetInfo fuerza pendientes al reconectar; también se intenta al volver a primer plano y cada veinte segundos con la app activa. No se promete un servicio permanente con la app cerrada.

La interfaz no inicia envíos cuando NetInfo informa desconexión. Las peticiones HTTP tienen un plazo de veinte segundos para manejar también pérdidas de red que ocurran durante un envío.

Un conflicto HTTP 409 conserva la versión, payload y referencias a adjuntos del servidor. Elegir local reencola contra esa versión; elegir servidor conserva un respaldo local antes de reemplazar entidad y acciones relacionadas, y descarga su evidencia. Los historiales permanecen disponibles sin conexión.

## 7. Backend mínimo

Node persiste entidades, versiones, recibos de actionId y adjuntos. La repetición de una acción confirmada devuelve el recibo sin duplicar el cambio. Se serializan escrituras y se confirma el archivo de estado mediante temporal y rename. Se validan tipo de entidad, versión base y adjuntos; las fotos/PDF se almacenan por SHA-256. El límite de cuerpo es 40 MiB, hasta diez adjuntos y límites individuales.

La demostración Android usa el puerto 8790 y un token público de laboratorio. El puente de diagnósticos se deshabilita en ese servidor. Es un stub persistente para validar el flujo end-to-end; carece de administración multiusuario y garantías de producción. Fuera de laboratorio requiere HTTPS, autenticación y controles operativos adecuados.

## 8. Prueba sin teléfono físico y límites

El emulador Android 15 x86_64 ejecuta el APK; el mismo artefacto incluye arm64-v8a. El agente SNMP en UDP/1162 obtiene nombre, interfaces e índices de Windows y contadores reales mediante Get-NetAdapterStatistics. Refresca cada cinco segundos sin solaparse y deja de responder si su lectura tiene más de treinta segundos. sysUpTime representa el tiempo activo del agente. Las conversiones Counter32 parten de enteros decimales y usan BigInt para evitar redondeo.

La prueba debe mostrar descubrimiento de la IP LAN de la PC, SNMP exitoso, registro/PDF offline y sincronización al recuperar Wi-Fi. Cámara y posición del emulador son simuladas. No se afirma haber probado un router físico ni un Android físico; la aceptación de la demostración en emulador corresponde al docente.

Las pruebas automatizadas cubren BER, correlación, sockets UDP reales, SSH con huella, idempotencia, persistencia, conflictos, reconexión prolongada e identificación de evidencia simulada. El estado de ejecución y las comprobaciones del artefacto deben consultarse en la información de build distribuida. El APK lleva firma de prueba, no una firma de publicación comercial.

## 9. Referencias

- RFC 1157: A Simple Network Management Protocol (SNMP), RFC Editor.
- RFC 1213: MIB-II para gestión de redes TCP/IP, RFC Editor.
- WatermelonDB: documentación de instalación, modelos y writers.
- Android Developers: PdfRenderer, Android Emulator y grabación de pantalla.
- JSch, implementación y dependencias criptográficas opcionales: https://github.com/mwiede/jsch.
