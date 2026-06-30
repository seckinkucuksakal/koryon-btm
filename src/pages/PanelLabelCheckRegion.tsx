import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import EditableTitle from "../components/EditableTitle";
import { useConfirm } from "../components/ConfirmDialog";
import PanelLabelSearchInput from "../components/PanelLabelSearchInput";
import {
  createPanel,
  deletePanel,
  filterPanelByQuery,
  formatPanelDimensions,
  getRegion,
  listPanelsWithSummary,
  normalizePanelWorkflowStatus,
  panelWorkflowRowClass,
  updateRegionName,
  type PanelLabelPanelSummary,
  type PanelLabelWorkflowStatus,
} from "../lib/panelLabelCatalog";

type StatusFilter = "all" | PanelLabelWorkflowStatus;

const STATUS_FILTER_LABELS: Record<StatusFilter, string> = {
  all: "Tümü",
  neutral: "Nötr",
  in_progress: "İşlemde Olanlar",
  completed: "Tamamlananlar",
};

export default function PanelLabelCheckRegionPage() {
  const { regionId } = useParams<{ regionId: string }>();
  const confirm = useConfirm();

  const [regionName, setRegionName] = useState("");
  const [panels, setPanels] = useState<PanelLabelPanelSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [newPanelName, setNewPanelName] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const reload = useCallback(async () => {
    if (!regionId) return;
    setLoading(true);
    try {
      const region = await getRegion(regionId);
      if (!region) {
        setNotFound(true);
        return;
      }
      setRegionName(region.name);
      setPanels(await listPanelsWithSummary(regionId));
    } finally {
      setLoading(false);
    }
  }, [regionId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleRename = async (next: string) => {
    if (!regionId) return;
    await updateRegionName(regionId, next);
    setRegionName(next);
  };

  const handleAddPanel = async () => {
    if (!regionId) return;
    const name = newPanelName.trim();
    if (!name) {
      setError("Pano adı girin.");
      return;
    }
    setAdding(true);
    setError(null);
    try {
      await createPanel(regionId, name);
      setNewPanelName("");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Pano eklenemedi.");
    } finally {
      setAdding(false);
    }
  };

  const handleDeletePanel = async (panel: PanelLabelPanelSummary) => {
    const ok = await confirm({
      title: "Panoyu sil",
      message: `"${panel.name}" geri dönüşüm kutusuna taşınsın mı? Tek hat, pano içi görselleri ve notlar saklanır; istediğinizde geri yükleyebilirsiniz.`,
      confirmText: "Çöpe taşı",
      destructive: true,
    });
    if (!ok) return;
    try {
      await deletePanel(panel.id);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Silinemedi.");
    }
  };

  const filteredPanels = panels.filter((panel) => {
    if (!filterPanelByQuery(panel, searchQuery)) return false;
    const status = normalizePanelWorkflowStatus(panel.workflowStatus);
    if (statusFilter === "all") return true;
    return status === statusFilter;
  });
  const searching = searchQuery.trim().length > 0;
  const filtering = statusFilter !== "all";

  if (notFound) {
    return (
      <>
        <PageHeader title="Bölge bulunamadı" back />
        <div className="px-4 py-10 text-center">
          <Link to="/panel-label-check" className="text-zinc-600 underline">
            Bölgelere dön
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        back
        title={
          <EditableTitle
            value={regionName}
            onSave={handleRename}
            ariaLabel="Bölge adını düzenle"
            placeholder="Bölge adı"
          />
        }
        subtitle={loading ? "Yükleniyor…" : `${panels.length} pano`}
      />

      <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        {!loading && panels.length > 0 && (
          <div className="space-y-3">
            <PanelLabelSearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Bu bölgede pano ara…"
            />
            <div className="flex gap-2 overflow-x-auto rounded-2xl bg-zinc-100 p-1">
              {(Object.keys(STATUS_FILTER_LABELS) as StatusFilter[]).map(
                (key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setStatusFilter(key)}
                    className={`whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold transition ${
                      statusFilter === key
                        ? "bg-white text-zinc-900 shadow-sm"
                        : "text-zinc-500 active:bg-zinc-200"
                    }`}
                  >
                    {STATUS_FILTER_LABELS[key]}
                  </button>
                ),
              )}
            </div>
          </div>
        )}

        <section className="rounded-2xl border-2 border-zinc-200 bg-white p-4">
          <h2 className="text-base font-semibold text-zinc-900">Pano Ekle</h2>
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={newPanelName}
              onChange={(e) => setNewPanelName(e.target.value)}
              placeholder="Pano adı"
              className="min-w-0 flex-1 rounded-xl border border-zinc-300 px-4 py-3 text-base outline-none focus:border-zinc-500"
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleAddPanel();
              }}
            />
            <button
              type="button"
              onClick={() => void handleAddPanel()}
              disabled={adding}
              className="shrink-0 rounded-xl bg-zinc-900 px-5 py-3 font-semibold text-white disabled:opacity-50"
            >
              {adding ? "…" : "Ekle"}
            </button>
          </div>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </section>

        {loading ? (
          <p className="text-center text-sm text-zinc-500">Yükleniyor…</p>
        ) : filteredPanels.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50 px-6 py-10 text-center">
            <p className="font-medium text-zinc-700">
              {searching || filtering ? "Sonuç bulunamadı" : "Bu bölgede pano yok"}
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              {searching || filtering
                ? "Farklı bir arama veya filtre deneyin."
                : "Yukarıdan pano ekleyin."}
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {filteredPanels.map((panel) => (
              <li
                key={panel.id}
                className={`rounded-2xl border-2 ${panelWorkflowRowClass(panel.workflowStatus)}`}
              >
                <div className="flex items-start">
                  <Link
                    to={`/panel-label-check/${regionId}/${panel.id}`}
                    className="flex min-w-0 flex-1 items-start gap-3 px-3 py-3 active:bg-black/5 sm:px-4"
                  >
                    <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/80 text-zinc-500">
                      <PanelIcon />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-base font-semibold leading-snug text-zinc-900">
                        {panel.name}
                      </p>
                      <PanelMeta panel={panel} />
                    </div>
                  </Link>
                  <button
                    type="button"
                    onClick={() => void handleDeletePanel(panel)}
                    className="hidden shrink-0 self-stretch border-l border-zinc-200 px-4 py-3 text-sm font-medium text-red-600 active:bg-red-50 sm:flex sm:items-center"
                  >
                    Sil
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDeletePanel(panel)}
                  className="w-full border-t border-zinc-200 px-4 py-2.5 text-sm font-medium text-red-600 active:bg-red-50 sm:hidden"
                >
                  Sil
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function PanelIcon() {
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
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18" />
      <path d="M9 21V9" />
    </svg>
  );
}

function PanelMeta({ panel }: { panel: PanelLabelPanelSummary }) {
  const dimensions = formatPanelDimensions(
    panel.widthCm,
    panel.heightCm,
    panel.depthCm,
  );
  const notePreview = panel.notes.trim();
  const locationPreview = panel.locationDirection.trim();
  const hasContent =
    panel.tekHatCount > 0 ||
    panel.panoIciCount > 0 ||
    !!dimensions ||
    notePreview.length > 0 ||
    locationPreview.length > 0;

  if (!hasContent) {
    return (
      <p className="mt-1 text-sm text-zinc-400">Henüz içerik eklenmemiş</p>
    );
  }

  return (
    <div className="mt-1.5 space-y-1">
      <div className="flex flex-wrap gap-1.5">
        {dimensions && (
          <MetaBadge tone="dark">{dimensions}</MetaBadge>
        )}
        {panel.tekHatCount > 0 && (
          <MetaBadge>Tek Hat · {panel.tekHatCount}</MetaBadge>
        )}
        {panel.panoIciCount > 0 && (
          <MetaBadge>Pano İçi · {panel.panoIciCount}</MetaBadge>
        )}
        {locationPreview.length > 0 && <MetaBadge>Lokasyon</MetaBadge>}
        {notePreview.length > 0 && <MetaBadge>Not</MetaBadge>}
      </div>
      {locationPreview.length > 0 && (
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-500">
          {locationPreview}
        </p>
      )}
      {notePreview.length > 0 && (
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-500">
          {notePreview}
        </p>
      )}
    </div>
  );
}

function MetaBadge({
  children,
  tone = "light",
}: {
  children: ReactNode;
  tone?: "light" | "dark";
}) {
  return (
    <span
      className={
        tone === "dark"
          ? "inline max-w-full break-words rounded-md bg-zinc-900 px-2 py-0.5 text-xs font-medium leading-relaxed text-white"
          : "inline max-w-full break-words rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium leading-relaxed text-zinc-600"
      }
    >
      {children}
    </span>
  );
}
