import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cameraLensLabel,
  chooseCameraLens,
  ULTRA_WIDE_LENS,
  WIDE_LENS,
} from "../src/domain/camera";

const wide = { deviceType: WIDE_LENS, localizedName: "Cámara gran angular" };
const ultra = {
  deviceType: ULTRA_WIDE_LENS,
  localizedName: "Back Ultra Wide Camera",
};

test("Cámara: elige la lente física 0,5× aunque iOS liste primero la 1× o una cámara virtual", () => {
  const virtual = {
    deviceType: "AVCaptureDeviceTypeBuiltInTripleCamera",
    localizedName: "Triple cámara",
  };
  assert.equal(
    chooseCameraLens([wide, virtual, ultra], undefined, true),
    ULTRA_WIDE_LENS,
  );
  assert.equal(cameraLensLabel(ultra), "0,5×");
  assert.equal(
    cameraLensLabel({ ...ultra, localizedName: "超広角カメラ" }),
    "0,5×",
  );
});

test("Cámara: conserva la elección manual y vuelve a una lente disponible si desaparece", () => {
  assert.equal(chooseCameraLens([wide, ultra], WIDE_LENS, true), WIDE_LENS);
  assert.equal(chooseCameraLens([wide], ULTRA_WIDE_LENS, true), WIDE_LENS);
  assert.equal(chooseCameraLens([], ULTRA_WIDE_LENS, true), ULTRA_WIDE_LENS);
  const front = {
    deviceType: "AVCaptureDeviceTypeBuiltInTrueDepthCamera",
    localizedName: "Frontal",
  };
  assert.equal(
    chooseCameraLens([front], ULTRA_WIDE_LENS, false),
    front.deviceType,
  );
});
