import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import {
  decodeMessage,
  encodeMessage,
  OIDS,
  SnmpMessage,
} from "../src/protocol/snmp";

function mobileProtocol() {
  const moduleRequire = createRequire(path.resolve("package.json"));
  const bufferFile = moduleRequire.resolve("buffer/");
  const context = vm.createContext({});
  // Reproduce a TypedArray implementation that returns plain Uint8Array views.
  // The Buffer polyfill's slice() restores its prototype; subarray() may not.
  vm.runInContext(
    `
    const originalSubarray = Uint8Array.prototype.subarray;
    Uint8Array.prototype.subarray = function(start, end) {
      const view = originalSubarray.call(this, start, end);
      return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
    };
  `,
    context,
  );
  function evaluate(source: string, require: (name: string) => unknown) {
    const module = { exports: {} as any };
    const wrapper = vm.runInContext(
      `(function(require, module, exports) { ${source}\n})`,
      context,
    );
    wrapper(require, module, module.exports);
    return module.exports;
  }
  const buffer = evaluate(
    readFileSync(bufferFile, "utf8"),
    createRequire(bufferFile),
  );
  const code = ts.transpileModule(
    readFileSync("src/protocol/snmp.ts", "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
      },
    },
  ).outputText;
  const protocol = evaluate(code, (name) => {
    if (name !== "buffer")
      throw new Error(`Unexpected mobile dependency: ${name}`);
    return buffer;
  }) as typeof import("../src/protocol/snmp");
  return { protocol, buffer };
}

test("El parser móvil conserva texto y community cuando subarray devuelve Uint8Array", () => {
  const { protocol, buffer } = mobileProtocol();
  assert.equal(
    buffer.Buffer.from("public").subarray(0).toString("utf8"),
    "112,117,98,108,105,99",
  );
  for (const version of [0, 1]) {
    for (const requestId of [1, 127, 128, 32768, 2147483646]) {
      const response: SnmpMessage = {
        version,
        community: "público",
        pdu: 0xa2,
        requestId,
        errorStatus: 0,
        errorIndex: 0,
        values: [
          { oid: OIDS.sysName, tag: 4, value: "Equipo de prueba · señal" },
          { oid: OIDS.uptime, tag: 0x43, value: 4294967295 },
        ],
      };
      const decoded = protocol.decodeMessage(encodeMessage(response));
      assert.deepEqual(JSON.parse(JSON.stringify(decoded)), response);
    }
  }
});

test("El cliente móvil acepta una respuesta correlacionada y mantiene el rechazo de otras consultas", async () => {
  const { protocol } = mobileProtocol();
  for (const version of [0, 1] as const) {
    const client = new protocol.SnmpClient(async (_host, _port, packet) => {
      const request = decodeMessage(packet);
      assert.equal(request.community, "public");
      return encodeMessage({
        ...request,
        pdu: 0xa2,
        values: request.values.map((v) => ({
          ...v,
          tag: 4,
          value: "Nombre correcto",
        })),
      });
    });
    const values = await client.query("192.168.1.4", [OIDS.sysName], {
      community: "public",
      version,
      port: 1161,
      timeout: 1500,
    });
    assert.equal(values[0].value, "Nombre correcto");
  }
  const wrongReply = new protocol.SnmpClient(async (_host, _port, packet) => {
    const request = decodeMessage(packet);
    return encodeMessage({
      ...request,
      requestId: request.requestId + 1,
      pdu: 0xa2,
    });
  });
  await assert.rejects(
    wrongReply.query("192.168.1.4", [OIDS.sysName], {
      community: "public",
      version: 1,
      port: 1161,
      timeout: 1500,
    }),
    /no corresponde/,
  );
});
