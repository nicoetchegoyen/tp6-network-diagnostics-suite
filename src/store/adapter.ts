import SQLiteAdapter from "@nozbe/watermelondb/adapters/sqlite";
import type { AppSchema } from "@nozbe/watermelondb";
export const makeAdapter = (schema: AppSchema) =>
  new SQLiteAdapter({
    schema,
    dbName: "fieldkit",
    jsi: false,
    onSetUpError: (e) => console.error("Error abriendo base local", e),
  });
