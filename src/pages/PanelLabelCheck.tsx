import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import { BigButton } from "../components/BigButton";
import { useConfirm } from "../components/ConfirmDialog";
import {
  countPanels,
  createRegion,
  deleteRegion,
  ensureRegionsAlphabeticalSort,
  listRegions,
  reorderRegions,
  type PanelLabelRegion,
} from "../lib/panelLabelCatalog";

type RegionSummary = PanelLabelRegion & { panelCount: number };

export default function PanelLabelCheckPage() {
  const confirm = useConfirm();
  const [regions, setRegions] = useState<RegionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [dragFromIndex, setDragFromIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const reload = async () => {
    setLoading(true);
    try {
      const list = await listRegions();
      const enriched = await Promise.all(
        list.map(async (region) => ({
          ...region,
          panelCount: await countPanels(region.id),
        })),
      );
      setRegions(enriched);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void (async () => {
      try {
        await ensureRegionsAlphabeticalSort();
      } catch {
        /* alfabetik sıralama başarısız olsa da listeyi yükle */
      }
      await reload();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) {
      setError("Bölge adı girin.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      await createRegion(name);
      setNewName("");
      setShowCreate(false);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bölge oluşturulamadı.");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (region: RegionSummary) => {
    const ok = await confirm({
      title: "Bölgeyi sil",
      message: `"${region.name}" bölgesi ve içindeki ${region.panelCount} pano silinecek. Emin misiniz?`,
      confirmText: "Sil",
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteRegion(region.id);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Silinemedi.");
    }
  };

  const applyReorder = async (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || savingOrder) return;

    const previous = regions;
    const next = [...regions];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setRegions(next);
    setSavingOrder(true);
    setError(null);

    try {
      await reorderRegions(next.map((r) => r.id));
    } catch (e) {
      setRegions(previous);
      setError(e instanceof Error ? e.message : "Sıralama kaydedilemedi.");
    } finally {
      setSavingOrder(false);
    }
  };

  const totalPanels = regions.reduce((s, r) => s + r.panelCount, 0);

  return (
    <>
      <PageHeader
        title="Pano ve Etiket Kontrol"
        subtitle={
          loading
            ? "Yükleniyor…"
            : `${regions.length} bölge · ${totalPanels} pano`
        }
        back
      />
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        <BigButton
          variant="primary"
          icon={<PlusIcon />}
          label="Yeni Bölge"
          hint="Yeni bölge grubu oluştur"
          onClick={() => {
            setShowCreate((v) => !v);
            setError(null);
          }}
        />

        {showCreate && (
          <div className="rounded-2xl border-2 border-zinc-200 bg-white p-4">
            <label className="block text-sm font-medium text-zinc-700">
              Bölge adı
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="PLT-900"
              className="mt-2 w-full rounded-xl border border-zinc-300 px-4 py-3 text-base outline-none focus:border-zinc-500"
              autoFocus
            />
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
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
                  setNewName("");
                  setError(null);
                }}
                className="rounded-xl border-2 border-zinc-200 px-4 py-3 font-semibold text-zinc-700"
              >
                İptal
              </button>
            </div>
          </div>
        )}

        {error && !showCreate && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-center text-sm text-zinc-500">Yükleniyor…</p>
        ) : regions.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50 px-6 py-10 text-center">
            <p className="font-medium text-zinc-700">Henüz bölge yok</p>
            <p className="mt-1 text-sm text-zinc-500">
              Yeni bölge ekleyerek başlayın.
            </p>
          </div>
        ) : (
          <>
            <p className="rounded-xl bg-zinc-50 px-4 py-2 text-xs text-zinc-600">
              Bölgeler harf sırasına göre listelenir. Tutup sürükleyerek istediğin
              sıraya alabilirsin.
              {savingOrder ? " Kaydediliyor…" : ""}
            </p>
            <div className="space-y-3">
              {regions.map((region, index) => (
                <div
                  key={region.id}
                  draggable={!savingOrder}
                  onDragStart={() => setDragFromIndex(index)}
                  onDragEnd={() => {
                    setDragFromIndex(null);
                    setDragOverIndex(null);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragFromIndex === null || dragFromIndex === index) return;
                    setDragOverIndex(index);
                  }}
                  onDragLeave={() => {
                    if (dragOverIndex === index) setDragOverIndex(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragFromIndex === null) return;
                    void applyReorder(dragFromIndex, index);
                    setDragFromIndex(null);
                    setDragOverIndex(null);
                  }}
                  className={`flex items-stretch gap-0 rounded-2xl border-2 bg-white transition ${
                    dragFromIndex === index ? "opacity-50" : ""
                  } ${
                    dragOverIndex === index
                      ? "border-zinc-900"
                      : "border-zinc-200"
                  }`}
                >
                  <button
                    type="button"
                    aria-label="Sürükleyerek sırala"
                    className="flex w-11 shrink-0 cursor-grab items-center justify-center border-r border-zinc-200 text-zinc-400 active:cursor-grabbing active:bg-zinc-50"
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <GripIcon />
                  </button>
                  <Link
                    to={`/panel-label-check/${region.id}`}
                    className="flex min-w-0 flex-1 items-center gap-4 px-4 py-5 active:bg-zinc-50"
                    draggable={false}
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600">
                      <RegionIcon />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-semibold text-zinc-900">
                        {region.name}
                      </span>
                      <span className="mt-0.5 block text-sm text-zinc-500">
                        {region.panelCount} pano
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
                    onClick={() => void handleDelete(region)}
                    aria-label="Bölgeyi sil"
                    className="flex w-14 shrink-0 items-center justify-center border-l border-zinc-200 text-zinc-400 active:bg-red-50 active:text-red-600"
                  >
                    <TrashIcon />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}

function GripIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <circle cx="9" cy="7" r="1.4" />
      <circle cx="15" cy="7" r="1.4" />
      <circle cx="9" cy="12" r="1.4" />
      <circle cx="15" cy="12" r="1.4" />
      <circle cx="9" cy="17" r="1.4" />
      <circle cx="15" cy="17" r="1.4" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function RegionIcon() {
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
