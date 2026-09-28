/**
 * Client-side image preparation — ONE reusable pipeline for every photo the
 * app sends to a server route (citizen report evidence, per-item inspection
 * photos, after-action photos, certificate uploads).
 *
 * Why this exists: serverless platforms (Vercel Functions) cap the request
 * body at ~4.5 MB. A modern phone camera produces 6–12 MB JPEGs (base64
 * inflates by another ~33%), so an unprocessed photo kills the request
 * before the route handler can even respond — the "AI analysis fails on
 * Vercel" class of bug. Every image is therefore:
 *
 *   1. type-validated   (must be image/*; decode failures return null)
 *   2. EXIF-oriented    (createImageBitmap with imageOrientation:"from-image"
 *                        where available; <img> decode honors EXIF in all
 *                        current browsers as the fallback path)
 *   3. downscaled       (max dimension 1600 default — generous enough for
 *                        certificate OCR, small enough for the body cap)
 *   4. re-encoded JPEG  (quality ladder 0.85 → 0.6 until the data URL fits
 *                        the byte budget)
 *
 * The output is a predictable `data:image/jpeg;base64,…` URL that all API
 * routes already accept.
 */

export interface PreparedImage {
  dataUrl: string;
  width: number;
  height: number;
  /** dataUrl character length — the number the server-side caps compare against. */
  bytes: number;
  /** Average luminance 0–255 of the decoded image (null = unreadable). Used
   *  by callers as a black-frame guard — an all-black capture means the
   *  camera never produced a real frame and should be retaken. */
  luminance: number | null;
}

export interface PrepareOptions {
  /** Maximum pixel dimension (width or height). Default 1600. */
  maxDim?: number;
  /** Maximum data-URL character length. Default 1_800_000 (~1.8 MB). */
  maxBytes?: number;
}

const DEFAULT_MAX_DIM = 1600;
const DEFAULT_MAX_BYTES = 1_800_000;
const QUALITY_LADDER = [0.85, 0.75, 0.65, 0.55] as const;

/** Sample ~100 pixels on a 10×10 grid; average luminance 0–255 (null = unreadable). */
function averageLuminance(ctx: CanvasRenderingContext2D, w: number, h: number): number | null {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < 100; i++) {
    const x = Math.min(w - 1, Math.floor(((i % 10) + 0.5) * (w / 10)));
    const y = Math.min(h - 1, Math.floor((Math.floor(i / 10) + 0.5) * (h / 10)));
    const px = ctx.getImageData(x, y, 1, 1).data;
    if (px.length < 3) continue;
    sum += 0.299 * px[0] + 0.587 * px[1] + 0.114 * px[2];
    n++;
  }
  return n === 0 ? null : sum / n;
}

/** Reject obviously non-image inputs before any decode is attempted. */
export function isSupportedImageType(type: string): boolean {
  return (
    type.startsWith("image/") &&
    // image/svg+xml can carry scripts — never rasterize untrusted SVG.
    type !== "image/svg+xml"
  );
}

interface DecodedImage {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
}

/** Decode any browser-readable image source to a canvas, EXIF-oriented and
 *  downscaled to `maxDim`. Returns null when the source cannot be decoded. */
async function decodeToCanvas(
  src: Blob | string,
  maxDim: number,
): Promise<DecodedImage | null> {
  // Primary path: createImageBitmap — honors EXIF orientation where the
  // option is supported (Chrome 81+, Safari 17+, Firefox 26+ behind flag /
  // 105+). Downscaling happens at draw time.
  if (typeof createImageBitmap === "function" && src instanceof Blob) {
    try {
      const bitmap = await createImageBitmap(src, { imageOrientation: "from-image" });
      const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const h = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(bitmap, 0, 0, w, h);
        bitmap.close();
        return { canvas, ctx, w, h };
      }
      bitmap.close();
    } catch {
      // fall through to the <img> path (e.g. orientation option unsupported)
    }
  }

  // Fallback: <img> decode — every current browser applies EXIF orientation
  // to <img> rendering by default (CSS image-orientation: from-image).
  try {
    const url = typeof src === "string" ? src : URL.createObjectURL(src);
    let revoke = false;
    if (typeof src !== "string") {
      revoke = true;
    }
    const img = new Image();
    img.decoding = "async";
    const loaded = new Promise<boolean>((resolve) => {
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
    });
    img.src = url;
    const ok = await loaded;
    if (revoke) URL.revokeObjectURL(url);
    if (!ok) return null;

    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    return { canvas, ctx, w, h };
  } catch {
    return null;
  }
}

/** Encode a prepared canvas to a JPEG data URL within the byte budget,
 *  walking the quality ladder until it fits (or the floor is reached). */
export function canvasToBoundedJpeg(
  canvas: HTMLCanvasElement,
  opts: PrepareOptions = {},
): PreparedImage | null {
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  let dataUrl = "";
  for (const q of QUALITY_LADDER) {
    dataUrl = canvas.toDataURL("image/jpeg", q);
    if (dataUrl.length <= maxBytes) break;
  }
  if (!dataUrl.startsWith("data:image/")) return null;
  const ctx = canvas.getContext("2d");
  return {
    dataUrl,
    width: canvas.width,
    height: canvas.height,
    bytes: dataUrl.length,
    luminance: ctx ? averageLuminance(ctx, canvas.width, canvas.height) : null,
  };
}

/** Prepare a picked File (camera app / gallery) for upload. Returns null on
 *  unsupported type or undecodable content — callers show a friendly toast. */
export async function prepareImageFromFile(
  file: File,
  opts: PrepareOptions = {},
): Promise<PreparedImage | null> {
  if (!isSupportedImageType(file.type)) return null;
  const decoded = await decodeToCanvas(file, opts.maxDim ?? DEFAULT_MAX_DIM);
  if (!decoded) return null;
  return canvasToBoundedJpeg(decoded.canvas, opts);
}

/** Re-prepare an existing data URL (e.g. a live camera frame already drawn to
 *  a data URL, or defensively bounding a photo that came from anywhere). */
export async function prepareImageFromDataUrl(
  dataUrl: string,
  opts: PrepareOptions = {},
): Promise<PreparedImage | null> {
  if (!dataUrl.startsWith("data:image/") || dataUrl.startsWith("data:image/svg")) return null;
  const decoded = await decodeToCanvas(dataUrl, opts.maxDim ?? DEFAULT_MAX_DIM);
  if (!decoded) return null;
  return canvasToBoundedJpeg(decoded.canvas, opts);
}

/** Downscale + bound an existing canvas (live <video> capture frames).
 *  The canvas is drawn at the video's intrinsic size by the caller; this
 *  redraws it capped at maxDim and applies the JPEG byte budget. */
export function prepareCanvasImage(
  source: HTMLCanvasElement,
  opts: PrepareOptions = {},
): PreparedImage | null {
  const maxDim = opts.maxDim ?? DEFAULT_MAX_DIM;
  const scale = Math.min(1, maxDim / Math.max(source.width, source.height));
  const w = Math.max(1, Math.round(source.width * scale));
  const h = Math.max(1, Math.round(source.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, w, h);
  return canvasToBoundedJpeg(canvas, opts);
}
