import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { AddressInfo } from "node:net";
import { createBackend } from "../backend/server.mjs";
test("Backend HTTP: autenticación, idempotencia persistida, conflictos y adjuntos", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "fieldkit-test-"));
  let server = await createBackend({ dataDir, token: "test" });
  const listen = async () => {
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  };
  let url = await listen();
  const headers = {
    "Content-Type": "application/json",
    Authorization: "Bearer test",
  };
  const send = async (body: unknown) =>
    fetch(`${url}/v1/sync`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  try {
    assert.equal((await fetch(`${url}/v1/health`)).status, 401);
    assert.equal((await fetch(`${url}/v1/health`, { headers })).status, 200);
    const a = {
      actionId: "a",
      kind: "device",
      entityId: "router",
      baseVersion: 0,
      payload: { id: "router", name: "Gateway" },
    };
    let r = await send(a);
    assert.equal(r.status, 200);
    assert.equal((await r.json()).version, 1);
    r = await send(a);
    assert.equal((await r.json()).duplicate, true);
    r = await send({ ...a, actionId: "b" });
    assert.equal(r.status, 409);
    assert.equal((await r.json()).version, 1);
    r = await send({ ...a, actionId: "b", baseVersion: 1 });
    assert.equal((await r.json()).version, 2);
    assert.equal(
      (
        await send({
          ...a,
          actionId: "secret",
          payload: { id: "router", password: "do-not-store" },
        })
      ).status,
      422,
    );
    const installation = {
      actionId: "i",
      kind: "installation",
      entityId: "visit",
      baseVersion: 0,
      payload: {
        id: "visit",
        location: { latitude: -32, longitude: -58 },
        photos: [
          { assetId: "photo", location: { latitude: -32, longitude: -58 } },
        ],
        pdfAssetId: "pdf",
      },
      assets: [
        {
          id: "photo",
          mime: "image/jpeg",
          base64: Buffer.from([255, 216, 255, 217]).toString("base64"),
        },
        {
          id: "pdf",
          mime: "application/pdf",
          base64: Buffer.from("%PDF-1.4\nfixture").toString("base64"),
        },
      ],
    };
    assert.equal((await send(installation)).status, 200);
    const all = await (await fetch(`${url}/v1/entities`, { headers })).json();
    const entity = all.find((e: any) => e.kind === "installation");
    assert.equal(
      (await fetch(`${url}/v1/assets/${entity.assets.pdf.hash}`, { headers }))
        .status,
      200,
    );
    await new Promise<void>((r) => server.close(() => r()));
    server = await createBackend({ dataDir, token: "test" });
    url = await listen();
    assert.equal((await (await send(a)).json()).duplicate, true);
    assert.equal(
      (await fetch(`${url}/v1/catalog/RB750GR3`, { headers })).status,
      200,
    );
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
    const resolved = path.resolve(dataDir);
    const tempPrefix = path.join(path.resolve(os.tmpdir()), "fieldkit-test-");
    if (!resolved.startsWith(tempPrefix))
      throw new Error(
        "El directorio de prueba está fuera del temporal esperado.",
      );
    await rm(resolved, { recursive: true, force: true });
  }
});
