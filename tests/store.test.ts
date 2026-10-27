import { test } from "node:test";
import assert from "node:assert/strict";
import { LocalStore, StoredRow, LocalAdapter } from "../src/store/repository";
import { OutboxAction } from "../src/domain/types";
import { findEquipment } from "../src/domain/equipment";
import type { Device } from "../src/domain/types";

function fixture() {
  let disk: StoredRow[] = [],
    fail = false;
  const adapter: LocalAdapter = {
    load: async () => structuredClone(disk),
    persist: async (rows) => {
      if (fail) throw new Error("Disco lleno");
      disk = structuredClone(rows);
    },
  };
  return {
    adapter,
    store: new LocalStore(adapter),
    fail: (value: boolean) => {
      fail = value;
    },
  };
}
test("Persistencia de entidad y outbox es atómica y sobrevive a reiniciar", async () => {
  const f = fixture();
  const device = { id: "router", name: "Original" };
  await f.store.save("device", device);
  device.name = "Mutación externa";
  const reopened = new LocalStore(f.adapter);
  assert.equal(
    (await reopened.get<typeof device>("device", "router"))?.name,
    "Original",
  );
  assert.equal(
    (await reopened.all<OutboxAction>("outbox"))[0].entityId,
    "router",
  );
  f.fail(true);
  await assert.rejects(
    f.store.save("device", { id: "router", name: "No persistido" }),
    /Disco lleno/,
  );
  assert.equal(
    (await f.store.get<typeof device>("device", "router"))?.name,
    "Original",
  );
  assert.equal((await f.store.all("outbox")).length, 1);
});
test("Ediciones simultáneas conservan FIFO y propagan versiones confirmadas", async () => {
  const { store } = fixture();
  await Promise.all([
    store.save("device", { id: "router", name: "Primero" }),
    store.save("device", { id: "router", name: "Segundo" }),
  ]);
  const actions = (await store.all<OutboxAction>("outbox")).sort(
    (a, b) => a.createdAt - b.createdAt,
  );
  assert.equal(actions.length, 2);
  assert.ok(actions[0].createdAt < actions[1].createdAt);
  await store.acknowledge(actions[0], 5);
  assert.equal((await store.all<OutboxAction>("outbox"))[0].baseVersion, 5);
  assert.equal(
    (await store.get<{ name: string }>("device", "router"))?.name,
    "Segundo",
  );
});
test("Elegir servidor conserva un respaldo local y elimina sucesoras del conflicto", async () => {
  const { store } = fixture();
  await store.save("device", { id: "router", name: "Local" });
  await store.save("device", { id: "router", name: "Otra edición" });
  const [action] = await store.all<OutboxAction>("outbox");
  await store.resolve(
    {
      ...action,
      serverVersion: 7,
      serverPayload: { id: "router", name: "Remoto" },
    },
    false,
  );
  assert.equal((await store.all("outbox")).length, 0);
  assert.equal(
    (await store.get<{ name: string }>("device", "router"))?.name,
    "Remoto",
  );
  const backups = await store.all<{
    entity: { name: string };
    actions: unknown[];
  }>("settings");
  assert.equal(backups[0].entity.name, "Otra edición");
  assert.equal(backups[0].actions.length, 2);
});
test("La misma IP en sitios distintos y MACs diferentes no mezclan historiales", () => {
  const first: Device = {
    id: "a",
    name: "Router A",
    ip: "192.168.1.1",
    site: "Cliente A",
    mac: "aa:bb:cc:dd:ee:01",
    ports: [],
    source: "manual",
    lastSeen: 0,
  };
  assert.equal(
    findEquipment([first], { ip: first.ip, site: "Cliente B" }),
    undefined,
  );
  assert.equal(
    findEquipment([first], { ...first, mac: "aa:bb:cc:dd:ee:02" }),
    undefined,
  );
  assert.equal(
    findEquipment([first], { ...first, ip: "192.168.1.50" })?.id,
    "a",
  );
  assert.equal(
    findEquipment([first], { ip: first.ip, site: " cliente a " })?.id,
    "a",
  );
});
