const fs = require("node:fs");
const path = require("node:path");
if (process.platform === "win32") {
  const pluginRoot = path.dirname(
    require.resolve("@react-native/gradle-plugin/package.json"),
  );
  const osSource = path.join(
    pluginRoot,
    "shared/src/main/kotlin/com/facebook/react/utils/Os.kt",
  );
  if (fs.existsSync(osSource)) {
    const source = fs.readFileSync(osSource, "utf8");
    // SUBST y el autolinking pueden entregar la misma ruta con letras distintas.
    // Mantener la ruta absoluta corta cuando no se puede relativizar entre C: y SUBST.
    const fixed = source
      .replace("this.relativeTo(base).path", "this.relativeToOrSelf(base).path")
      .replace(
        "this.canonicalFile.relativeTo(base.canonicalFile).path",
        "this.relativeToOrSelf(base).path",
      );
    if (fixed !== source) fs.writeFileSync(osSource, fixed);
  }
}
const cmake = path.join(
  __dirname,
  "../node_modules/expo-modules-core/android/CMakeLists.txt",
);
const marker =
  "# Fieldkit: explicit Android C++ runtime for Windows compiler aliases";
if (process.platform === "win32" && fs.existsSync(cmake)) {
  const source = fs.readFileSync(cmake, "utf8");
  // CMake puede invocar clang++ con un alias 8.3 sin "++" en rutas con espacios.
  if (!source.includes(marker))
    fs.appendFileSync(
      cmake,
      `\n${marker}\ntarget_link_libraries(\${PACKAGE_NAME} c++_shared)\n`,
    );
}
