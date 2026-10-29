import { compareOids, OIDS, SnmpValue } from "../src/protocol/snmp";

export type HostInterface = {
  ifIndex: number;
  name: string;
  description: string;
  receivedBytes: string;
  sentBytes: string;
};
export function hostMib(
  hostname: string,
  description: string,
  uptimeMs: number,
  interfaces: HostInterface[],
): SnmpValue[] {
  const counter = (value: string) => {
    if (!/^\d+$/.test(value)) throw new Error("Contador de Windows inválido.");
    return Number(BigInt(value) % (1n << 32n));
  };
  return [
    { oid: OIDS.sysName, tag: 4, value: hostname },
    { oid: OIDS.sysDescr, tag: 4, value: description },
    { oid: OIDS.uptime, tag: 0x43, value: Math.floor(uptimeMs / 10) % 2 ** 32 },
    ...interfaces.flatMap((adapter) => {
      if (!Number.isInteger(adapter.ifIndex) || adapter.ifIndex <= 0)
        throw new Error("Índice de interfaz inválido.");
      return [
        {
          oid: `${OIDS.ifIndex}.${adapter.ifIndex}`,
          tag: 2,
          value: adapter.ifIndex,
        },
        {
          oid: `${OIDS.ifDescr}.${adapter.ifIndex}`,
          tag: 4,
          value: `${adapter.name} · ${adapter.description}`,
        },
        {
          oid: `${OIDS.ifInOctets}.${adapter.ifIndex}`,
          tag: 0x41,
          value: counter(adapter.receivedBytes),
        },
        {
          oid: `${OIDS.ifOutOctets}.${adapter.ifIndex}`,
          tag: 0x41,
          value: counter(adapter.sentBytes),
        },
      ];
    }),
  ].sort((a, b) => compareOids(a.oid, b.oid));
}
