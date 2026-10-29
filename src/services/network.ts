import { requireNativeModule } from "expo";
import { Buffer } from "buffer";
import { Device, Settings, uid } from "../domain/types";
import { subnetHosts } from "../domain/network";
import { encodeMessage, OIDS, SnmpClient } from "../protocol/snmp";
import { diagnosticCommand, Vendor } from "../protocol/commands";
import { secrets } from "./secure";
type Found = Pick<Device, "ip" | "ports" | "source"> & Partial<Device>;
type Bridge = {
  runtimeInfo?(): { emulator: boolean };
  openPdf?(uri: string): Promise<void>;
  networkInfo(): Promise<{ ip?: string; prefix: number }>;
  exchangeUdp(
    host: string,
    port: number,
    data: string,
    timeout: number,
  ): Promise<string>;
  scan(
    hosts: string[],
    timeout: number,
    probe: string,
    udpPort: number,
  ): Promise<Found[]>;
  discoverMdns(duration: number): Promise<Found[]>;
  cancelScan(): void;
  resetScan(): void;
  sshFingerprint(host: string, port: number): Promise<string>;
  sshExec(
    host: string,
    port: number,
    username: string,
    password: string,
    fingerprint: string,
    command: string,
  ): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
    command: string;
  }>;
  addListener(
    name: string,
    cb: (event: { completed: number; total: number; found: number }) => void,
  ): { remove(): void };
};
const bridge = requireNativeModule<Bridge>("FieldNetwork");
export function nativeNetwork(): Bridge {
  return bridge;
}
export const snmp = new SnmpClient(async (host, port, packet, timeout) =>
  Buffer.from(
    await nativeNetwork().exchangeUdp(
      host,
      port,
      Buffer.from(packet).toString("base64"),
      timeout,
    ),
    "base64",
  ),
);
export function snmpConfig(settings: Settings) {
  return {
    community: settings.community,
    version: settings.snmpVersion,
    port: settings.snmpPort,
    timeout: settings.timeout,
  };
}
export async function discover(
  cidr: string,
  settings: Settings,
  progress: (n: number, total: number) => void,
): Promise<Device[]> {
  const hosts = subnetHosts(cidr);
  const n = nativeNetwork();
  n.resetScan();
  const listener = n.addListener("scanProgress", (event) =>
    progress(event.completed, event.total),
  );
  try {
    // El módulo procesa funciones async en serie: mDNS tiene una ventana acotada.
    const mdns = await n.discoverMdns(2500);
    const probe = encodeMessage({
      version: settings.snmpVersion,
      community: settings.community,
      pdu: 0xa0,
      requestId: 1 + Math.floor(Math.random() * 0x7ffffffe),
      errorStatus: 0,
      errorIndex: 0,
      values: [{ oid: OIDS.sysName, tag: 5, value: null }],
    });
    const tcp = await n.scan(
      hosts,
      350,
      probe.toString("base64"),
      settings.snmpPort,
    );
    const map = new Map<string, Found>();
    for (const device of [...tcp, ...mdns]) {
      const previous = map.get(device.ip);
      map.set(device.ip, {
        ...previous,
        ...device,
        ports: [...new Set([...(previous?.ports ?? []), ...device.ports])],
      });
    }
    return [...map.values()].map((d) => ({
      ...d,
      id: uid(),
      name: d.hostname || d.serviceName || d.ip,
      lastSeen: Date.now(),
      site: settings.site,
    }));
  } finally {
    listener.remove();
  }
}
export async function runSSH(
  device: Device,
  port: number,
  username: string,
  password: string,
  vendor: Vendor,
  commandId: string,
  remember: boolean,
) {
  const key = `ssh-pin-${device.id}-${port}`.replace(/[^\w.-]/g, "_");
  const fingerprint = await secrets.get(key);
  if (!fingerprint)
    throw new Error("Verificá y aceptá primero la huella del servidor SSH.");
  const result = await nativeNetwork().sshExec(
    device.ip,
    port,
    username,
    password,
    fingerprint,
    diagnosticCommand(vendor, commandId),
  );
  const credentialKey = `ssh-auth-${device.id}`.replace(/[^\w.-]/g, "_");
  if (remember)
    await secrets.set(
      credentialKey,
      JSON.stringify({ username, password, port }),
    );
  else await secrets.remove(credentialKey);
  return {
    id: uid(),
    deviceId: device.id,
    site: device.site,
    kind: "ssh" as const,
    createdAt: Date.now(),
    success: result.exitCode === 0,
    result,
  };
}
