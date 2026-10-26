import { test } from "node:test";
import assert from "node:assert/strict";
import dgram from "node:dgram";
import type { AddressInfo } from "node:net";
import { Buffer } from "buffer";
import {
  decodeMessage,
  encodeMessage,
  OIDS,
  SnmpClient,
  SnmpMessage,
} from "../src/protocol/snmp";
const request: SnmpMessage = {
  version: 0,
  community: "public",
  pdu: 0xa0,
  requestId: 1,
  errorStatus: 0,
  errorIndex: 0,
  values: [{ oid: OIDS.sysName, tag: 5, value: null }],
};
test("GetRequest v1 coincide con un vector BER independiente", () => {
  const hex =
    "302602010004067075626c6963a019020101020100020100300e300c06082b060102010105000500";
  assert.equal(encodeMessage(request).toString("hex"), hex);
  assert.deepEqual(decodeMessage(Buffer.from(hex, "hex")), request);
});
test("BER admite longitudes largas, OIDs multi-byte y Counter64 sin pérdida", () => {
  const response = {
    ...request,
    version: 1,
    pdu: 0xa2,
    values: [
      { oid: "2.999.4294967295.0", tag: 4, value: "á".repeat(160) },
      { oid: OIDS.uptime, tag: 0x43, value: 4294967295 },
      { oid: OIDS.sysName, tag: 0x46, value: "18446744073709551615" },
    ],
  };
  assert.deepEqual(decodeMessage(encodeMessage(response)), response);
});
test("Parser rechaza cada truncamiento y una longitud indefinida", () => {
  const packet = encodeMessage(request);
  for (let i = 0; i < packet.length; i++)
    assert.throws(() => decodeMessage(packet.subarray(0, i)));
  assert.throws(() => decodeMessage(Buffer.from([0x30, 0x80, 0, 0])));
  assert.throws(() => decodeMessage(Buffer.concat([packet, Buffer.from([0])])));
});
test("GET valida request-id, community, versión, PDU y OID", async () => {
  for (const changed of [
    { requestId: -1 },
    { community: "other" },
    { version: 1 },
    { pdu: 0xa0 },
    { values: [{ oid: OIDS.uptime, tag: 5, value: null }] },
  ]) {
    const client = new SnmpClient(async (_h, _p, data) =>
      encodeMessage({ ...decodeMessage(data), pdu: 0xa2, ...changed }),
    );
    await assert.rejects(
      client.query("127.0.0.1", [OIDS.sysName], {
        community: "public",
        version: 0,
        port: 161,
        timeout: 100,
      }),
    );
  }
});
test("GETNEXT rechaza agentes que no avanzan", async () => {
  const client = new SnmpClient(async (_h, _p, data) => {
    const m = decodeMessage(data);
    return encodeMessage({
      ...m,
      pdu: 0xa2,
      values: m.values.map((v) => ({ ...v, tag: 2, value: 1 })),
    });
  });
  await assert.rejects(
    client.inspect("127.0.0.1", {
      community: "public",
      version: 1,
      port: 161,
      timeout: 100,
    }),
    /no avanza/,
  );
});
test("GETNEXT v1 trata noSuchName como final de MIB", async () => {
  const client = new SnmpClient(async (_h, _p, data) => {
    const m = decodeMessage(data);
    return encodeMessage({
      ...m,
      pdu: 0xa2,
      errorStatus: m.pdu === 0xa1 ? 2 : 0,
      errorIndex: m.pdu === 0xa1 ? 1 : 0,
      values: m.values.map((v) => ({ ...v, tag: 4, value: "fixture" })),
    });
  });
  const result = await client.inspect("127.0.0.1", {
    community: "public",
    version: 0,
    port: 161,
    timeout: 100,
  });
  assert.deepEqual(result.interfaces, []);
});
test("SNMP consulta realmente un socket UDP y recorre índices no consecutivos", async () => {
  const agent = dgram.createSocket("udp4");
  const table = [
    { oid: OIDS.sysName, tag: 4, value: "test-router" },
    { oid: OIDS.uptime, tag: 0x43, value: 12000 },
    { oid: OIDS.sysDescr, tag: 4, value: "Fixture" },
    { oid: `${OIDS.ifIndex}.7`, tag: 2, value: 7 },
    { oid: `${OIDS.ifDescr}.7`, tag: 4, value: "ether7" },
    { oid: `${OIDS.ifInOctets}.7`, tag: 0x41, value: 1000 },
    { oid: `${OIDS.ifOutOctets}.7`, tag: 0x41, value: 2000 },
  ];
  agent.on("message", (data, peer) => {
    const m = decodeMessage(data);
    const values = m.values.map(
      (v) =>
        (m.pdu === 0xa1 && v.oid === OIDS.ifIndex
          ? table[3]
          : table.find((t) => t.oid === v.oid && m.pdu !== 0xa1)) || {
          oid: v.oid,
          tag: 0x82,
          value: null,
        },
    );
    agent.send(
      encodeMessage({ ...m, pdu: 0xa2, values }),
      peer.port,
      peer.address,
    );
  });
  await new Promise<void>((resolve) => agent.bind(0, "127.0.0.1", resolve));
  const port = (agent.address() as AddressInfo).port;
  const client = new SnmpClient(
    (host, port, data, timeout) =>
      new Promise((resolve, reject) => {
        const socket = dgram.createSocket("udp4");
        const timer = setTimeout(() => {
          socket.close();
          reject(new Error("timeout"));
        }, timeout);
        socket.once("message", (packet) => {
          clearTimeout(timer);
          socket.close();
          resolve(packet);
        });
        socket.once("error", (e) => {
          clearTimeout(timer);
          socket.close();
          reject(e);
        });
        socket.send(data, port, host);
      }),
  );
  try {
    const result = await client.inspect("127.0.0.1", {
      community: "public",
      version: 1,
      port,
      timeout: 1000,
    });
    assert.equal(result.sysName, "test-router");
    assert.deepEqual(result.interfaces, [
      { index: 7, name: "ether7", inOctets: 1000, outOctets: 2000 },
    ]);
  } finally {
    agent.close();
  }
});
