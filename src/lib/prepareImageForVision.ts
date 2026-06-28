const MAX_DIMENSION = 1536;
const JPEG_QUALITY = 0.82;
const PREPARE_THRESHOLD = 250 * 1024;

export type PreparedVisionImage = {
  base64: string;
  mimeType: string;
};

export async function prepareImageForVision(file: File): Promise<PreparedVisionImage> {
  const isRaster = /^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type);
  if (!isRaster || file.size < PREPARE_THRESHOLD) {
    return fileToBase64(file);
  }

  try {
    const compressed = await compressJpeg(file, MAX_DIMENSION, JPEG_QUALITY);
    if (!compressed) return fileToBase64(file);
    return {
      base64: await blobToBase64(compressed),
      mimeType: "image/jpeg",
    };
  } catch {
    return fileToBase64(file);
  }
}

async function fileToBase64(file: File): Promise<PreparedVisionImage> {
  return {
    base64: await blobToBase64(file),
    mimeType: file.type || "image/jpeg",
  };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1] ?? "";
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Görsel okunamadı"));
    reader.readAsDataURL(blob);
  });
}

async function compressJpeg(
  file: File,
  maxDim: number,
  quality: number,
): Promise<Blob | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const scale = Math.min(1, maxDim / Math.max(w, h));
    const cw = Math.max(1, Math.round(w * scale));
    const ch = Math.max(1, Math.round(h * scale));

    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, cw, ch);

    return await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image_load_failed"));
    img.src = url;
  });
}
