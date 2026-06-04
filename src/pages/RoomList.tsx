import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import { supabase } from "../lib/supabase";
import type { Database } from "../lib/database.types";

type Room = Database["public"]["Tables"]["rooms"]["Row"];

export default function RoomListPage() {
  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("rooms")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data, error: dbErr }) => {
        if (cancelled) return;
        if (dbErr) {
          setError(dbErr.message);
          return;
        }
        setRooms(data ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <PageHeader title="Kayıtlı Odalar" back />
      <div className="mx-auto max-w-2xl px-4 py-6">
        {error && (
          <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {!rooms && !error && (
          <div className="space-y-3">
            <div className="h-20 animate-pulse rounded-2xl bg-zinc-100" />
            <div className="h-20 animate-pulse rounded-2xl bg-zinc-100" />
          </div>
        )}

        {rooms && rooms.length === 0 && (
          <div className="rounded-2xl border-2 border-dashed border-zinc-200 bg-white px-4 py-12 text-center">
            <p className="text-zinc-500">Henüz oda yok.</p>
            <Link
              to="/rooms/new"
              className="mt-4 inline-flex rounded-xl bg-zinc-900 px-5 py-3 font-semibold text-white"
            >
              Yeni Oda Oluştur
            </Link>
          </div>
        )}

        {rooms && rooms.length > 0 && (
          <ul className="space-y-2">
            {rooms.map((room) => (
              <li key={room.id}>
                <Link
                  to={`/rooms/${room.id}`}
                  className="block rounded-2xl border-2 border-zinc-200 bg-white px-5 py-4 shadow-sm active:bg-zinc-50"
                >
                  <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    {room.unit_name}
                  </div>
                  <div className="mt-0.5 text-base font-semibold text-zinc-900">
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
      </div>
    </>
  );
}
