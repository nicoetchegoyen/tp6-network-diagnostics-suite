import * as Location from "expo-location";
import * as FileSystem from "expo-file-system/legacy";
import { Coordinates, Photo, uid } from "../domain/types";
import { nativeNetwork } from "./network";
import { Platform } from "react-native";
export async function locate(): Promise<Coordinates> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted)
    throw new Error("Habilitá la ubicación para georreferenciar la evidencia.");
  if (!(await Location.hasServicesEnabledAsync()))
    throw new Error("Activá el GPS del dispositivo.");
  if (Platform.OS === "android" && nativeNetwork().runtimeInfo) {
    // LocationManager funciona también en Android sin Google Play Services.
    const {
      Location: AndroidLocation,
      LocationProvider,
      LocationProfile,
    } = require("expo-location/next") as typeof import("expo-location/next");
    AndroidLocation.setLocationProvider(LocationProvider.Android());
    const requestedAt = Date.now();
    const position = await AndroidLocation.getPosition({
      maxCachedAge: 0,
      timeout: 25,
      profile: LocationProfile.OTHER_NAVIGATION,
    });
    if (!position || position.timestamp < requestedAt - 5000)
      throw new Error(
        "No se obtuvo una ubicación reciente. Reintentá al aire libre; en el emulador ejecutá PREPARAR_GPS.cmd.",
      );
    return {
      latitude: position.coordinates.latitude,
      longitude: position.coordinates.longitude,
      accuracy: position.horizontalAccuracy,
      timestamp: position.timestamp,
      simulated: position.mocked || !!nativeNetwork().runtimeInfo?.().emulator,
    };
  }
  const position = await Promise.race([
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
    new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              "No se pudo obtener GPS en 25 segundos. Probá al aire libre.",
            ),
          ),
        25000,
      ),
    ),
  ]);
  return {
    simulated: !!position.mocked || !!nativeNetwork().runtimeInfo?.().emulator,
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
    timestamp: position.timestamp,
  };
}
export async function retainPhoto(
  uri: string,
  location: Coordinates,
): Promise<Photo> {
  if (!FileSystem.documentDirectory)
    throw new Error(
      "No está disponible el almacenamiento privado de evidencia.",
    );
  const dir = `${FileSystem.documentDirectory}evidence/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  const id = uid(),
    target = `${dir}${id}.jpg`;
  await FileSystem.copyAsync({ from: uri, to: target });
  return { id, uri: target, location, capturedAt: Date.now() };
}
