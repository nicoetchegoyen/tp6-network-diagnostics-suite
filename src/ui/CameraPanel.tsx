import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Button, C } from "./components";

type Props =
  | { mode: "qr"; onCode(code: string): void }
  | { mode: "photo"; onPhoto(uri: string): Promise<void> };

export function CameraPanel(props: Props) {
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const [permissionBusy, setPermissionBusy] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [slow, setSlow] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [facing, setFacing] = useState<"back" | "front">("back");
  const [attempt, setAttempt] = useState(0);
  const camera = useRef<CameraView>(null);
  const requested = useRef(false);
  const locked = useRef(false);
  const captureLock = useRef(false);

  const askPermission = useCallback(async () => {
    setPermissionBusy(true);
    setError("");
    try {
      await requestPermission();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo pedir permiso de cámara.",
      );
    } finally {
      setPermissionBusy(false);
    }
  }, [requestPermission]);

  useEffect(() => {
    if (
      permission &&
      !permission.granted &&
      permission.canAskAgain &&
      !requested.current
    ) {
      requested.current = true;
      void askPermission();
    }
  }, [permission, askPermission]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void getPermission().catch(() => {});
    });
    return () => subscription.remove();
  }, [getPermission]);

  useEffect(() => {
    setReady(false);
    setSlow(false);
    setError("");
    if (!permission?.granted) return;
    const timer = setTimeout(() => setSlow(true), 10000);
    return () => clearTimeout(timer);
  }, [permission?.granted, facing, attempt]);

  function retry() {
    setAttempt((value) => value + 1);
  }

  async function capture() {
    if (!ready || captureLock.current || props.mode !== "photo") return;
    captureLock.current = true;
    setCapturing(true);
    setError("");
    try {
      const picture = await camera.current?.takePictureAsync({ quality: 0.35 });
      if (!picture) throw new Error("No se capturó la foto. Volvé a intentar.");
      await props.onPhoto(picture.uri);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo guardar la evidencia.",
      );
    } finally {
      captureLock.current = false;
      setCapturing(false);
    }
  }

  if (!permission || !permission.granted) {
    return (
      <View style={styles.permission}>
        {(!permission || permissionBusy) && <ActivityIndicator color="white" />}
        <Text style={styles.title}>Permiso de cámara</Text>
        <Text style={styles.text}>
          {permission
            ? "Permití que Fieldkit use la cámara para leer códigos y tomar fotos."
            : "Comprobando el acceso a la cámara…"}
        </Text>
        {!!error && <Text style={styles.error}>{error}</Text>}
        {permission && (
          <Button
            title={
              permission.canAskAgain
                ? "Permitir cámara"
                : "Abrir ajustes del teléfono"
            }
            busy={permissionBusy}
            onPress={() => {
              if (permission.canAskAgain) void askPermission();
              else
                void Linking.openSettings().catch(() =>
                  setError("Habilitá Cámara en los permisos de Fieldkit."),
                );
            }}
          />
        )}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.preview}>
        <CameraView
          key={`${facing}:${attempt}`}
          ref={camera}
          style={StyleSheet.absoluteFill}
          facing={facing}
          autofocus="on"
          zoom={0}
          onCameraReady={() => {
            setReady(true);
            setError("");
          }}
          onMountError={({ message }) => {
            setReady(false);
            setError(`No se pudo abrir esta cámara: ${message}`);
          }}
          barcodeScannerSettings={{
            barcodeTypes: [
              "qr",
              "ean13",
              "ean8",
              "code128",
              "code39",
              "pdf417",
              "datamatrix",
            ],
          }}
          onBarcodeScanned={
            props.mode === "qr"
              ? ({ data }) => {
                  if (locked.current || !data.trim()) return;
                  locked.current = true;
                  props.onCode(data);
                }
              : undefined
          }
        />
        {ready && props.mode === "qr" && (
          <View pointerEvents="none" style={styles.frame} />
        )}
        {!ready && (
          <View pointerEvents="none" style={styles.loading}>
            {!error && <ActivityIndicator color="white" size="large" />}
            <Text style={styles.text}>
              {error ||
                (slow
                  ? "La cámara está demorando. Tocá Reintentar cámara o cambiá de cámara."
                  : "Abriendo cámara…")}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.controls}>
        <Text style={styles.text}>
          {props.mode === "qr"
            ? "Apuntá al código y mantené la cámara quieta hasta reconocerlo."
            : "La foto se guardará con fecha y una nueva lectura de GPS."}
        </Text>
        {!!error && ready && <Text style={styles.error}>{error}</Text>}
        {props.mode === "photo" && (
          <Button
            title={capturing ? "Guardando foto y GPS…" : "Capturar evidencia"}
            icon="camera"
            disabled={!ready}
            busy={capturing}
            onPress={() => void capture()}
          />
        )}
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            disabled={capturing}
            onPress={retry}
            style={styles.action}
          >
            <Text style={styles.link}>Reintentar cámara</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={capturing}
            onPress={() => {
              setFacing(facing === "back" ? "front" : "back");
            }}
            style={styles.action}
          >
            <Text style={styles.link}>
              {facing === "back" ? "Usar frontal" : "Usar trasera"}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.navy },
  preview: { flex: 1, minHeight: 140, backgroundColor: "#081818" },
  controls: { padding: 16, gap: 12 },
  permission: {
    flex: 1,
    backgroundColor: C.navy,
    padding: 24,
    gap: 20,
    justifyContent: "center",
  },
  title: {
    color: "white",
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  text: { color: "#E2F5EA", fontSize: 14, textAlign: "center", lineHeight: 20 },
  error: { color: "#FFD3CA", fontSize: 14, textAlign: "center" },
  actions: { flexDirection: "row", justifyContent: "space-around", gap: 8 },
  action: { paddingVertical: 12, paddingHorizontal: 4 },
  link: { color: "#C9E6D9", fontSize: 13, textDecorationLine: "underline" },
  loading: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    gap: 18,
    justifyContent: "center",
    backgroundColor: "#081818DD",
  },
  frame: {
    position: "absolute",
    left: "12%",
    top: "15%",
    width: "76%",
    height: "65%",
    borderWidth: 2,
    borderColor: "#E2F5D6",
    borderRadius: 24,
  },
});
