import * as SQLite from "expo-sqlite";
import type { LocalAdapter, StoredRow } from "./repository";

// Expo Go incluye este módulo tanto en iOS como en Android.
export function makeAdapter(): LocalAdapter {
  let opening: Promise<SQLite.SQLiteDatabase> | undefined;
  const open = () =>
    (opening ??= (async () => {
      const db = await SQLite.openDatabaseAsync("fieldkit-expo-go.db");
      await db.execAsync(`PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS local_entries (
        row_key TEXT PRIMARY KEY NOT NULL, data TEXT NOT NULL
      );`);
      return db;
    })());
  return {
    async load() {
      const db = await open();
      const rows = await db.getAllAsync<{ data: string }>(
        "SELECT data FROM local_entries",
      );
      return rows.map(({ data }) => JSON.parse(data) as StoredRow);
    },
    async persist(rows) {
      const db = await open();
      // Entidades y acciones se confirman juntas, incluso si la app se cierra.
      await db.withExclusiveTransactionAsync(async (tx) => {
        await tx.runAsync("DELETE FROM local_entries");
        for (const row of rows)
          await tx.runAsync(
            "INSERT INTO local_entries (row_key, data) VALUES (?, ?)",
            JSON.stringify([row.kind, row.key]),
            JSON.stringify(row),
          );
      });
    },
  };
}
