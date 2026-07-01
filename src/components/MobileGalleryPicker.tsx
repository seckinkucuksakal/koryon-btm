import { useEffect, useRef, useState } from "react";
import { isAcceptablePanelAssetFile } from "../lib/panelLabelCatalog";

type PendingItem = {
  id: string;
  file: File;
  preview: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (files: File[]) => void;
};

function fileKey(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

export default function MobileGalleryPicker({ open, onClose, onConfirm }: Props) {
  const singleRef = useRef<HTMLInputElement>(null);
  const multiRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<PendingItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setItems([]);
    setError(null);
  }, [open]);

  useEffect(() => {
    if (open) return;
    setItems((prev) => {
      for (const item of prev) URL.revokeObjectURL(item.preview);
      return [];
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  function appendFiles(files: FileList | null) {
    if (!files?.length) return;
    const accepted = Array.from(files).filter(isAcceptablePanelAssetFile);
    if (accepted.length === 0) {
      setError("Lütfen görsel dosyası seçin.");
      return;
    }
    setError(null);

    setItems((prev) => {
      const existing = new Set(prev.map((p) => fileKey(p.file)));
      const next = [...prev];
      for (const file of accepted) {
        const key = fileKey(file);
        if (existing.has(key)) continue;
        existing.add(key);
        next.push({
          id: crypto.randomUUID(),
          file,
          preview: URL.createObjectURL(file),
        });
      }
      return next;
    });

    if (singleRef.current) singleRef.current.value = "";
    if (multiRef.current) multiRef.current.value = "";
  }

  function removeItem(id: string) {
    setItems((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter((p) => p.id !== id);
    });
  }

  function handleConfirm() {
    if (items.length === 0) {
      setError("En az bir fotoğraf seçin.");
      return;
    }
    onConfirm(items.map((p) => p.file));
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-zinc-950/60 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mobile-gallery-title"
    >
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-start gap-3 border-b border-zinc-200 px-4 py-4">
          <div className="min-w-0 flex-1">
            <h2
              id="mobile-gallery-title"
              className="text-base font-semibold text-zinc-900"
            >
              Galeriden ekle
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-zinc-500">
              Xiaomi ve bazı Android telefonlarda toplu seçim çalışmayabilir.
              Tek tek ekleyin veya sistem galerisini deneyin.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-zinc-500 active:bg-zinc-100"
            aria-label="Kapat"
          >
            <CloseIcon />
          </button>
        </header>

        <div className="space-y-3 border-b border-zinc-200 px-4 py-4">
          <button
            type="button"
            onClick={() => singleRef.current?.click()}
            className="flex w-full items-center gap-3 rounded-xl border-2 border-zinc-900 bg-zinc-900 px-4 py-3.5 text-left text-white active:bg-zinc-800"
          >
            <PlusIcon />
            <div>
              <p className="text-sm font-semibold">Fotoğraf ekle</p>
              <p className="text-xs text-zinc-300">
                Önerilen — her seferinde bir fotoğraf, istediğiniz kadar tekrarlayın
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => multiRef.current?.click()}
            className="flex w-full items-center gap-3 rounded-xl border-2 border-zinc-200 bg-zinc-50 px-4 py-3.5 text-left active:bg-zinc-100"
          >
            <GalleryIcon />
            <div>
              <p className="text-sm font-semibold text-zinc-900">
                Sistem galerisi (toplu)
              </p>
              <p className="text-xs text-zinc-500">
                iPhone ve destekleyen telefonlar için — çoklu seçim
              </p>
            </div>
          </button>

          <p className="text-xs leading-relaxed text-zinc-400">
            Galeri açıldığında erişim izni istenebilir. Fotoğraflara erişim için
            <span className="font-medium text-zinc-600"> İzin ver </span>
            seçeneğine dokunun.
          </p>

          <input
            ref={singleRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => appendFiles(e.target.files)}
          />
          <input
            ref={multiRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => appendFiles(e.target.files)}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {items.length === 0 ? (
            <p className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-10 text-center text-sm text-zinc-500">
              Henüz fotoğraf seçilmedi
            </p>
          ) : (
            <>
              <p className="mb-3 text-sm font-medium text-zinc-700">
                Seçilenler ({items.length})
              </p>
              <div className="grid grid-cols-3 gap-2">
                {items.map((item) => (
                  <div key={item.id} className="relative">
                    <img
                      src={item.preview}
                      alt=""
                      className="aspect-square w-full rounded-xl object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white"
                      aria-label="Kaldır"
                    >
                      <CloseIcon small />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>

        <footer className="flex gap-2 border-t border-zinc-200 px-4 py-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border-2 border-zinc-200 px-4 py-3 text-sm font-semibold text-zinc-800 active:bg-zinc-50"
          >
            İptal
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={items.length === 0}
            className="flex-1 rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40 active:bg-zinc-800"
          >
            {items.length > 0
              ? `${items.length} fotoğrafı yükle`
              : "Yükle"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function CloseIcon({ small }: { small?: boolean }) {
  const size = small ? 14 : 20;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function GalleryIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 text-zinc-600"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  );
}
