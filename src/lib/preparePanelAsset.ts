import { isPanelAssetPdf } from "./panelLabelCatalog";

const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 0.82;
const PREPARE_THRESHOLD = 200 * 1024;

export async function preparePanelAssetFile(file: File): Promise<File> {
  if (isPanelAssetPdf(file.type) || /\.pdf$/i.test(file.name)) return file;

  const isRaster = /^image\/(jpeg|jpg|png|webp|heic|heif)$/i.test(file.type);
  if (!isRaster || file.size < PREPARE_THRESHOLD) return file;

  try {
    const blob = await compressJpeg(file, MAX_DIMENSION, JPEG_QUALITY);
    if (!blob || blob.size >= file.size) return file;
    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg", lastModified: file.lastModified });
  } catch {
    return file;
  }
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
