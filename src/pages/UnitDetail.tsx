import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useConfirm } from "../components/ConfirmDialog";
import EditableTitle from "../components/EditableTitle";
import PageHeader from "../components/PageHeader";
import {
  DrawingIcon,
  NoteIcon,
  PanelIcon,
  PhotoIcon,
  StatChip,
} from "../components/StatChip";
import { supabase } from "../lib/supabase";
import type { Database } from "../lib/database.types";

type Unit = Database["public"]["Tables"]["units"]["Row"];
type RoomStat = Database["public"]["Views"]["room_stats"]["Row"];

export default function UnitDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [unit, setUnit] = useState<Unit | null>(null);
  const [rooms, setRooms] = useState<RoomStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    const [u, r] = await Promise.all([
      supabase
        .from("units")
        .select("*")
        .eq("id", id)
        .eq("visible", true)
        .maybeSingle(),
      supabase
        .from("room_stats")
        .select("*")
        .eq("unit_id", id)
        .order("created_at", { ascending: false }),
    ]);

    if (!u.data) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setUnit(u.data);
    setDescDraft(u.data.description ?? "");
    setRooms(r.data ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRenameUnit(next: string) {
    if (!unit) return;
    const { error } = await supabase
      .from("units")
      .update({ name: next, updated_at: new Date().toISOString() })
      .eq("id", unit.id);
    if (!error) setUnit({ ...unit, name: next });
  }

  async function handleSaveDescription() {
    if (!unit) return;
    const next = descDraft.trim();
    const value = next.length > 0 ? next : null;
    const { error } = await supabase
      .from("units")
      .update({ description: value, updated_at: new Date().toISOString() })
      .eq("id", unit.id);
    if (!error) setUnit({ ...unit, description: value });
    setEditingDesc(false);
  }

  async function handleSoftDeleteUnit() {
    if (!unit) return;
    const ok = await confirm({
      title: "Üniteyi sil",
      message: `"${unit.name}" ünitesi geri dönüşüm kutusuna taşınsın mı? İçindeki odalar ve panolar saklanır, istediğinde geri yükleyebilirsin.`,
      confirmText: "Sil",
      destructive: true,
    });
    if (!ok) return;
    await supabase
      .from("units")
      .update({ visible: false, deleted_at: new Date().toISOString() })
      .eq("id", unit.id);
    navigate("/units", { replace: true });
  }

  if (loading) {
    return (
      <>
        <PageHeader title="Yükleniyor..." back />
        <div className="mx-auto max-w-4xl space-y-3 px-4 py-6">
          <div className="h-24 animate-pulse rounded-2xl bg-zinc-100" />
          <div className="h-24 animate-pulse rounded-2xl bg-zinc-100" />
        </div>
      </>
    );
  }

  if (notFound || !unit) {
    return (
      <>
        <PageHeader title="Bulunamadı" back />
        <div className="mx-auto max-w-4xl px-4 py-6 text-zinc-500">
          Ünite bulunamadı.
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={
          <EditableTitle
            value={unit.name}
            onSave={handleRenameUnit}
            ariaLabel="Ünite adını düzenle"
            placeholder="Ünite adı"
          />
        }
        subtitle="Ünite"
        back
        right={
          <button
            type="button"
            onClick={handleSoftDeleteUnit}
            aria-label="Üniteyi Sil"
            className="flex h-12 w-12 items-center justify-center rounded-xl text-rose-600 active:bg-rose-50"
          >
            <TrashIcon />
          </button>
        }
      />

      <div className="mx-auto max-w-4xl space-y-5 px-4 py-5">
        <DescriptionBlock
          editing={editingDesc}
          value={unit.description ?? ""}
          draft={descDraft}
          onDraftChange={setDescDraft}
          onStartEdit={() => {
            setDescDraft(unit.description ?? "");
            setEditingDesc(true);
          }}
          onCancel={() => {
            setDescDraft(unit.description ?? "");
            setEditingDesc(false);
          }}
          onSave={handleSaveDescription}
        />

        <section>
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-base font-semibold text-zinc-900">Odalar</h2>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
              {rooms.length}
            </span>
            <Link
              to={`/units/${unit.id}/rooms/new`}
              className="ml-auto rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white active:bg-zinc-800"
            >
              + Oda Ekle
            </Link>
          </div>

          {rooms.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-zinc-200 bg-white px-4 py-10 text-center text-sm text-zinc-400">
              Henüz oda yok. İlk odayı ekleyerek başla.
            </div>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {rooms.map((room) => (
                <li key={room.id}>
                  <Link
                    to={`/rooms/${room.id}`}
                    className="block h-full rounded-2xl border-2 border-zinc-200 bg-white px-5 py-4 transition active:bg-zinc-50 md:hover:border-zinc-300 md:hover:shadow"
                  >
                    <div className="text-base font-semibold text-zinc-900">
                      {room.room_name}
                    </div>
                    {room.description && (
                      <div className="mt-1 line-clamp-2 text-sm text-zinc-500">
                        {room.description}
                      </div>
                    )}

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <StatChip
                        icon={<PanelIcon />}
                        label="pano"
                        value={room.panel_count ?? 0}
                      />
                      <StatChip
                        icon={<PhotoIcon />}
                        label="foto"
                        value={room.photo_count ?? 0}
                      />
                      <StatChip
                        icon={<DrawingIcon />}
                        label="çizim"
                        value={room.drawing_count ?? 0}
                      />
                      <StatChip
                        icon={<NoteIcon />}
                        label="not"
                        value={room.note_count ?? 0}
                      />
                    </div>

                    {room.created_at && (
                      <div className="mt-2 text-xs text-zinc-400">
                        {new Date(room.created_at).toLocaleString("tr-TR")}
                      </div>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

function DescriptionBlock({
  editing,
  value,
  draft,
  onDraftChange,
  onStartEdit,
  onCancel,
  onSave,
}: {
  editing: boolean;
  value: string;
  draft: string;
  onDraftChange: (v: string) => void;
  onStartEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  if (editing) {
    return (
      <div className="space-y-2 rounded-2xl bg-zinc-50 p-3">
        <textarea
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          rows={3}
          autoFocus
          placeholder="Açıklama..."
          className="w-full rounded-xl border-2 border-zinc-200 bg-white px-4 py-3 text-sm outline-none focus:border-zinc-900"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border-2 border-zinc-200 bg-white px-3 py-2 text-sm font-semibold active:bg-zinc-100"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={onSave}
            className="flex-1 rounded-xl bg-zinc-900 px-3 py-2 text-sm font-semibold text-white active:bg-zinc-800"
          >
            Kaydet
          </button>
        </div>
      </div>
    );
  }

  if (!value) {
    return (
      <button
        type="button"
        onClick={onStartEdit}
        className="w-full rounded-2xl border-2 border-dashed border-zinc-200 bg-white px-4 py-3 text-left text-sm text-zinc-400 active:bg-zinc-50"
      >
        + Açıklama ekle
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onStartEdit}
      className="block w-full whitespace-pre-wrap rounded-2xl bg-zinc-50 px-4 py-3 text-left text-sm text-zinc-700 active:bg-zinc-100"
    >
      {value}
    </button>
  );
}

function TrashIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
