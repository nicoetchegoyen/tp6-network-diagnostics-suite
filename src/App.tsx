import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { CameraPanel } from "./ui/CameraPanel";
import NetInfo from "@react-native-community/netinfo";
import {
  Badge,
  Button,
  C,
  Card,
  Empty,
  Field,
  Icon,
  IconName,
  KV,
  Label,
  Section,
  s,
} from "./ui/components";
import {
  DEFAULT_SETTINGS,
  Coordinates,
  Device,
  Diagnostic,
  Installation,
  OutboxAction,
  Photo,
  Settings,
  uid,
} from "./domain/types";
import { ipv4ToInt, parseEquipmentCode } from "./domain/network";
import { findEquipment } from "./domain/equipment";
import { store } from "./store/database";
import {
  discover,
  nativeNetwork,
  runSSH,
  snmp,
  snmpConfig,
  configureNetwork,
  directNetworkAvailable,
} from "./services/network";
import { COMMANDS, Vendor } from "./protocol/commands";
import { formatUptime } from "./protocol/snmp";
import { locate, retainPhoto } from "./services/evidence";
import { generateReport, shareReport } from "./reporting/report";
import {
  backendHealth,
  createSync,
  lookupDatasheet,
  useServerConflict,
  validateBackendUrl,
} from "./services/api";
import { secrets } from "./services/secure";

