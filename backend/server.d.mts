import type { Server } from "node:http";
export function createBackend(options?: {
  dataDir?: string;
  token?: string;
  gateway?: boolean;
}): Promise<Server>;
