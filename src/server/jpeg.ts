/** Reject non-JPEG blobs even if the client labelled them image/jpeg. */
export function isJpegDataUrl(data: string): boolean {
  const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/=\s]+)$/i.exec(data.trim());
  if (!match) return false;
  try {
    const buf = Buffer.from(match[1], "base64");
    return buf.length >= 24 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  } catch {
    return false;
  }
}
