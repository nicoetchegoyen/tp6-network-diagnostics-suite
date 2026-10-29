import { test } from "node:test";
import assert from "node:assert/strict";
import { hostMib } from "../scripts/host-mib";
import { OIDS } from "../src/protocol/snmp";

test("Agente de PC: conserva índices Windows y convierte contadores de 64 bits a Counter32 sin redondear", () => {
  const table = hostMib("PC", "Windows real", 12340, [
    {
      ifIndex: 13,
      name: "Ethernet",
      description: "Realtek",
      receivedBytes: "18446744073709551615",
      sentBytes: "4294967297",
    },
  ]);
  const value = (oid: string) =>
    table.find((entry) => entry.oid === oid)?.value;
  assert.equal(value(`${OIDS.ifIndex}.13`), 13);
  assert.equal(value(`${OIDS.ifDescr}.13`), "Ethernet · Realtek");
  assert.equal(value(`${OIDS.ifInOctets}.13`), 4294967295);
  assert.equal(value(`${OIDS.ifOutOctets}.13`), 1);
  assert.equal(value(OIDS.uptime), 1234);
});

test("Agente de PC: rechaza lecturas inválidas en lugar de inventar contadores", () => {
  const entry = {
    ifIndex: 13,
    name: "Ethernet",
    description: "NIC",
    receivedBytes: "0",
    sentBytes: "0",
  };
  assert.throws(
    () => hostMib("PC", "Windows", 0, [{ ...entry, receivedBytes: "NaN" }]),
    /Contador/,
  );
  assert.throws(
    () => hostMib("PC", "Windows", 0, [{ ...entry, ifIndex: -1 }]),
    /Índice/,
  );
});
