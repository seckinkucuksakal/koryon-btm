import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import { BigButton } from "../components/BigButton";
import PanelLabelSearchInput from "../components/PanelLabelSearchInput";
import { useConfirm } from "../components/ConfirmDialog";
import {
  countPanels,
  createRegion,
  deleteRegion,
  ensureRegionsAlphabeticalSort,
  listRegions,
  mapRegionWorkflowHighlights,
  matchesPanelLabelQuery,
  regionWorkflowRowClass,
  reorderRegions,
  searchPanelLabels,
  type PanelLabelSearchHit,
  type PanelLabelRegion,
  type RegionWorkflowHighlight,
} from "../lib/panelLabelCatalog";

type RegionSummary = PanelLabelRegion & {
  panelCount: number;
  workflowHighlight: RegionWorkflowHighlight;
};

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
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const pointerDragActive = useRef(false);
  const dragFromRef = useRef<number | null>(null);
  const dragOverRef = useRef<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [panelHits, setPanelHits] = useState<PanelLabelSearchHit[]>([]);
  const [searchingPanels, setSearchingPanels] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const list = await listRegions();
      const highlights = await mapRegionWorkflowHighlights(list.map((r) => r.id));
      const enriched = await Promise.all(
        list.map(async (region) => ({
          ...region,
          panelCount: await countPanels(region.id),
          workflowHighlight: highlights.get(region.id) ?? null,
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

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setPanelHits([]);
      setSearchingPanels(false);
      return;
    }

    let cancelled = false;
    setSearchingPanels(true);
    void searchPanelLabels(q)
      .then((hits) => {
        if (!cancelled) setPanelHits(hits);
      })
      .catch(() => {
        if (!cancelled) setPanelHits([]);
      })
      .finally(() => {
        if (!cancelled) setSearchingPanels(false);
      });

    return () => {
      cancelled = true;
    };
  }, [searchQuery]);

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
      message: `"${region.name}" bölgesi ve içindeki ${region.panelCount} pano geri dönüşüm kutusuna taşınsın mı? İçerikler saklanır, istediğinizde geri yükleyebilirsiniz.`,
      confirmText: "Çöpe taşı",
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

  const resolveDropIndex = (clientY: number): number | null => {
    for (let i = 0; i < regions.length; i++) {
      const el = rowRefs.current.get(regions[i].id);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (clientY >= rect.top && clientY <= rect.bottom) return i;
    }
    return null;
  };

  const endPointerDrag = (clientY: number) => {
    if (!pointerDragActive.current || dragFromRef.current === null) return;

    const from = dragFromRef.current;
    const over = dragOverRef.current ?? resolveDropIndex(clientY);
    pointerDragActive.current = false;
    dragFromRef.current = null;
    dragOverRef.current = null;
    document.body.style.overflow = "";
    setDragFromIndex(null);
    setDragOverIndex(null);

    if (over !== null && over !== from) {
      void applyReorder(from, over);
    }
  };

  const handleGripPointerDown = (
    e: React.PointerEvent<HTMLButtonElement>,
    index: number,
  ) => {
    if (savingOrder || searching) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    pointerDragActive.current = true;
    dragFromRef.current = index;
    dragOverRef.current = null;
    document.body.style.overflow = "hidden";
    setDragFromIndex(index);
    setDragOverIndex(null);
  };

  const handleGripPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!pointerDragActive.current || dragFromRef.current === null) return;
    e.preventDefault();
    const over = resolveDropIndex(e.clientY);
    if (over !== null && over !== dragFromRef.current) {
      dragOverRef.current = over;
      setDragOverIndex(over);
    }
  };

  const handleGripPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!pointerDragActive.current) return;
    e.preventDefault();
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* capture already released */
    }
    endPointerDrag(e.clientY);
  };

  const handleGripPointerCancel = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!pointerDragActive.current) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* capture already released */
    }
    endPointerDrag(e.clientY);
  };

  const totalPanels = regions.reduce((s, r) => s + r.panelCount, 0);
  const searching = searchQuery.trim().length > 0;
  const filteredRegions = searching
    ? regions.filter((region) =>
        matchesPanelLabelQuery([region.name], searchQuery),
      )
    : regions;

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
        {!loading && regions.length > 0 && (
          <div className="space-y-3">
            <PanelLabelSearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Bölge veya pano ara…"
            />
            <Link
              to="/trash"
              className="flex items-center justify-center gap-2 rounded-xl border-2 border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-700 active:bg-zinc-100"
            >
              Geri Dönüşüm Kutusu
            </Link>
          </div>
        )}

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
            {searching && (
              <section className="space-y-2">
                <h2 className="text-sm font-semibold text-zinc-700">Panolar</h2>
                {searchingPanels ? (
                  <p className="text-sm text-zinc-500">Aranıyor…</p>
                ) : panelHits.length === 0 ? (
                  <p className="rounded-xl bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
                    Eşleşen pano yok.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {panelHits.map((hit) => (
                      <li key={hit.panelId}>
                        <Link
                          to={`/panel-label-check/${hit.regionId}/${hit.panelId}`}
                          className="flex items-start gap-3 rounded-2xl border-2 border-zinc-200 bg-white px-4 py-3 active:bg-zinc-50"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block break-words font-semibold leading-snug text-zinc-900">
                              {hit.panelName}
                            </span>
                            <span className="mt-0.5 block break-words text-sm leading-relaxed text-zinc-500">
                              {hit.regionName}
                            </span>
                          </span>
                          <svg
                            className="shrink-0 text-zinc-400"
                            width="20"
                            height="20"
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
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {!searching && (
            <p className="rounded-xl bg-zinc-50 px-4 py-2 text-xs text-zinc-600">
              Bölgeler harf sırasına göre listelenir. Sol tutamaçtan basılı tutup
              sürükleyerek sıralayın (telefon ve bilgisayarda).
              {savingOrder ? " Kaydediliyor…" : ""}
            </p>
            )}

            {searching && filteredRegions.length === 0 && !searchingPanels && panelHits.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50 px-6 py-10 text-center">
                <p className="font-medium text-zinc-700">Sonuç bulunamadı</p>
                <p className="mt-1 text-sm text-zinc-500">
                  Farklı bir arama deneyin.
                </p>
              </div>
            ) : (
            <>
            {searching && filteredRegions.length > 0 && (
              <h2 className="text-sm font-semibold text-zinc-700">Bölgeler</h2>
            )}
            <div className="space-y-3">
              {(searching ? filteredRegions : regions).map((region) => {
                const reorderIndex = regions.findIndex((r) => r.id === region.id);
                const isDragging = !searching && dragFromIndex === reorderIndex;
                const isDropTarget = !searching && dragOverIndex === reorderIndex;
                const baseRowClass = regionWorkflowRowClass(region.workflowHighlight);

                return (
                <div
                  key={region.id}
                  ref={(el) => {
                    if (el && !searching) rowRefs.current.set(region.id, el);
                    else rowRefs.current.delete(region.id);
                  }}
                  className={`flex items-stretch gap-0 rounded-2xl border-2 transition ${baseRowClass} ${
                    isDragging ? "opacity-50" : ""
                  } ${
                    isDropTarget ? "!border-zinc-900" : ""
                  }`}
                >
                  {!searching ? (
                  <button
                    type="button"
                    aria-label="Sürükleyerek sırala"
                    disabled={savingOrder}
                    className="flex w-11 shrink-0 touch-none cursor-grab items-center justify-center self-stretch border-r border-zinc-200 text-zinc-400 active:cursor-grabbing active:bg-zinc-100 disabled:opacity-40"
                    onPointerDown={(e) => handleGripPointerDown(e, reorderIndex)}
                    onPointerMove={handleGripPointerMove}
                    onPointerUp={handleGripPointerUp}
                    onPointerCancel={handleGripPointerCancel}
                  >
                    <GripIcon />
                  </button>
                  ) : (
                    <span className="flex w-3 shrink-0" aria-hidden />
                  )}
                  <Link
                    to={`/panel-label-check/${region.id}`}
                    className="flex min-w-0 flex-1 items-center gap-4 px-4 py-4 active:bg-zinc-50 sm:py-5"
                    draggable={false}
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600">
                      <RegionIcon />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block break-words text-base font-semibold leading-snug text-zinc-900">
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
                    className="flex w-14 shrink-0 items-center justify-center self-stretch border-l border-zinc-200 text-zinc-400 active:bg-red-50 active:text-red-600"
                  >
                    <TrashIcon />
                  </button>
                </div>
                );
              })}
            </div>
            </>
            )}

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
