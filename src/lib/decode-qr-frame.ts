import jsQR from "jsqr";

type Detector = { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>> };
type DetectorCtor = new (options?: { formats: string[] }) => Detector;

/**
 * Chrome and Android WebView ship a native barcode detector that reads a QR off
 * a bright phone screen far better than anything we can do on a canvas. Safari
 * and older iPads don't have it, so jsQR stays as the fallback rather than the
 * only path. `undefined` means we haven't looked yet; `null` means there isn't one.
 */
let native: Detector | null | undefined;

function nativeDetector(): Detector | null {
  if (native === undefined) {
    const Ctor = (globalThis as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
    try {
      native = Ctor ? new Ctor({ formats: ["qr_code"] }) : null;
    } catch {
      native = null;
    }
  }
  return native;
}

/**
 * Two looks per frame: the whole thing scaled down, which is cheap and catches a
 * pass held up close, then the middle at full detail for one held at arm's
 * length. Without the second pass staff have to keep asking people to come closer.
 */
const LOOKS = [
  { zoom: 1, maxEdge: 640 },
  { zoom: 0.5, maxEdge: 640 },
];

export async function decodeQrFromVideo(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
): Promise<string | null> {
  const detector = nativeDetector();
  if (detector) {
    try {
      const [found] = await detector.detect(video);
      const value = found?.rawValue?.trim();
      if (value) return value;
    } catch {
      // Throws on a frame that isn't decodable yet. jsQR gets a turn below.
    }
  }

  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    return null;
  }

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  for (const { zoom, maxEdge } of LOOKS) {
    const sw = Math.round(width * zoom);
    const sh = Math.round(height * zoom);
    const scale = Math.min(1, maxEdge / Math.max(sw, sh));

    canvas.width = Math.max(1, Math.round(sw * scale));
    canvas.height = Math.max(1, Math.round(sh * scale));
    ctx.drawImage(
      video,
      Math.round((width - sw) / 2),
      Math.round((height - sh) / 2),
      sw,
      sh,
      0,
      0,
      canvas.width,
      canvas.height,
    );

    const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
    // A QR on a screen is often light-on-dark, which "dontInvert" throws away.
    const code = jsQR(frame.data, frame.width, frame.height, {
      inversionAttempts: "attemptBoth",
    });
    const value = code?.data?.trim();
    if (value) return value;
  }

  return null;
}
