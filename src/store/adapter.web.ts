import LokiJSAdapter from "@nozbe/watermelondb/adapters/lokijs";
import type { AppSchema } from "@nozbe/watermelondb";
export const makeAdapter = (schema: AppSchema) =>
  new LokiJSAdapter({
    schema,
    dbName: "fieldkit-preview",
    useWebWorker: false,
    useIncrementalIndexedDB: true,
    onSetUpError: (e) => console.error("Error abriendo base local", e),
  });
