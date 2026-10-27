import { test } from "node:test";
import assert from "node:assert/strict";
import dgram from "node:dgram";
import { generateKeyPairSync } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import ssh2 from "ssh2";
import { createBackend } from "../backend/server.mjs";
import { isLanHost } from "../backend/network.mjs";
import { SnmpClient, decodeMessage, encodeMessage } from "../src/protocol/snmp";

test("Puente Expo Go: autenticación, SNMP por UDP real, SSH con huella y comandos restringidos", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "fieldkit-gateway-"));
  const server = await createBackend({
    dataDir,
    token: "local-test",
    gateway: true,
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const call = (operation: string, body: unknown, auth = true) =>
    fetch(`${url}/v1/network/${operation}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(auth ? { Authorization: "Bearer local-test" } : {}),
      },
      body: JSON.stringify(body),
    });
  const udp = dgram.createSocket("udp4");
  udp.on("message", (packet, remote) => {
    const request = decodeMessage(packet);
    const response = encodeMessage({
      ...request,
      pdu: 0xa2,
      values: request.values.map((value) => ({
        ...value,
        tag: 4,
        value: "Equipo UDP real",
      })),
    });
    udp.send(response, remote.port, remote.address);
  });
  await new Promise<void>((resolve) => udp.bind(0, "127.0.0.1", resolve));
  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs1", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  let authenticated = 0;
  const ssh = new ssh2.Server({ hostKeys: [privateKey] }, (client) => {
    client.on("error", () => {});
    client.on("authentication", (context) => {
      if (
        context.method === "password" &&
        context.username === "tech" &&
        context.password === "secret"
      ) {
        authenticated++;
        context.accept();
      } else context.reject();
    });
    client.on("ready", () =>
      client.on("session", (accept) => {
        const session = accept();
        session.on("exec", (acceptExec, _reject, info) => {
          const stream = acceptExec();
          stream.write(`Ejecutado: ${info.command}\n`);
          stream.exit(0);
          stream.end();
        });
      }),
    );
  });
  await new Promise<void>((resolve) => ssh.listen(0, "127.0.0.1", resolve));
  try {
    assert.equal((await call("info", {}, false)).status, 401);
    assert.equal(
      (await call("udp", { host: "8.8.8.8", port: 161, data: "AQ==" })).status,
      422,
    );
    assert.equal(isLanHost("192.168.1.1"), true);
    assert.equal(isLanHost("example.com"), false);
    assert.equal(isLanHost("169.254.169.254"), true);
    const snmp = new SnmpClient(async (host, port, bytes, timeout) => {
      const r = await call("udp", {
        host,
        port,
        data: Buffer.from(bytes).toString("base64"),
        timeout,
      });
      assert.equal(r.status, 200);
      return Buffer.from((await r.json()).result, "base64");
    });
    const result = await snmp.query("127.0.0.1", ["1.3.6.1.2.1.1.5.0"], {
      community: "public",
      version: 1,
      port: (udp.address() as AddressInfo).port,
      timeout: 1000,
    });
    assert.equal(result[0].value, "Equipo UDP real");
    const host = {
      host: "127.0.0.1",
      port: (ssh.address() as AddressInfo).port,
    };
    const fingerprintResponse = await call("fingerprint", host);
    assert.equal(fingerprintResponse.status, 200);
    const fingerprint = (await fingerprintResponse.json()).result;
    assert.match(fingerprint, /^SHA256:/);
    const credentials = {
      ...host,
      username: "tech",
      password: "secret",
      fingerprint,
      command: "uptime",
    };
    assert.equal(
      (await call("ssh", { ...credentials, command: "rm -rf /" })).status,
      422,
    );
    assert.equal(
      (
        await call("ssh", {
          ...credentials,
          fingerprint: `SHA256:${"A".repeat(43)}`,
        })
      ).status,
      502,
    );
    assert.equal(authenticated, 0);
    const execution = await call("ssh", credentials);
    assert.equal(execution.status, 200);
    assert.equal((await execution.json()).result.stdout, "Ejecutado: uptime\n");
    assert.equal(authenticated, 1);
    assert.equal(
      (
        await call("scan", {
          hosts: ["127.0.0.1", "8.8.8.8"],
          probe: "AQ==",
          udpPort: 161,
        })
      ).status,
      422,
    );
  } finally {
    udp.close();
    await new Promise<void>((resolve) => ssh.close(() => resolve()));
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await rm(dataDir, { recursive: true, force: true });
  }
});
