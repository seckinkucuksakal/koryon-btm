import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import DrawingCanvas from "../components/DrawingCanvas";
import DrawingEditor from "../drawing/Editor";
import type { DrawingKind, SceneJSON } from "../drawing/types";
import { useAuth } from "../auth/AuthContext";
import { supabase } from "../lib/supabase";
import { uploadToStorage } from "../lib/storage";

type Props = {
  target: "room" | "panel";
};

type Tab = "freehand" | "layout" | "sld";

export default function NewDrawingPage({ target }: Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { userId } = useAuth();
  const [tab, setTab] = useState<Tab>("freehand");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPanel = target === "panel";
  const folder = isPanel ? `drawings/panels/${id}` : `drawings/rooms/${id}`;

  async function persist({
    blob,
    kind,
    data,
  }: {
    blob: Blob;
    kind: DrawingKind;
    data?: SceneJSON;
  }) {
    if (!id || !userId) return;
    setSaving(true);
    setError(null);

    const result = await uploadToStorage({
      userId,
      folder,
      file: blob,
      filename: `cizim-${kind}-${Date.now()}.png`,
      contentType: "image/png",
    });

    if ("error" in result) {
      setError(result.error);
      setSaving(false);
      return;
    }

    const { error: dbErr } = await supabase.from("drawings").insert({
      room_id: isPanel ? null : id,
      panel_id: isPanel ? id : null,
      storage_path: result.path,
      kind,
      data: data ?? null,
    });

    setSaving(false);

    if (dbErr) {
      setError(dbErr.message);
      return;
    }

    navigate(isPanel ? `/panels/${id}` : `/rooms/${id}`, { replace: true });
  }

  async function handleFreehandSave(blob: Blob) {
    await persist({ blob, kind: "freehand" });
  }

  async function handleEditorSave({
    scene,
    png,
  }: {
    scene: SceneJSON;
    png: Blob;
  }) {
    await persist({ blob: png, kind: scene.kind, data: scene });
  }

  return (
    <>
      <PageHeader
        title="Yeni Çizim"
        subtitle={
          isPanel
            ? "Bu çizim panoya kaydedilecek"
            : "Bu çizim odaya kaydedilecek"
        }
        back
      />

      <div className="mx-auto max-w-6xl px-3 pb-4 pt-3 sm:px-4">
        <div className="mb-3 flex flex-wrap gap-1.5 rounded-2xl border-2 border-zinc-200 bg-white p-1.5">
          <TabBtn active={tab === "freehand"} onClick={() => setTab("freehand")}>
            Serbest
          </TabBtn>
          <TabBtn active={tab === "layout"} onClick={() => setTab("layout")}>
            Oda Yerleşimi
          </TabBtn>
          <TabBtn active={tab === "sld"} onClick={() => setTab("sld")}>
            Tek Hat Şeması
          </TabBtn>
        </div>

        {error && (
          <div className="mb-3 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {tab === "freehand" && (
          <div className="rounded-2xl border-2 border-zinc-200 bg-white p-3">
            <DrawingCanvas onSave={handleFreehandSave} saving={saving} />
          </div>
        )}

        {tab === "layout" && (
          <DrawingEditor
            key="layout"
            kind="layout"
            onSave={handleEditorSave}
            saving={saving}
          />
        )}

        {tab === "sld" && (
          <DrawingEditor
            key="sld"
            kind="sld"
            onSave={handleEditorSave}
            saving={saving}
          />
        )}
      </div>
    </>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition ${
        active
          ? "bg-zinc-900 text-white"
          : "bg-white text-zinc-600 active:bg-zinc-50"
      }`}
    >
      {children}
    </button>
  );
}
