const {
  withAndroidManifest,
  withGradleProperties,
  withAppBuildGradle,
  withProjectBuildGradle,
} = require("expo/config-plugins");
module.exports = function withAndroidNetwork(config) {
  config = withProjectBuildGradle(config, (result) => {
    if (
      !result.modResults.contents.includes("Fieldkit: WatermelonDB BuildConfig")
    )
      result.modResults.contents += `
// Fieldkit: WatermelonDB BuildConfig con Android Gradle Plugin 9.
subprojects { subproject ->
  subproject.plugins.withId("com.android.library") {
    if (subproject.name == "nozbe_watermelondb") subproject.android.buildFeatures.buildConfig = true
  }
}
`;
    return result;
  });
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
      "ndk { abiFilters(*((findProperty('reactNativeArchitectures') ?: 'arm64-v8a,x86_64').split(','))) }";
    if (!result.modResults.contents.includes(abi))
      result.modResults.contents = result.modResults.contents.replace(
        "defaultConfig {",
        `defaultConfig {\n        ${abi}\n        externalNativeBuild { cmake { arguments "-DCMAKE_OBJECT_PATH_MAX=240" } }`,
      );
    return result;
  });
};
