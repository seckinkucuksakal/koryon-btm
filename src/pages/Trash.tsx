import { useCallback, useEffect, useMemo, useState } from "react";
import { useConfirm } from "../components/ConfirmDialog";
import PageHeader from "../components/PageHeader";
import { PANEL_TYPE_LABELS, supabase } from "../lib/supabase";
import { deleteFromStorage } from "../lib/storage";
import {
  listDeletedPanels as listDeletedLabelPanels,
  listDeletedRegions as listDeletedLabelRegions,
  restorePanel as restoreLabelPanel,
  restoreRegion as restoreLabelRegion,
  type PanelLabelTrashPanel,
  type PanelLabelTrashRegion,
} from "../lib/panelLabelCatalog";
import type { Database } from "../lib/database.types";

type Unit = Database["public"]["Tables"]["units"]["Row"];
type Room = Database["public"]["Tables"]["rooms"]["Row"];
type Panel = Database["public"]["Tables"]["panels"]["Row"];

type Tab =
  | "units"
  | "rooms"
  | "panels"
  | "labelRegions"
  | "labelPanels";

type RoomWithUnit = Room & { unit: { id: string; name: string } | null };
type PanelWithRoom = Panel & {
  room: {
    id: string;
    room_name: string;
    unit: { id: string; name: string } | null;
  } | null;
};

