import dgram from "node:dgram";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { promises as fs } from "node:fs";
import path from "node:path";
import { Bonjour } from "bonjour-service";
import {
  compareOids,
  decodeMessage,
  encodeMessage,
} from "../src/protocol/snmp";
import { hostMib, HostInterface } from "./host-mib";

if (process.platform !== "win32")
  throw new Error("Este agente obtiene contadores reales de Windows.");
async function main() {
  const run = promisify(execFile);
  const port = Number(process.env.SNMP_PORT || 1162);
  const community = process.env.SNMP_COMMUNITY || "public";
  const started = Date.now();
  const description = `Fieldkit · agente SNMP de esta PC real · ${os.type()} ${os.release()} · contadores Get-NetAdapterStatistics`;
  let snapshot: { capturedAt: number; interfaces: HostInterface[] };
  const command =
    "$ErrorActionPreference='Stop'; @(Get-NetAdapter | Where-Object { $_.Status -eq 'Up' } | ForEach-Object { $s=Get-NetAdapterStatistics -Name $_.Name; [pscustomobject]@{ifIndex=$_.ifIndex;name=$_.Name;description=$_.InterfaceDescription;receivedBytes=$s.ReceivedBytes.ToString();sentBytes=$s.SentBytes.ToString()} }) | ConvertTo-Json -Compress";
  async function refresh() {
    const { stdout } = await run(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", command],
      { windowsHide: true, timeout: 20000, maxBuffer: 1024 * 1024 },
    );
    const parsed = JSON.parse(stdout.trim() || "[]");
    const interfaces = Array.isArray(parsed) ? parsed : [parsed];
    // Validar antes de reemplazar la última lectura; no fabricar valores si Windows falla.
    hostMib(os.hostname(), description, Date.now() - started, interfaces);
    snapshot = { capturedAt: Date.now(), interfaces };
    const target = path.resolve(".cache/snmp-host-snapshot.json");
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(
      target,
      JSON.stringify(
        { hostname: os.hostname(), description, ...snapshot },
        null,
        2,
      ),
    );
  }
  await refresh();
  let refreshing = false;
  const timer = setInterval(() => {
    if (refreshing) return;
    refreshing = true;
    void refresh()
      .catch((error) =>
        console.error("No se actualizaron los contadores:", error.message),
      )
      .finally(() => {
        refreshing = false;
      });
  }, 5000);
  const socket = dgram.createSocket("udp4");
  socket.on("message", (packet, peer) => {
    try {
      const request = decodeMessage(packet);
      if (
        request.community !== community ||
        ![0xa0, 0xa1].includes(request.pdu) ||
        Date.now() - snapshot.capturedAt > 30000
      )
        return;
      const table = hostMib(
        os.hostname(),
        description,
        Date.now() - started,
        snapshot.interfaces,
      );
      let missing = 0;
      const values = request.values.map((value, index) => {
        const found =
          request.pdu === 0xa1
            ? table.find((entry) => compareOids(entry.oid, value.oid) > 0)
            : table.find((entry) => entry.oid === value.oid);
        if (found) return found;
        if (request.version === 0) missing ||= index + 1;
        return {
          oid: value.oid,
          tag: request.version === 0 ? 5 : request.pdu === 0xa1 ? 0x82 : 0x80,
          value: null,
        };
      });
      socket.send(
        encodeMessage({
          ...request,
          pdu: 0xa2,
          errorStatus: missing ? 2 : 0,
          errorIndex: missing,
          values,
        }),
        peer.port,
        peer.address,
      );
    } catch (error) {
      console.error("Consulta SNMP rechazada:", (error as Error).message);
    }
  });
  socket.on("error", (error) => {
    console.error(error.message);
    clearInterval(timer);
    process.exitCode = 1;
    socket.close();
  });
  const bonjour = new Bonjour();
  socket.bind(port, "0.0.0.0", () => {
    bonjour.publish({
      name: `${os.hostname()} · Fieldkit PC real`,
      type: "snmp",
      protocol: "udp",
      port,
      txt: { source: "Windows Get-NetAdapterStatistics", mode: "real-host" },
    });
    console.log(
      `SNMP de PC real · UDP/${port} · ${os.hostname()} · ${snapshot.interfaces.length} interfaces de Windows.`,
    );
  });
  function stop() {
    clearInterval(timer);
    bonjour.destroy();
    socket.close();
  }
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
void main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
