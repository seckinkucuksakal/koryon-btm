import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import PhotoUploader from "../components/PhotoUploader";
import StorageImage from "../components/StorageImage";
import Lightbox, { type LightboxItem } from "../components/Lightbox";
import { PANEL_TYPE_LABELS, supabase } from "../lib/supabase";
import { deleteFromStorage } from "../lib/storage";
import type { Database } from "../lib/database.types";

type Panel = Database["public"]["Tables"]["panels"]["Row"];
type Equipment = Database["public"]["Tables"]["equipment"]["Row"];
type Photo = Database["public"]["Tables"]["photos"]["Row"];
type Drawing = Database["public"]["Tables"]["drawings"]["Row"];

export default function PanelDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [panel, setPanel] = useState<Panel | null>(null);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [viewer, setViewer] = useState<{
    items: LightboxItem[];
    index: number;
  } | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const [p, e, ph, dr] = await Promise.all([
      supabase.from("panels").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("equipment")
        .select("*")
        .eq("panel_id", id)
        .order("created_at", { ascending: true }),
      supabase
        .from("photos")
        .select("*")
        .eq("panel_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("drawings")
        .select("*")
        .eq("panel_id", id)
        .order("created_at", { ascending: false }),
    ]);

    if (!p.data) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setPanel(p.data);
    setEquipment(e.data ?? []);
    setPhotos(ph.data ?? []);
    setDrawings(dr.data ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDeletePanel() {
    if (!panel) return;
    if (!confirm(`"${panel.name}" panosunu silmek istiyor musun?`)) return;
    const paths = [
      ...photos.map((p) => p.storage_path),
      ...drawings.map((d) => d.storage_path),
    ];
    await Promise.all(paths.map((p) => deleteFromStorage(p)));
    await supabase.from("panels").delete().eq("id", panel.id);
    navigate(`/rooms/${panel.room_id}`, { replace: true });
  }

  if (loading) {
    return (
      <>
        <PageHeader title="Yükleniyor..." back />
        <div className="mx-auto max-w-4xl space-y-3 px-4 py-6">
          <div className="h-24 animate-pulse rounded-2xl bg-zinc-100" />
        </div>
      </>
    );
  }

  if (notFound || !panel) {
    return (
      <>
        <PageHeader title="Bulunamadı" back />
        <div className="mx-auto max-w-4xl px-4 py-6 text-zinc-500">
          Pano bulunamadı.
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={panel.name}
        subtitle={
          PANEL_TYPE_LABELS[panel.panel_type as keyof typeof PANEL_TYPE_LABELS] ??
          panel.panel_type
        }
        back
        right={
          <button
            type="button"
            onClick={handleDeletePanel}
            aria-label="Panoyu Sil"
            className="flex h-12 w-12 items-center justify-center rounded-xl text-rose-600 active:bg-rose-50"
          >
            <TrashIcon />
          </button>
        }
      />

      <div className="mx-auto max-w-4xl space-y-6 px-4 py-5">
        {panel.notes && (
          <p className="rounded-2xl bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
            {panel.notes}
          </p>
        )}

        <section>
          <h2 className="mb-2 text-base font-semibold text-zinc-900">
            Ekipmanlar
            <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
              {equipment.length}
            </span>
          </h2>

          <QuickEquipmentInput panelId={panel.id} onAdded={load} />

          {equipment.length > 0 && (
            <ul className="mt-3 divide-y divide-zinc-100 overflow-hidden rounded-2xl border-2 border-zinc-200 bg-white">
              {equipment.map((eq) => (
                <EquipmentRow key={eq.id} equipment={eq} onChange={load} />
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-zinc-900">
            Fotoğraflar
            <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
              {photos.length}
            </span>
          </h2>
          <PhotoUploader
            folder="panels"
            ownerColumn="panel_id"
            ownerId={panel.id}
            onUploaded={load}
          />
          {photos.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2 md:grid-cols-4">
              {photos.map((ph, i) => (
                <button
                  type="button"
                  key={ph.id}
                  onClick={() =>
                    setViewer({
                      items: photos.map((p, idx) => ({
                        path: p.storage_path,
                        title: `${panel.name} — Foto ${idx + 1}`,
                      })),
                      index: i,
                    })
                  }
                  className="overflow-hidden rounded-xl active:opacity-80 md:hover:opacity-90"
                >
                  <StorageImage
                    path={ph.storage_path}
                    className="aspect-square w-full rounded-xl object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="mb-2 flex items-center gap-2">
            <h2 className="text-base font-semibold text-zinc-900">
              Çizimler
              <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                {drawings.length}
              </span>
            </h2>
            <Link
              to={`/panels/${panel.id}/drawings/new`}
              className="ml-auto rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white active:bg-zinc-800"
            >
              + Çizim
            </Link>
          </div>

          {drawings.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-zinc-200 bg-white px-4 py-6 text-center text-sm text-zinc-400">
              Henüz çizim yok
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              {drawings.map((d, i) => (
                <button
                  type="button"
                  key={d.id}
                  onClick={() =>
                    setViewer({
                      items: drawings.map((dr, idx) => ({
                        path: dr.storage_path,
                        title: `${panel.name} — Çizim ${idx + 1}`,
                      })),
                      index: i,
                    })
                  }
                  className="overflow-hidden rounded-xl border-2 border-zinc-200 bg-white text-left transition active:opacity-80 md:hover:border-zinc-300"
                >
                  <StorageImage
                    path={d.storage_path}
                    className="aspect-[4/3] w-full object-contain"
                  />
                  <div className="px-3 py-2 text-xs text-zinc-500">
                    {new Date(d.created_at).toLocaleString("tr-TR")}
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      {viewer && (
        <Lightbox
          items={viewer.items}
          index={viewer.index}
          onClose={() => setViewer(null)}
          onIndexChange={(i) =>
            setViewer((v) => (v ? { ...v, index: i } : v))
          }
        />
      )}
    </>
  );
}

function QuickEquipmentInput({
  panelId,
  onAdded,
}: {
  panelId: string;
  onAdded: () => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function add() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);

    const { error: dbErr } = await supabase
      .from("equipment")
      .insert({ panel_id: panelId, name: trimmed });

    setBusy(false);
    if (dbErr) {
      setError(dbErr.message);
      return;
    }
    setName("");
    onAdded();
    inputRef.current?.focus();
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Ekipman adı (Ör. P101A)"
          autoCapitalize="characters"
          autoComplete="off"
          className="min-w-0 flex-1 rounded-xl border-2 border-zinc-200 bg-white px-4 py-4 text-base outline-none focus:border-zinc-900"
        />
        <button
          type="button"
          onClick={add}
          disabled={busy || !name.trim()}
          className="shrink-0 rounded-xl bg-zinc-900 px-5 text-base font-semibold text-white active:bg-zinc-800 disabled:opacity-50"
        >
          Ekle
        </button>
      </div>
      <p className="text-xs text-zinc-500">
        Enter tuşu ile peş peşe ekleyebilirsin. Açıklama isteğe bağlı; satıra
        dokunarak ekleyebilirsin.
      </p>
      {error && (
        <div className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </div>
      )}
    </div>
  );
}

function EquipmentRow({
  equipment,
  onChange,
}: {
  equipment: Equipment;
  onChange: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(equipment.name);
  const [description, setDescription] = useState(equipment.description ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    await supabase
      .from("equipment")
      .update({
        name: name.trim() || equipment.name,
        description: description.trim() || null,
      })
      .eq("id", equipment.id);
    setBusy(false);
    setEditing(false);
    onChange();
  }

  async function remove() {
    if (!confirm(`"${equipment.name}" silinsin mi?`)) return;
    await supabase.from("equipment").delete().eq("id", equipment.id);
    onChange();
  }

  if (editing) {
    return (
      <li className="space-y-2 px-4 py-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoCapitalize="characters"
          autoComplete="off"
          className="w-full rounded-xl border-2 border-zinc-200 bg-white px-3 py-2 text-base outline-none focus:border-zinc-900"
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Açıklama"
          autoComplete="off"
          className="w-full rounded-xl border-2 border-zinc-200 bg-white px-3 py-2 text-base outline-none focus:border-zinc-900"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setName(equipment.name);
              setDescription(equipment.description ?? "");
            }}
            className="flex-1 rounded-xl border-2 border-zinc-200 bg-white px-3 py-2 text-sm font-semibold active:bg-zinc-50"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="flex-1 rounded-xl bg-zinc-900 px-3 py-2 text-sm font-semibold text-white active:bg-zinc-800 disabled:opacity-50"
          >
            Kaydet
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-2 px-4 py-3">
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="min-w-0 flex-1 text-left active:opacity-70"
      >
        <div className="text-base font-semibold text-zinc-900">
          {equipment.name}
        </div>
        {equipment.description && (
          <div className="text-sm text-zinc-500">{equipment.description}</div>
        )}
      </button>
      <button
        type="button"
        onClick={remove}
        aria-label="Sil"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-400 active:bg-zinc-100 active:text-rose-600"
      >
        <TrashIcon size={18} />
      </button>
    </li>
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
