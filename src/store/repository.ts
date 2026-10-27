import { EntityKind, OutboxAction, uid } from "../domain/types";

export type StoredRow = {
  kind: EntityKind | "outbox";
  key: string;
  data: unknown;
  version: number;
  updatedAt: number;
};
export interface LocalAdapter {
  load(): Promise<StoredRow[]>;
  persist(rows: StoredRow[]): Promise<void>;
}
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));

export class LocalStore {
  private loaded?: Promise<StoredRow[]>;
  private rows: StoredRow[] = [];
  private serial: Promise<unknown> = Promise.resolve();
  private listeners = new Set<() => void>();
  constructor(private adapter: LocalAdapter) {}
  private async load() {
    this.loaded ??= this.adapter.load().then((rows) => (this.rows = rows));
    await this.loaded;
  }
  private mutate(fn: (rows: StoredRow[]) => void) {
    const task = this.serial.then(async () => {
      await this.load();
      const next = copy(this.rows);
      fn(next);
      await this.adapter.persist(next);
      this.rows = next;
      for (const listener of this.listeners) {
        try {
          listener();
        } catch (error) {
          console.error("Observador local", error);
        }
      }
    });
    this.serial = task.catch(() => {});
    return task;
  }
  all = async <T>(kind: EntityKind | "outbox"): Promise<T[]> => {
    await this.serial;
    await this.load();
    return copy(
      this.rows
        .filter((row) => row.kind === kind)
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map((row) => row.data),
    ) as T[];
  };
  get = async <T>(kind: EntityKind, key: string): Promise<T | undefined> => {
    await this.serial;
    await this.load();
    const row = this.rows.find((r) => r.kind === kind && r.key === key);
    return row ? (copy(row.data) as T) : undefined;
  };
  observe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  save = <T extends { id: string }>(
    kind: EntityKind,
    payload: T,
    enqueue = true,
  ) => {
    const snapshot = copy(payload);
    return this.mutate((rows) => {
      const previous = rows.find(
        (r) => r.kind === kind && r.key === snapshot.id,
      );
      const version = previous?.version ?? 0;
      this.put(rows, kind, snapshot.id, snapshot, version);
      if (!enqueue) return;
      const latest = rows
        .filter((r) => r.kind === "outbox")
        .reduce((n, r) => Math.max(n, (r.data as OutboxAction).createdAt), 0);
      const action: OutboxAction = {
        id: uid(),
        kind,
        entityId: snapshot.id,
        payload: snapshot,
        baseVersion: version,
        attempts: 0,
        nextAttemptAt: 0,
        state: "pending",
        createdAt: Math.max(Date.now(), latest + 1),
      };
      this.put(rows, "outbox", action.id, action);
    });
  };
  updateAction = (action: OutboxAction) =>
    this.mutate((rows) => {
      if (rows.some((r) => r.kind === "outbox" && r.key === action.id))
        this.put(rows, "outbox", action.id, copy(action));
    });
  acknowledge = (action: OutboxAction, version: number) =>
    this.mutate((rows) => {
      const index = rows.findIndex(
        (r) => r.kind === "outbox" && r.key === action.id,
      );
      if (index >= 0) rows.splice(index, 1);
      const entity = rows.find(
        (r) => r.kind === action.kind && r.key === action.entityId,
      );
      if (entity) entity.version = version;
      for (const row of rows) {
        const queued = row.data as OutboxAction;
        if (
          row.kind === "outbox" &&
          queued.kind === action.kind &&
          queued.entityId === action.entityId
        )
          queued.baseVersion = version;
      }
    });
  resolve = (action: OutboxAction, useLocal: boolean) =>
    this.mutate((rows) => {
      const queued = rows.find(
        (r) => r.kind === "outbox" && r.key === action.id,
      );
      if (!queued) return;
      if (useLocal) {
        queued.data = {
          ...action,
          baseVersion: action.serverVersion ?? 0,
          state: "pending",
          attempts: 0,
          nextAttemptAt: 0,
          error: undefined,
        };
        return;
      }
      const related = rows.filter(
        (r) =>
          r.kind === "outbox" &&
          (r.data as OutboxAction).kind === action.kind &&
          (r.data as OutboxAction).entityId === action.entityId,
      );
      const entity = rows.find(
        (r) => r.kind === action.kind && r.key === action.entityId,
      );
      const backupId = `conflict-backup-${uid()}`;
      this.put(rows, "settings", backupId, {
        id: backupId,
        entity: entity?.data ?? action.payload,
        actions: related.map((r) => r.data),
        savedAt: Date.now(),
      });
      for (const row of related) rows.splice(rows.indexOf(row), 1);
      this.put(
        rows,
        action.kind,
        action.entityId,
        action.serverPayload,
        action.serverVersion ?? 0,
      );
    });
  private put(
    rows: StoredRow[],
    kind: StoredRow["kind"],
    key: string,
    data: unknown,
    version = 0,
  ) {
    const row = { kind, key, data, version, updatedAt: Date.now() };
    const index = rows.findIndex((r) => r.kind === kind && r.key === key);
    if (index < 0) rows.push(row);
    else rows[index] = row;
  }
}
