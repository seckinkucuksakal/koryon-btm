import { STORAGE_BUCKET, supabase } from "./supabase";

/**
 * Bucket public olduğu için direkt public URL üretiyoruz.
 * (Eski signed URL akışından farklı: cache veya TTL gerekmiyor.)
 * Async imzayı koruyoruz, çağıran kodları değiştirmemek için.
 */
export async function getSignedUrl(path: string): Promise<string | null> {
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data?.publicUrl ?? null;
}

export type UploadOptions = {
  userId?: string;
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
  // userId yoksa ortak klasör.
  const owner = userId && userId.length > 0 ? userId : "shared";
  const path = `${owner}/${folder}/${Date.now()}-${safeName}`;

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
}

function guessExt(file: File | Blob): string {
  const t = file.type;
  if (t.includes("png")) return "png";
  if (t.includes("webp")) return "webp";
  if (t.includes("heic")) return "heic";
  return "jpg";
}
