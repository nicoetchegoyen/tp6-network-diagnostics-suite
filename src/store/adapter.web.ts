import type { LocalAdapter, StoredRow } from "./repository";
export const localStorageName = "IndexedDB";

export function makeAdapter(): LocalAdapter {
  let opening: Promise<IDBDatabase> | undefined;
  const open = () =>
    (opening ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("fieldkit-expo-go", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("state");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }));
  return {
    async load() {
      const db = await open();
      return new Promise<StoredRow[]>((resolve, reject) => {
        const tx = db.transaction("state", "readonly");
        const request = tx.objectStore("state").get("entries");
        tx.oncomplete = () => resolve(request.result ?? []);
        tx.onabort = () => reject(tx.error);
        tx.onerror = () => reject(tx.error);
      });
    },
    async persist(rows) {
      const db = await open();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("state", "readwrite");
        tx.objectStore("state").put(rows, "entries");
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(tx.error);
        tx.onerror = () => reject(tx.error);
      });
    },
  };
}
