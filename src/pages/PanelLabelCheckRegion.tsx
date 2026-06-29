import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import EditableTitle from "../components/EditableTitle";
import PanelCoverPreview from "../components/PanelCoverPreview";
import { useConfirm } from "../components/ConfirmDialog";
import {
  createPanel,
  deletePanel,
  formatPanelDimensions,
  getRegion,
  listPanelsWithSummary,
  updateRegionName,
  type PanelLabelPanelSummary,
} from "../lib/panelLabelCatalog";

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
      message: `"${panel.name}" listeden silinsin mi?`,
      confirmText: "Sil",
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
        ) : panels.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50 px-6 py-10 text-center">
            <p className="font-medium text-zinc-700">Bu bölgede pano yok</p>
            <p className="mt-1 text-sm text-zinc-500">
              Yukarıdan pano ekleyin.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {panels.map((panel) => (
              <li
                key={panel.id}
                className="overflow-hidden rounded-2xl border-2 border-zinc-200 bg-white"
              >
                <div className="flex items-stretch gap-0">
                  <Link
                    to={`/panel-label-check/${regionId}/${panel.id}`}
                    className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3 active:bg-zinc-50 sm:px-4"
                  >
                    <PanelCoverPreview
                      tekHat={{
                        label: "Tek Hat",
                        path: panel.tekHatCoverPath,
                        mimeType: panel.tekHatCoverMime,
                        count: panel.tekHatCount,
                      }}
                      panoIci={{
                        label: "Pano İçi",
                        path: panel.panoIciCoverPath,
                        mimeType: panel.panoIciCoverMime,
                        count: panel.panoIciCount,
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-semibold text-zinc-900">
                        {panel.name}
                      </p>
                      <PanelMeta panel={panel} />
                    </div>
                    <svg
                      className="hidden shrink-0 text-zinc-400 sm:block"
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
                  <button
                    type="button"
                    onClick={() => void handleDeletePanel(panel)}
                    className="shrink-0 border-l border-zinc-200 px-4 py-3 text-sm font-medium text-red-600 active:bg-red-50"
                  >
                    Sil
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function PanelMeta({ panel }: { panel: PanelLabelPanelSummary }) {
  const dimensions = formatPanelDimensions(
    panel.widthCm,
    panel.heightCm,
    panel.depthCm,
  );
  const notePreview = panel.notes.trim();
  const hasContent =
    panel.tekHatCount > 0 ||
    panel.panoIciCount > 0 ||
    !!dimensions ||
    notePreview.length > 0;

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
        {notePreview.length > 0 && <MetaBadge>Not</MetaBadge>}
      </div>
      {notePreview.length > 0 && (
        <p className="line-clamp-2 text-sm text-zinc-500">{notePreview}</p>
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
          ? "inline-flex rounded-md bg-zinc-900 px-2 py-0.5 text-xs font-medium text-white"
          : "inline-flex rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600"
      }
    >
      {children}
    </span>
  );
}
