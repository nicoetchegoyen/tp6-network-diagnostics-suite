import { test } from "node:test";
import assert from "node:assert/strict";
import { reportHtml } from "../src/reporting/html";
import type { Installation } from "../src/domain/types";

test("PDF: identifica la ubicación simulada del emulador sin atribuirla a una visita de campo", () => {
  const location = {
    latitude: -34.6,
    longitude: -58.4,
    accuracy: 5,
    timestamp: 1000,
    simulated: true,
  };
  const installation: Installation = {
    id: "demo",
    deviceId: "pc",
    site: "Laboratorio",
    technician: "Técnico",
    notes: "<prueba>",
    createdAt: 1000,
    location,
    photos: [{ id: "foto", uri: "local.jpg", location, capturedAt: 1000 }],
  };
  const html = reportHtml(installation, undefined, [], ["aGVsbG8="]);
  assert.match(html, /UBICACIÓN SIMULADA/);
  assert.match(html, /no acredita una visita de campo/);
  assert.match(html, /&lt;prueba&gt;/);
  const real = reportHtml(
    {
      ...installation,
      location: { ...location, simulated: false },
      photos: [],
    },
    undefined,
    [],
    [],
  );
  assert.doesNotMatch(real, /UBICACIÓN SIMULADA/);
});
