import { useEffect, useRef, useState } from "react";
import EditableTitle from "./EditableTitle";
import LocalPhotoLightbox from "./LocalPhotoLightbox";
import PanelAssetTile from "./PanelAssetTile";
import PDFViewer, { type PDFDoc } from "./PDFViewer";
import { useConfirm } from "./ConfirmDialog";
import {
  addPanelImage,
  deletePanelImage,
  isAcceptablePanelAssetFile,
  isPanelAssetPdf,
  updatePanelImageTitle,
  type PanelLabelImage,
  type PanelLabelImageCategory,
} from "../lib/panelLabelCatalog";
import { getPublicUrl } from "../lib/storage";
import { downloadPanelImagesZip } from "../lib/panelLabelDownload";

type Props = {
  panelId: string;
  regionName: string;
  panelName: string;
  category: PanelLabelImageCategory;
  heading: string;
  hint: string;
  images: PanelLabelImage[];
  onChange: () => void;
};

export default function PanelLabelImageSection({
  panelId,
  regionName,
  panelName,
  category,
  heading,
  hint,
  images,
  onChange,
}: Props) {
  const confirm = useConfirm();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const [uploadProgress, setUploadProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const uploading = uploadProgress !== null;
  const [downloadProgress, setDownloadProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const downloadingZip = downloadProgress !== null;
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [pdfViewer, setPdfViewer] = useState<PanelLabelImage | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const dragDepthRef = useRef(0);

  const imageItems = images.filter((img) => !isPanelAssetPdf(img.mimeType));
  const dropDisabled = uploading || downloadingZip;

  function filterAcceptableFiles(files: File[]): File[] {
    return files.filter(isAcceptablePanelAssetFile);
  }

  async function uploadFiles(picked: File[]) {
    setUploadProgress({ done: 0, total: picked.length });
    setError(null);
    try {
      let done = 0;
      for (const file of picked) {
        await addPanelImage(panelId, category, file);
        done += 1;
        setUploadProgress({ done, total: picked.length });
      }
      onChange();
      if (done === picked.length) {
        await new Promise((r) => setTimeout(r, 400));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yükleme başarısız.");
    } finally {
      setUploadProgress(null);
      if (cameraRef.current) cameraRef.current.value = "";
      if (galleryRef.current) galleryRef.current.value = "";
      if (pdfRef.current) pdfRef.current.value = "";
    }
  }

  async function handleDroppedFiles(files: File[]) {
    if (dropDisabled) return;
    const picked = filterAcceptableFiles(files);
    if (picked.length === 0) {
      setError("Lütfen görsel veya PDF dosyası sürükleyin.");
      return;
    }

    const label = picked.length === 1 ? "1 dosya" : `${picked.length} dosya`;
    const ok = await confirm({
      title: "Dosyaları yükle",
      message: `${label} yükleyeceksiniz, emin misiniz?`,
      confirmText: "Yükle",
    });
    if (!ok) return;

    await uploadFiles(picked);
  }

  function onDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (dropDisabled) return;
    dragDepthRef.current += 1;
    setDragActive(true);
  }

  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current -= 1;
    if (dragDepthRef.current <= 0) {
      dragDepthRef.current = 0;
      setDragActive(false);
    }
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!dropDisabled) e.dataTransfer.dropEffect = "copy";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = 0;
    setDragActive(false);
    if (dropDisabled) return;
    void handleDroppedFiles(Array.from(e.dataTransfer.files));
  }

  useEffect(() => {
    if (!uploading && !downloadingZip) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [uploading, downloadingZip]);

  async function handleDownloadZip() {
    if (downloadingZip || uploading || images.length === 0) return;
    setError(null);
    setDownloadProgress({ done: 0, total: images.length });
    try {
      await downloadPanelImagesZip({
        regionName,
        panelName,
        category,
        images,
        onProgress: (done, total) => setDownloadProgress({ done, total }),
      });
      await new Promise((r) => setTimeout(r, 300));
    } catch (e) {
      setError(e instanceof Error ? e.message : "İndirme başarısız.");
    } finally {
      setDownloadProgress(null);
    }
  }

  async function handleDeleteImage(image: PanelLabelImage) {
    const label =
      image.title?.trim() ||
      (isPanelAssetPdf(image.mimeType) ? "PDF dosyası" : "Görsel");
    const ok = await confirm({
      title: "Dosyayı sil",
      message: `"${label}" silinsin mi?`,
      confirmText: "Sil",
      destructive: true,
    });
    if (!ok) return;

    setDeleting(true);
    setError(null);
    try {
      await deletePanelImage(image.id);

      if (pdfViewer?.id === image.id) setPdfViewer(null);

      if (lightboxIndex !== null) {
        const idx = imageItems.findIndex((item) => item.id === image.id);
        if (idx >= 0) {
          const remaining = imageItems.length - 1;
          if (remaining <= 0) setLightboxIndex(null);
          else if (idx === lightboxIndex) {
            setLightboxIndex(Math.min(lightboxIndex, remaining - 1));
          } else if (idx < lightboxIndex) {
            setLightboxIndex(lightboxIndex - 1);
          }
        }
      }

      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Silme başarısız.");
    } finally {
      setDeleting(false);
    }
  }

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const picked = filterAcceptableFiles(Array.from(files));
    if (picked.length === 0) {
      setError("Lütfen görsel veya PDF dosyası seçin.");
      return;
    }
    await uploadFiles(picked);
  };

  const openAsset = (image: PanelLabelImage) => {
    if (isPanelAssetPdf(image.mimeType)) {
      setPdfViewer(image);
      return;
    }
    const imageIndex = imageItems.findIndex((item) => item.id === image.id);
    if (imageIndex >= 0) setLightboxIndex(imageIndex);
  };

  const lightboxPhotos = imageItems.map((img) => ({
    url: getPublicUrl(img.storagePath) ?? "",
    label: img.title,
    onSaveLabel: async (next: string) => {
      await updatePanelImageTitle(img.id, next);
      onChange();
    },
  }));

  const pdfDoc: PDFDoc | null = pdfViewer
    ? {
        id: pdfViewer.id,
        storage_path: pdfViewer.storagePath,
        title: pdfViewer.title || null,
        file_size: null,
        created_at: pdfViewer.createdAt,
      }
    : null;

  return (
    <section className="rounded-2xl border-2 border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-zinc-900">{heading}</h2>
          <p className="mt-1 text-sm text-zinc-500">{hint}</p>
        </div>
        {images.length > 0 && (
          <DownloadZipButton
            category={category}
            disabled={uploading || downloadingZip}
            busy={downloadingZip}
            onClick={() => void handleDownloadZip()}
          />
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={uploading || downloadingZip}
          onClick={() => cameraRef.current?.click()}
          className="rounded-xl border-2 border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm font-semibold text-zinc-800 disabled:opacity-50"
        >
          Kamera
        </button>
        <button
          type="button"
          disabled={uploading || downloadingZip}
          onClick={() => galleryRef.current?.click()}
          className="rounded-xl border-2 border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm font-semibold text-zinc-800 disabled:opacity-50"
        >
          Galeriden ekle
        </button>
        <button
          type="button"
          disabled={uploading || downloadingZip}
          onClick={() => pdfRef.current?.click()}
          className="rounded-xl border-2 border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm font-semibold text-zinc-800 disabled:opacity-50"
        >
          PDF ekle
        </button>
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
        />
        <input
          ref={pdfRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
        />
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div
        className={`mt-4 rounded-xl border-2 border-dashed transition ${
          dragActive
            ? "border-zinc-900 bg-zinc-100"
            : "border-zinc-200 bg-transparent"
        } ${dropDisabled ? "pointer-events-none opacity-60" : ""}`}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        {images.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-zinc-500">
            {dragActive
              ? "Dosyaları bırakın…"
              : "Henüz dosya yok — görsel veya PDF sürükleyip bırakın"}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3">
            {images.map((image) => (
              <div key={image.id} className="min-w-0">
                <PanelAssetTile
                  path={image.storagePath}
                  mimeType={image.mimeType}
                  title={image.title || undefined}
                  onOpen={() => openAsset(image)}
                  onDelete={() => void handleDeleteImage(image)}
                />
                <EditableTitle
                  value={image.title}
                  onSave={async (next) => {
                    await updatePanelImageTitle(image.id, next);
                    onChange();
                  }}
                  ariaLabel="Dosya adını düzenle"
                  placeholder="Dosya adı"
                  allowEmpty
                  className="mt-1 block w-full break-words rounded-md px-1 py-0.5 text-left text-xs font-medium leading-relaxed text-zinc-600 active:bg-zinc-100"
                  inputClassName="w-full rounded-lg border border-zinc-300 px-2 py-1 text-xs outline-none focus:border-zinc-500"
                  emptyClassName="italic text-zinc-400"
                />
              </div>
            ))}
          </div>
        )}
        {dragActive && images.length > 0 && (
          <p className="border-t border-dashed border-zinc-300 px-4 py-3 text-center text-sm font-medium text-zinc-700">
            Dosyaları bırakın…
          </p>
        )}
      </div>

      {lightboxIndex !== null && lightboxPhotos[lightboxIndex]?.url && (
        <LocalPhotoLightbox
          photos={lightboxPhotos}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
          onDelete={() => {
            const image = imageItems[lightboxIndex];
            if (image) return handleDeleteImage(image);
          }}
        />
      )}

      {pdfDoc && (
        <PDFViewer
          doc={pdfDoc}
          onClose={() => setPdfViewer(null)}
          onDelete={
            pdfViewer
              ? () => handleDeleteImage(pdfViewer)
              : undefined
          }
        />
      )}

      {uploadProgress && (
        <UploadProgressModal progress={uploadProgress} />
      )}

      {downloadProgress && (
        <DownloadProgressModal progress={downloadProgress} />
      )}

      {deleting && (
        <div
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/50"
          role="status"
          aria-live="polite"
          aria-label="Siliniyor"
        >
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-white/30 border-t-white" />
          <p className="mt-3 text-sm font-medium text-white">Siliniyor…</p>
        </div>
      )}
    </section>
  );
}

function DownloadZipButton({
  category,
  disabled,
  busy,
  onClick,
}: {
  category: PanelLabelImageCategory;
  disabled?: boolean;
  busy?: boolean;
  onClick: () => void;
}) {
  const isTekHat = category === "tek_hat";
  const label = isTekHat ? "Tek Hat ZIP" : "Pano İçi ZIP";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex shrink-0 items-center gap-2 rounded-xl border-2 px-3 py-2 text-sm font-semibold transition disabled:opacity-50 ${
        isTekHat
          ? "border-blue-200 bg-blue-50 text-blue-900 active:bg-blue-100"
          : "border-emerald-200 bg-emerald-50 text-emerald-900 active:bg-emerald-100"
      }`}
      aria-label={`${label} indir`}
      title={`${label} indir`}
    >
      {busy ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />
      ) : (
        <DownloadIcon />
      )}
      <span>{busy ? "Hazırlanıyor…" : label}</span>
    </button>
  );
}

function DownloadIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function DownloadProgressModal({
  progress,
}: {
  progress: { done: number; total: number };
}) {
  const pct =
    progress.total > 0
      ? Math.round((progress.done / progress.total) * 100)
      : 0;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="download-progress-title"
      aria-live="polite"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-[3px] border-zinc-200 border-t-zinc-900" />
        <p
          id="download-progress-title"
          className="mt-4 text-base font-semibold text-zinc-900"
        >
          ZIP hazırlanıyor…
        </p>
        <p className="mt-1 text-3xl font-bold tabular-nums text-zinc-900">
          {progress.done}/{progress.total}
        </p>
        <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-zinc-100">
          <div
            className="h-full rounded-full bg-zinc-900 transition-all duration-200"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-1 text-xs tabular-nums text-zinc-400">{pct}%</p>
      </div>
    </div>
  );
}

function UploadProgressModal({
  progress,
}: {
  progress: { done: number; total: number };
}) {
  const pct =
    progress.total > 0
      ? Math.round((progress.done / progress.total) * 100)
      : 0;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-progress-title"
      aria-live="polite"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-[3px] border-zinc-200 border-t-zinc-900" />
        <p
          id="upload-progress-title"
          className="mt-4 text-base font-semibold text-zinc-900"
        >
          Yükleniyor…
        </p>
        <p className="mt-1 text-3xl font-bold tabular-nums text-zinc-900">
          {progress.done}/{progress.total}
        </p>
        <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-zinc-100">
          <div
            className="h-full rounded-full bg-zinc-900 transition-all duration-200"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-1 text-xs tabular-nums text-zinc-400">{pct}%</p>
        <p className="mt-4 text-sm leading-relaxed text-zinc-500">
          Lütfen bekleyin. Yükleme bitene kadar uygulamadan çıkmayın.
        </p>
      </div>
    </div>
  );
}
