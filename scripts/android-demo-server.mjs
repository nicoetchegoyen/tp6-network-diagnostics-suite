import { createBackend } from "../backend/server.mjs";
import { spawn, execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.FIELDKIT_DEMO_PORT || 8790);
const server = await createBackend({
  token: "fieldkit-demo-local",
  gateway: false,
  dataDir: path.join(root, "backend/data-android-demo"),
});
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(port, "0.0.0.0", resolve);
});
const agent = spawn(
  process.execPath,
  ["--import", "tsx", "scripts/snmp-host-agent.ts"],
  { cwd: root, windowsHide: true, stdio: "inherit" },
);
console.log(
  `Backend Android: http://10.0.2.2:${port} desde el emulador. Mantener esta ventana abierta.`,
);
console.log(
  "SNMP y SSH salen del APK. El backend solo sincroniza y entrega fichas técnicas.",
);
// El emulador recibe una señal GPS de ejemplo reciente, incluso con sus radios apagadas.
// Es una entrada del simulador, no una medición física ni tráfico HTTP de la app.
const run = promisify(execFile);
let gpsBusy = false;
const gpsTimer = setInterval(() => {
  if (gpsBusy || process.env.FIELDKIT_DEMO_GPS === "0") return;
  gpsBusy = true;
  void fs.readFile(path.join(root, ".cache/emulator-connection.json"), "utf8")
    .then(JSON.parse)
    .then(({ serial }) => run(path.join(root, ".tools/android-sdk/platform-tools/adb.exe"), ["-s", serial, "emu", "geo", "fix", "-58.3816", "-34.6037"], { windowsHide: true, timeout: 3000 }))
    .catch(() => {})
    .finally(() => { gpsBusy = false; });
}, 2000);
console.log("GPS de demostracion: punto SIMULADO de Buenos Aires enviado al emulador cada 2 segundos.");
function stop() {
  clearInterval(gpsTimer);
  agent.kill();
  server.close();
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
agent.on("error", (error) => {
  console.error(error.message);
  stop();
  process.exitCode = 1;
});
agent.on("exit", (code) => {
  if (code) {
    clearInterval(gpsTimer);
    server.close();
    process.exitCode = code;
  }
});
