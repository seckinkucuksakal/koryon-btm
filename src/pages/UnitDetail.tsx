import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import { supabase } from "../lib/supabase";
import type { Database } from "../lib/database.types";

type Unit = Database["public"]["Tables"]["units"]["Row"];
type Room = Database["public"]["Tables"]["rooms"]["Row"];

export default function UnitDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [unit, setUnit] = useState<Unit | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const [u, r] = await Promise.all([
      supabase.from("units").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("rooms")
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
    setRooms(r.data ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDeleteUnit() {
    if (!unit) return;
    if (
      !confirm(
        `"${unit.name}" ünitesini silmek istiyor musun? İçindeki tüm odalar, panolar, fotoğraflar silinecek.`,
      )
    ) {
      return;
    }
    await supabase.from("units").delete().eq("id", unit.id);
    navigate("/units", { replace: true });
  }

  if (loading) {
    return (
      <>
        <PageHeader title="Yükleniyor..." back />
        <div className="mx-auto max-w-2xl space-y-3 px-4 py-6">
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
        <div className="mx-auto max-w-2xl px-4 py-6 text-zinc-500">
          Ünite bulunamadı.
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={unit.name}
        subtitle="Ünite"
        back
        right={
          <button
            type="button"
            onClick={handleDeleteUnit}
            aria-label="Üniteyi Sil"
            className="flex h-12 w-12 items-center justify-center rounded-xl text-rose-600 active:bg-rose-50"
          >
            <TrashIcon />
          </button>
        }
      />

      <div className="mx-auto max-w-2xl space-y-5 px-4 py-5">
        {unit.description && (
          <p className="rounded-2xl bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
            {unit.description}
          </p>
        )}

        <section>
          <div className="mb-2 flex items-center gap-2">
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
            <ul className="space-y-2">
              {rooms.map((room) => (
                <li key={room.id}>
                  <Link
                    to={`/rooms/${room.id}`}
                    className="block rounded-2xl border-2 border-zinc-200 bg-white px-5 py-4 active:bg-zinc-50"
                  >
                    <div className="text-base font-semibold text-zinc-900">
                      {room.room_name}
                    </div>
                    {room.description && (
                      <div className="mt-1 line-clamp-2 text-sm text-zinc-500">
                        {room.description}
                      </div>
                    )}
                    <div className="mt-2 text-xs text-zinc-400">
                      {new Date(room.created_at).toLocaleString("tr-TR")}
                    </div>
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
