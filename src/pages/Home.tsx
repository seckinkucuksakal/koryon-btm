import { useEffect, useState } from "react";
import PageHeader from "../components/PageHeader";
import { BigLink } from "../components/BigButton";
import {
  DrawingIcon,
  PanelIcon,
  PhotoIcon,
  RoomIcon,
} from "../components/StatChip";
import { supabase } from "../lib/supabase";

type Totals = {
  units: number;
  rooms: number;
  panels: number;
  photos: number;
  drawings: number;
};

export default function HomePage() {
  const [totals, setTotals] = useState<Totals | null>(null);
  const [trashCount, setTrashCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("unit_stats")
      .select("room_count, panel_count, photo_count, drawing_count")
      .then(({ data }) => {
        if (cancelled) return;
        const list = data ?? [];
        const t: Totals = {
          units: list.length,
          rooms: list.reduce((s, u) => s + (u.room_count ?? 0), 0),
          panels: list.reduce((s, u) => s + (u.panel_count ?? 0), 0),
          photos: list.reduce((s, u) => s + (u.photo_count ?? 0), 0),
          drawings: list.reduce((s, u) => s + (u.drawing_count ?? 0), 0),
        };
        setTotals(t);
      });

    Promise.all([
      supabase
        .from("units")
        .select("id", { count: "exact", head: true })
        .eq("visible", false),
      supabase
        .from("rooms")
        .select("id", { count: "exact", head: true })
        .eq("visible", false),
      supabase
        .from("panels")
        .select("id", { count: "exact", head: true })
        .eq("visible", false),
      supabase
        .from("panel_label_regions")
        .select("id", { count: "exact", head: true })
        .eq("visible", false),
      supabase
        .from("panel_label_panels")
        .select("id", { count: "exact", head: true })
        .eq("visible", false),
    ]).then(([u, r, p, lr, lp]) => {
      if (cancelled) return;
      setTrashCount(
        (u.count ?? 0) +
          (r.count ?? 0) +
          (p.count ?? 0) +
          (lr.count ?? 0) +
          (lp.count ?? 0),
      );
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <PageHeader title="Koryon" subtitle="Saha kayıt asistanı" />
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        <Summary totals={totals} />

        <div className="grid gap-3 md:grid-cols-2">
          <BigLink
            to="/units/new"
            variant="primary"
            icon={<PlusIcon />}
            label="Yeni Ünite Oluştur"
            hint="Şartnamedeki üniteyi tanımla"
          />
          <BigLink
            to="/units"
            variant="secondary"
            icon={<ListIcon />}
            label="Kayıtlı Üniteler"
            hint={
              totals
                ? `${totals.units} ünite, ${totals.rooms} oda, ${totals.panels} pano`
                : "Daha önce oluşturduğun üniteler"
            }
          />
        </div>

        <BigLink
          to="/reports"
          variant="secondary"
          icon={<ReportIcon />}
          label="Günlük Faaliyet Raporları"
          hint="Günlük rapor gir, geçmiş raporları görüntüle"
        />

        <BigLink
          to="/panel-label-check"
          variant="secondary"
          icon={<PanelCheckIcon />}
          label="Pano ve Etiket Kontrol"
          hint="Bölge gruplarına göre pano listesi, ekleme ve düzenleme"
        />

        <BigLink
          to="/expense-receipts"
          variant="secondary"
          icon={<ReceiptIcon />}
          label="Harcırah Fişleri"
          hint="Seyahat klasörlerine fiş ekle, toplamı gör, toplu indir"
        />

        <BigLink
          to="/trash"
          variant="secondary"
          icon={<TrashIcon />}
          label="Geri Dönüşüm Kutusu"
          hint={
            trashCount === null
              ? "Sildiğin kayıtları geri yükle"
              : trashCount > 0
                ? `${trashCount} kayıt geri yüklenmeyi bekliyor`
                : "Boş — silinen kayıt yok"
          }
        />

        <p className="text-center text-xs text-zinc-400">
          Ünite → Oda → Pano → Ekipman
        </p>
      </div>
    </>
  );
}

function Summary({ totals }: { totals: Totals | null }) {
  const items = [
    {
      icon: <UnitIcon />,
      label: "Ünite",
      value: totals?.units,
    },
    {
      icon: <RoomIcon />,
      label: "Oda",
      value: totals?.rooms,
    },
    {
      icon: <PanelIcon />,
      label: "Pano",
      value: totals?.panels,
    },
    {
      icon: <PhotoIcon />,
      label: "Fotoğraf",
      value: totals?.photos,
    },
    {
      icon: <DrawingIcon />,
      label: "Çizim",
      value: totals?.drawings,
    },
  ];

  return (
    <div className="rounded-2xl border-2 border-zinc-200 bg-white p-4">
      <div className="grid grid-cols-3 gap-2 md:grid-cols-5">
        {items.map((it) => (
          <div
            key={it.label}
            className="flex flex-col items-center justify-center rounded-xl bg-zinc-50 px-2 py-3 text-center"
          >
            <div className="text-zinc-500">{it.icon}</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-zinc-900">
              {it.value ?? "–"}
            </div>
            <div className="text-xs text-zinc-500">{it.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlusIcon() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function UnitIcon() {
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
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  );
}

function ReportIcon() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function PanelCheckIcon() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function ReceiptIcon() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="12" y1="17" x2="8" y2="17" />
      <line x1="16" y1="17" x2="16.01" y2="17" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
