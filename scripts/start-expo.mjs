import { createBackend } from "../backend/server.mjs";
import { networkInfo } from "../backend/network.mjs";
import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const expoVersion = JSON.parse(
  await fs.readFile(
    path.join(root, "node_modules", "expo", "package.json"),
    "utf8",
  ),
).version;
const sdkVersion = `${expoVersion.split(".")[0]}.0.0`;
await fs.mkdir(path.join(root, ".cache"), { recursive: true });
const tokenFile = path.join(root, ".cache", "companion-token");
let token;
try {
  token = (await fs.readFile(tokenFile, "utf8")).trim();
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
if (!token) {
  token = randomBytes(24).toString("hex");
  await fs.writeFile(tokenFile, token, { mode: 0o600 });
}
const server = await createBackend({ token, gateway: true });
let port = Number(process.env.FIELDKIT_PORT || 8787);
while (true) {
  try {
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, "0.0.0.0", () => {
        server.removeListener("error", reject);
        resolve();
      });
    });
    break;
  } catch (error) {
    if (error.code !== "EADDRINUSE" || port >= 8797) throw error;
    port++;
  }
}
const info = networkInfo();
const ip = process.env.REACT_NATIVE_PACKAGER_HOSTNAME || info.ip || "127.0.0.1";
const backend = `http://${ip}:${port}`;
const metroPort = Number(process.env.EXPO_PORT || 8083);
await fs.mkdir(path.join(root, "deliverables"), { recursive: true });
await QRCode.toFile(
  path.join(root, "deliverables", "expo-go-qr.png"),
  `exp://${ip}:${metroPort}`,
  { width: 320, margin: 3 },
);
await fs.writeFile(
  path.join(root, ".cache", "expo-connection.json"),
  JSON.stringify(
    { url: `exp://${ip}:${metroPort}`, backend, metroPort, sdkVersion },
    null,
    2,
  ),
);
console.log(`\nFieldkit para Expo Go · iPhone y PC en la misma Wi-Fi`);
console.log(`Expo SDK ${sdkVersion} · Expo ${expoVersion}`);
console.log(`Servidor y puente de red: ${backend}`);
console.log(`QR guardado en deliverables/expo-go-qr.png`);
console.log(`El servidor y su acceso se configuran automáticamente en la app.`);
console.log(
  `Si iOS lo solicita, permití el acceso de Expo Go a la red local.\n`,
);
const args = [
  path.join(root, "node_modules", "expo", "bin", "cli"),
  "start",
  "--go",
  "--lan",
  "--port",
  String(metroPort),
];
if (process.argv.includes("--clear")) args.push("--clear");
const child = spawn(process.execPath, args, {
  cwd: root,
  stdio: "inherit",
  windowsHide: true,
  env: {
    ...process.env,
    REACT_NATIVE_PACKAGER_HOSTNAME: ip,
    EXPO_PUBLIC_FIELDKIT_BACKEND: backend,
    EXPO_PUBLIC_FIELDKIT_TOKEN: token,
  },
});
const stop = () => {
  child.kill();
  server.close();
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
child.on("exit", (code) => {
  server.close();
  process.exitCode = code || 0;
});
child.on("error", (error) => {
  console.error(error.message);
  server.close();
  process.exitCode = 1;
});
