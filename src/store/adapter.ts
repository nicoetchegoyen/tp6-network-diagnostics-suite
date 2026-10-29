import { NativeModules } from "react-native";
import { makeWatermelonAdapter } from "./watermelonAdapter";

export const localStorageName = "WatermelonDB · SQLite";

export function makeAdapter() {
  if (!NativeModules.WMDatabaseBridge)
    throw new Error("El APK no incluye WatermelonDB. Recompilá la aplicación.");
  return makeWatermelonAdapter();
}
