module.exports = {
  expo: {
    name: "Fieldkit · Network Diagnostics",
    slug: "network-diagnostics-suite",
    version: "1.1.1",
    orientation: "portrait",
    userInterfaceStyle: "light",
    platforms: ["android"],
    android: {
      package: "ar.edu.fcyt.fieldkit",
      versionCode: 3,
      permissions: [
        "INTERNET",
        "ACCESS_NETWORK_STATE",
        "ACCESS_WIFI_STATE",
        "CHANGE_WIFI_MULTICAST_STATE",
        "CAMERA",
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
      ],
      blockedPermissions: ["android.permission.RECORD_AUDIO"],
    },
    plugins: [
      [
        "expo-camera",
        {
          cameraPermission:
            "Permitir fotos de la instalación y lectura de códigos.",
          recordAudioAndroid: false,
          barcodeScannerEnabled: true,
        },
      ],
      [
        "expo-location",
        {
          locationWhenInUsePermission:
            "Georreferenciar la instalación y sus fotografías.",
        },
      ],
      "expo-secure-store",
      "expo-asset",
      "expo-font",
      "expo-sharing",
      "expo-status-bar",
      "./plugins/withAndroidNetwork",
    ],
  },
};
