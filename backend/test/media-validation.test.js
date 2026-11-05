import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getSupportedMediaType,
  isSupportedMediaBuffer,
  normalizeMediaType,
} from "../src/utils/media-validation.js";

describe("chat media validation", () => {
  it("accepts supported browser voice recording types", () => {
    const webmHeader = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);
    assert.deepEqual(getSupportedMediaType("audio/webm;codecs=opus"), {
      type: "audio",
      extension: ".webm",
    });
    assert.equal(normalizeMediaType("audio/webm;codecs=opus"), "audio/webm");
    assert.equal(
      isSupportedMediaBuffer(webmHeader, "audio/webm;codecs=opus"),
      true,
    );
  });

  it("validates image signatures and rejects unsupported content", () => {
    const pngHeader = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(isSupportedMediaBuffer(pngHeader, "image/png"), true);
    assert.equal(getSupportedMediaType("image/svg+xml"), null);
    assert.equal(isSupportedMediaBuffer(Buffer.from("<svg/>"), "image/png"), false);
  });
});
