# JSch carga implementaciones criptográficas por nombre mediante reflexión.
# Deben conservarse también al compilar el APK release con R8.
-keep class com.jcraft.jsch.** { *; }

# Integraciones opcionales de JSch: este APK usa JCE de Android y contraseña,
# sin agente de escritorio, Kerberos, Bouncy Castle ni adaptadores de logging.
# JSch comprueba la disponibilidad de los algoritmos al negociar la sesión.
-dontwarn com.sun.jna.**
-dontwarn org.apache.logging.log4j.**
-dontwarn org.bouncycastle.**
-dontwarn org.ietf.jgss.**
-dontwarn org.newsclub.net.unix.**
-dontwarn org.slf4j.**
