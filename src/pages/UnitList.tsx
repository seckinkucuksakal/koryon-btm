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
  const [reorder, setReorder] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    const { data, error: dbErr } = await supabase
      .from("unit_stats")
      .select("*")
      .order("sort_order", { ascending: false })
      .order("created_at", { ascending: false });
    if (dbErr) {
      setError(dbErr.message);
      return;
    }
    setUnits(data ?? []);
  }

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("unit_stats")
      .select("*")
      .order("sort_order", { ascending: false })
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

  async function pinToTop(unit: UnitStat) {
    if (!unit.id || !units) return;
    const maxOrder = Math.max(0, ...units.map((u) => u.sort_order ?? 0));
    setBusyId(unit.id);
    await supabase
      .from("units")
      .update({ sort_order: maxOrder + 1 })
      .eq("id", unit.id);
    await load();
    setBusyId(null);
  }

  async function move(unit: UnitStat, direction: "up" | "down") {
    if (!unit.id || !units) return;
    const idx = units.findIndex((u) => u.id === unit.id);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= units.length) return;
    const other = units[swapIdx];
    if (!other.id) return;

    const a = unit.sort_order ?? 0;
    const b = other.sort_order ?? 0;

    setBusyId(unit.id);
    if (a === b) {
      // Eşitse, hareket etmek için ufak bir fark uygula.
      const next = direction === "up" ? a + 1 : a - 1;
      await supabase
        .from("units")
        .update({ sort_order: next })
        .eq("id", unit.id);
    } else {
      await Promise.all([
        supabase.from("units").update({ sort_order: b }).eq("id", unit.id),
        supabase.from("units").update({ sort_order: a }).eq("id", other.id),
      ]);
    }
    await load();
    setBusyId(null);
  }

  return (
    <>
      <PageHeader
        title="Kayıtlı Üniteler"
        back
        right={
          units && units.length > 1 ? (
            <button
              type="button"
              onClick={() => setReorder((v) => !v)}
              className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                reorder
                  ? "bg-zinc-900 text-white active:bg-zinc-800"
                  : "border-2 border-zinc-200 bg-white text-zinc-900 active:bg-zinc-50"
              }`}
            >
              {reorder ? "Bitti" : "Sırala"}
            </button>
          ) : undefined
        }
      />
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
          <>
            {reorder && (
              <p className="mb-3 rounded-xl bg-zinc-50 px-4 py-2 text-xs text-zinc-600">
                Sıralama modu açık. Üniteleri yukarı/aşağı taşı veya en üste
                sabitle.
              </p>
            )}
            <ul
              className={
                reorder
                  ? "flex flex-col gap-2"
                  : "grid gap-3 md:grid-cols-2"
              }
            >
              {units.map((unit, index) =>
                reorder ? (
                  <ReorderRow
                    key={unit.id}
                    unit={unit}
                    isFirst={index === 0}
                    isLast={index === units.length - 1}
                    busy={busyId === unit.id}
                    onPin={() => pinToTop(unit)}
                    onUp={() => move(unit, "up")}
                    onDown={() => move(unit, "down")}
                  />
                ) : (
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
                ),
              )}
            </ul>
          </>
        )}
      </div>
    </>
  );
}

function ReorderRow({
  unit,
  isFirst,
  isLast,
  busy,
  onPin,
  onUp,
  onDown,
}: {
  unit: UnitStat;
  isFirst: boolean;
  isLast: boolean;
  busy: boolean;
  onPin: () => void;
  onUp: () => void;
  onDown: () => void;
}) {
  return (
    <li
      className={`flex items-center gap-2 rounded-2xl border-2 border-zinc-200 bg-white px-3 py-3 ${
        busy ? "opacity-60" : ""
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-base font-semibold text-zinc-900">
          {unit.name}
        </div>
        <div className="mt-0.5 text-xs text-zinc-500">
          {unit.room_count ?? 0} oda • {unit.panel_count ?? 0} pano
        </div>
      </div>
      <button
        type="button"
        onClick={onPin}
        disabled={busy || isFirst}
        aria-label="En yukarı taşı"
        title="En yukarı taşı"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-zinc-200 bg-white text-zinc-700 active:bg-zinc-50 disabled:opacity-30"
      >
        <PinIcon />
      </button>
      <button
        type="button"
        onClick={onUp}
        disabled={busy || isFirst}
        aria-label="Yukarı"
        title="Yukarı"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-zinc-200 bg-white text-zinc-700 active:bg-zinc-50 disabled:opacity-30"
      >
        <ArrowIcon direction="up" />
      </button>
      <button
        type="button"
        onClick={onDown}
        disabled={busy || isLast}
        aria-label="Aşağı"
        title="Aşağı"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-zinc-200 bg-white text-zinc-700 active:bg-zinc-50 disabled:opacity-30"
      >
        <ArrowIcon direction="down" />
      </button>
    </li>
  );
}

function ArrowIcon({ direction }: { direction: "up" | "down" }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: direction === "down" ? "rotate(180deg)" : undefined }}
    >
      <path d="M18 15l-6-6-6 6" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 17v5" />
      <path d="M9 10V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v5l3 4H6l3-4z" />
    </svg>
  );
}