export default function TrashPage() {
  const [tab, setTab] = useState<Tab>("units");
  const [units, setUnits] = useState<Unit[]>([]);
  const [rooms, setRooms] = useState<RoomWithUnit[]>([]);
  const [panels, setPanels] = useState<PanelWithRoom[]>([]);
  const [labelRegions, setLabelRegions] = useState<PanelLabelTrashRegion[]>([]);
  const [labelPanels, setLabelPanels] = useState<PanelLabelTrashPanel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [u, r, p, lr, lp] = await Promise.all([
      supabase
        .from("units")
        .select("*")
        .eq("visible", false)
        .order("deleted_at", { ascending: false }),
      supabase
        .from("rooms")
        .select("*, unit:units(id, name)")
        .eq("visible", false)
        .order("deleted_at", { ascending: false }),
      supabase
        .from("panels")
        .select("*, room:rooms(id, room_name, unit:units(id, name))")
        .eq("visible", false)
        .order("deleted_at", { ascending: false }),
      listDeletedLabelRegions().catch(() => [] as PanelLabelTrashRegion[]),
      listDeletedLabelPanels().catch(() => [] as PanelLabelTrashPanel[]),
    ]);
    if (u.error || r.error || p.error) {
      setError(u.error?.message ?? r.error?.message ?? p.error?.message ?? "Yükleme hatası");
    }
    setUnits((u.data ?? []) as Unit[]);
    setRooms((r.data ?? []) as RoomWithUnit[]);
    setPanels((p.data ?? []) as PanelWithRoom[]);
    setLabelRegions(lr);
    setLabelPanels(lp);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(
    () => ({
      units: units.length,
      rooms: rooms.length,
      panels: panels.length,
      labelRegions: labelRegions.length,
      labelPanels: labelPanels.length,
    }),
    [
      units.length,
      rooms.length,
      panels.length,
      labelRegions.length,
      labelPanels.length,
    ],
  );

  return (
    <>
      <PageHeader title="Geri Dönüşüm Kutusu" subtitle="Silinen kayıtlar" back />
      <div className="mx-auto max-w-4xl px-4 py-5">
        <div className="mb-4 flex gap-2 overflow-x-auto rounded-2xl bg-zinc-100 p-1">
          <TabButton
            active={tab === "labelRegions"}
            onClick={() => setTab("labelRegions")}
            label="Etiket Bölgeleri"
            count={counts.labelRegions}
          />
          <TabButton
            active={tab === "labelPanels"}
            onClick={() => setTab("labelPanels")}
            label="Etiket Panoları"
            count={counts.labelPanels}
          />
          <TabButton
            active={tab === "units"}
            onClick={() => setTab("units")}
            label="Üniteler"
            count={counts.units}
          />
          <TabButton
            active={tab === "rooms"}
            onClick={() => setTab("rooms")}
            label="Odalar"
            count={counts.rooms}
          />
          <TabButton
            active={tab === "panels"}
            onClick={() => setTab("panels")}
            label="Panolar"
            count={counts.panels}
          />
        </div>

        {error && (
          <div className="mb-3 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            <div className="h-20 animate-pulse rounded-2xl bg-zinc-100" />
            <div className="h-20 animate-pulse rounded-2xl bg-zinc-100" />
          </div>
        ) : tab === "labelRegions" ? (
          <LabelRegionsList items={labelRegions} onChange={load} />
        ) : tab === "labelPanels" ? (
          <LabelPanelsList items={labelPanels} onChange={load} />
        ) : tab === "units" ? (
          <UnitsList items={units} onChange={load} />
        ) : tab === "rooms" ? (
          <RoomsList items={rooms} onChange={load} />
        ) : (
          <PanelsList items={panels} onChange={load} />
        )}
      </div>
    </>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold transition ${
        active
          ? "bg-white text-zinc-900 shadow-sm"
          : "bg-transparent text-zinc-500 active:bg-zinc-200"
      }`}
    >
      {label}
      <span
        className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${
          active ? "bg-zinc-100 text-zinc-700" : "bg-zinc-200 text-zinc-600"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function EmptyTrash({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-zinc-200 bg-white px-4 py-12 text-center text-sm text-zinc-400">
      {text}
    </div>
  );
}

function TrashRow({
  title,
  subtitle,
  meta,
  onRestore,
  onPurge,
  busy,
  allowPurge = true,
}: {
  title: string;
  subtitle?: string;
  meta?: string;
  onRestore: () => void;
  onPurge?: () => void;
  busy?: boolean;
  allowPurge?: boolean;
}) {
  return (
    <li className="rounded-2xl border-2 border-zinc-200 bg-white p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-semibold text-zinc-900">
            {title}
          </div>
          {subtitle && (
            <div className="mt-0.5 truncate text-sm text-zinc-500">
              {subtitle}
            </div>
          )}
          {meta && <div className="mt-1 text-xs text-zinc-400">{meta}</div>}
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onRestore}
            className="rounded-xl border-2 border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 active:bg-zinc-50 disabled:opacity-50"
          >
            Geri Yükle
          </button>
          {allowPurge && onPurge && (
            <button
              type="button"
              disabled={busy}
              onClick={onPurge}
              className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white active:bg-rose-700 disabled:opacity-50"
            >
              Kalıcı Sil
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

function UnitsList({ items, onChange }: { items: Unit[]; onChange: () => void }) {
  const confirm = useConfirm();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function restore(unit: Unit) {
    setBusyId(unit.id);
    await supabase
      .from("units")
      .update({ visible: true, deleted_at: null, updated_at: new Date().toISOString() })
      .eq("id", unit.id);
    setBusyId(null);
    onChange();
  }

  async function purge(unit: Unit) {
    const ok = await confirm({
      title: "Üniteyi kalıcı sil",
      message: `"${unit.name}" ünitesi ve içindeki TÜM odalar, panolar, fotoğraflar ve çizimler kalıcı olarak silinecek. Bu işlem geri alınamaz.`,
      confirmText: "Kalıcı sil",
      destructive: true,
    });
    if (!ok) return;
    setBusyId(unit.id);

    await purgeStorageForUnit(unit.id);

    await supabase.from("units").delete().eq("id", unit.id);
    setBusyId(null);
    onChange();
  }

  if (items.length === 0) {
    return <EmptyTrash text="Geri dönüşüm kutusunda ünite yok." />;
  }

  return (
    <ul className="space-y-3">
      {items.map((u) => (
        <TrashRow
          key={u.id}
          title={u.name}
          subtitle={u.description ?? undefined}
          meta={formatDeletedAt(u.deleted_at)}
          busy={busyId === u.id}
          onRestore={() => restore(u)}
          onPurge={() => purge(u)}
        />
      ))}
    </ul>
  );
}

function RoomsList({
  items,
  onChange,
}: {
  items: RoomWithUnit[];
  onChange: () => void;
}) {
  const confirm = useConfirm();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function restore(room: RoomWithUnit) {
    setBusyId(room.id);
    await supabase
      .from("rooms")
      .update({ visible: true, deleted_at: null, updated_at: new Date().toISOString() })
      .eq("id", room.id);
    setBusyId(null);
    onChange();
  }

  async function purge(room: RoomWithUnit) {
    const ok = await confirm({
      title: "Odayı kalıcı sil",
      message: `"${room.room_name}" odası ve içindeki tüm panolar, fotoğraflar, çizimler kalıcı olarak silinecek. Bu işlem geri alınamaz.`,
      confirmText: "Kalıcı sil",
      destructive: true,
    });
    if (!ok) return;
    setBusyId(room.id);
    await purgeStorageForRoom(room.id);
    await supabase.from("rooms").delete().eq("id", room.id);
    setBusyId(null);
    onChange();
  }

  if (items.length === 0) {
    return <EmptyTrash text="Geri dönüşüm kutusunda oda yok." />;
  }

  return (
    <ul className="space-y-3">
      {items.map((r) => (
        <TrashRow
          key={r.id}
          title={r.room_name}
          subtitle={r.unit?.name ? `Ünite: ${r.unit.name}` : undefined}
          meta={formatDeletedAt(r.deleted_at)}
          busy={busyId === r.id}
          onRestore={() => restore(r)}
          onPurge={() => purge(r)}
        />
      ))}
    </ul>
  );
}

function PanelsList({
  items,
  onChange,
}: {
  items: PanelWithRoom[];
  onChange: () => void;
}) {
  const confirm = useConfirm();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function restore(panel: PanelWithRoom) {
    setBusyId(panel.id);
    await supabase
      .from("panels")
      .update({ visible: true, deleted_at: null })
      .eq("id", panel.id);
    setBusyId(null);
    onChange();
  }

  async function purge(panel: PanelWithRoom) {
    const ok = await confirm({
      title: "Panoyu kalıcı sil",
      message: `"${panel.name}" panosu ve içindeki tüm ekipman, fotoğraf ve çizimler kalıcı olarak silinecek. Bu işlem geri alınamaz.`,
      confirmText: "Kalıcı sil",
      destructive: true,
    });
    if (!ok) return;
    setBusyId(panel.id);
    await purgeStorageForPanel(panel.id);
    await supabase.from("panels").delete().eq("id", panel.id);
    setBusyId(null);
    onChange();
  }

  if (items.length === 0) {
    return <EmptyTrash text="Geri dönüşüm kutusunda pano yok." />;
  }

  return (
    <ul className="space-y-3">
      {items.map((p) => {
        const path = [p.room?.unit?.name, p.room?.room_name]
          .filter(Boolean)
          .join(" › ");
        const typeLabel =
          PANEL_TYPE_LABELS[
            p.panel_type as keyof typeof PANEL_TYPE_LABELS
          ] ?? p.panel_type;
        return (
          <TrashRow
            key={p.id}
            title={p.name}
            subtitle={[typeLabel, path].filter(Boolean).join(" • ")}
            meta={formatDeletedAt(p.deleted_at)}
            busy={busyId === p.id}
            onRestore={() => restore(p)}
            onPurge={() => purge(p)}
          />
        );
      })}
    </ul>
  );
}

function formatDeletedAt(value: string | null): string | undefined {
  if (!value) return undefined;
  return `Silindi: ${new Date(value).toLocaleString("tr-TR")}`;
}

function LabelRegionsList({
  items,
  onChange,
}: {
  items: PanelLabelTrashRegion[];
  onChange: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function restore(region: PanelLabelTrashRegion) {
    setBusyId(region.id);
    setError(null);
    try {
      await restoreLabelRegion(region.id);
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Geri yüklenemedi.");
    } finally {
      setBusyId(null);
    }
  }

  if (items.length === 0) {
    return (
      <EmptyTrash text="Geri dönüşüm kutusunda etiket bölgesi yok." />
    );
  }

  return (
    <>
      {error && (
        <div className="mb-3 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}
      <ul className="space-y-3">
        {items.map((region) => (
          <TrashRow
            key={region.id}
            title={region.name}
            subtitle={`${region.panelCount} pano · içerikler korunur`}
            meta={formatDeletedAt(region.deletedAt)}
            busy={busyId === region.id}
            allowPurge={false}
            onRestore={() => void restore(region)}
          />
        ))}
      </ul>
    </>
  );
}

function LabelPanelsList({
  items,
  onChange,
}: {
  items: PanelLabelTrashPanel[];
  onChange: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function restore(panel: PanelLabelTrashPanel) {
    setBusyId(panel.id);
    setError(null);
    try {
      await restoreLabelPanel(panel.id);
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Geri yüklenemedi.");
    } finally {
      setBusyId(null);
    }
  }

  if (items.length === 0) {
    return <EmptyTrash text="Geri dönüşüm kutusunda etiket panosu yok." />;
  }

  return (
    <>
      {error && (
        <div className="mb-3 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}
      <ul className="space-y-3">
        {items.map((panel) => (
          <TrashRow
            key={panel.id}
            title={panel.name}
            subtitle={panel.regionName}
            meta={`Tek Hat ${panel.tekHatCount} · Pano İçi ${panel.panoIciCount} · ${formatDeletedAt(panel.deletedAt) ?? ""}`}
            busy={busyId === panel.id}
            allowPurge={false}
            onRestore={() => void restore(panel)}
          />
        ))}
      </ul>
    </>
  );
}

async function purgeStorageForUnit(unitId: string) {
  const { data: roomIds } = await supabase
    .from("rooms")
    .select("id")
    .eq("unit_id", unitId);
  const ids = (roomIds ?? []).map((r) => r.id);
  if (ids.length === 0) return;
  await Promise.all(ids.map((rid) => purgeStorageForRoom(rid)));
}

async function purgeStorageForRoom(roomId: string) {
  const [photos, drawings, panels] = await Promise.all([
    supabase.from("photos").select("storage_path").eq("room_id", roomId),
    supabase.from("drawings").select("storage_path").eq("room_id", roomId),
    supabase.from("panels").select("id").eq("room_id", roomId),
  ]);
  const paths: string[] = [
    ...(photos.data ?? []).map((p) => p.storage_path),
    ...(drawings.data ?? []).map((d) => d.storage_path),
  ];
  await Promise.all(paths.map((p) => deleteFromStorage(p)));
  const panelIds = (panels.data ?? []).map((p) => p.id);
  await Promise.all(panelIds.map((pid) => purgeStorageForPanel(pid)));
}

async function purgeStorageForPanel(panelId: string) {
  const [photos, drawings] = await Promise.all([
    supabase.from("photos").select("storage_path").eq("panel_id", panelId),
    supabase.from("drawings").select("storage_path").eq("panel_id", panelId),
  ]);
  const paths: string[] = [
    ...(photos.data ?? []).map((p) => p.storage_path),
    ...(drawings.data ?? []).map((d) => d.storage_path),
  ];
  await Promise.all(paths.map((p) => deleteFromStorage(p)));
}
