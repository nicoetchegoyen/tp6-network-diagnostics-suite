import { NativeModules } from "react-native";
import { requireOptionalNativeModule } from "expo";
import { makeAdapter as makeExpoAdapter } from "./sqliteAdapter";
import type { LocalAdapter } from "./repository";

const available = !!NativeModules.WMDatabaseBridge;
export const localStorageName = available
  ? "WatermelonDB · SQLite"
  : "SQLite de Expo";

export function makeAdapter(): LocalAdapter {
  if (available) {
    return (
      require("./watermelonAdapter") as typeof import("./watermelonAdapter")
    ).makeWatermelonAdapter();
  }
  if (requireOptionalNativeModule("FieldNetwork")) {
    throw new Error(
      "El APK no incluye WatermelonDB. Recompilá la aplicación Android.",
    );
  }
  return makeExpoAdapter();
}
