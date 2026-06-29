import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import EditableTitle from "../components/EditableTitle";
import PanelLabelImageSection from "../components/PanelLabelImageSection";
import {
  getPanel,
  getRegion,
  listPanelImages,
  updatePanelDetails,
  updatePanelName,
  type PanelLabelImage,
  type PanelLabelPanelDetails,
} from "../lib/panelLabelCatalog";

type DimensionDraft = {
  widthCm: string;
  heightCm: string;
  depthCm: string;
};

type SavedDimensions = {
  widthCm: number | null;
  heightCm: number | null;
  depthCm: number | null;
};

function dimensionsToDraft(d: SavedDimensions): DimensionDraft {
  return {
    widthCm: d.widthCm != null ? String(d.widthCm) : "",
    heightCm: d.heightCm != null ? String(d.heightCm) : "",
    depthCm: d.depthCm != null ? String(d.depthCm) : "",
  };
}

function parseDimension(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const num = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(num) || num < 0) {
    throw new Error("Boyutlar geçerli bir sayı olmalıdır.");
  }
  return num;
}

function draftToSaved(draft: DimensionDraft): SavedDimensions {
  return {
    widthCm: parseDimension(draft.widthCm),
    heightCm: parseDimension(draft.heightCm),
    depthCm: parseDimension(draft.depthCm),
  };
}

function detailsEqual(
  notesDraft: string,
  notes: string,
  draft: DimensionDraft,
  saved: SavedDimensions,
): boolean {
  if (notesDraft !== notes) return false;
  try {
    const next = draftToSaved(draft);
    return (
      next.widthCm === saved.widthCm &&
      next.heightCm === saved.heightCm &&
      next.depthCm === saved.depthCm
    );
  } catch {
    return false;
  }
}

