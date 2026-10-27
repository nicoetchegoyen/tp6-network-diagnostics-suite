import * as Location from "expo-location";
import * as FileSystem from "expo-file-system/legacy";
import { Coordinates, Photo, uid } from "../domain/types";
export async function locate(): Promise<Coordinates> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted)
    throw new Error("Habilitá la ubicación para georreferenciar la evidencia.");
  if (!(await Location.hasServicesEnabledAsync()))
    throw new Error("Activá el GPS del dispositivo.");
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
    throw new Error("Guardá la evidencia desde Expo Go en tu teléfono.");
  const dir = `${FileSystem.documentDirectory}evidence/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  const id = uid(),
    target = `${dir}${id}.jpg`;
  await FileSystem.copyAsync({ from: uri, to: target });
  return { id, uri: target, location, capturedAt: Date.now() };
}
