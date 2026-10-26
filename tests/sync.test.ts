import { test } from "node:test";
import assert from "node:assert/strict";
import { SyncEngine, SyncPort, retryDelay } from "../src/sync/engine";
import { OutboxAction } from "../src/domain/types";
function action(id = "a"): OutboxAction {
  return {
    id,
    kind: "device",
    entityId: "router",
    payload: { id: "router" },
    baseVersion: 0,
    attempts: 0,
    nextAttemptAt: 0,
    state: "pending",
    createdAt: id === "a" ? 1 : 2,
  };
}
function fixture(initial = [action()]) {
  let rows = structuredClone(initial);
  const sent: string[] = [];
  let response = { status: 200, version: 1 };
  let offline = false;
  const port: SyncPort = {
    list: async () => structuredClone(rows),
    update: async (a) => {
      rows = rows.map((r) => (r.id === a.id ? structuredClone(a) : r));
    },
    acknowledge: async (a, version) => {
      rows = rows
        .filter((r) => r.id !== a.id)
        .map((r) =>
          r.entityId === a.entityId ? { ...r, baseVersion: version } : r,
        );
    },
    prepare: async (a) => a.payload,
    send: async (a) => {
      if (offline) throw new Error("offline");
      sent.push(a.id);
      return response;
    },
  };
  return {
    port,
    rows: () => rows,
    sent,
    offline: (v: boolean) => (offline = v),
    response: (r: typeof response) => (response = r),
  };
}
test("Falla offline conserva la acción y reconectar permite confirmarla", async () => {
  const f = fixture();
  f.offline(true);
  let now = 10;
  const engine = new SyncEngine(f.port, () => now);
  await engine.run();
  assert.equal(f.rows().length, 1);
  assert.equal(f.rows()[0].attempts, 1);
  assert.equal(f.rows()[0].state, "pending");
  f.offline(false);
  now = 5000;
  await engine.run();
  assert.equal(f.rows().length, 0);
});
test("Backoff está acotado y no reintenta antes de tiempo", async () => {
  assert.equal(
    retryDelay(1, () => 0),
    2000,
  );
  assert.equal(
    retryDelay(20, () => 0),
    300000,
  );
  const f = fixture([{ ...action(), nextAttemptAt: 1000 }]);
  await new SyncEngine(f.port, () => 100).run();
  assert.equal(f.sent.length, 0);
});
test("Recupera acciones interrumpidas y evita workers simultáneos", async () => {
  const f = fixture([{ ...action(), state: "sending" }]);
  const engine = new SyncEngine(f.port);
  await engine.recover();
  assert.equal(f.rows()[0].state, "pending");
  await Promise.all([engine.run(), engine.run()]);
  assert.deepEqual(f.sent, ["a"]);
});
test("Conflicto bloquea sucesoras de la entidad y no borra el snapshot", async () => {
  const f = fixture([action(), action("b")]);
  f.response({ status: 409, version: 3 });
  await new SyncEngine(f.port).run();
  assert.equal(f.rows()[0].state, "conflict");
  assert.equal(f.rows()[0].serverVersion, 3);
  assert.equal(f.rows()[1].state, "pending");
  assert.deepEqual(f.sent, ["a"]);
});
test("Errores permanentes requieren revisión; 8 fallos no descartan datos", async () => {
  const f = fixture();
  f.response({ status: 401, version: 0 });
  await new SyncEngine(f.port).run();
  assert.equal(f.rows()[0].state, "failed");
  const g = fixture([{ ...action(), attempts: 7 }]);
  g.offline(true);
  await new SyncEngine(g.port).run();
  assert.equal(g.rows()[0].state, "failed");
  assert.equal(g.rows().length, 1);
});
test("Orden por entidad transmite la versión confirmada a la próxima acción", async () => {
  const f = fixture([action(), action("b")]);
  const versions: number[] = [];
  f.port.send = async (a) => {
    versions.push(a.baseVersion);
    return { status: 200, version: a.baseVersion + 1 };
  };
  await new SyncEngine(f.port).run();
  assert.deepEqual(versions, [0, 1]);
  assert.equal(f.rows().length, 0);
});
