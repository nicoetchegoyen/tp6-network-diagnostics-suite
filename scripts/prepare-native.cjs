const fs = require("node:fs");
const path = require("node:path");
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
