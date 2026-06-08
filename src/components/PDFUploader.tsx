import { useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { uploadToStorage } from "../lib/storage";
import { supabase } from "../lib/supabase";

type Props = {
  ownerColumn: "room_id" | "panel_id";
  ownerId: string;
  onUploaded: () => void;
};

const MAX_PDF_MB = 50;

export default function PDFUploader({ ownerColumn, ownerId, onUploaded }: Props) {
  const { userId } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0 || !userId) return;
    setError(null);
    setBusy(true);
    setProgress({ done: 0, total: files.length });

    const list = Array.from(files);
    let done = 0;
    let firstError: string | null = null;

    for (const file of list) {
      if (firstError) break;

      if (file.size > MAX_PDF_MB * 1024 * 1024) {
        firstError = `"${file.name}" ${MAX_PDF_MB} MB'dan büyük — desteklenmiyor.`;
        break;
      }

      const result = await uploadToStorage({
        userId,
        folder: `documents/${ownerId}`,
        file,
        filename: file.name,
        contentType: "application/pdf",
      });

      if ("error" in result) {
        firstError = result.error;
        break;
      }

      const { error: dbErr } = await supabase.from("documents").insert({
        [ownerColumn]: ownerId,
        storage_path: result.path,
        title: file.name.replace(/\.pdf$/i, ""),
        file_size: file.size,
      } as never);

      if (dbErr) {
        firstError = dbErr.message;
        break;
      }

      done += 1;
      setProgress({ done, total: list.length });
    }

    if (firstError) setError(firstError);
    setBusy(false);
    setProgress(null);
    if (fileRef.current) fileRef.current.value = "";
    onUploaded();
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={busy}
        onClick={() => fileRef.current?.click()}
        className="flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-zinc-300 bg-white px-4 py-5 text-zinc-600 transition active:bg-zinc-50 disabled:opacity-60"
      >
        <PDFIcon />
        <span className="text-sm font-semibold">
          {busy
            ? progress
              ? `Yükleniyor ${progress.done}/${progress.total}…`
              : "Hazırlanıyor…"
            : "PDF Seç / Yükle"}
        </span>
      </button>

      <input
        ref={fileRef}
        type="file"
        accept="application/pdf"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {error && (
        <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      {busy && progress && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
          <div
            className="h-full rounded-full bg-zinc-900 transition-all duration-200"
            style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

function PDFIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="9" y1="13" x2="9" y2="17" />
      <line x1="12" y1="11" x2="12" y2="17" />
      <line x1="15" y1="15" x2="15" y2="17" />
    </svg>
  );
}
