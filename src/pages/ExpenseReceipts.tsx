import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import { BigButton } from "../components/BigButton";
import { useConfirm } from "../components/ConfirmDialog";
import {
  createFolder,
  deleteFolder,
  formatAmount,
  listFolders,
  listReceipts,
  migrateLocalExpenseDataIfNeeded,
  sumAmounts,
  type ExpenseFolder,
} from "../lib/expenseReceipts";

type FolderSummary = ExpenseFolder & {
  receiptCount: number;
  total: number;
};

export default function ExpenseReceiptsPage() {
  const confirm = useConfirm();
  const [folders, setFolders] = useState<FolderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    try {
      const list = await listFolders();
      const enriched = await Promise.all(
        list.map(async (folder) => {
          const receipts = await listReceipts(folder.id);
          return {
            ...folder,
            receiptCount: receipts.length,
            total: sumAmounts(receipts),
          };
        }),
      );
      setFolders(enriched);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void (async () => {
      try {
        await migrateLocalExpenseDataIfNeeded();
      } catch {
        /* yerel taşıma başarısız olsa da listeyi yükle */
      }
      await reload();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async () => {
    const title = newTitle.trim();
    if (!title) {
      setError("Klasör adı girin (ör. Batman, Kırıkkale).");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      await createFolder(title);
      setNewTitle("");
      setShowCreate(false);
      await reload();
    } catch {
      setError("Klasör oluşturulamadı.");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (folder: FolderSummary) => {
    const ok = await confirm({
      title: "Klasörü sil",
      message: `"${folder.title}" klasörü ve içindeki ${folder.receiptCount} fiş silinecek. Emin misiniz?`,
      confirmText: "Sil",
      destructive: true,
    });
    if (!ok) return;
    await deleteFolder(folder.id);
    await reload();
  };

  return (
    <>
      <PageHeader
        title="Harcırah Fişleri"
        subtitle="Saha seyahatlerine göre fiş klasörleri"
        back
      />
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        <BigButton
          variant="primary"
          icon={<FolderPlusIcon />}
          label="Yeni Harcırah Klasörü"
          hint="Örn. Batman, Kırıkkale — seyahat başına bir klasör"
          onClick={() => {
            setShowCreate((v) => !v);
            setError(null);
          }}
        />

        {showCreate && (
          <div className="rounded-2xl border-2 border-zinc-200 bg-white p-4">
            <label className="block text-sm font-medium text-zinc-700">
              Klasör adı
            </label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Batman"
              className="mt-2 w-full rounded-xl border border-zinc-300 px-4 py-3 text-base outline-none focus:border-zinc-500"
              autoFocus
            />
            {error && (
              <p className="mt-2 text-sm text-red-600">{error}</p>
            )}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => void handleCreate()}
                disabled={creating}
                className="flex-1 rounded-xl bg-zinc-900 px-4 py-3 font-semibold text-white disabled:opacity-50"
              >
                {creating ? "Oluşturuluyor…" : "Oluştur"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreate(false);
                  setNewTitle("");
                  setError(null);
                }}
                className="rounded-xl border-2 border-zinc-200 px-4 py-3 font-semibold text-zinc-700"
              >
                İptal
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-center text-sm text-zinc-500">Yükleniyor…</p>
        ) : folders.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50 px-6 py-10 text-center">
            <p className="font-medium text-zinc-700">Henüz klasör yok</p>
            <p className="mt-1 text-sm text-zinc-500">
              Seyahat başına bir klasör açıp fiş fotoğraflarını ekleyin.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {folders.map((folder) => (
              <div
                key={folder.id}
                className="flex items-stretch gap-2 rounded-2xl border-2 border-zinc-200 bg-white"
              >
                <Link
                  to={`/expense-receipts/${folder.id}`}
                  className="flex min-w-0 flex-1 items-center gap-4 px-5 py-5 active:bg-zinc-50"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600">
                    <FolderIcon />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-semibold text-zinc-900">
                      {folder.title}
                    </span>
                    <span className="mt-0.5 block text-sm text-zinc-500">
                      {folder.receiptCount} fiş
                      {folder.receiptCount > 0
                        ? ` · Toplam ${formatAmount(folder.total)}`
                        : " · Henüz fiş yok"}
                    </span>
                  </span>
                  <svg
                    className="shrink-0 text-zinc-400"
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </Link>
                <button
                  type="button"
                  onClick={() => void handleDelete(folder)}
                  aria-label="Klasörü sil"
                  className="flex w-14 shrink-0 items-center justify-center border-l border-zinc-200 text-zinc-400 active:bg-red-50 active:text-red-600"
                >
                  <TrashIcon />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function FolderPlusIcon() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      <line x1="12" y1="11" x2="12" y2="17" />
      <line x1="9" y1="14" x2="15" y2="14" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
