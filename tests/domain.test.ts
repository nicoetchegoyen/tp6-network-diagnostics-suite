import { test } from "node:test";
import assert from "node:assert/strict";
import { parseEquipmentCode, subnetHosts } from "../src/domain/network";
import { diagnosticCommand } from "../src/protocol/commands";
import { escapeHtml } from "../src/reporting/html";
test("Subredes /24, /31 y /32; evita barridos accidentales fuera del alcance", () => {
  const hosts = subnetHosts("192.168.5.10/24");
  assert.equal(hosts.length, 254);
  assert.equal(hosts[0], "192.168.5.1");
  assert.equal(hosts[253], "192.168.5.254");
  assert.deepEqual(subnetHosts("10.0.0.2/31"), ["10.0.0.2", "10.0.0.3"]);
  assert.deepEqual(subnetHosts("10.0.0.2/32"), ["10.0.0.2"]);
  for (const s of ["10.0.0.0/16", "999.1.1.1/24", "10.0.0.1", "10.0.0.1/24/x"])
    assert.throws(() => subnetHosts(s));
});
test("QR toma identificador sin navegar a URLs arbitrarias", () => {
  assert.equal(parseEquipmentCode('{"serial":"ONT-42"}'), "ONT-42");
  assert.equal(
    parseEquipmentCode("https://vendor.test/devices/ONT-43?foo=1"),
    "ONT-43",
  );
  assert.equal(parseEquipmentCode("  RB750GR3 "), "RB750GR3");
  assert.throws(() => parseEquipmentCode("{}"));
});
test("Lista SSH cerrada y escape HTML de notas de usuario", () => {
  assert.equal(diagnosticCommand("linux", "uptime"), "uptime");
  assert.throws(() => diagnosticCommand("linux", "rm -rf /"));
  assert.equal(
    escapeHtml('<script>"x"&</script>'),
    "&lt;script&gt;&quot;x&quot;&amp;&lt;/script&gt;",
  );
});
