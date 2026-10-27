import { AssetRef, OutboxAction } from "../domain/types";
export interface SyncPort {
  list(): Promise<OutboxAction[]>;
  update(action: OutboxAction): Promise<void>;
  acknowledge(action: OutboxAction, version: number): Promise<void>;
  prepare(action: OutboxAction): Promise<unknown>;
  send(
    action: OutboxAction,
    payload: unknown,
  ): Promise<{
    status: number;
    version?: number;
    payload?: unknown;
    assets?: Record<string, AssetRef>;
    error?: string;
  }>;
}
export function retryDelay(attempt: number, random = Math.random): number {
  return (
    Math.min(300000, 2000 * 2 ** Math.min(attempt - 1, 8)) +
    Math.floor(random() * 1000)
  );
}
export class SyncEngine {
  private running = false;
  constructor(
    private port: SyncPort,
    private now = Date.now,
  ) {}
  async recover() {
    for (const action of await this.port.list())
      if (action.state === "sending")
        await this.port.update({ ...action, state: "pending" });
  }
  async run({ force = false }: { force?: boolean } = {}): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const actions = (await this.port.list()).sort(
        (a, b) => a.createdAt - b.createdAt,
      );
      const blocked = new Set<string>();
      for (const original of actions) {
        const entityKey = `${original.kind}:${original.entityId}`;
        if (blocked.has(entityKey)) continue;
        if (
          original.state !== "pending" ||
          (!force && original.nextAttemptAt > this.now())
        ) {
          blocked.add(entityKey);
          continue;
        }
        let action = { ...original, state: "sending" as const };
        await this.port.update(action);
        try {
          const payload = await this.port.prepare(action);
          const response = await this.port.send(action, payload);
          if (
            response.status >= 200 &&
            response.status < 300 &&
            Number.isInteger(response.version)
          ) {
            await this.port.acknowledge(action, response.version!);
            // Actualizar también el snapshot de la iteración actual.
            actions.forEach((a) => {
              if (a.kind === action.kind && a.entityId === action.entityId)
                a.baseVersion = response.version!;
            });
          } else if (response.status === 409) {
            await this.port.update({
              ...action,
              state: "conflict",
              serverVersion: response.version,
              serverPayload: response.payload,
              serverAssets: response.assets,
              error:
                "El servidor tiene otra versión. Elegí qué datos conservar.",
            });
            blocked.add(entityKey);
          } else if (
            response.status >= 400 &&
            response.status < 500 &&
            ![408, 429].includes(response.status)
          ) {
            await this.port.update({
              ...action,
              state: "failed",
              error:
                response.error ||
                `El backend rechazó la acción (HTTP ${response.status}).`,
            });
            blocked.add(entityKey);
          } else
            throw new Error(
              response.error || `Backend HTTP ${response.status}`,
            );
        } catch (error) {
          const attempts = action.attempts + 1;
          await this.port.update({
            ...action,
            attempts,
            state: "pending",
            nextAttemptAt: this.now() + retryDelay(attempts),
            error:
              error instanceof Error
                ? error.message
                : "Error de sincronización.",
          });
          blocked.add(entityKey);
        }
      }
    } finally {
      this.running = false;
    }
  }
}
