export const ULTRA_WIDE_LENS = "AVCaptureDeviceTypeBuiltInUltraWideCamera";
export const WIDE_LENS = "AVCaptureDeviceTypeBuiltInWideAngleCamera";
const TELEPHOTO_LENS = "AVCaptureDeviceTypeBuiltInTelephotoCamera";

export type CameraLens = { deviceType: string; localizedName: string };

export function chooseCameraLens(
  lenses: CameraLens[],
  current: string | undefined,
  preferUltraWide: boolean,
): string | undefined {
  if (!lenses.length) return current;
  if (lenses.some((lens) => lens.deviceType === current)) return current;
  const preferred = preferUltraWide ? ULTRA_WIDE_LENS : WIDE_LENS;
  return (
    lenses.find((lens) => lens.deviceType === preferred)?.deviceType ??
    lenses.find((lens) => lens.deviceType === WIDE_LENS)?.deviceType ??
    lenses[0].deviceType
  );
}

export function cameraLensLabel(lens: CameraLens): string {
  if (lens.deviceType === ULTRA_WIDE_LENS) return "0,5×";
  if (lens.deviceType === WIDE_LENS) return "1×";
  if (lens.deviceType === TELEPHOTO_LENS) return "Teleobjetivo";
  return lens.localizedName || "Otra cámara";
}
