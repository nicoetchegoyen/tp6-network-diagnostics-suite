import { Device, Diagnostic, Installation } from "../domain/types";
export const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function reportHtml(
  installation: Installation,
  device: Device | undefined,
  diagnostics: Diagnostic[],
  photos: string[],
) {
  const e = escapeHtml,
    date = (n: number) => new Date(n).toLocaleString("es-AR");
  const gps = (p: Installation["location"]) =>
    `${p.latitude.toFixed(6)}, ${p.longitude.toFixed(6)} · ${p.accuracy === null ? 'precisión no informada' : `±${Math.round(p.accuracy)} m`}`;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
  @page{size:A4;margin:22mm 17mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#142c36;font-size:11px;line-height:1.55}header{border-bottom:3px solid #147d68;padding-bottom:18px;margin-bottom:24px}.brand{color:#147d68;letter-spacing:3px;font-size:12px;font-weight:bold}h1{font-size:28px;margin:8px 0}h2{font-size:15px;border-bottom:1px solid #d9e4e3;padding-bottom:8px;margin-top:24px}.muted{color:#64767c}table{border-collapse:collapse;width:100%}td{padding:8px;border-bottom:1px solid #e3e9e8;vertical-align:top}td:first-child{width:30%;color:#64767c}.notes{white-space:pre-wrap;background:#f2f6f5;padding:14px;overflow-wrap:anywhere}.photo{page-break-inside:avoid;margin:18px 0}.photo img{max-width:100%;max-height:370px;object-fit:contain}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f2f6f5;padding:12px;font-size:9px}.footer{border-top:1px solid #d9e4e3;padding-top:12px;margin-top:28px;color:#64767c;font-size:9px}
  </style></head><body><header><div class="brand">FIELDKIT / NETWORK DIAGNOSTICS SUITE</div><h1>Reporte de instalación</h1><div class="muted">${e(installation.id)} · ${e(date(installation.createdAt))}</div></header>
  <h2>01 · Visita técnica</h2><table><tr><td>Sitio</td><td>${e(installation.site)}</td></tr><tr><td>Técnico</td><td>${e(installation.technician)}</td></tr><tr><td>Equipo</td><td>${e(device?.name ?? installation.deviceId)}</td></tr><tr><td>IP / MAC</td><td>${e(device?.ip)} / ${e(device?.mac ?? "No disponible")}</td></tr><tr><td>Código</td><td>${e(device?.barcode ?? "Sin código asociado")}</td></tr><tr><td>Ubicación GPS</td><td>${e(gps(installation.location))}</td></tr><tr><td>Fecha de ubicación</td><td>${e(date(installation.location.timestamp))}</td></tr></table>
  <h2>02 · Notas técnicas</h2><div class="notes">${e(installation.notes)}</div>
  <h2>03 · Evidencia fotográfica</h2>${installation.photos.map((photo, i) => `<div class="photo"><img src="data:image/jpeg;base64,${photos[i]}"/><p class="muted">Foto ${i + 1} · ${e(date(photo.capturedAt))}<br>GPS: ${e(gps(photo.location))}</p></div>`).join("")}
  <h2>04 · Diagnósticos del equipo</h2>${diagnostics.length ? diagnostics.map((d) => `<div><strong>${e(d.kind.toUpperCase())} · ${e(date(d.createdAt))} · ${d.success ? "Correcto" : "Con error"}</strong><pre>${e(JSON.stringify(d.result, null, 2))}</pre></div>`).join("") : '<p class="muted">Sin diagnósticos registrados al generar este reporte.</p>'}
  <div class="footer">Documento generado localmente por Fieldkit. Las coordenadas y la precisión provienen del dispositivo. No constituye una certificación de conectividad ni una firma digital.</div></body></html>`;
}
