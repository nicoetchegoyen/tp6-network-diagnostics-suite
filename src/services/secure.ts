import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
const ephemeral = new Map<string, string>();
export const secrets = {
  get: async (key: string) =>
    Platform.OS === "web"
      ? (ephemeral.get(key) ?? null)
      : SecureStore.getItemAsync(key),
  set: async (key: string, value: string) => {
    if (Platform.OS === "web") ephemeral.set(key, value);
    else
      await SecureStore.setItemAsync(key, value, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
  },
  remove: async (key: string) => {
    ephemeral.delete(key);
    if (Platform.OS !== "web") await SecureStore.deleteItemAsync(key);
  },
};
