import dgram from "node:dgram";
import os from "node:os";
import {
  compareOids,
  decodeMessage,
  encodeMessage,
  OIDS,
  SnmpValue,
} from "../src/protocol/snmp";
const port = Number(process.env.SNMP_PORT || 1161),
  community = process.env.SNMP_COMMUNITY || "public";
const start = Date.now();
const socket = dgram.createSocket("udp4");
socket.on("message", (packet, peer) => {
  try {
    const m = decodeMessage(packet);
    if (m.community !== community || ![0xa0, 0xa1].includes(m.pdu)) return;
    const table: SnmpValue[] = [
      { oid: OIDS.sysName, tag: 4, value: os.hostname() },
      {
        oid: OIDS.sysDescr,
        tag: 4,
        value: "Fieldkit TP6 lab SNMP agent (fixture)",
      },
      {
        oid: OIDS.uptime,
        tag: 0x43,
        value: Math.floor((Date.now() - start) / 10),
      },
      ...[1, 3].flatMap((index) => [
        { oid: `${OIDS.ifIndex}.${index}`, tag: 2, value: index },
        {
          oid: `${OIDS.ifDescr}.${index}`,
          tag: 4,
          value: index === 1 ? "eth0" : "wlan0",
        },
        {
          oid: `${OIDS.ifInOctets}.${index}`,
          tag: 0x41,
          value: Math.floor(((Date.now() - start) * index) / 10) % 0xffffffff,
        },
        {
          oid: `${OIDS.ifOutOctets}.${index}`,
          tag: 0x41,
          value: Math.floor(((Date.now() - start) * index) / 20) % 0xffffffff,
        },
      ]),
    ].sort((a, b) => compareOids(a.oid, b.oid));
    let missing = 0;
    const values = m.values.map((v, i) => {
      const found =
        m.pdu === 0xa1
          ? table.find((t) => compareOids(t.oid, v.oid) > 0)
          : table.find((t) => t.oid === v.oid);
      if (found) return found;
      if (m.version === 0) missing ||= i + 1;
      return {
        oid: v.oid,
        tag: m.version === 0 ? 5 : m.pdu === 0xa1 ? 0x82 : 0x80,
        value: null,
      };
    });
    socket.send(
      encodeMessage({
        ...m,
        pdu: 0xa2,
        errorStatus: missing ? 2 : 0,
        errorIndex: missing,
        values,
      }),
      peer.port,
      peer.address,
    );
  } catch (e) {
    console.error("Paquete rechazado:", (e as Error).message);
  }
});
socket.bind(port, "0.0.0.0", () =>
  console.log(
    `SNMP de laboratorio UDP/${port}, community ${community}. Consultar la IP de esta PC; no sustituye un equipo real.`,
  ),
);