type Tab = "network" | "installations" | "history" | "queue";
const tabs: { id: Tab; label: string; icon: IconName }[] = [
  { id: "network", label: "Red local", icon: "grid-outline" },
  { id: "installations", label: "Instalaciones", icon: "construct-outline" },
  { id: "history", label: "Historial", icon: "time-outline" },
  { id: "queue", label: "Cola", icon: "cloud-upload-outline" },
];
const when = (n: number) =>
  new Date(n).toLocaleString("es-AR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
const precision = (accuracy: number | null) =>
  accuracy === null ? "precisión no informada" : `±${Math.round(accuracy)} m`;
function notify(title: string, text: string) {
  if (Platform.OS === "web") window.alert(`${title}\n${text}`);
  else Alert.alert(title, text);
}
function AppContent() {
  const [tab, setTab] = useState<Tab>("network"),
    [ready, setReady] = useState(false),
    [fatal, setFatal] = useState("");
  const [settings, setSettings] = useState(DEFAULT_SETTINGS),
    settingsRef = useRef(settings);
  settingsRef.current = settings;
  configureNetwork(() => settingsRef.current.backendUrl);
  const sync = useRef(createSync(() => settingsRef.current)).current;
  const [devices, setDevices] = useState<Device[]>([]),
    [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]),
    [installations, setInstallations] = useState<Installation[]>([]),
    [queue, setQueue] = useState<OutboxAction[]>([]);
  const [connected, setConnected] = useState(false),
    [syncing, setSyncing] = useState(false),
    [busy, setBusy] = useState("");
  const connectedRef = useRef(false);
  const [settingsDraft, setSettingsDraft] = useState(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false),
    [selected, setSelected] = useState<string>(),
    [detailTab, setDetailTab] = useState<"snmp" | "ssh" | "sheet">("snmp");
  const [cidr, setCidr] = useState("192.168.1.0/24"),
    [scanProgress, setScanProgress] = useState(0),
    [scanning, setScanning] = useState(false),
    scanCancelled = useRef(false);
  const [search, setSearch] = useState(""),
    [manualIp, setManualIp] = useState(""),
    [manualName, setManualName] = useState(""),
    [manualOpen, setManualOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState(""),
    [historyDetail, setHistoryDetail] = useState<Diagnostic>();
  const [newInstall, setNewInstall] = useState(false),
    [installDevice, setInstallDevice] = useState(""),
    [site, setSite] = useState(""),
    [technician, setTechnician] = useState(""),
    [notes, setNotes] = useState(""),
    [location, setLocation] = useState<Coordinates>(),
    [photos, setPhotos] = useState<Photo[]>([]);
  const [cameraMode, setCameraMode] = useState<"qr" | "photo">();
  const [code, setCode] = useState(""),
    [vendor, setVendor] = useState<Vendor>("linux"),
    [commandId, setCommandId] = useState("uptime"),
    [sshUser, setSshUser] = useState(""),
    [sshPassword, setSshPassword] = useState(""),
    [sshPort, setSshPort] = useState("22"),
    [remember, setRemember] = useState(false);
  const [backendToken, setBackendToken] = useState("");
  const selectedDevice = devices.find((d) => d.id === selected);
  const selectedDiagnostics = diagnostics.filter(
    (d) => d.deviceId === selected,
  );
  const refresh = useCallback(async () => {
    const [d, h, i, q] = await Promise.all([
      store.all<Device>("device"),
      store.all<Diagnostic>("diagnostic"),
      store.all<Installation>("installation"),
      store.all<OutboxAction>("outbox"),
    ]);
    setDevices(d);
    setDiagnostics(h);
    setInstallations(i);
    setQueue(q);
  }, []);
  const syncNow = useCallback(
    async (silent = false, force = !silent) => {
      if (!settingsRef.current.backendUrl) {
        if (!silent)
          notify(
            "Backend sin configurar",
            "Ingresá la URL del servidor en Ajustes. Tus datos ya están guardados localmente.",
          );
        return;
      }
      setSyncing(true);
      try {
        await sync.run({ force });
        await refresh();
      } catch (e) {
        if (!silent) notify("No se pudo sincronizar", message(e));
      } finally {
        setSyncing(false);
      }
    },
    [sync, refresh],
  );
  useEffect(() => {
    let mounted = true;
    let unsubscribe = () => {};
    (async () => {
      try {
        const saved = await store.get<Settings>("settings", "preferences");
        const community = await secrets.get("snmp-community");
        const prefs = {
          ...DEFAULT_SETTINGS,
          ...saved,
          community: community || "public",
        };
        settingsRef.current = prefs;
        const savedToken = await secrets.get("backend-token");
        const token =
          savedToken || process.env.EXPO_PUBLIC_FIELDKIT_TOKEN || "";
        if (!savedToken && token) await secrets.set("backend-token", token);
        if (mounted) {
          setSettings(prefs);
          setSite(prefs.site);
          setTechnician(prefs.technician);
          setBackendToken(token);
        }
        const draft = await store.get<{
          id: string;
          deviceId: string;
          site: string;
          technician: string;
          notes: string;
          location?: Coordinates;
          photos: Photo[];
        }>("settings", "installation-draft");
        if (draft && mounted) {
          setInstallDevice(draft.deviceId);
          setSite(draft.site);
          setTechnician(draft.technician);
          setNotes(draft.notes);
          setLocation(draft.location);
          setPhotos(draft.photos);
        }
        await sync.recover();
        await refresh();
        if (mounted) {
          setReady(true);
          unsubscribe = store.observe(() => {
            refresh().catch((e) => setFatal(message(e)));
          });
        }
        try {
          const info = await nativeNetwork().networkInfo();
          if (mounted && info.ip)
            setCidr(`${info.ip}/${Math.max(22, info.prefix)}`);
        } catch {}
      } catch (e) {
        if (mounted) setFatal(message(e));
      }
    })();
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [refresh, sync]);
  useEffect(() => {
    if (!ready) return;
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = state.isConnected === true;
      const recovered = online && !connectedRef.current;
      connectedRef.current = online;
      setConnected(online);
      if (online && settingsRef.current.autoSync) void syncNow(true, recovered);
    });
    const app = AppState.addEventListener("change", (state) => {
      if (
        state === "active" &&
        connectedRef.current &&
        settingsRef.current.autoSync
      )
        void syncNow(true);
    });
    const timer = setInterval(() => {
      if (
        connectedRef.current &&
        settingsRef.current.autoSync &&
        AppState.currentState === "active"
      )
        void syncNow(true);
    }, 20000);
    return () => {
      unsubscribe();
      app.remove();
      clearInterval(timer);
    };
  }, [ready, syncNow]);
  useEffect(() => {
    if (!ready || !newInstall) return;
    const timer = setTimeout(() => {
      store
        .save(
          "settings",
          {
            id: "installation-draft",
            deviceId: installDevice,
            site,
            technician,
            notes,
            location,
            photos,
          } as { id: string },
          false,
        )
        .catch((e) => notify("No se guardó el borrador", message(e)));
    }, 400);
    return () => clearTimeout(timer);
  }, [
    ready,
    newInstall,
    installDevice,
    site,
    technician,
    notes,
    location,
    photos,
  ]);
  useEffect(() => {
    let active = true;
    setSshPassword("");
    setSshUser("");
    setSshPort("22");
    setRemember(false);
    setCode(devices.find((d) => d.id === selected)?.barcode || "");
    if (!selected) return;
    secrets
      .get(`ssh-auth-${selected}`.replace(/[^\w.-]/g, "_"))
      .then((raw) => {
        if (raw && active) {
          const a = JSON.parse(raw);
          setSshUser(a.username);
          setSshPassword(a.password);
          setSshPort(String(a.port));
          setRemember(true);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [selected]);
  useEffect(() => {
    if (showSettings) setSettingsDraft(settingsRef.current);
  }, [showSettings]);
  async function task(id: string, fn: () => Promise<void>) {
    if (busy) return;
    setBusy(id);
    try {
      await fn();
    } catch (e) {
      notify("No se pudo completar", message(e));
    } finally {
      setBusy("");
    }
  }
  async function inspect(device: Device, full = true, showError = true) {
    let diagnostic: Diagnostic;
    try {
      diagnostic = {
        id: uid(),
        deviceId: device.id,
        site: device.site,
        kind: "snmp",
        createdAt: Date.now(),
        success: true,
        result: await snmp.inspect(
          device.ip,
          snmpConfig(settingsRef.current),
          full,
        ),
      };
    } catch (e) {
      diagnostic = {
        id: uid(),
        deviceId: device.id,
        site: device.site,
        kind: "snmp",
        createdAt: Date.now(),
        success: false,
        result: { error: message(e) },
      };
      if (showError) notify("Consulta SNMP", message(e));
    }
    await store.save("diagnostic", diagnostic);
  }
  async function scan() {
    if (!settings.site.trim()) {
      notify(
        "Identificá el sitio",
        "Completá el sitio de trabajo en Ajustes antes de escanear.",
      );
      return;
    }
    setScanning(true);
    setScanProgress(0);
    scanCancelled.current = false;
    try {
      const found = await discover(cidr, settings, (n, total) =>
        setScanProgress(n / total),
      );
      for (const d of found) {
        if (scanCancelled.current) break;
        const existing = findEquipment(devices, d);
        const device = {
          ...existing,
          ...d,
          id: existing?.id ?? d.id,
          name: existing?.name || d.name,
          site: existing?.site || d.site,
        };
        await store.save("device", device);
        await inspect(device, false, false);
      }
      if (!found.length && !scanCancelled.current)
        notify(
          "Sin respuestas",
          "Revisá la subred, la conexión Wi-Fi y el aislamiento de clientes. También podés ingresar una IP manualmente.",
        );
    } catch (e) {
      notify("Escaneo LAN", message(e));
    } finally {
      setScanning(false);
      await refresh();
    }
  }
  function openCamera(mode: "qr" | "photo") {
    if (mode === "photo" && photos.length >= 6) {
      notify(
        "Evidencia completa",
        "Podés adjuntar hasta 6 fotografías por instalación.",
      );
      return;
    }
    setCameraMode(mode);
  }
  async function associateCode(raw: string) {
    const device = devices.find((d) => d.id === selected);
    if (!device) return;
    const parsed = parseEquipmentCode(raw);
    setCode(parsed);
    const sheet = await lookupDatasheet(parsed, settings.backendUrl);
    await store.save("device", {
      ...device,
      barcode: parsed,
      datasheet: sheet,
    });
    notify(
      "Equipo identificado",
      sheet
        ? `${sheet.vendor} · ${sheet.model}\nFicha disponible sin conexión.`
        : `Código ${parsed} asociado. La ficha no está disponible; podés volver a consultarla al reconectar.`,
    );
  }
  async function saveInstallation() {
    if (!installDevice || !site.trim() || !technician.trim() || !notes.trim())
      throw new Error("Completá equipo, sitio, técnico y notas técnicas.");
    if (!location || !photos.length)
      throw new Error(
        "La instalación requiere ubicación GPS y al menos una foto georreferenciada.",
      );
    const installation: Installation = {
      id: uid(),
      deviceId: installDevice,
      site: site.trim(),
      technician: technician.trim(),
      notes: notes.trim(),
      location,
      photos,
      createdAt: Date.now(),
    };
    await store.save("installation", installation);
    try {
      installation.pdfUri = await generateReport(installation);
    } catch (e) {
      installation.pdfError = message(e);
    }
    await store.save("installation", installation);
    await store.save(
      "settings",
      {
        id: "installation-draft",
        deviceId: "",
        site: settings.site,
        technician: settings.technician,
        notes: "",
        photos: [],
      } as { id: string },
      false,
    );
    setNewInstall(false);
    setPhotos([]);
    setLocation(undefined);
    setNotes("");
    setInstallDevice("");
    notify(
      "Instalación guardada",
      installation.pdfUri
        ? "El PDF y la evidencia están guardados. La acción quedó en la cola de sincronización."
        : "Los datos están guardados. El PDF se reintentará al sincronizar; también podés generarlo desde la instalación.",
    );
    if (settings.autoSync) void syncNow(true);
  }
  async function saveSettings() {
    const url = validateBackendUrl(settingsDraft.backendUrl);
    if (
      !Number.isInteger(settingsDraft.snmpPort) ||
      settingsDraft.snmpPort < 1 ||
      settingsDraft.snmpPort > 65535 ||
      !Number.isInteger(settingsDraft.timeout) ||
      settingsDraft.timeout < 100 ||
      settingsDraft.timeout > 15000 ||
      !settingsDraft.community ||
      settingsDraft.community.length > 255
    )
      throw new Error("Revisá puerto, community y timeout (100–15000 ms).");
    await secrets.set("backend-token", backendToken);
    await secrets.set("snmp-community", settingsDraft.community);
    const saved = { ...settingsDraft, backendUrl: url };
    setSettings(saved);
    settingsRef.current = saved;
    await store.save("settings", { ...saved, community: "public" }, false);
    setShowSettings(false);
    if (saved.autoSync && saved.backendUrl) void syncNow(true);
  }
  const pageTitle = {
    network: "Red local",
    installations: "Instalaciones",
    history: "Historial",
    queue: "Sincronización",
  }[tab];
  const pageSub = {
    network: "DESCUBRIR · IDENTIFICAR · DIAGNOSTICAR",
    installations: "EVIDENCIA DE CADA VISITA",
    history: "TUS DIAGNÓSTICOS, SIEMPRE DISPONIBLES",
    queue: "PRIMERO LOCAL. DESPUÉS, CONECTADO.",
  }[tab];
  const filteredDevices = devices.filter((d) =>
    `${d.name} ${d.ip} ${d.mac || ""} ${d.site}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  if (fatal)
    return (
      <SafeAreaView style={[a.root, a.center]}>
        <Icon name="warning-outline" size={36} color={C.red} />
        <Text style={s.h2}>No se pudo abrir la base local</Text>
        <Text style={s.body}>{fatal}</Text>
        <Text style={s.body}>
          Reiniciá la app. No borres los datos si tenés registros pendientes.
        </Text>
      </SafeAreaView>
    );
  if (!ready)
    return (
      <SafeAreaView style={[a.root, a.center]}>
        <ActivityIndicator color={C.green} />
        <Text style={s.body}>Abriendo tu espacio de trabajo…</Text>
      </SafeAreaView>
    );
  return (
    <SafeAreaView style={a.root} edges={["top", "left", "right"]}>
      <StatusBar style="dark" />
      <View style={a.top}>
        <View style={s.row}>
          <View style={a.logo}>
            <Icon name="scan-outline" color="white" size={22} />
          </View>
          <View>
            <Text style={a.wordmark}>
              fieldkit<Text style={{ color: C.green }}>.</Text>
            </Text>
            <Text style={a.brandSub}>NETWORK DIAGNOSTICS</Text>
          </View>
        </View>
        <View style={s.row}>
          <Badge tone={connected ? "green" : "amber"}>
            {connected ? "En red" : "Offline"}
          </Badge>
          <Pressable
            accessibilityLabel="Ajustes"
            onPress={() => setShowSettings(true)}
            style={a.gear}
          >
            <Icon name="options-outline" size={22} />
          </Pressable>
        </View>
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={a.content}
      >
        <View style={{ gap: 8 }}>
          <Label>{pageSub}</Label>
          <Text style={s.h1}>
            {pageTitle}
            <Text style={{ color: C.green }}>.</Text>
          </Text>
        </View>
        {tab === "network" && (
          <>
            <View style={a.hero}>
              <View style={a.heroCircle} />
              <View style={a.heroCircle2} />
              <View style={{ gap: 12, zIndex: 1 }}>
                <View style={s.row}>
                  <View style={a.heroDot} />
                  <Text style={a.heroEyebrow}>TU KIT DE CAMPO</Text>
                </View>
                <Text style={a.heroTitle}>Tu red,{"\n"}bajo control.</Text>
                <Text style={a.heroBody}>
                  Descubrí equipos y resolvé en el sitio.{"\n"}Tus datos te
                  acompañan, incluso sin señal.
                </Text>
                <View style={a.heroBottom}>
                  <Icon
                    name="shield-checkmark-outline"
                    size={17}
                    color="#B8D9CB"
                  />
                  <Text style={{ color: "#B8D9CB", fontSize: 12 }}>
                    Guardado local · Offline-first
                  </Text>
                </View>
              </View>
              <View style={a.radar}>
                <View style={a.radarInner}>
                  <Icon name="radio-outline" color="#92C3AC" size={37} />
                </View>
              </View>
            </View>
            <View style={a.stats}>
              {[
                {
                  n: devices.length.toString().padStart(2, "0"),
                  title: "Equipos",
                  icon: "hardware-chip-outline",
                },
                {
                  n: diagnostics.length.toString().padStart(2, "0"),
                  title: "Consultas",
                  icon: "pulse-outline",
                },
                {
                  n: queue.length.toString().padStart(2, "0"),
                  title: "Pendientes",
                  icon: "cloud-upload-outline",
                },
              ].map((item) => (
                <View style={a.stat} key={item.title}>
                  <Icon
                    name={item.icon as IconName}
                    size={19}
                    color={C.green}
                  />
                  <Text style={a.statNumber}>{item.n}</Text>
                  <Text style={s.caption}>{item.title}</Text>
                </View>
              ))}
            </View>
            {!directNetworkAvailable && (
              <Card>
                <Label>EXPO GO · CONEXIÓN CON TU COMPUTADORA</Label>
                <Text style={s.body}>
                  Las fotos, el GPS, los PDF y tus registros se guardan en este
                  teléfono. El escaneo, SNMP y SSH se ejecutan desde la
                  computadora conectada a la red del equipo.
                </Text>
                <Button
                  title="Configurar conexión y sitio"
                  icon="options-outline"
                  secondary
                  onPress={() => setShowSettings(true)}
                />
              </Card>
            )}
            <Section title="Explorar la red" detail="mDNS · TCP/UDP" />
            <Card>
              <Field
                label="Subred IPv4 / CIDR"
                value={cidr}
                onChangeText={setCidr}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="192.168.1.0/24"
              />
              <Text style={s.caption}>
                Buscamos servicios publicados y hosts que responden. Se consulta
                SNMP al encontrar cada equipo.
              </Text>
              {scanning && (
                <View style={{ gap: 8 }}>
                  <View style={a.progress}>
                    <View
                      style={[
                        a.progressFill,
                        { width: `${Math.round(scanProgress * 100)}%` },
                      ]}
                    />
                  </View>
                  <Text style={s.caption}>
                    {Math.round(scanProgress * 100)}% · Descubriendo y
                    consultando equipos…
                  </Text>
                </View>
              )}
              <Button
                title={scanning ? "Detener escaneo" : "Escanear red local"}
                icon={scanning ? "stop-outline" : "scan-outline"}
                onPress={() => {
                  if (scanning) {
                    scanCancelled.current = true;
                    nativeNetwork().cancelScan();
                  } else void scan();
                }}
              />
              <Button
                title="Agregar equipo por IP"
                icon="add-outline"
                secondary
                onPress={() => setManualOpen(!manualOpen)}
              />
              {manualOpen && (
                <>
                  <Field
                    label="Dirección IP"
                    value={manualIp}
                    onChangeText={setManualIp}
                    keyboardType="decimal-pad"
                    placeholder="192.168.1.1"
                  />
                  <Field
                    label="Nombre del equipo"
                    value={manualName}
                    onChangeText={setManualName}
                    placeholder="Router principal"
                  />
                  <Button
                    title="Guardar equipo"
                    busy={busy === "manual"}
                    onPress={() =>
                      void task("manual", async () => {
                        ipv4ToInt(manualIp.trim());
                        const ip = manualIp.trim();
                        if (!settings.site.trim())
                          throw new Error(
                            "Completá el sitio de trabajo en Ajustes antes de agregar equipos.",
                          );
                        const existing = findEquipment(devices, {
                          ip,
                          site: settings.site,
                        });
                        const d: Device = {
                          ...existing,
                          id: existing?.id || uid(),
                          ip,
                          name: manualName.trim() || ip,
                          source: "manual",
                          ports: existing?.ports || [],
                          lastSeen: Date.now(),
                          site: settings.site,
                        };
                        await store.save("device", d);
                        setManualOpen(false);
                        setManualIp("");
                        setManualName("");
                        setSelected(d.id);
                        await inspect(d, false);
                      })
                    }
                  />
                </>
              )}
            </Card>
            <Section
              title="Equipos de tu red"
              detail={`${devices.length} guardados`}
            />
            {devices.length > 0 && (
              <Field
                label="Buscar equipo o sitio"
                value={search}
                onChangeText={setSearch}
                placeholder="Nombre, IP, MAC o sitio…"
              />
            )}
            {!filteredDevices.length ? (
              <Card>
                <Empty
                  icon="git-network-outline"
                  title={
                    devices.length
                      ? "Sin coincidencias"
                      : "Tu próximo equipo, acá"
                  }
                  text={
                    devices.length
                      ? "Probá con otro nombre, IP o sitio."
                      : "Conectate al Wi-Fi del sitio y escaneá la red para empezar tu diagnóstico."
                  }
                />
              </Card>
            ) : (
              filteredDevices.map((d) => (
                <Pressable
                  key={d.id}
                  onPress={() => {
                    setSelected(d.id);
                    setDetailTab("snmp");
                  }}
                >
                  <Card style={{ gap: 12 }}>
                    <View style={s.row}>
                      <View style={a.deviceIcon}>
                        <Icon name="server-outline" color={C.green} />
                      </View>
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={a.deviceName}>{d.name}</Text>
                        <Text style={a.mono}>{d.ip}</Text>
                      </View>
                      <Icon name="chevron-forward" size={18} color={C.muted} />
                    </View>
                    <View style={a.deviceFooter}>
                      <Text style={s.caption}>
                        {d.site || "Sin sitio"} · {d.source.toUpperCase()}
                      </Text>
                      <Text style={s.caption}>Visto {when(d.lastSeen)}</Text>
                    </View>
                  </Card>
                </Pressable>
              ))
            )}
          </>
        )}
        {tab === "installations" && (
          <>
            <Text style={s.body}>
              Dejá constancia de tu trabajo con fotos, ubicación y un reporte
              listo para compartir.
            </Text>
            {!newInstall ? (
              <Button
                title="Nueva instalación"
                icon="add-outline"
                onPress={() => setNewInstall(true)}
              />
            ) : (
              <Card>
                <Section title="Registrar visita" />
                <Label>1 / EQUIPO</Label>
                <View style={a.chips}>
                  {devices.map((d) => (
                    <Pressable
                      key={d.id}
                      onPress={() => setInstallDevice(d.id)}
                      style={[a.chip, installDevice === d.id && a.chipActive]}
                    >
                      <Text
                        style={
                          installDevice === d.id ? a.chipTextActive : a.chipText
                        }
                      >
                        {d.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {!devices.length && (
                  <Text style={s.body}>
                    Agregá un equipo desde Red local antes de registrar la
                    instalación.
                  </Text>
                )}
                <Field
                  label="Sitio / cliente"
                  value={site}
                  onChangeText={setSite}
                  placeholder="Ej. Edificio San Martín · Azotea"
                />
                <Field
                  label="Técnico responsable"
                  value={technician}
                  onChangeText={setTechnician}
                  placeholder="Tu nombre y apellido"
                />
                <Field
                  label="Notas técnicas"
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  placeholder="Trabajo realizado, estado del equipo y observaciones…"
                />
                <Label>2 / UBICACIÓN Y EVIDENCIA</Label>
                {location && (
                  <Badge>
                    {location.latitude.toFixed(5)},{" "}
                    {location.longitude.toFixed(5)} ·{" "}
                    {precision(location.accuracy)}
                  </Badge>
                )}
                <Button
                  title={
                    location
                      ? "Actualizar ubicación GPS"
                      : "Obtener ubicación GPS"
                  }
                  secondary
                  icon="location-outline"
                  busy={busy === "gps"}
                  onPress={() =>
                    void task("gps", async () => setLocation(await locate()))
                  }
                />
                <View style={a.photoGrid}>
                  {photos.map((p) => (
                    <View style={a.photoItem} key={p.id}>
                      <Image source={{ uri: p.uri }} style={a.thumbnail} />
                      <Pressable
                        accessibilityLabel="Quitar foto"
                        style={a.removePhoto}
                        onPress={() =>
                          setPhotos(photos.filter((i) => i.id !== p.id))
                        }
                      >
                        <Icon name="close" size={16} color="white" />
                      </Pressable>
                      <Text style={[s.caption, { fontSize: 10 }]}>
                        GPS · {precision(p.location.accuracy)}
                      </Text>
                    </View>
                  ))}
                </View>
                <Button
                  title={`Tomar foto georreferenciada (${photos.length}/6)`}
                  icon="camera-outline"
                  secondary
                  onPress={() => void openCamera("photo")}
                />
                <Text style={s.caption}>
                  Cada foto captura su propia ubicación. El borrador se guarda
                  automáticamente en este dispositivo.
                </Text>
                <Button
                  title="Guardar y generar PDF"
                  icon="document-text-outline"
                  busy={busy === "installation"}
                  onPress={() => void task("installation", saveInstallation)}
                />
                <Button
                  title="Volver a instalaciones"
                  secondary
                  onPress={() => setNewInstall(false)}
                />
              </Card>
            )}
            <Section
              title="Visitas registradas"
              detail={`${installations.length} locales`}
            />
            {!installations.length && (
              <Card>
                <Empty
                  icon="document-text-outline"
                  title="Cada visita cuenta"
                  text="Registrá tu primera instalación. El reporte se genera en el teléfono, con o sin Internet."
                />
              </Card>
            )}
            {installations.map((i) => (
              <Card key={i.id}>
                <View style={s.row}>
                  <View style={a.deviceIcon}>
                    <Icon name="document-text-outline" color={C.green} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={a.deviceName}>{i.site}</Text>
                    <Text style={s.caption}>
                      {i.technician} · {when(i.createdAt)}
                    </Text>
                  </View>
                </View>
                <Text style={s.body}>{i.notes}</Text>
                <Badge>{i.photos.length} fotos · GPS registrado</Badge>
                <Text style={s.caption}>
                  {devices.find((d) => d.id === i.deviceId)?.name || i.deviceId}
                </Text>
                {i.pdfError && (
                  <Text style={{ color: C.amber, fontSize: 12 }}>
                    {i.pdfError}
                  </Text>
                )}
                <View style={a.chips}>
                  <Button
                    small
                    secondary
                    title={i.pdfUri ? "Compartir PDF" : "Generar PDF"}
                    icon="document-outline"
                    busy={busy === i.id}
                    onPress={() =>
                      void task(i.id, async () => {
                        const uri = i.pdfUri || (await generateReport(i));
                        if (!i.pdfUri)
                          await store.save("installation", {
                            ...i,
                            pdfUri: uri,
                            pdfError: undefined,
                          });
                        await shareReport(uri);
                      })
                    }
                  />
                  <Button
                    small
                    secondary
                    title="Ver ubicación"
                    icon="map-outline"
                    onPress={() => {
                      void Linking.openURL(
                        `https://www.openstreetmap.org/?mlat=${i.location.latitude}&mlon=${i.location.longitude}#map=18/${i.location.latitude}/${i.location.longitude}`,
                      ).catch((e) => notify("Mapa", message(e)));
                    }}
                  />
                </View>
              </Card>
            ))}
          </>
        )}
        {tab === "history" && (
          <>
            <Text style={s.body}>
              Consultá resultados guardados por equipo y sitio, sin depender de
              la conexión.
            </Text>
            <Field
              label="Filtrar historial"
              value={historySearch}
              onChangeText={setHistorySearch}
              placeholder="Equipo, sitio, IP o protocolo…"
            />
            {!diagnostics.length && (
              <Card>
                <Empty
                  icon="pulse-outline"
                  title="La memoria de tu red"
                  text="Tus consultas SNMP y comandos SSH quedan registrados acá, incluidos los intentos con error."
                />
              </Card>
            )}
            {diagnostics
              .filter((d) =>
                `${devices.find((e) => e.id === d.deviceId)?.name} ${d.deviceId} ${d.site} ${d.kind}`
                  .toLowerCase()
                  .includes(historySearch.toLowerCase()),
              )
              .map((d) => (
                <Pressable key={d.id} onPress={() => setHistoryDetail(d)}>
                  <Card>
                    <View style={s.row}>
                      <View
                        style={[
                          a.deviceIcon,
                          { backgroundColor: d.success ? C.pale : "#F8ECE6" },
                        ]}
                      >
                        <Icon
                          name={
                            d.kind === "snmp"
                              ? "pulse-outline"
                              : "terminal-outline"
                          }
                          color={d.success ? C.green : C.amber}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={a.deviceName}>
                          {devices.find((e) => e.id === d.deviceId)?.name ||
                            d.deviceId}
                        </Text>
                        <Text style={s.caption}>
                          {d.site || "Sin sitio"} · {when(d.createdAt)}
                        </Text>
                      </View>
                      <Badge tone={d.success ? "green" : "amber"}>
                        {d.kind.toUpperCase()}
                      </Badge>
                    </View>
                    <Text style={s.caption}>
                      {d.success
                        ? "Diagnóstico completado · Ver resultado"
                        : "Intento con error · Ver detalle"}
                    </Text>
                  </Card>
                </Pressable>
              ))}
          </>
        )}
        {tab === "queue" && (
          <>
            <View style={a.syncHero}>
              <View style={a.emptyCloud}>
                <Icon name="cloud-upload-outline" size={34} color={C.green} />
              </View>
              <Text style={s.h2}>
                {queue.length
                  ? `${queue.length} acciones en espera`
                  : "Todo en su lugar"}
              </Text>
              <Text style={[s.body, { textAlign: "center" }]}>
                Los registros se guardan primero en tu teléfono. Al alcanzar el
                backend, se envían automáticamente.
              </Text>
              <Button
                title="Sincronizar ahora"
                icon="sync-outline"
                busy={syncing}
                onPress={() => void syncNow()}
              />
            </View>
            <Card>
              <KV
                label="Backend"
                value={settings.backendUrl || "Sin configurar"}
              />
              <KV
                label="Sincronización automática"
                value={
                  settings.autoSync
                    ? "Activada · app en primer plano"
                    : "Desactivada"
                }
              />
              <KV
                label="Conexión de red"
                value={
                  connected
                    ? "Disponible (no garantiza acceso al backend)"
                    : "Sin conexión"
                }
              />
            </Card>
            {queue.map((q) => (
              <Card key={q.id}>
                <View style={s.row}>
                  <Icon
                    name={
                      q.state === "conflict"
                        ? "git-compare-outline"
                        : "cloud-upload-outline"
                    }
                    color={C.green}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={a.deviceName}>
                      {
                        {
                          device: "Equipo",
                          diagnostic: "Diagnóstico",
                          installation: "Reporte de instalación",
                          settings: "Configuración",
                          datasheet: "Ficha técnica",
                        }[q.kind]
                      }
                    </Text>
                    <Text style={s.caption}>
                      {when(q.createdAt)} · {q.attempts} intentos
                    </Text>
                  </View>
                  <Badge
                    tone={
                      q.state === "conflict" || q.state === "failed"
                        ? "amber"
                        : "green"
                    }
                  >
                    {
                      {
                        pending: "Pendiente",
                        sending: "Enviando",
                        conflict: "Conflicto",
                        failed: "Revisar",
                      }[q.state]
                    }
                  </Badge>
                </View>
                {q.error && (
                  <Text style={[s.caption, { color: C.amber }]}>{q.error}</Text>
                )}
                {q.nextAttemptAt > Date.now() && q.state === "pending" && (
                  <Text style={s.caption}>
                    Próximo intento: {when(q.nextAttemptAt)}
                  </Text>
                )}
                {q.state === "conflict" ? (
                  <>
                    <Text style={s.body}>
                      Tu versión: {JSON.stringify(q.payload).slice(0, 240)}
                    </Text>
                    <Text style={s.body}>
                      Servidor v{q.serverVersion}:{" "}
                      {JSON.stringify(q.serverPayload).slice(0, 240)}
                    </Text>
                    <Button
                      secondary
                      title="Conservar versión local"
                      onPress={() =>
                        void task(q.id, async () => {
                          await store.resolve(q, true);
                          void syncNow();
                        })
                      }
                    />
                    <Button
                      secondary
                      title="Usar versión del servidor"
                      onPress={() =>
                        void task(q.id, async () => {
                          await useServerConflict(q, settings.backendUrl);
                        })
                      }
                    />
                  </>
                ) : (
                  q.state !== "sending" && (
                    <Button
                      small
                      secondary
                      title="Reintentar ahora"
                      onPress={() =>
                        void task(q.id, async () => {
                          await store.updateAction({
                            ...q,
                            state: "pending",
                            attempts: 0,
                            nextAttemptAt: 0,
                          });
                          void syncNow();
                        })
                      }
                    />
                  )
                )}
              </Card>
            ))}
          </>
        )}
        <View style={a.bottomNote}>
          <Icon name="lock-closed-outline" size={13} color={C.muted} />
          <Text style={s.caption}>
            Tus registros están disponibles sin conexión.
          </Text>
        </View>
      </ScrollView>
      <SafeAreaView edges={["bottom"]} style={a.navSafe}>
        <View style={a.nav}>
          {tabs.map((t) => (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === t.id }}
              accessibilityLabel={t.label}
              key={t.id}
              onPress={() => setTab(t.id)}
              style={a.navItem}
            >
              <View
                style={[a.navIcon, tab === t.id && { backgroundColor: C.pale }]}
              >
                <Icon
                  name={t.icon}
                  color={tab === t.id ? C.green : C.muted}
                  size={22}
                />
                {t.id === "queue" && queue.length > 0 && (
                  <View style={a.navDot} />
                )}
              </View>
              <Text
                style={[
                  a.navLabel,
                  tab === t.id && { color: C.green, fontWeight: "700" },
                ]}
              >
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </SafeAreaView>

      <Sheet
        visible={!!selectedDevice}
        title={
          cameraMode === "qr"
            ? "Identificar equipo"
            : selectedDevice?.name || "Equipo"
        }
        subtitle={selectedDevice?.ip}
        onClose={() => {
          if (cameraMode === "qr") {
            setCameraMode(undefined);
            return;
          }
          setSelected(undefined);
          setSshPassword("");
        }}
        fullContent={
          cameraMode === "qr" && selectedDevice ? (
            <CameraPanel
              mode="qr"
              onCode={(raw) => {
                setCameraMode(undefined);
                void task("sheet", () => associateCode(raw));
              }}
            />
          ) : undefined
        }
      >
        {selectedDevice && (
          <>
            <View style={a.chips}>
              {(["snmp", "ssh", "sheet"] as const).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setDetailTab(t)}
                  style={[a.chip, detailTab === t && a.chipActive]}
                >
                  <Text style={detailTab === t ? a.chipTextActive : a.chipText}>
                    {{ snmp: "SNMP", ssh: "SSH", sheet: "Ficha técnica" }[t]}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Card>
              <KV label="Dirección IP" value={selectedDevice.ip} />
              <KV
                label="MAC"
                value={
                  selectedDevice.mac || "No disponible en este dispositivo"
                }
              />
              <KV
                label="Hostname"
                value={selectedDevice.hostname || "No anunciado"}
              />
              <KV label="Sitio" value={selectedDevice.site || "Sin asignar"} />
              <KV
                label="Puertos TCP detectados"
                value={selectedDevice.ports.join(", ") || "No registrados"}
              />
              <Field
                label="Asignar sitio al equipo"
                value={selectedDevice.site}
                onChangeText={(value) =>
                  setDevices((ds) =>
                    ds.map((d) =>
                      d.id === selected ? { ...d, site: value } : d,
                    ),
                  )
                }
              />
              <Button
                small
                secondary
                title="Guardar sitio"
                onPress={() =>
                  void task("site", async () =>
                    store.save("device", selectedDevice),
                  )
                }
              />
            </Card>
            {detailTab === "snmp" && (
              <>
                <Card>
                  <Label>CONSULTA MIB-II</Label>
                  <Text style={s.h2}>Estado e interfaces</Text>
                  <Text style={s.body}>
                    sysName, uptime y contadores de tráfico por interfaz. SNMP{" "}
                    {settings.snmpVersion === 0 ? "v1" : "v2c"} · UDP/
                    {settings.snmpPort}.
                  </Text>
                  <Button
                    title="Consultar SNMP"
                    icon="pulse-outline"
                    busy={busy === "snmp"}
                    onPress={() =>
                      void task("snmp", async () => inspect(selectedDevice))
                    }
                  />
                  <Text style={s.caption}>
                    La community se configura en Ajustes. SNMP v1/v2c transmite
                    sin cifrado.
                  </Text>
                </Card>
                {selectedDiagnostics
                  .filter((d) => d.kind === "snmp")
                  .slice(0, 1)
                  .map((d) => (
                    <Result key={d.id} diagnostic={d} />
                  ))}
              </>
            )}
            {detailTab === "ssh" && (
              <Card>
                <Label>ACCESO REMOTO SEGURO</Label>
                <Text style={s.h2}>Consola de diagnóstico</Text>
                <View style={a.chips}>
                  {(Object.keys(COMMANDS) as Vendor[]).map((v) => (
                    <Pressable
                      key={v}
                      style={[a.chip, vendor === v && a.chipActive]}
                      onPress={() => setVendor(v)}
                    >
                      <Text
                        style={vendor === v ? a.chipTextActive : a.chipText}
                      >
                        {v === "linux"
                          ? "Linux / OpenWrt"
                          : v === "cisco"
                            ? "Cisco IOS"
                            : "MikroTik"}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Field
                  label="Puerto SSH"
                  value={sshPort}
                  onChangeText={setSshPort}
                  keyboardType="number-pad"
                />
                <Button
                  title="Verificar huella del servidor"
                  icon="finger-print-outline"
                  secondary
                  busy={busy === "fingerprint"}
                  onPress={() =>
                    void task("fingerprint", async () => {
                      const port = Number(sshPort);
                      if (!Number.isInteger(port) || port < 1 || port > 65535)
                        throw new Error("Puerto SSH inválido.");
                      const fingerprint = await nativeNetwork().sshFingerprint(
                        selectedDevice.ip,
                        port,
                      );
                      const key =
                        `ssh-pin-${selectedDevice.id}-${port}`.replace(
                          /[^\w.-]/g,
                          "_",
                        );
                      const previous = await secrets.get(key);
                      const accept = () =>
                        void secrets
                          .set(key, fingerprint)
                          .then(() =>
                            notify(
                              "Huella guardada",
                              "La conexión exigirá esta clave del servidor.",
                            ),
                          );
                      const text = `${selectedDevice.ip}:${port}\n${fingerprint}\n${previous && previous !== fingerprint ? "ATENCIÓN: la clave cambió. " : ""}Compará esta huella por un canal confiable antes de aceptarla.`;
                      if (Platform.OS === "web") {
                        if (window.confirm(text)) accept();
                      } else
                        Alert.alert("Verificar identidad SSH", text, [
                          { text: "Cancelar", style: "cancel" },
                          {
                            text: "Aceptar huella verificada",
                            onPress: accept,
                          },
                        ]);
                    })
                  }
                />
                <Field
                  label="Usuario"
                  value={sshUser}
                  onChangeText={setSshUser}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Field
                  label="Contraseña"
                  value={sshPassword}
                  onChangeText={setSshPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <View style={[s.row, { justifyContent: "space-between" }]}>
                  <Text style={[s.body, { flex: 1 }]}>
                    Recordar de forma segura
                  </Text>
                  <Switch
                    value={remember}
                    onValueChange={setRemember}
                    trackColor={{ true: C.green }}
                  />
                </View>
                <Button
                  small
                  secondary
                  title="Olvidar credenciales y huella"
                  onPress={() =>
                    void task("forget", async () => {
                      await secrets.remove(
                        `ssh-auth-${selectedDevice.id}`.replace(
                          /[^\w.-]/g,
                          "_",
                        ),
                      );
                      await secrets.remove(
                        `ssh-pin-${selectedDevice.id}-${Number(sshPort)}`.replace(
                          /[^\w.-]/g,
                          "_",
                        ),
                      );
                      setSshPassword("");
                      setRemember(false);
                      notify(
                        "Credenciales eliminadas",
                        "Se eliminaron de este dispositivo.",
                      );
                    })
                  }
                />
                <Label>COMANDO PREDEFINIDO</Label>
                {COMMANDS[vendor].map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() => setCommandId(c.id)}
                    style={a.command}
                  >
                    <Icon
                      name={
                        commandId === c.id
                          ? "radio-button-on"
                          : "radio-button-off"
                      }
                      size={18}
                      color={C.green}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={a.chipText}>{c.label}</Text>
                      <Text style={[a.mono, { fontSize: 11 }]}>
                        {c.command}
                      </Text>
                    </View>
                  </Pressable>
                ))}
                <Button
                  title="Ejecutar diagnóstico"
                  icon="terminal-outline"
                  busy={busy === "ssh"}
                  onPress={() =>
                    void task("ssh", async () => {
                      if (!sshUser.trim() || !sshPassword)
                        throw new Error("Ingresá usuario y contraseña.");
                      try {
                        await store.save(
                          "diagnostic",
                          await runSSH(
                            selectedDevice,
                            Number(sshPort),
                            sshUser,
                            sshPassword,
                            vendor,
                            commandId,
                            remember,
                          ),
                        );
                        if (!remember) setSshPassword("");
                      } catch (e) {
                        await store.save("diagnostic", {
                          id: uid(),
                          deviceId: selectedDevice.id,
                          site: selectedDevice.site,
                          kind: "ssh",
                          createdAt: Date.now(),
                          success: false,
                          result: { error: message(e) },
                        });
                        throw e;
                      }
                    })
                  }
                />
                {selectedDiagnostics
                  .filter((d) => d.kind === "ssh")
                  .slice(0, 1)
                  .map((d) => (
                    <Result key={d.id} diagnostic={d} />
                  ))}
              </Card>
            )}
            {detailTab === "sheet" && (
              <Card>
                <Label>IDENTIFICACIÓN DEL EQUIPO</Label>
                <Text style={s.h2}>Escaneá. Asociá. Consultá.</Text>
                <Text style={s.body}>
                  Leé el QR o código de barras del equipo. La ficha técnica se
                  consulta en el backend y se conserva para próximas visitas.
                </Text>
                <Button
                  title="Escanear QR / código de barras"
                  icon="qr-code-outline"
                  onPress={() => void openCamera("qr")}
                />
                <Field
                  label="Código o número de serie"
                  value={code}
                  onChangeText={setCode}
                  autoCapitalize="none"
                  placeholder="Ej. RB750GR3"
                />
                <Button
                  title="Asociar y consultar ficha"
                  secondary
                  busy={busy === "sheet"}
                  onPress={() =>
                    void task("sheet", async () => associateCode(code))
                  }
                />
                {selectedDevice.datasheet && (
                  <>
                    <Badge>Ficha guardada sin conexión</Badge>
                    <Text style={s.h2}>{selectedDevice.datasheet.model}</Text>
                    <Text style={s.body}>
                      {selectedDevice.datasheet.description}
                    </Text>
                    <KV
                      label="Fabricante"
                      value={selectedDevice.datasheet.vendor}
                    />
                    {Object.entries(selectedDevice.datasheet.specs).map(
                      ([key, value]) => (
                        <KV key={key} label={key} value={value} />
                      ),
                    )}
                    <Text style={s.caption}>
                      Consultada: {when(selectedDevice.datasheet.cachedAt)}
                    </Text>
                  </>
                )}
              </Card>
            )}
            <Button
              title="Registrar instalación de este equipo"
              icon="construct-outline"
              secondary
              onPress={() => {
                setInstallDevice(selectedDevice.id);
                setSite(selectedDevice.site || settings.site);
                setSelected(undefined);
                setTab("installations");
                setNewInstall(true);
              }}
            />
          </>
        )}
      </Sheet>
      <Sheet
        visible={showSettings}
        title="Ajustes"
        subtitle="Tu espacio de trabajo"
        onClose={() => setShowSettings(false)}
      >
        <Card>
          <Label>PERFIL DE CAMPO</Label>
          <Field
            label="Técnico predeterminado"
            value={settingsDraft.technician}
            onChangeText={(v) =>
              setSettingsDraft({ ...settingsDraft, technician: v })
            }
          />
          <Field
            label="Sitio predeterminado"
            value={settingsDraft.site}
            onChangeText={(v) =>
              setSettingsDraft({ ...settingsDraft, site: v })
            }
          />
        </Card>
        <Card>
          <Label>SERVIDOR Y PUENTE DE RED</Label>
          <Field
            label="URL del servidor"
            placeholder="http://192.168.1.10:8787"
            value={settingsDraft.backendUrl}
            onChangeText={(v) =>
              setSettingsDraft({ ...settingsDraft, backendUrl: v })
            }
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <Field
            label="Token (si está configurado)"
            value={backendToken}
            onChangeText={setBackendToken}
            secureTextEntry
            autoCapitalize="none"
          />
          <Text style={s.caption}>
            Iniciá npm start en tu computadora. El iPhone y la PC deben estar en
            la misma Wi-Fi. Permití el acceso de Expo Go a la red local si iOS
            lo solicita. Usá HTTPS fuera del laboratorio.
          </Text>
          <Button
            title="Probar conexión"
            secondary
            busy={busy === "health"}
            onPress={() =>
              void task("health", async () => {
                await secrets.set("backend-token", backendToken);
                await backendHealth(
                  validateBackendUrl(settingsDraft.backendUrl),
                );
                notify(
                  "Backend disponible",
                  "Conexión y autenticación correctas.",
                );
              })
            }
          />
          <View style={[s.row, { justifyContent: "space-between" }]}>
            <Text style={[s.body, { flex: 1 }]}>
              Sincronizar automáticamente
            </Text>
            <Switch
              value={settingsDraft.autoSync}
              onValueChange={(v) =>
                setSettingsDraft({ ...settingsDraft, autoSync: v })
              }
              trackColor={{ true: C.green }}
            />
          </View>
        </Card>
        <Card>
          <Label>PROTOCOLO SNMP</Label>
          <View style={a.chips}>
            {([0, 1] as const).map((v) => (
              <Pressable
                key={v}
                onPress={() =>
                  setSettingsDraft({ ...settingsDraft, snmpVersion: v })
                }
                style={[
                  a.chip,
                  settingsDraft.snmpVersion === v && a.chipActive,
                ]}
              >
                <Text
                  style={
                    settingsDraft.snmpVersion === v
                      ? a.chipTextActive
                      : a.chipText
                  }
                >
                  {v === 0 ? "SNMP v1" : "SNMP v2c"}
                </Text>
              </Pressable>
            ))}
          </View>
          <Field
            label="Community (guardada de forma segura)"
            value={settingsDraft.community}
            onChangeText={(v) =>
              setSettingsDraft({ ...settingsDraft, community: v })
            }
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Field
            label="Puerto UDP"
            value={String(settingsDraft.snmpPort || "")}
            onChangeText={(v) =>
              setSettingsDraft({ ...settingsDraft, snmpPort: Number(v) })
            }
            keyboardType="number-pad"
          />
          <Field
            label="Timeout en milisegundos"
            value={String(settingsDraft.timeout || "")}
            onChangeText={(v) =>
              setSettingsDraft({ ...settingsDraft, timeout: Number(v) })
            }
            keyboardType="number-pad"
          />
          <Text style={s.caption}>
            GetRequest y GetNextRequest sobre MIB-II. Sin SNMPv3. La community
            viaja sin cifrar por la red.
          </Text>
        </Card>
        <Button
          title="Guardar ajustes"
          busy={busy === "settings"}
          onPress={() => void task("settings", saveSettings)}
        />
        <Text style={s.caption}>
          Fieldkit 1.0.0 · TP6 · React Native
          {Platform.OS === "web"
            ? "\nVista web: diagnósticos mediante la PC. Fotos, GPS y PDF se prueban en Expo Go. Las credenciales solo se conservan en memoria."
            : `\n${Platform.OS === "ios" ? "iPhone" : "Android"} · SQLite de Expo · Funciona en Expo Go`}
        </Text>
      </Sheet>
      <Sheet
        visible={!!historyDetail}
        title="Resultado del diagnóstico"
        subtitle={historyDetail ? when(historyDetail.createdAt) : ""}
        onClose={() => setHistoryDetail(undefined)}
      >
        {historyDetail && <Result diagnostic={historyDetail} />}
      </Sheet>
      <Modal
        visible={cameraMode === "photo"}
        animationType="slide"
        onRequestClose={() => setCameraMode(undefined)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: C.navy }}>
          <View style={a.cameraHeader}>
            <Text style={{ color: "white", fontSize: 18, fontWeight: "700" }}>
              Evidencia georreferenciada
            </Text>
            <Pressable
              accessibilityLabel="Cerrar cámara"
              style={a.gear}
              onPress={() => setCameraMode(undefined)}
            >
              <Icon name="close" color="white" />
            </Pressable>
          </View>
          {cameraMode === "photo" && (
            <CameraPanel
              mode="photo"
              onPhoto={async (uri) => {
                const gps = await locate();
                const photo = await retainPhoto(uri, gps);
                setPhotos((p) => [...p, photo]);
                setLocation(gps);
                setCameraMode(undefined);
              }}
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
function Sheet({
  visible,
  title,
  subtitle,
  onClose,
  fullContent,
  children,
}: React.PropsWithChildren<{
  visible: boolean;
  title: string;
  subtitle?: string;
  fullContent?: React.ReactNode;
  onClose(): void;
}>) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={a.root}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={a.sheetHeader}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={s.h2}>{title}</Text>
              {subtitle && <Text style={s.caption}>{subtitle}</Text>}
            </View>
            <Pressable
              accessibilityLabel="Cerrar"
              onPress={onClose}
              style={a.gear}
            >
              <Icon name="close" />
            </Pressable>
          </View>
          {fullContent ?? (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={a.content}
            >
              {children}
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
function Result({ diagnostic: d }: { diagnostic: Diagnostic }) {
  const r = d.result as Record<string, any>;
  return (
    <Card>
      <View style={[s.row, { justifyContent: "space-between" }]}>
        <Label>
          {d.kind.toUpperCase()} · {when(d.createdAt)}
        </Label>
        <Badge tone={d.success ? "green" : "amber"}>
          {d.success ? "Correcto" : "Con error"}
        </Badge>
      </View>
      {r.error ? (
        <Text selectable style={[s.body, { color: C.red }]}>
          {r.error}
        </Text>
      ) : d.kind === "snmp" ? (
        <>
          <KV label="Nombre del sistema" value={r.sysName} />
          <KV
            label="Tiempo activo"
            value={
              typeof r.uptimeTicks === "number"
                ? formatUptime(r.uptimeTicks)
                : "No disponible"
            }
          />
          <Text style={s.body}>{r.description}</Text>
          {r.interfaces?.length > 0 && (
            <Label>CONTADORES DE TRÁFICO · OCTETOS</Label>
          )}
          {r.interfaces?.map((i: any) => (
            <View key={i.index} style={a.interface}>
              <Text style={a.deviceName}>
                {i.name} <Text style={s.caption}>#{i.index}</Text>
              </Text>
              <Text style={s.caption}>
                ↓ Entrada: {i.inOctets ?? "N/D"} B ↑ Salida:{" "}
                {i.outOctets ?? "N/D"} B
              </Text>
            </View>
          ))}
          {r.truncated && (
            <Text style={s.caption}>Tabla limitada a 64 interfaces.</Text>
          )}
          <Text style={s.caption}>
            Contadores acumulados de 32 bits; pueden reiniciarse o desbordar. No
            representan una velocidad instantánea.
          </Text>
        </>
      ) : (
        <>
          <Text style={a.mono}>$ {r.command}</Text>
          <View style={a.terminal}>
            <Text selectable style={a.terminalText}>
              {r.stdout || "(sin salida estándar)"}
            </Text>
            {r.stderr ? (
              <Text selectable style={[a.terminalText, { color: "#EDC9AC" }]}>
                {r.stderr}
              </Text>
            ) : null}
          </View>
          <KV label="Código de salida" value={r.exitCode} />
        </>
      )}
    </Card>
  );
}
export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}
const a = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  center: {
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    gap: 20,
  },
  top: {
    paddingHorizontal: 16,
    paddingVertical: 17,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: C.line,
    gap: 10,
  },
  logo: {
    width: 40,
    height: 40,
    backgroundColor: C.green,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  wordmark: {
    fontSize: 26,
    fontWeight: "800",
    color: C.ink,
    letterSpacing: -1,
  },
  brandSub: {
    fontSize: 7,
    letterSpacing: 1.6,
    color: C.muted,
    fontWeight: "700",
    marginTop: 1,
  },
  gear: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  content: {
    padding: 22,
    gap: 20,
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
    paddingBottom: 30,
  },
  hero: {
    backgroundColor: C.navy,
    borderRadius: 23,
    padding: 24,
    overflow: "hidden",
    minHeight: 254,
  },
  heroTitle: {
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "600",
    letterSpacing: -1,
    color: "#F7FBF3",
  },
  heroBody: { fontSize: 13, lineHeight: 21, color: "#AAC7BC", maxWidth: 290 },
  heroEyebrow: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.6,
    color: "#B8D9CB",
  },
  heroDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#A6DAB2" },
  heroBottom: {
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
    marginTop: 7,
    borderTopWidth: 1,
    borderTopColor: "#2A4C48",
    paddingTop: 16,
  },
  heroCircle: {
    width: 280,
    height: 280,
    borderRadius: 140,
    borderWidth: 1,
    borderColor: "#2A5149",
    position: "absolute",
    right: -135,
    top: -50,
  },
  heroCircle2: {
    width: 400,
    height: 400,
    borderRadius: 200,
    borderWidth: 1,
    borderColor: "#24483F",
    position: "absolute",
    right: -195,
    top: -110,
  },
  radar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: "#365F50",
    position: "absolute",
    right: -14,
    top: 57,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.65,
  },
  radarInner: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: "#23493E",
    alignItems: "center",
    justifyContent: "center",
  },
  stats: { flexDirection: "row", gap: 10 },
  stat: {
    flex: 1,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  statNumber: {
    color: C.ink,
    fontSize: 28,
    fontWeight: "600",
    letterSpacing: -1,
  },
  progress: {
    height: 5,
    borderRadius: 4,
    backgroundColor: C.pale,
    overflow: "hidden",
  },
  progressFill: { height: 5, backgroundColor: C.green },
  deviceIcon: {
    width: 45,
    height: 45,
    borderRadius: 13,
    backgroundColor: C.pale,
    alignItems: "center",
    justifyContent: "center",
  },
  deviceName: { fontSize: 16, fontWeight: "600", color: C.ink },
  mono: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 13,
    color: C.muted,
    lineHeight: 21,
  },
  deviceFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
    borderTopWidth: 1,
    borderColor: "#EEF1EC",
    paddingTop: 12,
  },
  navSafe: {
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderColor: C.line,
  },
  nav: {
    flexDirection: "row",
    paddingVertical: 9,
    maxWidth: 760,
    width: "100%",
    alignSelf: "center",
  },
  navItem: { flex: 1, alignItems: "center", gap: 4 },
  navIcon: {
    width: 52,
    height: 32,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  navLabel: { fontSize: 10, color: C.muted },
  navDot: {
    position: "absolute",
    top: 4,
    right: 10,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.amber,
  },
  bottomNote: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
  },
  sheetHeader: {
    padding: 22,
    borderBottomWidth: 1,
    borderColor: C.line,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: "white",
  },
  chipActive: { backgroundColor: C.green, borderColor: C.green },
  chipText: { fontSize: 13, fontWeight: "600", color: C.ink },
  chipTextActive: { fontSize: 13, fontWeight: "600", color: "white" },
  command: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  terminal: { backgroundColor: C.navy, padding: 16, borderRadius: 12 },
  terminalText: {
    color: "#BFE7CE",
    fontFamily: "monospace",
    fontSize: 12,
    lineHeight: 19,
  },
  interface: {
    backgroundColor: "#F4F7F2",
    borderRadius: 10,
    padding: 12,
    gap: 6,
  },
  syncHero: { paddingVertical: 15, gap: 16, alignItems: "center" },
  emptyCloud: {
    width: 86,
    height: 86,
    borderRadius: 30,
    backgroundColor: "#E3EEE4",
    alignItems: "center",
    justifyContent: "center",
  },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  photoItem: { width: 85, gap: 4 },
  thumbnail: { width: 85, height: 85, borderRadius: 12 },
  removePhoto: {
    position: "absolute",
    top: 3,
    right: 3,
    borderRadius: 12,
    padding: 4,
    backgroundColor: "#153B3BCC",
  },
  cameraHeader: {
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});
