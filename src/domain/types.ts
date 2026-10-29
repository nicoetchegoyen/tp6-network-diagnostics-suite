export type Device = {
  id: string;
  ip: string;
  mac?: string;
  hostname?: string;
  serviceName?: string;
  name: string;
  source: "tcp" | "udp" | "mdns" | "manual";
  ports: number[];
  lastSeen: number;
  site: string;
  barcode?: string;
  datasheet?: Datasheet;
};
export type Datasheet = {
  code: string;
  vendor: string;
  model: string;
  description: string;
  specs: Record<string, string>;
  url?: string;
  cachedAt: number;
};
export type Coordinates = {
  simulated?: boolean;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
};
export type Photo = {
  id: string;
  uri: string;
  location: Coordinates;
  capturedAt: number;
};
export type Diagnostic = {
  id: string;
  deviceId: string;
  site: string;
  kind: "snmp" | "ssh";
  createdAt: number;
  success: boolean;
  result: unknown;
};
export type Installation = {
  id: string;
  deviceId: string;
  site: string;
  technician: string;
  notes: string;
  location: Coordinates;
  photos: Photo[];
  createdAt: number;
  pdfUri?: string;
  pdfError?: string;
};
export type EntityKind =
  | "device"
  | "diagnostic"
  | "installation"
  | "datasheet"
  | "settings";
export type AssetRef = { hash: string; mime: string; size: number };
export type OutboxAction = {
  id: string;
  entityId: string;
  kind: EntityKind;
  payload: unknown;
  baseVersion: number;
  attempts: number;
  nextAttemptAt: number;
  state: "pending" | "sending" | "conflict" | "failed";
  error?: string;
  serverVersion?: number;
  serverPayload?: unknown;
  serverAssets?: Record<string, AssetRef>;
  createdAt: number;
};
export type Settings = {
  id: string;
  backendUrl: string;
  technician: string;
  site: string;
  community: string;
  snmpVersion: 0 | 1;
  snmpPort: number;
  timeout: number;
  autoSync: boolean;
};
export const DEFAULT_SETTINGS: Settings = {
  id: "preferences",
  backendUrl: process.env.EXPO_PUBLIC_FIELDKIT_BACKEND || "",
  technician: "",
  site: "",
  community: "public",
  snmpVersion: 1,
  snmpPort: 161,
  timeout: 1500,
  autoSync: true,
};
export const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
