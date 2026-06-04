import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import { supabase } from "../lib/supabase";
import type { Database } from "../lib/database.types";

type Unit = Database["public"]["Tables"]["units"]["Row"];
type UnitWithCounts = Unit & { room_count: number };

export default function UnitListPage() {
  const [units, setUnits] = useState<UnitWithCounts[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: unitsData, error: dbErr } = await supabase
        .from("units")
        .select("*")
        .order("created_at", { ascending: false });

      if (cancelled) return;
      if (dbErr) {
        setError(dbErr.message);
        return;
      }
      const list = unitsData ?? [];

      // Her ünite için oda sayısını bağımsız sorgularla al (kolay ve okunaklı)
      const counts = await Promise.all(
        list.map((u) =>
          supabase
            .from("rooms")
            .select("id", { count: "exact", head: true })
            .eq("unit_id", u.id),
        ),
      );

      if (cancelled) return;
      setUnits(
        list.map((u, i) => ({
          ...u,
          room_count: counts[i].count ?? 0,
        })),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <PageHeader title="Kayıtlı Üniteler" back />
      <div className="mx-auto max-w-2xl px-4 py-6">
        {error && (
          <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {!units && !error && (
          <div className="space-y-3">
            <div className="h-20 animate-pulse rounded-2xl bg-zinc-100" />
            <div className="h-20 animate-pulse rounded-2xl bg-zinc-100" />
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
          <ul className="space-y-2">
            {units.map((unit) => (
              <li key={unit.id}>
                <Link
                  to={`/units/${unit.id}`}
                  className="block rounded-2xl border-2 border-zinc-200 bg-white px-5 py-4 shadow-sm active:bg-zinc-50"
                >
                  <div className="flex items-center gap-2">
                    <div className="text-base font-semibold text-zinc-900">
                      {unit.name}
                    </div>
                    <span className="ml-auto rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600">
                      {unit.room_count} oda
                    </span>
                  </div>
                  {unit.description && (
                    <div className="mt-1 line-clamp-2 text-sm text-zinc-500">
                      {unit.description}
                    </div>
                  )}
                  <div className="mt-2 text-xs text-zinc-400">
                    {new Date(unit.created_at).toLocaleString("tr-TR")}
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
