import dgram from "node:dgram";
import net from "node:net";
import os from "node:os";
import { createHash } from "node:crypto";
import ssh2 from "ssh2";
import { Bonjour } from "bonjour-service";

const COMMANDS = new Set([
  "uptime",
  "ip -s address show",
  "ip route show",
  "/system resource print",
  "/interface print stats",
  "/ip route print",
  "show version",
  "show interfaces",
  "show ip route",
]);
const invalid = (text) => Object.assign(new Error(text), { status: 422 });
export function isLanHost(host) {
  if (typeof host !== "string" || !/^\d{1,3}(\.\d{1,3}){3}$/.test(host))
    return false;
  const [a, b, ...rest] = host.split(".").map(Number);
  if ([a, b, ...rest].some((n) => n > 255)) return false;
  if ([a, b, ...rest].join(".") !== host) return false;
  return (
    a === 10 ||
    a === 127 ||
    (a === 192 && b === 168) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 169 && b === 254)
  );
}
const hostOf = (host) => {
  if (!isLanHost(host))
    throw invalid("El puente solo permite direcciones IPv4 de redes locales.");
  return host;
};
const portOf = (port) => {
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw invalid("Puerto inválido.");
  return port;
};
const duration = (n, fallback = 1500, max = 15000) =>
  Math.max(100, Math.min(max, Number(n) || fallback));
