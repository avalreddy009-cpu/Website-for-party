import jsQR from "jsqr";

/**
 * Decode a QR from a live video frame. Used on the door panel so Safari / iPad
 * can scan without BarcodeDetector (Chrome-only).
 */
export function decodeQrFromVideo(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
): string | null {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    return null;
  }

  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  ctx.drawImage(video, 0, 0, width, height);
  const image = ctx.getImageData(0, 0, width, height);
  const code = jsQR(image.data, image.width, image.height, {
    inversionAttempts: "dontInvert",
  });
  if (!code?.data) return null;

  const { topLeftCorner, topRightCorner, bottomLeftCorner } = code.location;
  const edgeW = Math.hypot(
    topRightCorner.x - topLeftCorner.x,
    topRightCorner.y - topLeftCorner.y,
  );
  const edgeH = Math.hypot(
    bottomLeftCorner.x - topLeftCorner.x,
    bottomLeftCorner.y - topLeftCorner.y,
  );
  if (edgeW < 72 || edgeH < 72) return null;

  return code.data.trim() || null;
}
