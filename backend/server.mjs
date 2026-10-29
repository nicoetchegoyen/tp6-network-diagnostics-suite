import http from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, timingSafeEqual } from "node:crypto";

const here = path.dirname(fileURLToPath(import.meta.url));
const CATALOG = {
  "PC-REAL": {
    vendor: "Laboratorio local",
    model: "PC Windows real",
    description:
      "Computadora física consultada por SNMP mediante el agente incluido. Sus interfaces y contadores se leen de Windows; no representa un router ni usa contadores sintéticos.",
    specs: {
      SNMP: "v1 / v2c · UDP 1162",
      Fuente: "Get-NetAdapterStatistics",
      Identidad: "Nombre e índices de interfaces de Windows",
    },
  },
  HG8245H: {
    vendor: "Huawei",
    model: "EchoLife HG8245H",
    description: "ONT GPON de acceso residencial.",
    specs: {
      Tecnología: "GPON",
      LAN: "4 × Gigabit Ethernet",
      WiFi: "2.4 GHz",
      Gestión: "Web / OMCI",
    },
    url: "https://e.huawei.com/",
  },
  RB750GR3: {
    vendor: "MikroTik",
    model: "hEX (RB750Gr3)",
    description: "Router Ethernet de cinco puertos.",
    specs: {
      LAN: "5 × Gigabit Ethernet",
      RAM: "256 MB",
      Sistema: "RouterOS",
      Alimentación: "8–30 V",
    },
    url: "https://mikrotik.com/product/RB750Gr3",
  },
};
export async function createBackend({
  dataDir = process.env.DATA_DIR || path.join(here, "data"),
  token = process.env.SYNC_TOKEN || "",
} = {}) {
  await fs.mkdir(path.join(dataDir, "assets"), { recursive: true });
  const dbFile = path.join(dataDir, "state.json");
  let state;
  try {
    state = JSON.parse(await fs.readFile(dbFile, "utf8"));
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
    state = { entities: {}, receipts: {} };
  }
  let serial = Promise.resolve();
  const transaction = (fn) => {
    const task = serial.then(fn);
    serial = task.catch(() => {});
    return task;
  };
  const reply = (res, status, body) => {
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(JSON.stringify(body));
  };
  const server = http.createServer(async (req, res) => {
    try {
      if (req.method === "OPTIONS") {
        res.writeHead(204, {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "content-type,authorization",
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        });
        return res.end();
      }
      if (token) {
        const got = Buffer.from(req.headers.authorization || ""),
          expected = Buffer.from(`Bearer ${token}`);
        if (got.length !== expected.length || !timingSafeEqual(got, expected))
          return reply(res, 401, { error: "Token inválido." });
      }
      const url = new URL(req.url, "http://localhost");
      if (req.method === "GET" && url.pathname === "/v1/health")
        return reply(res, 200, {
          ok: true,
          service: "fieldkit-sync",
          entities: Object.keys(state.entities).length,
        });
      if (req.method === "GET" && url.pathname.startsWith("/v1/catalog/")) {
        const code = decodeURIComponent(
          url.pathname.slice("/v1/catalog/".length),
        );
        const sheet = CATALOG[code.toUpperCase()];
        return reply(
          res,
          sheet ? 200 : 404,
          sheet ? { code, ...sheet } : { error: "Ficha no encontrada." },
        );
      }
      if (req.method === "GET" && url.pathname === "/v1/entities")
        return reply(res, 200, Object.values(state.entities));
      if (
        req.method === "GET" &&
        /^\/v1\/assets\/[a-f0-9]{64}$/.test(url.pathname)
      ) {
        const hash = url.pathname.split("/").pop();
        try {
          const data = await fs.readFile(path.join(dataDir, "assets", hash));
          res.writeHead(200, {
            "Content-Type": "application/octet-stream",
            "Content-Disposition": "attachment",
            "X-Content-Type-Options": "nosniff",
          });
          return res.end(data);
        } catch {
          return reply(res, 404, { error: "Archivo no encontrado." });
        }
      }
      if (req.method !== "POST" || url.pathname !== "/v1/sync")
        return reply(res, 404, { error: "Ruta no encontrada." });
      let size = 0;
      const chunks = [];
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 40 * 1024 * 1024) {
          reply(res, 413, { error: "La acción supera 40 MiB." });
          req.resume();
          return;
        }
        chunks.push(chunk);
      }
      let action;
      try {
        action = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch {
        return reply(res, 400, { error: "JSON inválido." });
      }
      const {
        actionId,
        kind,
        entityId,
        baseVersion,
        payload,
        assets = [],
      } = action;
      if (
        typeof actionId !== "string" ||
        actionId.length > 160 ||
        !actionId ||
        !["device", "diagnostic", "installation"].includes(kind) ||
        typeof entityId !== "string" ||
        !entityId ||
        entityId.length > 200 ||
        !Number.isSafeInteger(baseVersion) ||
        baseVersion < 0 ||
        !payload ||
        typeof payload !== "object" ||
        Array.isArray(payload) ||
        payload.id !== entityId ||
        !Array.isArray(assets) ||
        assets.length > 10
      )
        return reply(res, 422, { error: "Acción inválida." });
      // Rechazar secretos evita introducirlos accidentalmente en el backend de evidencia.
      if (
        /"(?:password|community|privateKey|token)"\s*:/i.test(
          JSON.stringify(payload),
        )
      )
        return reply(res, 422, {
          error: "El payload contiene campos de credenciales.",
        });
      const assetMap = {};
      for (const asset of assets) {
        if (
          typeof asset.id !== "string" ||
          asset.id.length > 200 ||
          !["image/jpeg", "application/pdf"].includes(asset.mime) ||
          typeof asset.base64 !== "string" ||
          asset.base64.length > 16 * 1024 * 1024 ||
          !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
            asset.base64,
          )
        )
          return reply(res, 422, { error: "Adjunto inválido." });
        const bytes = Buffer.from(asset.base64, "base64");
        const magic =
          asset.mime === "application/pdf"
            ? bytes.subarray(0, 5).toString() === "%PDF-"
            : bytes[0] === 255 && bytes[1] === 216;
        if (!magic)
          return reply(res, 422, { error: "Tipo de adjunto incorrecto." });
        const hash = createHash("sha256").update(bytes).digest("hex");
        assetMap[asset.id] = { hash, mime: asset.mime, size: bytes.length };
      }
      if (
        kind === "installation" &&
        (!Array.isArray(payload.photos) ||
          !payload.photos.length ||
          !payload.location ||
          !assetMap[payload.pdfAssetId] ||
          payload.photos.some((p) => !assetMap[p.assetId] || !p.location))
      )
        return reply(res, 422, {
          error: "La instalación requiere PDF, fotos y GPS.",
        });
      return await transaction(async () => {
        // El recibo se persiste junto con la entidad, y sobrevive a reinicios.
        const receipt = state.receipts[actionId];
        if (receipt) return reply(res, 200, { ...receipt, duplicate: true });
        const key = `${kind}:${entityId}`;
        const current = state.entities[key];
        if ((current?.version || 0) !== baseVersion)
          return reply(res, 409, {
            version: current?.version || 0,
            payload: current?.payload,
            assets: current?.assets,
            error: "Conflicto de versión.",
          });
        for (const asset of assets)
          await fs.writeFile(
            path.join(dataDir, "assets", assetMap[asset.id].hash),
            Buffer.from(asset.base64, "base64"),
          );
        const version = baseVersion + 1;
        const next = {
          entities: {
            ...state.entities,
            [key]: {
              kind,
              id: entityId,
              version,
              payload,
              assets: assetMap,
              updatedAt: Date.now(),
            },
          },
          receipts: { ...state.receipts, [actionId]: { version } },
        };
        await fs.writeFile(`${dbFile}.tmp`, JSON.stringify(next));
        await fs.rename(`${dbFile}.tmp`, dbFile);
        state = next;
        return reply(res, 200, { version });
      });
    } catch (error) {
      console.error("Backend:", error.message);
      if (!res.headersSent)
        reply(res, 500, { error: "Error interno del backend." });
      else res.end();
    }
  });
  server.requestTimeout = 30000;
  server.headersTimeout = 15000;
  return server;
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  createBackend()
    .then((server) => {
      const port = Number(process.env.PORT || 8790),
        host = process.env.HOST || "0.0.0.0";
      server.listen(port, host, () =>
        console.log(
          `Fieldkit backend: http://${host}:${port} · ${process.env.SYNC_TOKEN ? "token habilitado" : "laboratorio sin token"}`,
        ),
      );
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
