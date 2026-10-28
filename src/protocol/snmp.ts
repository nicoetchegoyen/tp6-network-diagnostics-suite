import { Buffer } from "buffer";

export type SnmpValue = {
  oid: string;
  tag: number;
  value: string | number | null;
};
export type SnmpMessage = {
  version: number;
  community: string;
  pdu: number;
  requestId: number;
  errorStatus: number;
  errorIndex: number;
  values: SnmpValue[];
};
export class SnmpResponseError extends Error {
  constructor(
    readonly status: number,
    readonly index: number,
  ) {
    super(`Error SNMP ${status} en variable ${index}.`);
    this.name = "SnmpResponseError";
  }
}
const MAX_PACKET = 65507;
const concat = (...parts: Uint8Array[]) =>
  Buffer.concat(parts.map((p) => Buffer.from(p)));
function length(n: number): Buffer {
  if (!Number.isSafeInteger(n) || n < 0 || n > MAX_PACKET)
    throw new Error("Longitud BER fuera de rango.");
  if (n < 128) return Buffer.from([n]);
  return n < 256
    ? Buffer.from([0x81, n])
    : Buffer.from([0x82, n >> 8, n & 255]);
}
function tlv(tag: number, data: Uint8Array): Buffer {
  return concat(Buffer.from([tag]), length(data.length), data);
}
function integer(n: number, tag = 2): Buffer {
  if (!Number.isSafeInteger(n) || n < -2147483648 || n > 4294967295)
    throw new Error("Entero SNMP fuera de rango.");
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n >>> 0);
  let i = 0;
  if (n >= 0) {
    while (i < 3 && b[i] === 0 && !(b[i + 1] & 128)) i++;
  } else {
    while (i < 3 && b[i] === 255 && b[i + 1] & 128) i++;
  }
  const body = b.subarray(i);
  return tlv(
    tag,
    n >= 0 && body[0] & 128 ? concat(Buffer.from([0]), body) : body,
  );
}
function base128(n: number): number[] {
  if (!Number.isSafeInteger(n) || n < 0 || n > 0xffffffff + 80)
    throw new Error("Arco OID inválido.");
  const out = [n % 128];
  n = Math.floor(n / 128);
  while (n) {
    out.unshift(n % 128 | 128);
    n = Math.floor(n / 128);
  }
  return out;
}
function oid(value: string): Buffer {
  const a = value.replace(/^\./, "").split(".");
  if (a.length < 2 || a.some((p) => !/^\d+$/.test(p)))
    throw new Error("OID inválido.");
  const arcs = a.map(Number);
  if (arcs[0] > 2 || (arcs[0] < 2 && arcs[1] > 39))
    throw new Error("Raíz OID inválida.");
  return tlv(
    6,
    Buffer.from([
      ...base128(arcs[0] * 40 + arcs[1]),
      ...arcs.slice(2).flatMap(base128),
    ]),
  );
}
function encodeValue(v: SnmpValue): Buffer {
  if (v.tag === 5 || [0x80, 0x81, 0x82].includes(v.tag))
    return tlv(v.tag, Buffer.alloc(0));
  if ([2, 0x41, 0x42, 0x43].includes(v.tag))
    return integer(Number(v.value), v.tag);
  if (v.tag === 6) return oid(String(v.value));
  if (v.tag === 0x46) {
    let n = BigInt(String(v.value));
    if (n < 0n || n > 0xffffffffffffffffn)
      throw new Error("Counter64 inválido.");
    const b: number[] = [];
    do {
      b.unshift(Number(n & 255n));
      n >>= 8n;
    } while (n);
    if (b[0] & 128) b.unshift(0);
    return tlv(v.tag, Buffer.from(b));
  }
  return tlv(v.tag, Buffer.from(String(v.value ?? ""), "utf8"));
}
export function encodeMessage(m: SnmpMessage): Buffer {
  if (![0, 1].includes(m.version)) throw new Error("Solo SNMP v1 y v2c.");
  const vars = tlv(
    0x30,
    concat(
      ...m.values.map((v) => tlv(0x30, concat(oid(v.oid), encodeValue(v)))),
    ),
  );
  return tlv(
    0x30,
    concat(
      integer(m.version),
      tlv(4, Buffer.from(m.community, "utf8")),
      tlv(
        m.pdu,
        concat(
          integer(m.requestId),
          integer(m.errorStatus),
          integer(m.errorIndex),
          vars,
        ),
      ),
    ),
  );
}
class Reader {
  offset = 0;
  constructor(readonly data: Buffer) {}
  read(expected?: number): { tag: number; data: Buffer } {
    if (this.offset + 2 > this.data.length)
      throw new Error("Paquete BER truncado.");
    const tag = this.data[this.offset++];
    let len = this.data[this.offset++];
    if (len & 128) {
      const count = len & 127;
      if (!count || count > 3 || this.offset + count > this.data.length)
        throw new Error("Longitud BER inválida.");
      len = 0;
      for (let i = 0; i < count; i++)
        len = len * 256 + this.data[this.offset++];
    }
    if (len > MAX_PACKET || this.offset + len > this.data.length)
      throw new Error("Valor BER truncado.");
    if (expected !== undefined && tag !== expected)
      throw new Error(`Tipo BER inesperado: ${tag}.`);
    // Some mobile TypedArray implementations return a plain Uint8Array view.
    // Restore Buffer explicitly before decoding text/hex with toString(encoding).
    const data = Buffer.from(
      this.data.subarray(this.offset, this.offset + len),
    );
    this.offset += len;
    return { tag, data };
  }
  done() {
    if (this.offset !== this.data.length)
      throw new Error("Datos BER adicionales.");
  }
}
function numberValue(data: Buffer, signed: boolean): number {
  if (!data.length || data.length > 5) throw new Error("Entero BER inválido.");
  let n = signed && data[0] & 128 ? -1 : 0;
  for (const b of data) n = n * 256 + b;
  if (!Number.isSafeInteger(n)) throw new Error("Entero fuera de precisión.");
  return n;
}
function decodeOid(data: Buffer): string {
  if (!data.length) throw new Error("OID vacío.");
  const a: number[] = [];
  let n = 0;
  let open = false;
  for (const b of data) {
    n = n * 128 + (b & 127);
    open = !!(b & 128);
    if (n > 0xffffffff + 80) throw new Error("Arco OID fuera de rango.");
    if (!open) {
      a.push(n);
      n = 0;
    }
  }
  if (open) throw new Error("OID truncado.");
  const first = a.shift()!;
  const root = first < 40 ? 0 : first < 80 ? 1 : 2;
  return [root, first - root * 40, ...a].join(".");
}
function value(tag: number, data: Buffer): string | number | null {
  if (tag === 2) return numberValue(data, true);
  if ([0x41, 0x42, 0x43].includes(tag)) return numberValue(data, false);
  if (tag === 0x46) {
    if (!data.length || data.length > 9) throw new Error("Counter64 inválido.");
    let n = 0n;
    for (const b of data) n = n * 256n + BigInt(b);
    return n.toString();
  }
  if (tag === 4) return data.toString("utf8");
  if (tag === 6) return decodeOid(data);
  if (tag === 0x40) {
    if (data.length !== 4) throw new Error("IpAddress inválida.");
    return [...data].join(".");
  }
  if ([5, 0x80, 0x81, 0x82].includes(tag)) {
    if (data.length) throw new Error("Excepción SNMP inválida.");
    return null;
  }
  return `0x${data.toString("hex")}`;
}
export function decodeMessage(packet: Uint8Array): SnmpMessage {
  if (packet.length > MAX_PACKET)
    throw new Error("Paquete SNMP demasiado grande.");
  const outer = new Reader(Buffer.from(packet));
  const top = new Reader(outer.read(0x30).data);
  outer.done();
  const version = numberValue(top.read(2).data, true);
  if (![0, 1].includes(version)) throw new Error("Versión SNMP no soportada.");
  const community = top.read(4).data.toString("utf8");
  const p = top.read();
  top.done();
  if (![0xa0, 0xa1, 0xa2].includes(p.tag))
    throw new Error("PDU SNMP no soportada.");
  const r = new Reader(p.data);
  const requestId = numberValue(r.read(2).data, true),
    errorStatus = numberValue(r.read(2).data, true),
    errorIndex = numberValue(r.read(2).data, true);
  const vars = new Reader(r.read(0x30).data);
  r.done();
  const values: SnmpValue[] = [];
  while (vars.offset < vars.data.length) {
    if (values.length >= 128) throw new Error("Demasiadas variables SNMP.");
    const v = new Reader(vars.read(0x30).data);
    const name = decodeOid(v.read(6).data),
      item = v.read();
    v.done();
    values.push({
      oid: name,
      tag: item.tag,
      value: value(item.tag, item.data),
    });
  }
  return {
    version,
    community,
    pdu: p.tag,
    requestId,
    errorStatus,
    errorIndex,
    values,
  };
}
export type UdpExchange = (
  host: string,
  port: number,
  packet: Uint8Array,
  timeout: number,
) => Promise<Uint8Array>;
export const OIDS = {
  sysDescr: "1.3.6.1.2.1.1.1.0",
  uptime: "1.3.6.1.2.1.1.3.0",
  sysName: "1.3.6.1.2.1.1.5.0",
  ifIndex: "1.3.6.1.2.1.2.2.1.1",
  ifDescr: "1.3.6.1.2.1.2.2.1.2",
  ifInOctets: "1.3.6.1.2.1.2.2.1.10",
  ifOutOctets: "1.3.6.1.2.1.2.2.1.16",
};
export class SnmpClient {
  constructor(private exchange: UdpExchange) {}
  async query(
    host: string,
    oids: string[],
    config: {
      community: string;
      version: 0 | 1;
      port: number;
      timeout: number;
    },
    next = false,
  ): Promise<SnmpValue[]> {
    if (!config.community || Buffer.byteLength(config.community) > 255)
      throw new Error("Community debe tener de 1 a 255 bytes.");
    const requestId = 1 + Math.floor(Math.random() * 0x7ffffffe);
    const packet = encodeMessage({
      version: config.version,
      community: config.community,
      pdu: next ? 0xa1 : 0xa0,
      requestId,
      errorStatus: 0,
      errorIndex: 0,
      values: oids.map((oid) => ({ oid, tag: 5, value: null })),
    });
    let result: SnmpMessage | undefined;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        result = decodeMessage(
          await this.exchange(host, config.port, packet, config.timeout),
        );
        break;
      } catch (e) {
        if (attempt || !/timeout|timed out/i.test(String(e))) throw e;
      }
    }
    if (!result) throw new Error("No se recibió una respuesta SNMP válida.");
    const mismatches = [
      result.pdu !== 0xa2 && "tipo de mensaje",
      result.requestId !== requestId && "identificador de consulta",
      result.community !== config.community && "community",
      result.version !== config.version && "versión",
    ].filter(Boolean);
    if (mismatches.length)
      throw new Error(
        `La respuesta SNMP no corresponde a la solicitud (${mismatches.join(", ")}).`,
      );
    if (result.errorStatus)
      throw new SnmpResponseError(result.errorStatus, result.errorIndex);
    if (result.values.length !== oids.length)
      throw new Error("Cantidad de variables SNMP inesperada.");
    result.values.forEach((v, i) => {
      if (!next && v.oid !== oids[i])
        throw new Error("OID de respuesta inesperado.");
    });
    return result.values;
  }
  async inspect(
    host: string,
    config: Parameters<SnmpClient["query"]>[2],
    interfaces = true,
  ) {
    const basics = await this.query(
      host,
      [OIDS.sysName, OIDS.uptime, OIDS.sysDescr],
      config,
    );
    const rows: {
      index: number;
      name: string;
      inOctets: number | string | null;
      outOctets: number | string | null;
    }[] = [];
    let cursor = OIDS.ifIndex;
    let truncated = false;
    if (interfaces) {
      for (let i = 0; i < 64; i++) {
        let v: SnmpValue;
        try {
          [v] = await this.query(host, [cursor], config, true);
        } catch (error) {
          // SNMPv1 no tiene endOfMibView: noSuchName termina el recorrido.
          if (
            config.version === 0 &&
            error instanceof SnmpResponseError &&
            error.status === 2
          )
            break;
          throw error;
        }
        if (v.value === null) break;
        if (compareOids(v.oid, cursor) <= 0)
          throw new Error("El agente SNMP no avanza en la tabla.");
        if (!v.oid.startsWith(`${OIDS.ifIndex}.`)) break;
        cursor = v.oid;
        const index = Number(v.value);
        if (!Number.isInteger(index) || index <= 0)
          throw new Error("Índice de interfaz inválido.");
        const values = await this.query(
          host,
          [OIDS.ifDescr, OIDS.ifInOctets, OIDS.ifOutOctets].map(
            (o) => `${o}.${index}`,
          ),
          config,
        );
        rows.push({
          index,
          name: String(values[0].value ?? `if${index}`),
          inOctets: values[1].value,
          outOctets: values[2].value,
        });
        if (i === 63) truncated = true;
      }
    }
    return {
      sysName: basics[0].value,
      uptimeTicks: basics[1].value,
      description: basics[2].value,
      interfaces: rows,
      truncated,
      sampledAt: Date.now(),
    };
  }
}
export function compareOids(a: string, b: string): number {
  const x = a.split(".").map(Number),
    y = b.split(".").map(Number);
  for (let i = 0; i < Math.min(x.length, y.length); i++)
    if (x[i] !== y[i]) return x[i] - y[i];
  return x.length - y.length;
}
export function formatUptime(ticks: number): string {
  const s = Math.floor(ticks / 100);
  return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}
