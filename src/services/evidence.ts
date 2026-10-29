import * as Location from "expo-location";
import * as FileSystem from "expo-file-system/legacy";
import {
  Location as AndroidLocation,
  LocationProvider,
  LocationProfile,
} from "expo-location/next";
import { Coordinates, Photo, uid } from "../domain/types";
import { nativeNetwork } from "./network";
export async function locate(): Promise<Coordinates> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted)
    throw new Error("Habilitá la ubicación para georreferenciar la evidencia.");
  if (!(await Location.hasServicesEnabledAsync()))
    throw new Error("Activá el GPS del dispositivo.");
  // LocationManager también funciona sin Google Play Services.
  AndroidLocation.setLocationProvider(LocationProvider.Android());
  const requestedAt = Date.now();
  const position = await AndroidLocation.getPosition({
    maxCachedAge: 0,
    timeout: 25,
    profile: LocationProfile.OTHER_NAVIGATION,
  });
  if (!position || position.timestamp < requestedAt - 5000)
    throw new Error(
      "No se obtuvo una ubicación reciente. Reintentá al aire libre o enviá una ubicación desde los controles del emulador.",
    );
  return {
    simulated: position.mocked || !!nativeNetwork().runtimeInfo?.().emulator,
    latitude: position.coordinates.latitude,
    longitude: position.coordinates.longitude,
    accuracy: position.horizontalAccuracy,
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
