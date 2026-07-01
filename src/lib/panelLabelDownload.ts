import { getPublicUrl } from "./storage";
import {
  type PanelLabelImage,
  type PanelLabelImageCategory,
} from "./panelLabelCatalog";

function sanitizeZipSegment(value: string): string {
  return value
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 100);
}

function formatDownloadDate(date = new Date()): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

export function buildPanelZipFolderName(
  regionName: string,
  panelName: string,
  date = formatDownloadDate(),
): string {
  const region = sanitizeZipSegment(regionName) || "Bolge";
  const panel = sanitizeZipSegment(panelName) || "Pano";
  return `${region} - ${panel} - ${date}`;
}

export function buildPanelZipFilename(
  regionName: string,
  panelName: string,
  date = formatDownloadDate(),
): string {
  return `${buildPanelZipFolderName(regionName, panelName, date)}.zip`;
}

function extensionForMime(mimeType: string, storagePath: string): string {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("heic")) return "heic";
  if (mimeType.includes("gif")) return "gif";
  const fromPath = storagePath.split(".").pop()?.toLowerCase();
  if (fromPath && /^[a-z0-9]{2,5}$/.test(fromPath)) return fromPath;
  return "jpg";
}

function sanitizeFileBase(value: string): string {
  return (
    value
      .trim()
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
      .replace(/\s+/g, " ")
      .slice(0, 80) || "dosya"
  );
}

function uniqueEntryName(
  image: PanelLabelImage,
  index: number,
  used: Set<string>,
): string {
  const ext = extensionForMime(image.mimeType, image.storagePath);
  const base = sanitizeFileBase(image.title || `dosya-${index + 1}`);
  let name = `${base}.${ext}`;
  if (!used.has(name)) {
    used.add(name);
    return name;
  }
  let i = 2;
  while (used.has(`${base}-${i}.${ext}`)) i += 1;
  name = `${base}-${i}.${ext}`;
  used.add(name);
  return name;
}

export async function downloadPanelImagesZip(options: {
  regionName: string;
  panelName: string;
  category: PanelLabelImageCategory;
  images: PanelLabelImage[];
  onProgress?: (done: number, total: number) => void;
}): Promise<void> {
  const { regionName, panelName, images, onProgress } = options;
  if (images.length === 0) {
    throw new Error("İndirilecek dosya yok.");
  }

  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const date = formatDownloadDate();
  const folderName = buildPanelZipFolderName(regionName, panelName, date);
  const folder = zip.folder(folderName);
  if (!folder) throw new Error("ZIP oluşturulamadı.");

  const used = new Set<string>();
  let done = 0;

  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    const url = getPublicUrl(image.storagePath);
    if (!url) {
      throw new Error(`Dosya adresi alınamadı: ${image.title || i + 1}`);
    }

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Dosya indirilemedi: ${image.title || i + 1}`);
    }

    const blob = await res.blob();
    folder.file(uniqueEntryName(image, i, used), blob);
    done += 1;
    onProgress?.(done, images.length);
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = buildPanelZipFilename(regionName, panelName, date);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
