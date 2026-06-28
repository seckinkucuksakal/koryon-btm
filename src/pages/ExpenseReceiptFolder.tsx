import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import LocalPhotoLightbox from "../components/LocalPhotoLightbox";
import { useConfirm } from "../components/ConfirmDialog";
import {
  addReceipt,
  deleteReceipt,
  downloadAllReceiptsZip,
  formatAmount,
  formatDateLabel,
  getFolder,
  getReceipt,
  listReceipts,
  receiptDownloadFilename,
  receiptImageUrl,
  sumAmounts,
  type ExpenseReceiptMeta,
} from "../lib/expenseReceipts";

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function ExpenseReceiptFolderPage() {
  const { folderId } = useParams<{ folderId: string }>();
  const confirm = useConfirm();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const [folderTitle, setFolderTitle] = useState("");
  const [receipts, setReceipts] = useState<ExpenseReceiptMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayIso);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [downloading, setDownloading] = useState(false);

  const reload = useCallback(async () => {
    if (!folderId) return;
    setLoading(true);
    try {
      const folder = await getFolder(folderId);
      if (!folder) {
        setNotFound(true);
        return;
      }
      setFolderTitle(folder.title);
      const list = await listReceipts(folderId);
      setReceipts(list);
    } finally {
      setLoading(false);
    }
  }, [folderId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    return () => {
      for (const url of pendingPreviews) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearPending = () => {
    for (const url of pendingPreviews) URL.revokeObjectURL(url);
    setPendingFiles([]);
    setPendingPreviews([]);
  };

  const pickFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const picked = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (picked.length === 0) {
      setFormError("Lütfen görsel dosyası seçin.");
      return;
    }
    setFormError(null);
    setPendingFiles((prev) => [...prev, ...picked]);
    setPendingPreviews((prev) => [
      ...prev,
      ...picked.map((f) => URL.createObjectURL(f)),
    ]);
  };

  const removePending = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
    setPendingPreviews((prev) => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  };

  const parseAmount = (raw: string): number | null => {
    const normalized = raw.trim().replace(",", ".");
    if (!normalized) return null;
    const n = Number(normalized);
    if (!Number.isFinite(n) || n < 0) return null;
    return n;
  };

  const handleSave = async () => {
    if (!folderId) return;
    const trimmedTitle = title.trim();
    const parsedAmount = parseAmount(amount);
    if (!trimmedTitle) {
      setFormError("Başlık girin (ör. Gıda, Konaklama).");
      return;
    }
    if (parsedAmount === null) {
      setFormError("Geçerli bir tutar girin.");
      return;
    }
    if (!date) {
      setFormError("Tarih seçin.");
      return;
    }
    if (pendingFiles.length === 0) {
      setFormError("En az bir fiş görseli ekleyin.");
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      for (const file of pendingFiles) {
        await addReceipt(folderId, file, trimmedTitle, parsedAmount, date);
      }
      setTitle("");
      setAmount("");
      setDate(todayIso());
      clearPending();
      await reload();
    } catch {
      setFormError("Fiş kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (receipt: ExpenseReceiptMeta) => {
    const ok = await confirm({
      title: "Fişi sil",
      message: `"${receipt.title}" (${formatAmount(receipt.amount)}) silinsin mi?`,
      confirmText: "Sil",
      destructive: true,
    });
    if (!ok) return;
    await deleteReceipt(receipt.id);
    if (lightboxIndex !== null) setLightboxIndex(null);
    await reload();
  };

  const handleDownloadAll = async () => {
    if (receipts.length === 0 || downloading) return;
    setDownloading(true);
    try {
      const full = await Promise.all(
        receipts.map(async (r) => {
          const item = await getReceipt(r.id);
          if (!item) throw new Error("Fiş bulunamadı");
          return item;
        }),
      );
      await downloadAllReceiptsZip(folderTitle, full);
    } catch {
      setFormError("İndirme başarısız.");
    } finally {
      setDownloading(false);
    }
  };

  const total = sumAmounts(receipts);

  const lightboxPhotos =
    lightboxIndex === null
      ? []
      : receipts.map((r) => ({
          url: receiptImageUrl(r) ?? "",
          filename: receiptDownloadFilename(r),
          label: `${r.title} · ${formatAmount(r.amount)} · ${formatDateLabel(r.date)}`,
        }));

  if (notFound) {
    return (
      <>
        <PageHeader title="Klasör bulunamadı" back />
        <div className="px-4 py-10 text-center">
          <Link to="/expense-receipts" className="text-zinc-600 underline">
            Harcırah klasörlerine dön
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={folderTitle || "Harcırah"}
        subtitle={`${receipts.length} fiş`}
        back
        right={
          receipts.length > 0 ? (
            <button
              type="button"
              onClick={() => void handleDownloadAll()}
              disabled={downloading}
              className="flex h-10 items-center gap-1.5 rounded-xl bg-zinc-900 px-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              <DownloadIcon />
              {downloading ? "…" : "İndir"}
            </button>
          ) : undefined
        }
      />

      <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        <div className="rounded-2xl border-2 border-zinc-200 bg-white p-4">
          <div className="text-center">
            <p className="text-sm text-zinc-500">Toplam Harcama</p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-zinc-900">
              {loading ? "–" : formatAmount(total)}
            </p>
          </div>
        </div>

        <section className="rounded-2xl border-2 border-zinc-200 bg-white p-4">
          <h2 className="text-base font-semibold text-zinc-900">Fiş Ekle</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Başlık, tutar ve tarih girin; birden fazla görsel seçebilirsiniz.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-1">
              <label className="block text-xs font-medium text-zinc-600">
                Başlık
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Gıda"
                className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-base outline-none focus:border-zinc-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600">
                Tutar (₺)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="850"
                className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-base outline-none focus:border-zinc-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600">
                Tarih
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-base outline-none focus:border-zinc-500"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              className="rounded-xl border-2 border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm font-semibold text-zinc-800 active:bg-zinc-100"
            >
              Kamera
            </button>
            <button
              type="button"
              onClick={() => galleryRef.current?.click()}
              className="rounded-xl border-2 border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm font-semibold text-zinc-800 active:bg-zinc-100"
            >
              Galeriden seç
            </button>
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                pickFiles(e.target.files);
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
                pickFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          {pendingPreviews.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {pendingPreviews.map((url, i) => (
                <div key={url} className="relative">
                  <img
                    src={url}
                    alt=""
                    className="h-20 w-20 rounded-xl border border-zinc-200 object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removePending(i)}
                    className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 text-xs text-white"
                    aria-label="Kaldır"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {formError && (
            <p className="mt-3 text-sm text-red-600">{formError}</p>
          )}

          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="mt-4 w-full rounded-xl bg-zinc-900 px-4 py-3 font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Kaydediliyor…" : "Fişleri Kaydet"}
          </button>
        </section>

        {loading ? (
          <p className="text-center text-sm text-zinc-500">Yükleniyor…</p>
        ) : receipts.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50 px-6 py-10 text-center">
            <p className="font-medium text-zinc-700">Henüz fiş yok</p>
            <p className="mt-1 text-sm text-zinc-500">
              Yukarıdan fiş fotoğrafı ekleyin.
            </p>
          </div>
        ) : (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-zinc-900">
                Kayıtlı Fişler
              </h2>
              <button
                type="button"
                onClick={() => void handleDownloadAll()}
                disabled={downloading}
                className="flex items-center gap-1.5 rounded-xl border-2 border-zinc-200 px-3 py-2 text-sm font-semibold text-zinc-800 disabled:opacity-50"
              >
                <DownloadIcon />
                Tümünü indir (ZIP)
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {receipts.map((receipt, index) => {
                const thumbUrl = receiptImageUrl(receipt, {
                  width: 480,
                  quality: 75,
                });
                return (
                <div
                  key={receipt.id}
                  className="overflow-hidden rounded-2xl border-2 border-zinc-200 bg-white"
                >
                  <button
                    type="button"
                    onClick={() => setLightboxIndex(index)}
                    className="block w-full text-left active:bg-zinc-50"
                  >
                    {thumbUrl ? (
                      <img
                        src={thumbUrl}
                        alt={receipt.title}
                        className="aspect-[4/3] w-full object-cover"
                      />
                    ) : (
                      <div className="flex aspect-[4/3] items-center justify-center bg-zinc-100 text-zinc-400">
                        …
                      </div>
                    )}
                    <div className="px-4 py-3">
                      <p className="font-semibold text-zinc-900">
                        {receipt.title}
                      </p>
                      <p className="mt-0.5 text-sm text-zinc-600">
                        {formatAmount(receipt.amount)} ·{" "}
                        {formatDateLabel(receipt.date)}
                      </p>
                      <p className="mt-1 truncate text-xs text-zinc-400">
                        {receiptDownloadFilename(receipt)}
                      </p>
                    </div>
                  </button>
                  <div className="border-t border-zinc-100 px-4 py-2">
                    <button
                      type="button"
                      onClick={() => void handleDelete(receipt)}
                      className="text-sm font-medium text-red-600"
                    >
                      Sil
                    </button>
                  </div>
                </div>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {lightboxIndex !== null && lightboxPhotos[lightboxIndex]?.url && (
        <LocalPhotoLightbox
          photos={lightboxPhotos}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
        />
      )}
    </>
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
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}
