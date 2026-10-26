import {
  Database,
  Model,
  Q,
  appSchema,
  tableSchema,
} from "@nozbe/watermelondb";
import { makeAdapter } from "./adapter";
import { EntityKind, OutboxAction, uid } from "../domain/types";

const schema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: "entries",
      columns: [
        { name: "kind", type: "string", isIndexed: true },
        { name: "entity_key", type: "string", isIndexed: true },
        { name: "data", type: "string" },
        { name: "version", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),
  ],
});
class Entry extends Model {
  static table = "entries";
  // Accesores equivalentes a @field: evitan depender del orden de transforms Babel.
  get kind() {
    return this._getRaw("kind") as string;
  }
  set kind(v: string) {
    this._setRaw("kind", v);
  }
  get entityKey() {
    return this._getRaw("entity_key") as string;
  }
  set entityKey(v: string) {
    this._setRaw("entity_key", v);
  }
  get data() {
    return this._getRaw("data") as string;
  }
  set data(v: string) {
    this._setRaw("data", v);
  }
  get version() {
    return this._getRaw("version") as number;
  }
  set version(v: number) {
    this._setRaw("version", v);
  }
  get updatedAt() {
    return this._getRaw("updated_at") as number;
  }
  set updatedAt(v: number) {
    this._setRaw("updated_at", v);
  }
}
export const database = new Database({
  adapter: makeAdapter(schema),
  modelClasses: [Entry],
});
const entries = database.get<Entry>("entries");
async function find(kind: string, key: string) {
  return (
    await entries
      .query(Q.where("kind", kind), Q.where("entity_key", key))
      .fetch()
  )[0];
}
function prepare(
  kind: string,
  key: string,
  payload: unknown,
  existing?: Entry,
  version = 0,
) {
  const mutate = (r: Entry) => {
    r.kind = kind;
    r.entityKey = key;
    r.data = JSON.stringify(payload);
    r.version = version;
    r.updatedAt = Date.now();
  };
  return existing
    ? existing.prepareUpdate(mutate)
    : entries.prepareCreate(mutate);
}
export const store = {
  async all<T>(kind: EntityKind | "outbox"): Promise<T[]> {
    return (
      await entries
        .query(Q.where("kind", kind), Q.sortBy("updated_at", Q.desc))
        .fetch()
    ).map((r) => JSON.parse(r.data));
  },
  async get<T>(kind: EntityKind, key: string): Promise<T | undefined> {
    const r = await find(kind, key);
    return r && JSON.parse(r.data);
  },
  observe(listener: () => void) {
    const sub = entries
      .query()
      .observeWithColumns(["data", "version"])
      .subscribe(listener);
    return () => sub.unsubscribe();
  },
  async save<T extends { id: string }>(
    kind: EntityKind,
    payload: T,
    enqueue = true,
  ) {
    await database.write(async () => {
      const existing = await find(kind, payload.id);
      const batch: Model[] = [
        prepare(kind, payload.id, payload, existing, existing?.version ?? 0),
      ];
      if (enqueue) {
        const pendingRows = await entries
          .query(Q.where("kind", "outbox"))
          .fetch();
        const lastCreatedAt = pendingRows.reduce(
          (latest, row) =>
            Math.max(latest, (JSON.parse(row.data) as OutboxAction).createdAt),
          0,
        );
        // Snapshots inmutables: una edición nunca reemplaza una acción que el worker leyó.
        const action: OutboxAction = {
          id: uid(),
          kind,
          entityId: payload.id,
          payload,
          baseVersion: existing?.version ?? 0,
          attempts: 0,
          nextAttemptAt: 0,
          state: "pending",
          createdAt: Math.max(Date.now(), lastCreatedAt + 1),
        };
        batch.push(prepare("outbox", action.id, action));
      }
      await database.batch(...batch);
    });
  },
  async updateAction(action: OutboxAction) {
    await database.write(async () => {
      const r = await find("outbox", action.id);
      if (r)
        await r.update((e) => {
          e.data = JSON.stringify(action);
        });
    });
  },
  async acknowledge(action: OutboxAction, version: number) {
    await database.write(async () => {
      const queued = await find("outbox", action.id),
        entity = await find(action.kind, action.entityId);
      const batch: Model[] = [];
      if (queued) batch.push(queued.prepareDestroyPermanently());
      if (entity)
        batch.push(
          entity.prepareUpdate((r) => {
            r.version = version;
          }),
        );
      // Las ediciones locales posteriores heredan la versión recién confirmada.
      const rest = await entries.query(Q.where("kind", "outbox")).fetch();
      for (const row of rest) {
        const a: OutboxAction = JSON.parse(row.data);
        if (
          a.id !== action.id &&
          a.kind === action.kind &&
          a.entityId === action.entityId
        )
          batch.push(
            row.prepareUpdate((r) => {
              r.data = JSON.stringify({ ...a, baseVersion: version });
            }),
          );
      }
      await database.batch(...batch);
    });
  },
  async resolve(action: OutboxAction, useLocal: boolean) {
    await database.write(async () => {
      const queued = await find("outbox", action.id),
        entity = await find(action.kind, action.entityId);
      if (!queued) return;
      if (useLocal)
        await queued.update((r) => {
          r.data = JSON.stringify({
            ...action,
            id: action.id,
            baseVersion: action.serverVersion ?? 0,
            state: "pending",
            attempts: 0,
            nextAttemptAt: 0,
            error: undefined,
          });
        });
      else {
        const all = await entries.query(Q.where("kind", "outbox")).fetch();
        const related = all.filter((r) => {
          const a: OutboxAction = JSON.parse(r.data);
          return a.kind === action.kind && a.entityId === action.entityId;
        });
        // Respaldo local antes de reemplazar por la versión elegida del servidor.
        const batch: Model[] = [
          prepare("settings", `conflict-backup-${uid()}`, {
            entity: entity ? JSON.parse(entity.data) : action.payload,
            actions: related.map((r) => JSON.parse(r.data)),
            savedAt: Date.now(),
          }),
          ...related.map((r) => r.prepareDestroyPermanently()),
        ];
        if (entity)
          batch.push(
            prepare(
              action.kind,
              action.entityId,
              action.serverPayload,
              entity,
              action.serverVersion,
            ),
          );
        await database.batch(...batch);
      }
    });
  },
};
