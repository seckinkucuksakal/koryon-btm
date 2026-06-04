import { STORAGE_BUCKET, supabase } from "./supabase";

const SIGNED_URL_TTL = 60 * 60;

const cache = new Map<string, { url: string; expiresAt: number }>();

export async function getSignedUrl(path: string): Promise<string | null> {
  const cached = cache.get(path);
  if (cached && cached.expiresAt > Date.now() + 30_000) {
    return cached.url;
  }

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL);

  if (error || !data) return null;

  cache.set(path, {
    url: data.signedUrl,
    expiresAt: Date.now() + SIGNED_URL_TTL * 1000,
  });
  return data.signedUrl;
}

export type UploadOptions = {
  userId: string;
  folder: string;
  file: File | Blob;
  filename?: string;
  contentType?: string;
};

export async function uploadToStorage({
  userId,
  folder,
  file,
  filename,
  contentType,
}: UploadOptions): Promise<{ path: string } | { error: string }> {
  const ext = filename?.split(".").pop() ?? guessExt(file);
  const safeName = filename
    ? filename.replace(/[^\w.\-]/g, "_")
    : `${crypto.randomUUID()}.${ext}`;
  const path = `${userId}/${folder}/${Date.now()}-${safeName}`;

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, {
      contentType: contentType ?? (file instanceof File ? file.type : undefined),
      upsert: false,
    });

  if (error) return { error: error.message };
  return { path };
}

export async function deleteFromStorage(path: string) {
  await supabase.storage.from(STORAGE_BUCKET).remove([path]);
  cache.delete(path);
}

function guessExt(file: File | Blob): string {
  const t = file.type;
  if (t.includes("png")) return "png";
  if (t.includes("webp")) return "webp";
  if (t.includes("heic")) return "heic";
  return "jpg";
}
