import { useRef, useState } from "react";
import EditableTitle from "./EditableTitle";
import LocalPhotoLightbox from "./LocalPhotoLightbox";
import PanelAssetTile from "./PanelAssetTile";
import PDFViewer, { type PDFDoc } from "./PDFViewer";
import {
  addPanelImage,
  isAcceptablePanelAssetFile,
  isPanelAssetPdf,
  updatePanelImageTitle,
  type PanelLabelImage,
  type PanelLabelImageCategory,
} from "../lib/panelLabelCatalog";
import { getPublicUrl } from "../lib/storage";

type Props = {
  panelId: string;
  category: PanelLabelImageCategory;
  heading: string;
  hint: string;
  images: PanelLabelImage[];
  onChange: () => void;
};

export default function PanelLabelImageSection({
  panelId,
  category,
  heading,
  hint,
  images,
  onChange,
}: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [pdfViewer, setPdfViewer] = useState<PanelLabelImage | null>(null);

  const imageItems = images.filter((img) => !isPanelAssetPdf(img.mimeType));

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const picked = Array.from(files).filter(isAcceptablePanelAssetFile);
    if (picked.length === 0) {
      setError("Lütfen görsel veya PDF dosyası seçin.");
      return;
    }

    setUploading(true);
    setError(null);
    try {
      for (const file of picked) {
        await addPanelImage(panelId, category, file);
      }
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yükleme başarısız.");
    } finally {
      setUploading(false);
      if (cameraRef.current) cameraRef.current.value = "";
      if (galleryRef.current) galleryRef.current.value = "";
      if (pdfRef.current) pdfRef.current.value = "";
    }
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
      <h2 className="text-base font-semibold text-zinc-900">{heading}</h2>
      <p className="mt-1 text-sm text-zinc-500">{hint}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={uploading}
          onClick={() => cameraRef.current?.click()}
          className="rounded-xl border-2 border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm font-semibold text-zinc-800 disabled:opacity-50"
        >
          Kamera
        </button>
        <button
          type="button"
          disabled={uploading}
          onClick={() => galleryRef.current?.click()}
          className="rounded-xl border-2 border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm font-semibold text-zinc-800 disabled:opacity-50"
        >
          Galeriden ekle
        </button>
        <button
          type="button"
          disabled={uploading}
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
        {uploading && (
          <span className="self-center text-sm text-zinc-500">Yükleniyor…</span>
        )}
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {images.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-500">
          Henüz dosya yok
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((image) => (
            <div key={image.id} className="min-w-0">
              <PanelAssetTile
                path={image.storagePath}
                mimeType={image.mimeType}
                title={image.title || undefined}
                onOpen={() => openAsset(image)}
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

      {lightboxIndex !== null && lightboxPhotos[lightboxIndex]?.url && (
        <LocalPhotoLightbox
          photos={lightboxPhotos}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
        />
      )}

      {pdfDoc && (
        <PDFViewer doc={pdfDoc} onClose={() => setPdfViewer(null)} />
      )}
    </section>
  );
}
