import * as Print from "expo-print";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Device, Diagnostic, Installation } from "../domain/types";
import { store } from "../store/database";
import { reportHtml } from "./html";
export async function generateReport(
  installation: Installation,
): Promise<string> {
  if (!FileSystem.documentDirectory)
    throw new Error("Generá el PDF desde Expo Go en tu teléfono.");
  const device = await store.get<Device>("device", installation.deviceId);
  const diagnostics = (await store.all<Diagnostic>("diagnostic"))
    .filter(
      (d) =>
        d.deviceId === installation.deviceId && d.site === installation.site,
    )
    .slice(0, 20);
  const photos = await Promise.all(
    installation.photos.map((p) =>
      FileSystem.readAsStringAsync(p.uri, {
        encoding: FileSystem.EncodingType.Base64,
      }),
    ),
  );
  const { uri } = await Print.printToFileAsync({
    html: reportHtml(installation, device, diagnostics, photos),
    width: 595,
    height: 842,
  });
  const dir = `${FileSystem.documentDirectory}reports/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  const destination = `${dir}installation-${installation.id}-${Date.now()}.pdf`;
  await FileSystem.moveAsync({ from: uri, to: destination });
  return destination;
}
export async function shareReport(uri: string) {
  if (!(await Sharing.isAvailableAsync()))
    throw new Error("No hay un servicio disponible para compartir archivos.");
  await Sharing.shareAsync(uri, {
    mimeType: "application/pdf",
    dialogTitle: "Reporte de instalación",
  });
}
