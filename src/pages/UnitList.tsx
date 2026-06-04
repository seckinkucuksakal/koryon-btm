import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import {
  StatChip,
  RoomIcon,
  PanelIcon,
  PhotoIcon,
  DrawingIcon,
} from "../components/StatChip";
import { supabase } from "../lib/supabase";
import type { Database } from "../lib/database.types";

type UnitStat = Database["public"]["Views"]["unit_stats"]["Row"];

export default function UnitListPage() {
  const [units, setUnits] = useState<UnitStat[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("unit_stats")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data, error: dbErr }) => {
        if (cancelled) return;
        if (dbErr) {
          setError(dbErr.message);
          return;
        }
        setUnits(data ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <PageHeader title="Kayıtlı Üniteler" back />
      <div className="mx-auto max-w-4xl px-4 py-6">
        {error && (
          <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {!units && !error && (
          <div className="grid gap-3 md:grid-cols-2">
            <div className="h-32 animate-pulse rounded-2xl bg-zinc-100" />
            <div className="h-32 animate-pulse rounded-2xl bg-zinc-100" />
          </div>
        )}

        {units && units.length === 0 && (
          <div className="rounded-2xl border-2 border-dashed border-zinc-200 bg-white px-4 py-12 text-center">
            <p className="text-zinc-500">Henüz ünite yok.</p>
            <Link
              to="/units/new"
              className="mt-4 inline-flex rounded-xl bg-zinc-900 px-5 py-3 font-semibold text-white"
            >
              Yeni Ünite Oluştur
            </Link>
          </div>
        )}

        {units && units.length > 0 && (
          <ul className="grid gap-3 md:grid-cols-2">
            {units.map((unit) => (
              <li key={unit.id}>
                <Link
                  to={`/units/${unit.id}`}
                  className="block h-full rounded-2xl border-2 border-zinc-200 bg-white px-5 py-4 shadow-sm transition active:bg-zinc-50 md:hover:border-zinc-300 md:hover:shadow"
                >
                  <div className="text-base font-semibold text-zinc-900">
                    {unit.name}
                  </div>
                  {unit.description && (
                    <div className="mt-1 line-clamp-2 text-sm text-zinc-500">
                      {unit.description}
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <StatChip
                      icon={<RoomIcon />}
                      label="oda"
                      value={unit.room_count ?? 0}
                    />
                    <StatChip
                      icon={<PanelIcon />}
                      label="pano"
                      value={unit.panel_count ?? 0}
                    />
                    <StatChip
                      icon={<PhotoIcon />}
                      label="foto"
                      value={unit.photo_count ?? 0}
                    />
                    <StatChip
                      icon={<DrawingIcon />}
                      label="çizim"
                      value={unit.drawing_count ?? 0}
                    />
                  </div>

                  {unit.created_at && (
                    <div className="mt-2 text-xs text-zinc-400">
                      {new Date(unit.created_at).toLocaleString("tr-TR")}
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