function packetOf(data) {
  if (
    typeof data !== "string" ||
    data.length > 88000 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      data,
    )
  )
    throw invalid("Datagrama inválido.");
  const packet = Buffer.from(data, "base64");
  if (!packet.length || packet.length > 65507)
    throw invalid("Datagrama inválido.");
  return packet;
}
export function exchangeUdp(host, port, data, timeout = 1500) {
  hostOf(host);
  portOf(port);
  const packet = packetOf(data);
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket("udp4");
    let finished = false;
    const finish = (error, reply) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      socket.close();
      if (error) reject(error);
      else resolve(reply.toString("base64"));
    };
    const timer = setTimeout(
      () => finish(new Error("El equipo no respondió al datagrama UDP.")),
      duration(timeout),
    );
    socket.on("error", (error) => finish(error));
    socket.on("message", (reply) => finish(null, reply));
    socket.connect(port, host, () =>
      socket.send(packet, (error) => {
        if (error) finish(error);
      }),
    );
  });
}
function tcp(host, port, timeout) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    let ended = false;
    const finish = (value) => {
      if (!ended) {
        ended = true;
        socket.destroy();
        resolve(value);
      }
    };
    socket.setTimeout(timeout);
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
    socket.once("timeout", () => finish(false));
  });
}
export function networkInfo() {
  const interfaces = Object.entries(os.networkInterfaces()).flatMap(
    ([name, addresses]) =>
      (addresses ?? [])
        .filter(
          (a) => a.family === "IPv4" && !a.internal && isLanHost(a.address),
        )
        .map((a) => ({
          name,
          ip: a.address,
          prefix: Number(a.cidr?.split("/")[1] || 24),
        })),
  );
  const preferred =
    interfaces.find((i) => /wi-?fi|wlan|wireless/i.test(i.name)) ??
    interfaces[0];
  return {
    ip: preferred?.ip,
    prefix: preferred?.prefix ?? 24,
    interfaces,
    via: "computer",
  };
}
async function discoverMdns(milliseconds) {
  return new Promise((resolve) => {
    const found = new Map();
    const bonjour = new Bonjour({}, () => {});
    const browser = bonjour.find({}, (service) => {
      for (const ip of service.addresses ?? []) {
        if (isLanHost(ip))
          found.set(ip, {
            ip,
            hostname: service.host?.replace(/\.$/, ""),
            serviceName: service.name,
            ports: [service.port],
            source: "mdns",
          });
      }
    });
    setTimeout(
      () => {
        browser.stop();
        bonjour.destroy();
        resolve([...found.values()]);
      },
      duration(milliseconds, 2500, 3000),
    );
  });
}
async function scan({ hosts, timeout, probe, udpPort }) {
  if (!Array.isArray(hosts) || !hosts.length || hosts.length > 1024)
    throw invalid("El escaneo permite entre 1 y 1024 direcciones.");
  hosts.forEach(hostOf);
  portOf(udpPort);
  packetOf(probe);
  const unique = [...new Set(hosts)],
    found = [];
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(12, unique.length) }, async () => {
      while (cursor < unique.length) {
        const ip = unique[cursor++];
        const ports = [22, 80, 443, 8291];
        const results = await Promise.all(
          ports.map((port) => tcp(ip, port, duration(timeout, 350, 1000))),
        );
        const udp = await exchangeUdp(
          ip,
          udpPort,
          probe,
          duration(timeout, 350, 1000),
        ).then(
          () => true,
          () => false,
        );
        const open = ports.filter((_, i) => results[i]);
        if (open.length || udp)
          found.push({ ip, ports: open, source: udp ? "udp" : "tcp" });
      }
    }),
  );
  return found;
}
export function sshOperation(
  { host, port, username, password, fingerprint, command },
  fingerprintOnly = false,
) {
  hostOf(host);
  portOf(port);
  if (
    !fingerprintOnly &&
    (!COMMANDS.has(command) ||
      typeof username !== "string" ||
      !username ||
      typeof password !== "string" ||
      password.length > 4096 ||
      username.length > 200 ||
      typeof fingerprint !== "string" ||
      !/^SHA256:[A-Za-z0-9+/]{43}$/.test(fingerprint))
  )
    throw invalid("Credenciales, huella o comando no válidos.");
  return new Promise((resolve, reject) => {
    const client = new ssh2.Client();
    let ended = false,
      observed = "",
      stdout = "",
      stderr = "",
      bytes = 0;
    const finish = (error, value) => {
      if (ended) return;
      ended = true;
      clearTimeout(timer);
      client.destroy();
      if (error) reject(error);
      else resolve(value);
    };
    const timer = setTimeout(
      () => finish(new Error("Tiempo agotado en SSH.")),
      20000,
    );
    client.on("error", (error) => {
      if (fingerprintOnly && observed) finish(null, observed);
      else
        finish(
          new Error(
            error.level === "client-authentication"
              ? "SSH: autenticación rechazada."
              : "No se pudo establecer la conexión SSH. Revisá equipo, puerto y huella.",
          ),
        );
    });
    client.on("close", () => {
      if (!ended)
        finish(
          new Error("SSH cerró la conexión antes de completar el diagnóstico."),
        );
    });
    client.on("ready", () =>
      client.exec(command, (error, stream) => {
        if (error)
          return finish(new Error("El equipo rechazó el comando SSH."));
        const append = (chunk, isError) => {
          bytes += chunk.length;
          if (bytes > 1024 * 1024)
            return finish(new Error("La respuesta SSH supera 1 MiB."));
          if (isError) stderr += chunk.toString();
          else stdout += chunk.toString();
        };
        stream.on("data", (chunk) => append(chunk, false));
        stream.stderr.on("data", (chunk) => append(chunk, true));
        stream.on("error", () => finish(new Error("Error en el canal SSH.")));
        stream.on("close", (code) =>
          finish(null, { stdout, stderr, exitCode: code ?? -1, command }),
        );
      }),
    );
    client.connect({
      host,
      port,
      username: fingerprintOnly ? "fieldkit-fingerprint" : username,
      password: fingerprintOnly ? undefined : password,
      readyTimeout: 8000,
      hostVerifier: (key) => {
        observed = `SHA256:${createHash("sha256").update(key).digest("base64").replace(/=+$/, "")}`;
        return !fingerprintOnly && observed === fingerprint;
      },
    });
  });
}
export function createGateway() {
  let scanning = false,
    active = 0;
  return async (operation, input = {}) => {
    if (active >= 32)
      throw Object.assign(new Error("El puente está ocupado."), {
        status: 429,
      });
    active++;
    try {
      switch (operation) {
        case "info":
          return networkInfo();
        case "udp":
          return await exchangeUdp(
            input.host,
            input.port,
            input.data,
            input.timeout,
          );
        case "mdns":
          return await discoverMdns(input.duration);
        case "fingerprint":
          return await sshOperation(input, true);
        case "ssh":
          return await sshOperation(input);
        case "scan":
          if (scanning)
            throw Object.assign(new Error("Ya hay un escaneo en curso."), {
              status: 429,
            });
          scanning = true;
          try {
            return await scan(input);
          } finally {
            scanning = false;
          }
        default:
          throw invalid("Operación de red desconocida.");
      }
    } finally {
      active--;
    }
  };
}
