// src/lib/imageMetadata.ts
//
// Downloads one image and extracts/flags its EXIF metadata. This is a
// genuinely strong signal for marketplace-fraud work — unlike page text,
// which a bad actor can freely write to sound legitimate, EXIF is a
// byproduct of how the photo was actually produced, so it's harder to
// fake convincingly:
//   - Missing EXIF entirely: legitimate small sellers usually don't
//     bother stripping it; its total absence is itself a (weak) signal
//     that someone deliberately scrubbed it.
//   - Editing-software tag present (Photoshop, GIMP, etc.): common when
//     watermarks/backgrounds are being removed or a photo is being reused.
//   - GPS coordinates present: informational — can corroborate or
//     contradict a claimed "ships from" location elsewhere on the page.
//
// None of these flags are proof of anything on their own — they're
// signals to weigh alongside the page-level text score, same caveat as
// every risk signal elsewhere in this codebase.

import exifr from "exifr";

const MAX_IMAGE_BYTES = 15 * 1024 * 1024; // 15MB safety cap
const FETCH_TIMEOUT_MS = 8000;

export interface ImageMetadataResult {
  imageUrl: string;
  width: number | null;
  height: number | null;
  cameraMake: string | null;
  cameraModel: string | null;
  software: string | null;
  gpsLat: number | null;
  gpsLon: number | null;
  capturedAt: Date | null;
  metadataStripped: boolean;
  suspicionFlags: string[];
  error?: string;
}

const EDITING_SOFTWARE_PATTERN = /(photoshop|gimp|paint\.net|lightroom|affinity photo|canva)/i;

// Shared EXIF-parsing core. `label` is stored in the result's `imageUrl`
// field (kept as-is for backward compatibility with existing callers/shape)
// — for buffer-sourced images there's no URL, so callers pass a descriptive
// placeholder instead.
async function parseExif(buffer: Buffer, label: string): Promise<ImageMetadataResult> {
  const base: ImageMetadataResult = {
    imageUrl: label,
    width: null,
    height: null,
    cameraMake: null,
    cameraModel: null,
    software: null,
    gpsLat: null,
    gpsLon: null,
    capturedAt: null,
    metadataStripped: true,
    suspicionFlags: [],
  };

  try {
    const data = await exifr.parse(buffer, {
      pick: ["Make", "Model", "Software", "GPSLatitude", "GPSLongitude", "DateTimeOriginal", "ExifImageWidth", "ExifImageHeight"],
    });

    const hasAnyExif = !!data && Object.keys(data).length > 0;
    const flags: string[] = [];

    if (!hasAnyExif) {
      flags.push("metadata_stripped");
    } else {
      if (data.Software && EDITING_SOFTWARE_PATTERN.test(String(data.Software))) {
        flags.push("editing_software_detected");
      }
      if (typeof data.GPSLatitude === "number" && typeof data.GPSLongitude === "number") {
        flags.push("gps_present");
      }
      if (!data.Make && !data.Model) {
        flags.push("no_device_info"); // has SOME exif, but camera/device fields absent — partial scrub
      }
    }

    return {
      imageUrl: label,
      width: data?.ExifImageWidth ?? null,
      height: data?.ExifImageHeight ?? null,
      cameraMake: data?.Make ?? null,
      cameraModel: data?.Model ?? null,
      software: data?.Software ?? null,
      gpsLat: typeof data?.GPSLatitude === "number" ? data.GPSLatitude : null,
      gpsLon: typeof data?.GPSLongitude === "number" ? data.GPSLongitude : null,
      capturedAt: data?.DateTimeOriginal ? new Date(data.DateTimeOriginal) : null,
      metadataStripped: !hasAnyExif,
      suspicionFlags: flags,
    };
  } catch (err: any) {
    // Parse failure (not a valid/parseable image, or a format with no
    // EXIF container e.g. PNG/WebP) — this is different from a network
    // error, but for our purposes it means the same thing: no usable
    // metadata to inspect.
    return { ...base, metadataStripped: true, suspicionFlags: ["metadata_stripped"], error: `EXIF parse error: ${err.message ?? String(err)}` };
  }
}

// URL-based entry point: downloads the image first, then parses EXIF.
export async function analyzeImage(imageUrl: string): Promise<ImageMetadataResult> {
  let buffer: ArrayBuffer;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(imageUrl, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) {
      return { imageUrl, width: null, height: null, cameraMake: null, cameraModel: null, software: null, gpsLat: null, gpsLon: null, capturedAt: null, metadataStripped: true, suspicionFlags: [], error: `Fetch failed: HTTP ${res.status}` };
    }

    const contentLength = Number(res.headers.get("content-length") ?? 0);
    if (contentLength && contentLength > MAX_IMAGE_BYTES) {
      return { imageUrl, width: null, height: null, cameraMake: null, cameraModel: null, software: null, gpsLat: null, gpsLon: null, capturedAt: null, metadataStripped: true, suspicionFlags: [], error: `Image too large (${contentLength} bytes) — skipped` };
    }
    buffer = await res.arrayBuffer();
    if (buffer.byteLength > MAX_IMAGE_BYTES) {
      return { imageUrl, width: null, height: null, cameraMake: null, cameraModel: null, software: null, gpsLat: null, gpsLon: null, capturedAt: null, metadataStripped: true, suspicionFlags: [], error: `Image too large (${buffer.byteLength} bytes) — skipped` };
    }
  } catch (err: any) {
    return { imageUrl, width: null, height: null, cameraMake: null, cameraModel: null, software: null, gpsLat: null, gpsLon: null, capturedAt: null, metadataStripped: true, suspicionFlags: [], error: `Fetch error: ${err.message ?? String(err)}` };
  }

  return parseExif(Buffer.from(buffer), imageUrl);
}

// Buffer-based entry point: for evidence already decoded in-process (e.g.
// a base64 upload), so EXIF is read off the exact same bytes that were
// hashed for chain-of-custody — no extra network fetch involved.
export async function extractImageMetadata(imageBuffer: Buffer): Promise<ImageMetadataResult> {
  if (imageBuffer.byteLength > MAX_IMAGE_BYTES) {
    return { imageUrl: "uploaded-image", width: null, height: null, cameraMake: null, cameraModel: null, software: null, gpsLat: null, gpsLon: null, capturedAt: null, metadataStripped: true, suspicionFlags: [], error: `Image too large (${imageBuffer.byteLength} bytes) — skipped` };
  }
  return parseExif(imageBuffer, "uploaded-image");
}