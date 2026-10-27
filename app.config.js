module.exports = {
  expo: {
    name: "Fieldkit · Network Diagnostics",
    slug: "network-diagnostics-suite",
    version: "1.0.0",
    orientation: "portrait",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    ios: {
      bundleIdentifier: "ar.edu.fcyt.fieldkit",
      supportsTablet: true,
      infoPlist: {
        NSLocalNetworkUsageDescription:
          "Conectar con el servidor de Fieldkit en tu computadora para diagnósticos y sincronización.",
        NSAppTransportSecurity: { NSAllowsLocalNetworking: true },
      },
    },
    android: {
      package: "ar.edu.fcyt.fieldkit",
      versionCode: 1,
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
      "./plugins/withAndroidNetwork",
    ],
    web: { bundler: "metro", name: "Fieldkit" },
    extra: {
      scope:
        "Expo Go iOS/Android. Diagnósticos de red mediante el puente de la computadora.",
    },
  },
};
