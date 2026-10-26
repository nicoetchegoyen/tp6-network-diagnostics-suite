import * as FileSystem from "expo-file-system/legacy";
import {
  Datasheet,
  Installation,
  OutboxAction,
  Settings,
} from "../domain/types";
import { store } from "../store/database";
import { secrets } from "./secure";
import { SyncEngine } from "../sync/engine";
import { generateReport } from "../reporting/report";
export function validateBackendUrl(value: string): string {
  const clean = value.trim().replace(/\/+$/, "");
  if (!clean) return "";
  const url = new URL(clean);
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error(
      "Ingresá una URL HTTP/HTTPS sin credenciales ni parámetros.",
    );
  return clean;
}
async function request(url: string, init: RequestInit = {}) {
  const token = await secrets.get("backend-token");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
  } finally {
    clearTimeout(timer);
  }
}
export async function backendHealth(url: string) {
  if (!url) throw new Error("Configurá la URL del backend en Ajustes.");
  const r = await request(`${url}/v1/health`);
  if (!r.ok) throw new Error(`Backend HTTP ${r.status}. Revisá URL y token.`);
  return r.json();
}
export async function lookupDatasheet(
  code: string,
  backendUrl: string,
): Promise<Datasheet | undefined> {
  const cached = await store.get<Datasheet & { id: string }>("datasheet", code);
  if (!backendUrl) return cached;
  try {
    const r = await request(
      `${backendUrl}/v1/catalog/${encodeURIComponent(code)}`,
    );
    if (r.status === 404) return cached;
    if (!r.ok) throw new Error(`Ficha técnica HTTP ${r.status}`);
    const sheet: Datasheet = {
      ...(await r.json()),
      code,
      cachedAt: Date.now(),
    };
    await store.save("datasheet", { ...sheet, id: code }, false);
    return sheet;
  } catch {
    return cached;
  }
}
export async function useServerConflict(
  action: OutboxAction,
  backendUrl: string,
) {
  let payload = action.serverPayload as any;
  if (!payload)
    throw new Error("El servidor no devolvió datos para este conflicto.");
  if (action.kind === "installation") {
    if (!FileSystem.documentDirectory)
      throw new Error("Restaurar evidencia requiere Android.");
    const dir = `${FileSystem.documentDirectory}remote-evidence/`;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    const token = await secrets.get("backend-token");
    const download = async (id: string) => {
      const ref = action.serverAssets?.[id];
      if (!ref || !/^[a-f0-9]{64}$/.test(ref.hash))
        throw new Error("El servidor no incluye un adjunto válido.");
      const target = `${dir}${ref.hash}.${ref.mime === "application/pdf" ? "pdf" : "jpg"}`;
      if (!(await FileSystem.getInfoAsync(target)).exists) {
        const response = await FileSystem.downloadAsync(
          `${backendUrl}/v1/assets/${ref.hash}`,
          target,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} },
        );
        if (response.status !== 200)
          throw new Error(
            "No se pudo descargar la evidencia del servidor. Se conserva tu versión local.",
          );
      }
      return target;
    };
    const photos = await Promise.all(
      payload.photos.map(async (photo: any) => ({
        ...photo,
        uri: await download(photo.assetId),
      })),
    );
    payload = {
      ...payload,
      photos,
      pdfUri: await download(payload.pdfAssetId),
      pdfError: undefined,
    };
  }
  await store.resolve({ ...action, serverPayload: payload }, false);
}
export function createSync(getSettings: () => Settings) {
  return new SyncEngine({
    list: () => store.all<OutboxAction>("outbox"),
    update: store.updateAction,
    acknowledge: store.acknowledge,
    async prepare(action) {
      const assets: { id: string; mime: string; base64: string }[] = [];
      let payload = action.payload;
      if (action.kind === "installation") {
        let installation = action.payload as Installation;
        if (!installation.pdfUri) {
          installation = {
            ...installation,
            pdfUri: await generateReport(installation),
            pdfError: undefined,
          };
          // Conserva la edición más reciente si otro formulario modificó el registro.
          const current = await store.get<Installation>(
            "installation",
            installation.id,
          );
          if (
            current &&
            JSON.stringify(current) === JSON.stringify(action.payload)
          )
            await store.save("installation", installation, false);
          action.payload = installation;
          await store.updateAction(action);
        }
        for (const photo of installation.photos)
          assets.push({
            id: photo.id,
            mime: "image/jpeg",
            base64: await FileSystem.readAsStringAsync(photo.uri, {
              encoding: FileSystem.EncodingType.Base64,
            }),
          });
        assets.push({
          id: `${installation.id}-pdf`,
          mime: "application/pdf",
          base64: await FileSystem.readAsStringAsync(installation.pdfUri!, {
            encoding: FileSystem.EncodingType.Base64,
          }),
        });
        payload = {
          ...installation,
          pdfUri: undefined,
          pdfAssetId: `${installation.id}-pdf`,
          photos: installation.photos.map(({ uri, ...photo }) => ({
            ...photo,
            assetId: photo.id,
          })),
        };
      }
      return { payload, assets };
    },
    async send(action, prepared) {
      const url = getSettings().backendUrl;
      if (!url) throw new Error("Configurá el backend para sincronizar.");
      const response = await request(`${url}/v1/sync`, {
        method: "POST",
        body: JSON.stringify({
          actionId: action.id,
          kind: action.kind,
          entityId: action.entityId,
          baseVersion: action.baseVersion,
          ...(prepared as object),
        }),
      });
      let data: Record<string, unknown>;
      try {
        data = await response.json();
      } catch {
        data = { error: "El backend no devolvió JSON válido." };
      }
      return { ...data, status: response.status };
    },
  });
}
