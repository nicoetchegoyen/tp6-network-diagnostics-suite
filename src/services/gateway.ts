import { secrets } from "./secure";

export function createNetworkGateway(getUrl: () => string) {
  let cancelled = false;
  let scanController: AbortController | undefined;
  const listeners = new Set<
    (event: { completed: number; total: number; found: number }) => void
  >();
  async function request<T>(
    operation: string,
    input: object = {},
    scanning = false,
  ): Promise<T> {
    const url = getUrl();
    if (!url)
      throw new Error(
        "Para los diagnósticos de red, iniciá npm start en la computadora y configurá su dirección en Ajustes. Podés registrar equipos e instalaciones sin el puente.",
      );
    const token = await secrets.get("backend-token");
    const controller = new AbortController();
    if (scanning) scanController = controller;
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(`${url}/v1/network/${operation}`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(input),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || `Puente de red HTTP ${response.status}`);
      return data.result as T;
    } catch (error) {
      if (controller.signal.aborted && cancelled)
        throw new Error("Escaneo detenido.");
      if (error instanceof TypeError || controller.signal.aborted)
        throw new Error(
          "No se pudo contactar con la computadora. Revisá que npm start siga abierto, la misma Wi-Fi, el permiso de red local y la URL en Ajustes.",
        );
      throw error;
    } finally {
      clearTimeout(timer);
      if (scanController === controller) scanController = undefined;
    }
  }
  return {
    networkInfo: () => request<{ ip?: string; prefix: number }>("info"),
    exchangeUdp: (host: string, port: number, data: string, timeout: number) =>
      request<string>("udp", { host, port, data, timeout }),
    discoverMdns: (duration: number) => request<any[]>("mdns", { duration }),
    async scan(
      hosts: string[],
      timeout: number,
      probe: string,
      udpPort: number,
    ) {
      const found: any[] = [];
      for (let offset = 0; offset < hosts.length && !cancelled; offset += 24) {
        const chunk = hosts.slice(offset, offset + 24);
        found.push(
          ...(await request<any[]>(
            "scan",
            { hosts: chunk, timeout, probe, udpPort },
            true,
          )),
        );
        for (const listener of listeners)
          listener({
            completed: Math.min(offset + chunk.length, hosts.length),
            total: hosts.length,
            found: found.length,
          });
      }
      return found;
    },
    cancelScan() {
      cancelled = true;
      scanController?.abort();
    },
    resetScan() {
      cancelled = false;
    },
    sshFingerprint: (host: string, port: number) =>
      request<string>("fingerprint", { host, port }),
    sshExec: (
      host: string,
      port: number,
      username: string,
      password: string,
      fingerprint: string,
      command: string,
    ) =>
      request<{
        stdout: string;
        stderr: string;
        exitCode: number;
        command: string;
      }>("ssh", { host, port, username, password, fingerprint, command }),
    addListener(
      _name: string,
      listener: (event: {
        completed: number;
        total: number;
        found: number;
      }) => void,
    ) {
      listeners.add(listener);
      return {
        remove: () => {
          listeners.delete(listener);
        },
      };
    },
  };
}
