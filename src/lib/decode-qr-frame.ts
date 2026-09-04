import jsQR from "jsqr";

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
};

type BarcodeDetectorCtor = new (options?: { formats: string[] }) => BarcodeDetectorLike;

let barcodeDetector: BarcodeDetectorLike | null | undefined;

function getBarcodeDetector(): BarcodeDetectorLike | null {
  if (barcodeDetector !== undefined) return barcodeDetector;
  const Ctor = (globalThis as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
  if (!Ctor) {
    barcodeDetector = null;
    return null;
  }
  try {
    barcodeDetector = new Ctor({ formats: ["qr_code"] });
  } catch {
    barcodeDetector = null;
  }
  return barcodeDetector;
}

function readJsQr(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): string | null {
  const code = jsQR(data, width, height, { inversionAttempts: "attemptBoth" });
  const value = code?.data?.trim();
  return value || null;
}

function decodeFromCanvas(canvas: HTMLCanvasElement): string | null {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  const { width, height } = canvas;
  if (!width || !height) return null;

  const full = ctx.getImageData(0, 0, width, height);
  const direct = readJsQr(full.data, width, height);
  if (direct) return direct;

  const crop = 0.18;
  const sx = Math.round(width * crop);
  const sy = Math.round(height * crop);
  const cw = Math.max(32, width - sx * 2);
  const ch = Math.max(32, height - sy * 2);
  const inset = ctx.getImageData(sx, sy, cw, ch);
  return readJsQr(inset.data, cw, ch);
}

function drawVideo(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  maxEdge: number,
): boolean {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    return false;
  }
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return false;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return true;
}

/**
 * Decode a QR from a live video frame. Phone-screen scans need inversion and
 * a smaller working buffer — dense HMAC payloads used to fail both.
 */
export async function decodeQrFromVideo(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
): Promise<string | null> {
  const detector = getBarcodeDetector();
  if (detector) {
    try {
      const codes = await detector.detect(video);
      const raw = codes[0]?.rawValue?.trim();
      if (raw) return raw;
    } catch {
      // Fall through to jsQR.
    }
  }

  for (const maxEdge of [720, 480]) {
    if (!drawVideo(video, canvas, maxEdge)) return null;
    const value = decodeFromCanvas(canvas);
    if (value) return value;
  }
  return null;
}
