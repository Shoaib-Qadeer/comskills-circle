// Shrinks a chosen photo in the browser to a ~256 px square (≤ 40 KB) before upload, so phones on
// slow data never send multi-megabyte images and MongoDB stays small.

export const PHOTO_SIZE = 256;
export const PHOTO_MAX_BYTES = 40 * 1024;

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality));
}

async function decode(file: File): Promise<CanvasImageSource & { width: number; height: number }> {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file);
    } catch {
      /* fall back to <img> below */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Center-crops to a square and encodes as WebP (or JPEG where WebP encoding isn't supported). */
export async function resizePhoto(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose a photo (JPEG, PNG or WebP).");
  if (file.size > 25 * 1024 * 1024) throw new Error("That file is too big. Choose a photo under 25 MB.");
  let src;
  try {
    src = await decode(file);
  } catch {
    throw new Error("Couldn't read that photo. Try a JPEG or PNG.");
  }
  const side = Math.min(src.width, src.height);
  const sx = (src.width - side) / 2;
  const sy = (src.height - side) / 2;
  const canvas = document.createElement("canvas");
  canvas.width = PHOTO_SIZE;
  canvas.height = PHOTO_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser couldn't process the photo.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, sx, sy, side, side, 0, 0, PHOTO_SIZE, PHOTO_SIZE);
  for (const type of ["image/webp", "image/jpeg"]) {
    for (const q of [0.82, 0.72, 0.62, 0.5, 0.4]) {
      const blob = await canvasToBlob(canvas, type, q);
      // Some browsers silently return PNG when they can't encode WebP; skip to JPEG then.
      if (!blob || blob.type !== type) break;
      if (blob.size <= PHOTO_MAX_BYTES) return blob;
    }
  }
  throw new Error("Couldn't make that photo small enough. Try another one.");
}
