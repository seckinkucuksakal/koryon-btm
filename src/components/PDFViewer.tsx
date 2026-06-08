import { useEffect, useState } from "react";
import { getPublicUrl } from "../lib/storage";

export type PDFDoc = {
  id: string;
  storage_path: string;
  title: string | null;
  file_size: number | null;
  created_at: string;
};

type Props = {
  doc: PDFDoc;
  onClose: () => void;
};

export default function PDFViewer({ doc, onClose }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setUrl(getPublicUrl(doc.storage_path));
    setIsMobile(/iPhone|iPad|Android/i.test(navigator.userAgent));
  }, [doc.storage_path]);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function download() {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = (doc.title ?? "belge") + ".pdf";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.click();
  }

  const title = doc.title ?? "Belge";
  const size = doc.file_size ? formatBytes(doc.file_size) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-zinc-950"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* ── Header ── */}
      <div className="flex shrink-0 items-center gap-3 border-b border-zinc-800 px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-zinc-300 transition active:bg-zinc-800"
          aria-label="Kapat"
        >
          <CloseIcon />
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{title}</p>
          {size && <p className="text-xs text-zinc-400">{size}</p>}
        </div>

        <button
          type="button"
          onClick={download}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition active:bg-blue-700"
          aria-label="PDF'i indir"
        >
          <DownloadIcon />
          <span className="hidden sm:inline">İndir</span>
        </button>
      </div>

      {/* ── Content ── */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {!url ? (
          <div className="flex h-full items-center justify-center text-zinc-400 text-sm">
            Yükleniyor…
          </div>
        ) : isMobile ? (
          /* Mobile: iframe doesn't render PDFs well → show download prompt */
          <MobilePrompt title={title} onDownload={download} />
        ) : (
          <iframe
            src={`${url}#toolbar=1&navpanes=0`}
            title={title}
            className="h-full w-full border-0"
            loading="lazy"
          />
        )}
      </div>
    </div>
  );
}

function MobilePrompt({ title, onDownload }: { title: string; onDownload: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-zinc-800">
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      </div>
      <div>
        <p className="text-base font-semibold text-white">{title}</p>
        <p className="mt-1 text-sm text-zinc-400">
          Mobil cihazda PDF'i tarayıcıda açmak için indirin.
        </p>
      </div>
      <button
        type="button"
        onClick={onDownload}
        className="flex items-center gap-2 rounded-2xl bg-blue-600 px-8 py-4 text-base font-semibold text-white active:bg-blue-700"
      >
        <DownloadIcon />
        PDF'i İndir / Aç
      </button>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}
