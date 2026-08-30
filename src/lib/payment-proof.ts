export const UTR_DIGITS = 12;
export const MAX_PROOF_DATA_CHARS = 380_000;

export function normalizeUtr(value: string): string {
  return value.replace(/\D/g, "").slice(0, UTR_DIGITS);
}

export function isCompleteUtr(value: string): boolean {
  return normalizeUtr(value).length === UTR_DIGITS;
}

export type PaymentScreenshot = {
  name: string;
  mime: "image/jpeg";
  dataUrl: string;
};

export async function compressPaymentScreenshot(file: File): Promise<PaymentScreenshot> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Upload a screenshot (JPG, PNG, or WebP).");
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error("That screenshot is too big. Keep it under 8 MB.");
  }

  const bitmap = await createImageBitmap(file);
  const maxEdge = 960;
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Couldn't read that screenshot.");
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const name = file.name.slice(0, 180) || "upi-screenshot.jpg";
  for (const quality of [0.72, 0.55, 0.4]) {
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    if (dataUrl.length <= MAX_PROOF_DATA_CHARS) {
      return { name, mime: "image/jpeg", dataUrl };
    }
  }

  throw new Error("Couldn't shrink that screenshot. Crop it and try again.");
}
