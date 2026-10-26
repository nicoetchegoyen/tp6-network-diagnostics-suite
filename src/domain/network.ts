export function ipv4ToInt(ip: string): number {
  const parts = ip.split(".");
  if (
    parts.length !== 4 ||
    parts.some((p) => !/^\d{1,3}$/.test(p) || Number(p) > 255)
  )
    throw new Error("Ingresá una dirección IPv4 válida.");
  return parts.reduce((n, p) => ((n << 8) | Number(p)) >>> 0, 0);
}
export function intToIpv4(n: number): string {
  return [24, 16, 8, 0].map((s) => (n >>> s) & 255).join(".");
}
export function subnetHosts(cidr: string): string[] {
  const [ip, bits, extra] = cidr.trim().split("/");
  const prefix = Number(bits);
  if (extra || !/^\d+$/.test(bits || "") || prefix < 22 || prefix > 32)
    throw new Error("Usá una subred IPv4 entre /22 y /32 (máximo 1022 hosts).");
  const value = ipv4ToInt(ip),
    size = 2 ** (32 - prefix),
    start = Math.floor(value / size) * size;
  const first = prefix >= 31 ? 0 : 1,
    end = prefix >= 31 ? size : size - 1;
  return Array.from({ length: end - first }, (_, i) =>
    intToIpv4(start + first + i),
  );
}
export function parseEquipmentCode(input: string): string {
  const s = input.trim();
  if (!s || s.length > 2048) throw new Error("Código vacío o demasiado largo.");
  if (s.startsWith("{")) {
    const data = JSON.parse(s);
    const code = data.serial ?? data.code ?? data.model;
    if (typeof code !== "string" || !code.trim())
      throw new Error("El QR no contiene serial, code o model.");
    return code.trim().slice(0, 160);
  }
  if (/^https?:\/\//i.test(s)) {
    const url = new URL(s);
    const code =
      url.searchParams.get("serial") ||
      url.searchParams.get("code") ||
      url.pathname.split("/").filter(Boolean).pop();
    if (!code) throw new Error("No se encontró un identificador en el QR.");
    return decodeURIComponent(code).slice(0, 160);
  }
  return s.slice(0, 160);
}
