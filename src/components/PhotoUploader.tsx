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
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0 || !userId) return;
    setError(null);
    setBusy(true);
    setProgress({ done: 0, total: files.length });

    try {
      const list = Array.from(files);
      for (let i = 0; i < list.length; i++) {
        const file = list[i];
        const dim = await readImageSize(file).catch(() => null);

        const result = await uploadToStorage({
          userId,
          folder: `${folder}/${ownerId}`,
          file,
          filename: file.name,
        });

        if ("error" in result) {
          setError(result.error);
          break;
        }

        const insertPayload = {
          [ownerColumn]: ownerId,
          storage_path: result.path,
          width: dim?.width ?? null,
          height: dim?.height ?? null,
        } as Record<string, unknown>;

        const { error: dbErr } = await supabase
          .from("photos")
          .insert(insertPayload as never);
        if (dbErr) {
          setError(dbErr.message);
          break;
        }

        setProgress({ done: i + 1, total: list.length });
      }
      onUploaded();
    } finally {
      setBusy(false);
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

      {progress && (
        <div className="rounded-xl bg-zinc-100 px-4 py-3 text-sm text-zinc-700">
          Yükleniyor: {progress.done}/{progress.total}
        </div>
      )}
      {error && (
        <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}
    </div>
  );
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
