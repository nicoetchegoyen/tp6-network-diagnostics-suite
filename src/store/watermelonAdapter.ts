import { Database, Model, appSchema, tableSchema } from "@nozbe/watermelondb";
import SQLiteAdapter from "@nozbe/watermelondb/adapters/sqlite";
import type { LocalAdapter, StoredRow } from "./repository";

class Entry extends Model {
  static table = "entries";
  get rowKey() {
    return this._getRaw("row_key") as string;
  }
  set rowKey(value: string) {
    this._setRaw("row_key", value);
  }
  get payload() {
    return this._getRaw("payload") as string;
  }
  set payload(value: string) {
    this._setRaw("payload", value);
  }
}

export function makeWatermelonAdapter(): LocalAdapter {
  const schema = appSchema({
    version: 1,
    tables: [
      tableSchema({
        name: "entries",
        columns: [
          { name: "row_key", type: "string", isIndexed: true },
          { name: "payload", type: "string" },
        ],
      }),
    ],
  });
  const database = new Database({
    adapter: new SQLiteAdapter({
      schema,
      dbName: "fieldkit-native",
      jsi: false,
    }),
    modelClasses: [Entry],
  });
  const entries = database.get<Entry>("entries");
  return {
    async load() {
      return (await entries.query().fetch()).map(
        (entry) => JSON.parse(entry.payload) as StoredRow,
      );
    },
    async persist(rows) {
      await database.write(async () => {
        const previous = await entries.query().fetch();
        const next = new Map(
          rows.map((row) => [
            JSON.stringify([row.kind, row.key]),
            JSON.stringify(row),
          ]),
        );
        const changes: Model[] = [];
        for (const entry of previous) {
          const payload = next.get(entry.rowKey);
          if (payload === undefined)
            changes.push(entry.prepareDestroyPermanently());
          else {
            if (entry.payload !== payload)
              changes.push(
                entry.prepareUpdate((record) => {
                  record.payload = payload;
                }),
              );
            next.delete(entry.rowKey);
          }
        }
        for (const [rowKey, payload] of next) {
          changes.push(
            entries.prepareCreate((record) => {
              record.rowKey = rowKey;
              record.payload = payload;
            }),
          );
        }
        // WatermelonDB confirma entidad, outbox y versiones en un único batch SQLite.
        if (changes.length) await database.batch(...changes);
      });
    },
  };
}
