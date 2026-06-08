import { useState } from "react";
import { supabase } from "../lib/supabase";
import { deleteFromStorage } from "../lib/storage";
import { useConfirm } from "./ConfirmDialog";
import PDFViewer, { type PDFDoc } from "./PDFViewer";

type Props = {
  documents: PDFDoc[];
  onChange: () => void;
};

export default function DocumentList({ documents, onChange }: Props) {
  const [viewer, setViewer] = useState<PDFDoc | null>(null);

  if (documents.length === 0) return null;

  return (
    <>
      <ul className="mt-3 space-y-2">
        {documents.map((doc) => (
          <DocRow key={doc.id} doc={doc} onOpen={() => setViewer(doc)} onChange={onChange} />
        ))}
      </ul>

      {viewer && <PDFViewer doc={viewer} onClose={() => setViewer(null)} />}
    </>
  );
}

function DocRow({
  doc,
  onOpen,
  onChange,
}: {
  doc: PDFDoc;
  onOpen: () => void;
  onChange: () => void;
}) {
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);

  async function remove() {
    const ok = await confirm({
      title: "Belgeyi sil",
      message: `"${doc.title ?? "Belge"}" silinsin mi?`,
      confirmText: "Sil",
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    await Promise.all([
      supabase
        .from("documents")
        .update({ visible: false, deleted_at: new Date().toISOString() })
        .eq("id", doc.id),
      deleteFromStorage(doc.storage_path),
    ]);
    setBusy(false);
    onChange();
  }

  const size = doc.file_size ? formatBytes(doc.file_size) : null;

  return (
    <li className="flex items-center gap-3 rounded-2xl border-2 border-zinc-200 bg-white px-4 py-3 transition active:bg-zinc-50">
      {/* PDF icon */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
        <PDFIcon />
      </div>

      {/* Info — tap to open */}
      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 flex-1 text-left"
      >
        <p className="truncate text-sm font-semibold text-zinc-900">
          {doc.title ?? "Belge"}
        </p>
        <p className="text-xs text-zinc-400">
          {new Date(doc.created_at).toLocaleDateString("tr-TR")}
          {size ? ` · ${size}` : ""}
        </p>
      </button>

      {/* Open button */}
      <button
        type="button"
        onClick={onOpen}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-zinc-500 transition active:bg-zinc-100"
        aria-label="Aç"
      >
        <OpenIcon />
      </button>

      {/* Delete button */}
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-zinc-400 transition active:bg-zinc-100 active:text-rose-600 disabled:opacity-40"
        aria-label="Sil"
      >
        <TrashIcon />
      </button>
    </li>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function PDFIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="9" y1="13" x2="9" y2="17" />
      <line x1="12" y1="11" x2="12" y2="17" />
      <line x1="15" y1="15" x2="15" y2="17" />
    </svg>
  );
}

function OpenIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}
