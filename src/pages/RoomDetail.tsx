import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import PhotoUploader from "../components/PhotoUploader";
import StorageImage from "../components/StorageImage";
import {
  EquipmentIcon,
  PhotoIcon,
  StatChip,
} from "../components/StatChip";
import { supabase, PANEL_TYPE_LABELS } from "../lib/supabase";
import { deleteFromStorage } from "../lib/storage";
import type { Database } from "../lib/database.types";

type Room = Database["public"]["Tables"]["rooms"]["Row"];
type PanelStat = Database["public"]["Views"]["panel_stats"]["Row"];
type Photo = Database["public"]["Tables"]["photos"]["Row"];
type Drawing = Database["public"]["Tables"]["drawings"]["Row"];
type Note = Database["public"]["Tables"]["notes"]["Row"];
type RoomWithUnit = Room & { units: { name: string } | null };

export default function RoomDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [room, setRoom] = useState<RoomWithUnit | null>(null);
  const [panels, setPanels] = useState<PanelStat[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const [r, p, ph, dr, no] = await Promise.all([
      supabase
        .from("rooms")
        .select("*, units(name)")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("panel_stats")
        .select("*")
        .eq("room_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("photos")
        .select("*")
        .eq("room_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("drawings")
        .select("*")
        .eq("room_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("notes")
        .select("*")
        .eq("room_id", id)
        .order("created_at", { ascending: false }),
    ]);

    if (!r.data) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setRoom(r.data as RoomWithUnit);
    setPanels(p.data ?? []);
    setPhotos(ph.data ?? []);
    setDrawings(dr.data ?? []);
    setNotes(no.data ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

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

  if (notFound || !room) {
    return (
      <>
        <PageHeader title="Bulunamadı" back />
        <div className="mx-auto max-w-4xl px-4 py-6 text-zinc-500">
          Oda bulunamadı.
        </div>
      </>
    );
  }

  async function handleDeleteRoom() {
    if (!room) return;
    if (
      !confirm(
        `"${room.room_name}" odasını silmek istiyor musun? Bu işlem geri alınamaz.`,
      )
    ) {
      return;
    }
    const paths = [
      ...photos.map((p) => p.storage_path),
      ...drawings.map((d) => d.storage_path),
    ];
    await Promise.all(paths.map((p) => deleteFromStorage(p)));
    await supabase.from("rooms").delete().eq("id", room.id);
    navigate(`/units/${room.unit_id}`, { replace: true });
  }

  return (
    <>
      <PageHeader
        title={room.room_name}
        subtitle={room.units?.name}
        back
        right={
          <button
            type="button"
            onClick={handleDeleteRoom}
            aria-label="Odayı Sil"
            className="flex h-12 w-12 items-center justify-center rounded-xl text-rose-600 active:bg-rose-50"
          >
            <TrashIcon />
          </button>
        }
      />

      <div className="mx-auto max-w-4xl space-y-6 px-4 py-5">
        {room.description && (
          <p className="rounded-2xl bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
            {room.description}
          </p>
        )}

        <Section
          title="Panolar"
          count={panels.length}
          action={
            <Link
              to={`/rooms/${room.id}/panels/new`}
              className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white active:bg-zinc-800"
            >
              + Pano Ekle
            </Link>
          }
        >
          {panels.length === 0 ? (
            <Empty text="Henüz pano yok" />
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {panels.map((panel) => (
                <li key={panel.id}>
                  <Link
                    to={`/panels/${panel.id}`}
                    className="block h-full rounded-2xl border-2 border-zinc-200 bg-white px-4 py-3 transition active:bg-zinc-50 md:hover:border-zinc-300 md:hover:shadow"
                  >
                    <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      {PANEL_TYPE_LABELS[
                        panel.panel_type as keyof typeof PANEL_TYPE_LABELS
                      ] ?? panel.panel_type}
                    </div>
                    <div className="text-base font-semibold text-zinc-900">
                      {panel.name}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <StatChip
                        icon={<EquipmentIcon />}
                        label="ekipman"
                        value={panel.equipment_count ?? 0}
                      />
                      <StatChip
                        icon={<PhotoIcon />}
                        label="foto"
                        value={panel.photo_count ?? 0}
                      />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Oda Fotoğrafları" count={photos.length}>
          <p className="mb-2 text-xs text-zinc-500">
            Bu fotoğraflar odaya aittir. Pano fotoğrafları her panonun kendi
            sayfasında.
          </p>
          <PhotoUploader
            folder="rooms"
            ownerColumn="room_id"
            ownerId={room.id}
            onUploaded={load}
          />
          {photos.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2 md:grid-cols-4">
              {photos.map((ph) => (
                <StorageImage
                  key={ph.id}
                  path={ph.storage_path}
                  className="aspect-square w-full rounded-xl object-cover"
                />
              ))}
            </div>
          )}
        </Section>

        <Section
          title="Çizimler"
          count={drawings.length}
          action={
            <Link
              to={`/rooms/${room.id}/drawings/new`}
              className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white active:bg-zinc-800"
            >
              + Çizim
            </Link>
          }
        >
          {drawings.length === 0 ? (
            <Empty text="Henüz çizim yok" />
          ) : (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              {drawings.map((d) => (
                <div
                  key={d.id}
                  className="overflow-hidden rounded-xl border-2 border-zinc-200 bg-white"
                >
                  <StorageImage
                    path={d.storage_path}
                    className="aspect-[4/3] w-full object-contain"
                  />
                  <div className="px-3 py-2 text-xs text-zinc-500">
                    {new Date(d.created_at).toLocaleString("tr-TR")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <NotesSection roomId={room.id} notes={notes} onChange={load} />
      </div>
    </>
  );
}

function Section({
  title,
  count,
  action,
  children,
}: {
  title: string;
  count?: number;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
        {typeof count === "number" && (
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
            {count}
          </span>
        )}
        {action && <div className="ml-auto">{action}</div>}
      </div>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-zinc-200 bg-white px-4 py-6 text-center text-sm text-zinc-400">
      {text}
    </div>
  );
}

function NotesSection({
  roomId,
  notes,
  onChange,
}: {
  roomId: string;
  notes: Note[];
  onChange: () => void;
}) {
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!content.trim()) return;
    setBusy(true);
    const { error } = await supabase
      .from("notes")
      .insert({ room_id: roomId, content: content.trim() });
    setBusy(false);
    if (!error) {
      setContent("");
      onChange();
    }
  }

  async function remove(noteId: string) {
    await supabase.from("notes").delete().eq("id", noteId);
    onChange();
  }

  return (
    <Section title="Notlar" count={notes.length}>
      <div className="space-y-2">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={2}
          placeholder="Hızlı not ekle..."
          className="w-full rounded-xl border-2 border-zinc-200 bg-white px-4 py-3 text-base outline-none focus:border-zinc-900"
        />
        <button
          type="button"
          onClick={add}
          disabled={!content.trim() || busy}
          className="w-full rounded-xl bg-zinc-900 px-4 py-3 font-semibold text-white active:bg-zinc-800 disabled:opacity-50"
        >
          Not Ekle
        </button>
      </div>

      {notes.length > 0 && (
        <ul className="mt-3 space-y-2">
          {notes.map((n) => (
            <li
              key={n.id}
              className="flex gap-2 rounded-xl bg-zinc-50 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="whitespace-pre-wrap break-words text-sm text-zinc-800">
                  {n.content}
                </p>
                <p className="mt-1 text-xs text-zinc-400">
                  {new Date(n.created_at).toLocaleString("tr-TR")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => remove(n.id)}
                aria-label="Notu sil"
                className="-mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-400 active:bg-zinc-200 active:text-rose-600"
              >
                <TrashIcon size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function TrashIcon({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
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
