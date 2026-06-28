import { useCallback, useEffect, useRef, useState } from "react";
import PageHeader from "../components/PageHeader";
import LocalPhotoLightbox from "../components/LocalPhotoLightbox";
import { analyzePanelImages, warmPreparePanelImages } from "../lib/analyzeBreakerImage";
import type { PreparedVisionImage } from "../lib/prepareImageForVision";

type PhotoItem = {
  id: string;
  file: File;
  previewUrl: string;
  prepared?: PreparedVisionImage;
};

function newId() {
  return crypto.randomUUID();
}

export default function PanelLabelCheckPage() {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeStage, setAnalyzeStage] = useState<"prepare" | "analyze" | null>(
    null,
  );
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [dragFromIndex, setDragFromIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  useEffect(() => {
    return () => {
      for (const p of photos) URL.revokeObjectURL(p.previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addFiles = useCallback((files: FileList | null) => {
    if (!files?.length) return;

    const picked = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (picked.length === 0) return;

    const next: PhotoItem[] = picked.map((file) => ({
      id: newId(),
      file,
      previewUrl: URL.createObjectURL(file),
    }));

    setPhotos((prev) => [...prev, ...next]);
    setResult(null);
    setError(null);

    warmPreparePanelImages(next, (id, prepared) => {
      setPhotos((prev) =>
        prev.map((p) => (p.id === id ? { ...p, prepared } : p)),
      );
    });
  }, []);

  const removePhoto = (id: string) => {
    setPhotos((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      const item = prev.find((p) => p.id === id);
      if (item) URL.revokeObjectURL(item.previewUrl);
      if (lightboxIndex !== null) {
        if (prev.length <= 1) setLightboxIndex(null);
        else if (idx <= lightboxIndex) {
          setLightboxIndex(Math.max(0, lightboxIndex - 1));
        }
      }
      return prev.filter((p) => p.id !== id);
    });
    setResult(null);
    setError(null);
  };

  const reorderPhotos = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    setPhotos((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
    setLightboxIndex((prev) => {
      if (prev === null) return null;
      if (prev === fromIndex) return toIndex;
      if (fromIndex < prev && toIndex >= prev) return prev - 1;
      if (fromIndex > prev && toIndex <= prev) return prev + 1;
      return prev;
    });
    setResult(null);
    setError(null);
  };

  const analyzePanel = async () => {
    if (photos.length === 0 || analyzing) return;
    setAnalyzing(true);
    setAnalyzeStage(null);
    setError(null);
    setResult(null);

    const snapshot = [...photos];

    try {
      const { text } = await analyzePanelImages(
        snapshot.map((p, i) => ({
          order: i + 1,
          file: p.file,
          prepared: p.prepared,
        })),
        setAnalyzeStage,
      );
      setResult(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analiz başarısız");
    } finally {
      setAnalyzing(false);
      setAnalyzeStage(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Pano ve Etiket Kontrol"
        subtitle="Pano fotoğraflarını yükle, ekipman listesi çıkar"
        back
      />
      <div className="mx-auto max-w-2xl space-y-5 px-4 py-5">
        <div className="rounded-2xl border-2 border-zinc-200 bg-white p-4">
          <p className="text-sm text-zinc-600">
            Panonun farklı bölümlerinden istediğiniz kadar fotoğraf ekleyin. Tüm
            fotoğraflar <strong>tek pano</strong> olarak birleştirilip yalnızca{" "}
            <strong>koruma devre elemanları</strong> (şalter, RCD, ana şalter)
            sırayla listelenir — devre etiketleri okunmaz.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={analyzing}
            onClick={() => cameraRef.current?.click()}
            className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-zinc-900 px-4 py-5 text-white shadow-sm transition active:scale-[0.99] disabled:opacity-60"
          >
            <CameraIcon />
            <span className="text-sm font-semibold">Kamera</span>
          </button>
          <button
            type="button"
            disabled={analyzing}
            onClick={() => galleryRef.current?.click()}
            className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-zinc-200 bg-white px-4 py-5 text-zinc-900 shadow-sm transition active:scale-[0.99] disabled:opacity-60"
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
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />

        {photos.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50 px-4 py-10 text-center">
            <p className="text-sm text-zinc-500">
              Henüz fotoğraf eklenmedi. Kamera veya galeriden başlayın.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Yüklenen fotoğraflar ({photos.length}) — sıralamak için sürükleyin
              (1 = analiz başlangıcı), büyütmek için fotoğrafa dokunun
            </p>
            <ul className="grid gap-3 sm:grid-cols-3">
              {photos.map((photo, index) => (
                <SortablePhotoTile
                  key={photo.id}
                  photo={photo}
                  index={index}
                  total={photos.length}
                  disabled={analyzing}
                  isDragging={dragFromIndex === index}
                  isOver={dragOverIndex === index && dragFromIndex !== index}
                  onOpen={() => setLightboxIndex(index)}
                  onRemove={() => removePhoto(photo.id)}
                  onReorder={reorderPhotos}
                  onDragStart={() => setDragFromIndex(index)}
                  onDragOverIndex={setDragOverIndex}
                  onDragEnd={() => {
                    setDragFromIndex(null);
                    setDragOverIndex(null);
                  }}
                />
              ))}
            </ul>
          </div>
        )}

        {photos.length > 0 && (
          <button
            type="button"
            disabled={analyzing}
            onClick={analyzePanel}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-zinc-900 py-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60 transition"
          >
            {analyzing ? (
              <>
                <Spinner />
                {analyzeStage === "prepare"
                  ? "Fotoğraflar hazırlanıyor…"
                  : "Pano analiz ediliyor…"}
              </>
            ) : result ? (
              "Yeniden analiz et"
            ) : (
              `Panoyu analiz et (${photos.length} fotoğraf)`
            )}
          </button>
        )}

        {error && (
          <div className="rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {result && (
          <div className="rounded-2xl border-2 border-zinc-200 bg-white overflow-hidden">
            <div className="border-b border-zinc-100 bg-zinc-50 px-4 py-2.5">
              <p className="text-sm font-semibold text-zinc-800">Koruma Elemanları</p>
            </div>
            <div className="px-4 py-4">
              <AnalysisText text={result} />
            </div>
          </div>
        )}

        <p className="pb-4 text-center text-xs text-zinc-400">
          Örnek: 1. MCB — 10A B
        </p>
      </div>

      {lightboxIndex !== null && photos.length > 0 && (
        <LocalPhotoLightbox
          photos={photos.map((p, i) => ({
            url: p.previewUrl,
            filename: p.file.name,
            label: `Fotoğraf ${i + 1}`,
          }))}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
        />
      )}
    </>
  );
}

function SortablePhotoTile({
  photo,
  index,
  total,
  disabled,
  isDragging,
  isOver,
  onOpen,
  onRemove,
  onReorder,
  onDragStart,
  onDragOverIndex,
  onDragEnd,
}: {
  photo: PhotoItem;
  index: number;
  total: number;
  disabled: boolean;
  isDragging: boolean;
  isOver: boolean;
  onOpen: () => void;
  onRemove: () => void;
  onReorder: (from: number, to: number) => void;
  onDragStart: () => void;
  onDragOverIndex: (index: number | null) => void;
  onDragEnd: () => void;
}) {
  const draggingRef = useRef(false);
  const dragIndexRef = useRef(index);

  useEffect(() => {
    dragIndexRef.current = index;
  }, [index]);

  function findDropIndex(clientX: number, clientY: number): number | null {
    const el = document.elementFromPoint(clientX, clientY);
    const li = el?.closest("[data-photo-index]");
    if (!li) return null;
    const raw = li.getAttribute("data-photo-index");
    if (raw === null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }

  function finishDrag(clientX: number, clientY: number) {
    const toIndex = findDropIndex(clientX, clientY);
    if (toIndex !== null) onReorder(dragIndexRef.current, toIndex);
    draggingRef.current = false;
    onDragEnd();
  }

  return (
    <li
      data-photo-index={index}
      data-photo-id={photo.id}
      className={`relative overflow-hidden rounded-2xl border-2 bg-white transition ${
        isDragging ? "scale-[0.98] opacity-60" : ""
      } ${isOver ? "border-zinc-900 ring-2 ring-zinc-900/20" : "border-zinc-200"}`}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOverIndex(index);
      }}
      onDragLeave={() => onDragOverIndex(null)}
      onDrop={(e) => {
        e.preventDefault();
        const from = Number(e.dataTransfer.getData("text/plain"));
        if (Number.isFinite(from)) onReorder(from, index);
        onDragEnd();
      }}
    >
      <div className="absolute left-2 top-2 z-10 rounded-full bg-zinc-900/80 px-2 py-0.5 text-[10px] font-bold text-white">
        {index + 1}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="absolute right-2 top-2 z-10 rounded-lg bg-white/90 p-1.5 text-zinc-400 shadow hover:text-red-500 disabled:opacity-40"
        aria-label="Fotoğrafı kaldır"
      >
        <TrashIcon />
      </button>
      <button
        type="button"
        onClick={onOpen}
        className="block w-full text-left active:opacity-90"
        aria-label={`Fotoğraf ${index + 1} büyüt`}
      >
        <img
          src={photo.previewUrl}
          alt={`Pano fotoğrafı ${index + 1}`}
          className="aspect-square w-full cursor-zoom-in object-cover bg-zinc-50"
          draggable={false}
        />
      </button>
      {total > 1 && (
        <div
          draggable={!disabled}
          onDragStart={(e) => {
            e.dataTransfer.setData("text/plain", String(index));
            e.dataTransfer.effectAllowed = "move";
            onDragStart();
          }}
          onDragEnd={onDragEnd}
          onPointerDown={(e) => {
            if (disabled) return;
            e.preventDefault();
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            draggingRef.current = true;
            onDragStart();
          }}
          onPointerMove={(e) => {
            if (!draggingRef.current || !e.currentTarget.hasPointerCapture(e.pointerId)) {
              return;
            }
            onDragOverIndex(findDropIndex(e.clientX, e.clientY));
          }}
          onPointerUp={(e) => {
            if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
            e.currentTarget.releasePointerCapture(e.pointerId);
            finishDrag(e.clientX, e.clientY);
          }}
          onPointerCancel={(e) => {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) {
              e.currentTarget.releasePointerCapture(e.pointerId);
            }
            draggingRef.current = false;
            onDragEnd();
          }}
          className="flex cursor-grab items-center justify-center gap-1 border-t border-zinc-100 bg-zinc-50 py-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 active:cursor-grabbing touch-none select-none"
          aria-label={`Fotoğraf ${index + 1} sırasını değiştir`}
        >
          <GripIcon />
          Sürükle
        </div>
      )}
    </li>
  );
}

function GripIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="9" cy="6" r="1.5" />
      <circle cx="15" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" />
      <circle cx="15" cy="18" r="1.5" />
    </svg>
  );
}

function AnalysisText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1 text-sm leading-relaxed text-zinc-800">
      {lines.map((line, i) => {
        if (line.startsWith("## ")) {
          return (
            <h3
              key={i}
              className="pt-3 text-xs font-bold uppercase tracking-wide text-zinc-500 first:pt-0"
            >
              {line.slice(3)}
            </h3>
          );
        }
        if (/^\d+\.\s/.test(line)) {
          return (
            <p key={i} className="rounded-lg bg-zinc-50 px-3 py-2 font-medium text-zinc-800">
              {line}
            </p>
          );
        }
        if (line.startsWith("- ")) {
          return (
            <p key={i} className="pl-1 text-zinc-700">
              • {line.slice(2)}
            </p>
          );
        }
        if (!line.trim()) return <div key={i} className="h-1" />;
        return (
          <p key={i} className="text-zinc-700">
            {line}
          </p>
        );
      })}
    </div>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function GalleryIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