export default function PanelLabelCheckPanelPage() {
  const { regionId, panelId } = useParams<{
    regionId: string;
    panelId: string;
  }>();

  const [panelName, setPanelName] = useState("");
  const [regionName, setRegionName] = useState("");
  const [notes, setNotes] = useState("");
  const [notesDraft, setNotesDraft] = useState("");
  const [dimensions, setDimensions] = useState<SavedDimensions>({
    widthCm: null,
    heightCm: null,
    depthCm: null,
  });
  const [dimensionsDraft, setDimensionsDraft] = useState<DimensionDraft>({
    widthCm: "",
    heightCm: "",
    depthCm: "",
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [tekHat, setTekHat] = useState<PanelLabelImage[]>([]);
  const [panoIci, setPanoIci] = useState<PanelLabelImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const reloadImages = useCallback(async () => {
    if (!panelId) return;
    const [tek, ici] = await Promise.all([
      listPanelImages(panelId, "tek_hat"),
      listPanelImages(panelId, "pano_ici"),
    ]);
    setTekHat(tek);
    setPanoIci(ici);
  }, [panelId]);

  const reload = useCallback(async () => {
    if (!panelId || !regionId) return;
    setLoading(true);
    try {
      const [panel, region] = await Promise.all([
        getPanel(panelId),
        getRegion(regionId),
      ]);
      if (!panel || panel.regionId !== regionId) {
        setNotFound(true);
        return;
      }
      setPanelName(panel.name);
      setNotes(panel.notes);
      setNotesDraft(panel.notes);
      const savedDims = {
        widthCm: panel.widthCm,
        heightCm: panel.heightCm,
        depthCm: panel.depthCm,
      };
      setDimensions(savedDims);
      setDimensionsDraft(dimensionsToDraft(savedDims));
      setRegionName(region?.name ?? "");
      await reloadImages();
    } finally {
      setLoading(false);
    }
  }, [panelId, regionId, reloadImages]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleRename = async (next: string) => {
    if (!panelId) return;
    await updatePanelName(panelId, next);
    setPanelName(next);
  };

  const handleSave = async () => {
    if (!panelId || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      let parsed: SavedDimensions;
      try {
        parsed = draftToSaved(dimensionsDraft);
      } catch (e) {
        setSaveError(
          e instanceof Error ? e.message : "Boyutlar geçersiz.",
        );
        return;
      }

      const details: PanelLabelPanelDetails = {
        notes: notesDraft,
        ...parsed,
      };
      await updatePanelDetails(panelId, details);
      setNotes(notesDraft);
      setDimensions(parsed);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Kayıt başarısız.");
    } finally {
      setSaving(false);
    }
  };

  const isDirty = !detailsEqual(
    notesDraft,
    notes,
    dimensionsDraft,
    dimensions,
  );

  if (notFound) {
    return (
      <>
        <PageHeader title="Pano bulunamadı" back />
        <div className="px-4 py-10 text-center">
          <Link
            to={regionId ? `/panel-label-check/${regionId}` : "/panel-label-check"}
            className="text-zinc-600 underline"
          >
            Panolara dön
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
            value={panelName}
            onSave={handleRename}
            ariaLabel="Pano adını düzenle"
            placeholder="Pano adı"
          />
        }
        subtitle={regionName || (loading ? "Yükleniyor…" : "")}
      />

      <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        {loading ? (
          <p className="text-center text-sm text-zinc-500">Yükleniyor…</p>
        ) : (
          <>
            <section className="rounded-2xl border-2 border-zinc-200 bg-white p-4">
              <h2 className="text-base font-semibold text-zinc-900">
                Pano Boyutu
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                Ölçüleri santimetre (cm) cinsinden girin.
              </p>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <DimensionField
                  label="Genişlik"
                  abbr="W"
                  value={dimensionsDraft.widthCm}
                  disabled={saving}
                  onChange={(v) => {
                    setDimensionsDraft((d) => ({ ...d, widthCm: v }));
                    setSaveError(null);
                  }}
                />
                <DimensionField
                  label="Boy"
                  abbr="H"
                  value={dimensionsDraft.heightCm}
                  disabled={saving}
                  onChange={(v) => {
                    setDimensionsDraft((d) => ({ ...d, heightCm: v }));
                    setSaveError(null);
                  }}
                />
                <DimensionField
                  label="Derinlik"
                  abbr="D"
                  value={dimensionsDraft.depthCm}
                  disabled={saving}
                  onChange={(v) => {
                    setDimensionsDraft((d) => ({ ...d, depthCm: v }));
                    setSaveError(null);
                  }}
                />
              </div>
            </section>

            <PanelLabelImageSection
              panelId={panelId!}
              category="tek_hat"
              heading="Tek Hat"
              hint="Tek hat şeması görselleri ve PDF dosyaları"
              images={tekHat}
              onChange={() => void reloadImages()}
            />

            <PanelLabelImageSection
              panelId={panelId!}
              category="pano_ici"
              heading="Pano İçi"
              hint="Pano içi fotoğraflar ve PDF dosyaları"
              images={panoIci}
              onChange={() => void reloadImages()}
            />

            <section className="rounded-2xl border-2 border-zinc-200 bg-white p-4">
              <h2 className="text-base font-semibold text-zinc-900">
                Pano Notları
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                Bu panoya özel notlarınızı yazın.
              </p>
              <textarea
                value={notesDraft}
                onChange={(e) => {
                  setNotesDraft(e.target.value);
                  setSaveError(null);
                }}
                placeholder="Not ekle…"
                rows={5}
                disabled={saving}
                className="mt-3 w-full resize-y rounded-xl border border-zinc-300 px-4 py-3 text-base outline-none focus:border-zinc-500 disabled:bg-zinc-50"
              />
              {saveError && (
                <p className="mt-2 text-sm text-red-600">{saveError}</p>
              )}
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving || !isDirty}
                className="mt-4 w-full rounded-xl bg-zinc-900 px-4 py-3 font-semibold text-white disabled:opacity-50"
              >
                Kaydet
              </button>
            </section>
          </>
        )}
      </div>

      {saving && <SavingOverlay />}
    </>
  );
}

function DimensionField({
  label,
  abbr,
  value,
  disabled,
  onChange,
}: {
  label: string;
  abbr: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline gap-1.5">
        <span className="text-sm font-medium text-zinc-800">{label}</span>
        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-bold text-zinc-500">
          {abbr}
        </span>
      </span>
      <div className="relative">
        <input
          type="text"
          inputMode="decimal"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          placeholder="—"
          className="w-full rounded-xl border border-zinc-300 py-3 pl-3 pr-10 text-base outline-none focus:border-zinc-500 disabled:bg-zinc-50"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400">
          cm
        </span>
      </div>
    </label>
  );
}

function SavingOverlay() {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/55 px-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Kaydediliyor"
    >
      <div className="flex w-full max-w-xs flex-col items-center gap-4 rounded-2xl bg-white px-6 py-7 shadow-2xl">
        <div className="relative flex h-14 w-14 items-center justify-center">
          <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-zinc-200 border-t-zinc-900" />
        </div>
        <p className="text-center text-base font-semibold text-zinc-900">
          Kaydediliyor…
        </p>
      </div>
    </div>
  );
}
