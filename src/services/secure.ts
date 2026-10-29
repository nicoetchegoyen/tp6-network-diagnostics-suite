import * as SecureStore from "expo-secure-store";
export const secrets = {
  get: (key: string) => SecureStore.getItemAsync(key),
  set: async (key: string, value: string) => {
    await SecureStore.setItemAsync(key, value);
  },
  remove: (key: string) => SecureStore.deleteItemAsync(key),
};
