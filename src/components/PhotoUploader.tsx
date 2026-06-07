import { useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { uploadToStorage } from "../lib/storage";
import { supabase } from "../lib/supabase";

type Props = {
  folder: string;
  ownerColumn: "room_id" | "panel_id";
  ownerId: string;
  onUploaded: () => void;
};

const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 0.82;
const PARALLEL_UPLOADS = 3;

export default function PhotoUploader({
  folder,
  ownerColumn,
  ownerId,
  onUploaded,
}: Props) {
  const { userId } = useAuth();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<"prepare" | "upload" | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0 || !userId) return;
    setError(null);
    setBusy(true);
    setStage("prepare");
    setProgress({ done: 0, total: files.length });

    try {
      const list = Array.from(files);

      // 1) Önce hepsini sıkıştır (paralel) — ağa daha az veri yüklemek için.
      const prepared = await Promise.all(
        list.map((f) => prepareImage(f).catch(() => fallback(f))),
      );

      // 2) Belirli bir eşzamanlılık limitiyle upload + DB insert.
      setStage("upload");
      setProgress({ done: 0, total: prepared.length });

      let done = 0;
      let firstError: string | null = null;

      await runWithConcurrency(prepared, PARALLEL_UPLOADS, async (item) => {
        if (firstError) return;
        const result = await uploadToStorage({
          userId,
          folder: `${folder}/${ownerId}`,
          file: item.blob,
          filename: item.filename,
          contentType: item.contentType,
        });

        if ("error" in result) {
          firstError = result.error;
          return;
        }

        const insertPayload = {
          [ownerColumn]: ownerId,
          storage_path: result.path,
          width: item.width,
          height: item.height,
        } as Record<string, unknown>;

        const { error: dbErr } = await supabase
          .from("photos")
          .insert(insertPayload as never);
        if (dbErr) {
          firstError = dbErr.message;
          return;
        }

        done += 1;
        setProgress({ done, total: prepared.length });
      });

      if (firstError) setError(firstError);
      onUploaded();
    } finally {
      setBusy(false);
      setStage(null);
      setProgress(null);
      if (cameraRef.current) cameraRef.current.value = "";
      if (galleryRef.current) galleryRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => cameraRef.current?.click()}
          className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-zinc-900 px-4 py-5 text-white shadow-sm transition active:scale-[0.99] active:bg-zinc-800 disabled:opacity-60"
        >
          <CameraIcon />
          <span className="text-sm font-semibold">Kamera</span>
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => galleryRef.current?.click()}
          className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-zinc-200 bg-white px-4 py-5 text-zinc-900 shadow-sm transition active:scale-[0.99] active:bg-zinc-50 disabled:opacity-60"
        >
          <GalleryIcon />
          <span className="text-sm font-semibold">Galeri</span>
        </button>
      </div>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {error && (
        <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {busy && (
        <UploadOverlay
          stage={stage}
          done={progress?.done ?? 0}
          total={progress?.total ?? 0}
        />
      )}
    </div>
  );
}

function UploadOverlay({
  stage,
  done,
  total,
}: {
  stage: "prepare" | "upload" | null;
  done: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const message =
    stage === "prepare"
      ? "Fotoğraflar hazırlanıyor"
      : stage === "upload"
        ? "Fotoğraflar yükleniyor"
        : "İşleniyor";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/55 px-6 backdrop-blur-sm">
      <div className="flex w-full max-w-xs flex-col items-center gap-4 rounded-2xl bg-white px-6 py-7 shadow-2xl">
        <CameraSpinner />
        <div className="text-center">
          <div className="text-base font-semibold text-zinc-900">{message}</div>
          {total > 0 && (
            <div className="mt-1 text-sm tabular-nums text-zinc-500">
              {done} / {total}
            </div>
          )}
        </div>
        {total > 0 && stage === "upload" && (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
            <div
              className="h-full rounded-full bg-zinc-900 transition-all duration-200"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
        <p className="text-center text-xs text-zinc-400">
          Fotoğraflar otomatik olarak optimize edilip yükleniyor.
        </p>
      </div>
    </div>
  );
}

function CameraSpinner() {
  return (
    <div className="relative flex h-14 w-14 items-center justify-center">
      <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-zinc-200 border-t-zinc-900" />
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-zinc-900"
      >
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
      </svg>
    </div>
  );
}

type Prepared = {
  blob: Blob | File;
  filename: string;
  contentType?: string;
  width: number | null;
  height: number | null;
};

async function prepareImage(file: File): Promise<Prepared> {
  const dim = await readImageSize(file).catch(() => null);

  // Sıkıştırma yalnızca raster (jpeg/png/webp) görsellerde anlamlı.
  const isRaster = /^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type);
  if (!isRaster || file.size < 200 * 1024) {
    return {
      blob: file,
      filename: file.name,
      contentType: file.type,
      width: dim?.width ?? null,
      height: dim?.height ?? null,
    };
  }

  try {
    const compressed = await compressJpeg(file, MAX_DIMENSION, JPEG_QUALITY);
    if (!compressed || compressed.blob.size >= file.size) {
      return {
        blob: file,
        filename: file.name,
        contentType: file.type,
        width: dim?.width ?? null,
        height: dim?.height ?? null,
      };
    }
    return {
      blob: compressed.blob,
      filename: replaceExt(file.name, "jpg"),
      contentType: "image/jpeg",
      width: compressed.width,
      height: compressed.height,
    };
  } catch {
    return {
      blob: file,
      filename: file.name,
      contentType: file.type,
      width: dim?.width ?? null,
      height: dim?.height ?? null,
    };
  }
}

function fallback(file: File): Prepared {
  return {
    blob: file,
    filename: file.name,
    contentType: file.type,
    width: null,
    height: null,
  };
}

async function compressJpeg(
  file: File,
  maxDim: number,
  quality: number,
): Promise<{ blob: Blob; width: number; height: number } | null> {
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

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob) return null;
    return { blob, width: cw, height: ch };
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

function readImageSize(
  file: File,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const out = { width: img.naturalWidth, height: img.naturalHeight };
      URL.revokeObjectURL(url);
      resolve(out);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image_load_failed"));
    };
    img.src = url;
  });
}

function replaceExt(name: string, ext: string): string {
  return name.replace(/\.[^.]+$/, "") + "." + ext;
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  const queue = [...items];
  const workers: Promise<void>[] = [];
  for (let i = 0; i < Math.min(limit, queue.length); i++) {
    workers.push(
      (async () => {
        while (queue.length > 0) {
          const item = queue.shift();
          if (!item) break;
          await worker(item);
        }
      })(),
    );
  }
  await Promise.all(workers);
}

function CameraIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function GalleryIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  );
}
