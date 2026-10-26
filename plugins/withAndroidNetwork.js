const {
  withAndroidManifest,
  withGradleProperties,
  withAppBuildGradle,
} = require("expo/config-plugins");
module.exports = function withAndroidNetwork(config) {
  config = withAndroidManifest(config, (result) => {
    const app = result.modResults.manifest.application[0].$;
    // El stub de laboratorio puede usarse por HTTP en una LAN sin Internet.
    app["android:usesCleartextTraffic"] = "true";
    app["android:allowBackup"] = "false";
    return result;
  });
  config = withGradleProperties(config, (result) => {
    const key = "android.packagingOptions.excludes";
    const resource = "META-INF/versions/9/OSGI-INF/MANIFEST.MF";
    const existing = result.modResults.find(
      (p) => p.type === "property" && p.key === key,
    );
    if (existing && !existing.value.includes(resource))
      existing.value += `,${resource}`;
    else if (!existing)
      result.modResults.push({ type: "property", key, value: resource });
    return result;
  });
  return withAppBuildGradle(config, (result) => {
    const abi =
      "ndk { abiFilters(*((findProperty('reactNativeArchitectures') ?: 'arm64-v8a').split(','))) }";
    if (!result.modResults.contents.includes(abi))
      result.modResults.contents = result.modResults.contents.replace(
        "defaultConfig {",
        `defaultConfig {\n        ${abi}`,
      );
    return result;
  });
};
