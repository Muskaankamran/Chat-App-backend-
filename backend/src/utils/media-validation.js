const supportedMediaTypes = new Map([
  ["image/jpeg", { type: "image", extension: ".jpg" }],
  ["image/png", { type: "image", extension: ".png" }],
  ["image/webp", { type: "image", extension: ".webp" }],
  ["image/gif", { type: "image", extension: ".gif" }],
  ["audio/webm", { type: "audio", extension: ".webm" }],
  ["audio/ogg", { type: "audio", extension: ".ogg" }],
  ["audio/mp4", { type: "audio", extension: ".m4a" }],
  ["audio/mpeg", { type: "audio", extension: ".mp3" }],
  ["audio/wav", { type: "audio", extension: ".wav" }],
  ["audio/x-wav", { type: "audio", extension: ".wav" }],
]);

export function getSupportedMediaType(mimeType) {
  return supportedMediaTypes.get(normalizeMediaType(mimeType)) ?? null;
}

export function normalizeMediaType(mimeType) {
  return typeof mimeType === "string"
    ? mimeType.split(";")[0].trim().toLowerCase()
    : "";
}

export function isSupportedMediaBuffer(buffer, mimeType) {
  const type = normalizeMediaType(mimeType);
  if (!Buffer.isBuffer(buffer)) {
    return false;
  }
  switch (type) {
    case "image/jpeg":
      return buffer.length >= 3 &&
        buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    case "image/png":
      return buffer.length >= 8 &&
        buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    case "image/webp":
      return buffer.length >= 12 &&
        buffer.toString("ascii", 0, 4) === "RIFF" &&
        buffer.toString("ascii", 8, 12) === "WEBP";
    case "image/gif":
      return buffer.toString("ascii", 0, 6) === "GIF87a" ||
        buffer.toString("ascii", 0, 6) === "GIF89a";
    case "audio/webm":
      return buffer.length >= 4 &&
        buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
    case "audio/ogg":
      return buffer.toString("ascii", 0, 4) === "OggS";
    case "audio/mp4":
      return buffer.length >= 12 &&
        buffer.toString("ascii", 4, 8) === "ftyp";
    case "audio/mpeg":
      return buffer.toString("ascii", 0, 3) === "ID3" ||
        (buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0);
    case "audio/wav":
    case "audio/x-wav":
      return buffer.length >= 12 &&
        buffer.toString("ascii", 0, 4) === "RIFF" &&
        buffer.toString("ascii", 8, 12) === "WAVE";
    default:
      return false;
  }
}
