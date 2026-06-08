import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useConfirm } from "../components/ConfirmDialog";
import EditableTitle from "../components/EditableTitle";
import PageHeader from "../components/PageHeader";
import PhotoTile, { softDeletePhoto } from "../components/PhotoTile";
import PhotoUploader from "../components/PhotoUploader";
import StorageImage from "../components/StorageImage";
import Lightbox, { type LightboxItem } from "../components/Lightbox";
import PanelEquipmentModal from "../components/PanelEquipmentModal";
import PDFUploader from "../components/PDFUploader";
import DocumentList from "../components/DocumentList";
import { PANEL_TYPE_LABELS, supabase } from "../lib/supabase";
import type { Database } from "../lib/database.types";

type Panel = Database["public"]["Tables"]["panels"]["Row"];
type Equipment = Database["public"]["Tables"]["equipment"]["Row"];
type Photo = Database["public"]["Tables"]["photos"]["Row"];
type Drawing = Database["public"]["Tables"]["drawings"]["Row"];
type PdfDoc = Database["public"]["Tables"]["documents"]["Row"];

export default function PanelDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [panel, setPanel] = useState<Panel | null>(null);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [documents, setDocuments] = useState<PdfDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [viewer, setViewer] = useState<{
    items: LightboxItem[];
    index: number;
    canDelete?: boolean;
  } | null>(null);
  const [equipmentModalOpen, setEquipmentModalOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const [p, e, ph, dr, docs] = await Promise.all([
      supabase
        .from("panels")
        .select("*")
        .eq("id", id)
        .eq("visible", true)
        .maybeSingle(),
      supabase
        .from("equipment")
        .select("*")
        .eq("panel_id", id)
        .eq("visible", true)
        .order("created_at", { ascending: true }),
      supabase
        .from("photos")
        .select("*")
        .eq("panel_id", id)
        .eq("visible", true)
        .order("created_at", { ascending: false }),
      supabase
        .from("drawings")
        .select("*")
        .eq("panel_id", id)
        .eq("visible", true)
        .order("created_at", { ascending: false }),
      supabase
        .from("documents")
        .select("*")
        .eq("panel_id", id)
        .eq("visible", true)
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
    setDocuments(docs.data ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRenamePanel(next: string) {
    if (!panel) return;
    const { error } = await supabase
      .from("panels")
      .update({ name: next })
      .eq("id", panel.id);
    if (!error) setPanel({ ...panel, name: next });
  }

  async function handleSoftDeletePanel() {
    if (!panel) return;
    const ok = await confirm({
      title: "Panoyu sil",
      message: `"${panel.name}" panosu geri dönüşüm kutusuna taşınsın mı? İçeriği saklanır, istediğinde geri yükleyebilirsin.`,
      confirmText: "Sil",
      destructive: true,
    });
    if (!ok) return;
    await supabase
      .from("panels")
      .update({ visible: false, deleted_at: new Date().toISOString() })
      .eq("id", panel.id);
    navigate(`/rooms/${panel.room_id}`, { replace: true });
  }

  async function handleDeletePhoto(photoId: string) {
    const ok = await confirm({
      title: "Fotoğrafı sil",
      message: "Bu fotoğraf silinsin mi? Geri dönüşüm kutusunda saklanır.",
      confirmText: "Sil",
      destructive: true,
    });
    if (!ok) return;
    await softDeletePhoto(photoId);
    await load();
  }

  async function handleDeleteCurrentLightboxPhoto() {
    if (!viewer || !viewer.canDelete) return;
    const current = viewer.items[viewer.index];
    if (!current) return;
    const photo = photos.find((p) => p.storage_path === current.path);
    if (!photo) return;

    const ok = await confirm({
      title: "Fotoğrafı sil",
      message: "Bu fotoğraf silinsin mi? Geri dönüşüm kutusunda saklanır.",
      confirmText: "Sil",
      destructive: true,
    });
    if (!ok) return;

    await softDeletePhoto(photo.id);

    const newItems = viewer.items.filter((_, i) => i !== viewer.index);
    if (newItems.length === 0) {
      setViewer(null);
    } else {
      setViewer({
        ...viewer,
        items: newItems,
        index: Math.min(viewer.index, newItems.length - 1),
      });
    }
    load();
  }

  async function handleRenameCurrentLightboxPhoto(next: string) {
    if (!viewer || !viewer.canDelete) return;
    const current = viewer.items[viewer.index];
    if (!current) return;
    const photo = photos.find((p) => p.storage_path === current.path);
    if (!photo) return;

    const value = next.trim().length > 0 ? next.trim() : null;
    await supabase.from("photos").update({ title: value }).eq("id", photo.id);

    setViewer((v) =>
      v
        ? {
            ...v,
            items: v.items.map((it, i) =>
              i === v.index ? { ...it, title: value ?? "" } : it,
            ),
          }
        : v,
    );
    setPhotos((prev) =>
      prev.map((p) => (p.id === photo.id ? { ...p, title: value } : p)),
    );
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
        title={
          <EditableTitle
            value={panel.name}
            onSave={handleRenamePanel}
            ariaLabel="Pano adını düzenle"
            placeholder="Pano adı"
          />
        }
        subtitle={
          PANEL_TYPE_LABELS[panel.panel_type as keyof typeof PANEL_TYPE_LABELS] ??
          panel.panel_type
        }
        back
        right={
          <button
            type="button"
            onClick={handleSoftDeletePanel}
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
          <div className="mb-2 flex items-center gap-2">
            <h2 className="text-base font-semibold text-zinc-900">
              Ekipmanlar
              <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                {equipment.filter(
                  (e) =>
                    LOAD_TYPES.has(e.equipment_type ?? "") ||
                    (!e.equipment_type && !equipment.some((c) => c.parent_id === e.id))
                ).length}
              </span>
            </h2>
            <button
              type="button"
              onClick={() => setEquipmentModalOpen(true)}
              className="ml-auto flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white active:bg-blue-700"
            >
              <PanelTreeIcon />
              Panel Ekipmanlarını Aç
            </button>
          </div>

          <QuickEquipmentInput panelId={panel.id} onAdded={load} />

          {equipment.length > 0 && (() => {
            // Sadece yük tipleri (Motor, Pompa vs.) veya tipsiz (hızlı ekleme) göster
            const fiders = equipment
              .filter((e) =>
                LOAD_TYPES.has(e.equipment_type ?? "") ||
                (!e.equipment_type && !equipment.some((c) => c.parent_id === e.id))
              )
              .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.created_at.localeCompare(b.created_at));
            if (fiders.length === 0) return null;
            return (
              <ul className="mt-3 overflow-hidden rounded-2xl border-2 border-zinc-200 bg-white divide-y divide-zinc-100">
                {fiders.map((eq) => (
                  <FiderRow key={eq.id} equipment={eq} allEquipment={equipment} onChange={load} />
                ))}
              </ul>
            );
          })()}
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
                <PhotoTile
                  key={ph.id}
                  path={ph.storage_path}
                  title={ph.title}
                  onOpen={() =>
                    setViewer({
                      items: photos.map((p, idx) => ({
                        path: p.storage_path,
                        title: p.title ?? "",
                        fallbackLabel: `${panel.name} — Foto ${idx + 1}`,
                      })),
                      index: i,
                      canDelete: true,
                    })
                  }
                  onDelete={() => handleDeletePhoto(ph.id)}
                />
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
                    className="aspect-[4/3] w-full"
                    fit="contain"
                    thumbWidth={800}
                  />
                  <div className="px-3 py-2 text-xs text-zinc-500">
                    {new Date(d.created_at).toLocaleString("tr-TR")}
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* ── PDF / Belgeler ── */}
        <section>
          <h2 className="mb-3 text-base font-semibold text-zinc-900">
            Belgeler (PDF)
            {documents.length > 0 && (
              <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                {documents.length}
              </span>
            )}
          </h2>
          <PDFUploader ownerColumn="panel_id" ownerId={panel.id} onUploaded={load} />
          <DocumentList documents={documents} onChange={load} />
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
          onDelete={
            viewer.canDelete ? handleDeleteCurrentLightboxPhoto : undefined
          }
          onRename={
            viewer.canDelete ? handleRenameCurrentLightboxPhoto : undefined
          }
        />
      )}

      {equipmentModalOpen && panel && (
        <PanelEquipmentModal
          panel={panel}
          onClose={() => setEquipmentModalOpen(false)}
          onSaved={load}
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

const LOAD_TYPES = new Set([
  "motor", "pompa", "fan", "heater", "ups",
  "alt_pano", "junction_box", "aydinlatma", "diger",
]);

const EQ_TYPE_LABEL: Record<string, string> = {
  motor: "Motor", pompa: "Pompa", fan: "Fan", heater: "Isıtıcı",
  ups: "UPS", alt_pano: "Alt Pano", junction_box: "JB",
  aydinlatma: "Ayd.", diger: "Diğer",
  tms: "TMŞ", mccb: "MCCB", mcb: "MCB", acb: "ACB",
  fuse_switch: "Sig.", ct: "CT", pt: "PT",
  vfd: "VFD", soft_starter: "SS", dol: "DOL",
  star_delta: "Y-Δ", kontaktor: "KNT",
  kablo: "Kablo", guc_kablosu: "Kablo",
  busbar: "BUSBAR",
};

/** Üst zincir elemanları (yük hariç, busbar hariç): TMŞ → CT → VFD */
function getChainLabel(leafId: string, allEq: Equipment[]): string {
  const parts: string[] = [];
  let cur = allEq.find((e) => e.id === leafId);
  while (cur?.parent_id) {
    cur = allEq.find((e) => e.id === cur!.parent_id);
    if (cur && cur.equipment_type !== "busbar") {
      const label = cur.equipment_type ? (EQ_TYPE_LABEL[cur.equipment_type] ?? cur.equipment_type) : cur.name;
      parts.unshift(label);
    }
  }
  return parts.join(" → ");
}

/** Busbar dahil tüm ata zincirini [root → ... → item] sıralamasıyla döner */
function buildAncestorChain(item: Equipment, allEq: Equipment[]): Equipment[] {
  const chain: Equipment[] = [item];
  let cur = item;
  for (let i = 0; i < 20; i++) {
    if (!cur.parent_id) break;
    const parent = allEq.find((e) => e.id === cur.parent_id);
    if (!parent) break;
    chain.unshift(parent);
    cur = parent;
  }
  return chain;
}

// ── Ekipman tipi grupları (zincire ekleme formu için) ──────────────────────────

const ADD_EQ_GROUPS = [
  {
    label: "Koruma Şalterleri",
    color: "blue",
    items: [
      { value: "tms",              label: "TMŞ" },
      { value: "mccb",             label: "MCCB" },
      { value: "mcb",              label: "MCB" },
      { value: "acb",              label: "ACB" },
      { value: "fuse_switch",      label: "Sigorta" },
      { value: "load_break_switch",label: "YGŞ" },
      { value: "mks",              label: "MKŞ" },
    ],
  },
  {
    label: "Sürücüler",
    color: "orange",
    items: [
      { value: "vfd",          label: "VFD" },
      { value: "soft_starter", label: "Soft Starter" },
      { value: "dol",          label: "DOL" },
      { value: "star_delta",   label: "Y-Δ" },
    ],
  },
  {
    label: "Kontrol",
    color: "purple",
    items: [
      { value: "kontaktor",      label: "Kontaktör" },
      { value: "role",           label: "Röle" },
      { value: "koruma_role",    label: "Koruma Rölesi" },
      { value: "yardimci_role",  label: "Yardımcı Röle" },
    ],
  },
  {
    label: "Ölçüm",
    color: "teal",
    items: [
      { value: "ct",               label: "Akım Trafosu (CT)" },
      { value: "pt",               label: "Gerilim Trafosu (PT)" },
      { value: "enerji_analizoru", label: "Enerji Analizörü" },
    ],
  },
  {
    label: "Otomasyon",
    color: "gray",
    items: [
      { value: "plc",       label: "PLC" },
      { value: "io_modulu", label: "I/O Modülü" },
      { value: "timer",     label: "Zamanlayıcı" },
    ],
  },
  {
    label: "Kablo",
    color: "red",
    items: [
      { value: "guc_kablosu",      label: "Güç Kablosu" },
      { value: "kontrol_kablosu",  label: "Kontrol Kablosu" },
    ],
  },
] as const;

const COLOR_MAP: Record<string, string> = {
  blue:   "bg-blue-50 border-blue-200 text-blue-700",
  orange: "bg-orange-50 border-orange-200 text-orange-700",
  purple: "bg-purple-50 border-purple-200 text-purple-700",
  teal:   "bg-teal-50 border-teal-200 text-teal-700",
  gray:   "bg-zinc-50 border-zinc-200 text-zinc-600",
  red:    "bg-red-50 border-red-200 text-red-700",
};

// ── Inline "zincire ekle" formu ────────────────────────────────────────────────

function AddToChainForm({
  feederItem,
  allEquipment,
  onSaved,
  onClose,
}: {
  feederItem: Equipment;
  allEquipment: Equipment[];
  onSaved: () => void;
  onClose: () => void;
}) {
  const chain = buildAncestorChain(feederItem, allEquipment);
  // Varsayılan: yükten hemen önceye ekle (yükün parent'ından sonra)
  const [insertAfterIdx, setInsertAfterIdx] = useState(chain.length - 2); // -1 = en başa
  const [selType, setSelType] = useState<string>("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);

  async function save() {
    if (!selType) { setError("Ekipman tipi seç"); return; }
    if (!name.trim()) { setError("Ekipman adı gir"); return; }
    setBusy(true);
    setError("");

    // insertAfterIdx: chain[insertAfterIdx] den sonrasına ekle
    // -1 ise en başa (parent yok, busbar varsa busbar sonrası mantıklı)
    const parentItem = insertAfterIdx >= 0 ? chain[insertAfterIdx] : null;
    const childItem  = chain[insertAfterIdx + 1]; // bu item'ın parent_id'si değişecek

    const { data: newEq, error: insErr } = await supabase
      .from("equipment")
      .insert({
        panel_id: feederItem.panel_id,
        parent_id: parentItem?.id ?? null,
        name: name.trim(),
        equipment_type: selType,
      })
      .select("id")
      .single();

    if (insErr || !newEq) { setError("Kayıt hatası"); setBusy(false); return; }

    // Eski child'ın parent'ını yeni item'a bağla
    await supabase.from("equipment").update({ parent_id: newEq.id }).eq("id", childItem.id);

    setBusy(false);
    onSaved();
  }

  return (
    <li className="bg-zinc-50 border-t-2 border-dashed border-blue-200 px-4 py-4 space-y-3">
      {/* Zincir + ekleme noktası seçici */}
      <div>
        <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
          Nereye eklensin?
        </p>
        <div className="flex flex-wrap items-center gap-1">
          {chain.map((item, idx) => {
            const isLoad = item.id === feederItem.id;
            const label = item.equipment_type
              ? (EQ_TYPE_LABEL[item.equipment_type] ?? item.equipment_type)
              : item.name;
            const isActive = insertAfterIdx === idx - 1;
            return (
              <span key={item.id} className="flex items-center gap-1">
                {/* Ekleme noktası: item'dan önce */}
                <button
                  type="button"
                  onClick={() => setInsertAfterIdx(idx - 1)}
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-colors ${
                    isActive
                      ? "border-blue-500 bg-blue-500 text-white"
                      : "border-zinc-300 bg-white text-zinc-400 hover:border-blue-400"
                  }`}
                  title={`${item.name} öncesine ekle`}
                >
                  {isActive ? "✓" : "+"}
                </button>
                <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold border ${
                  isLoad
                    ? "bg-green-50 border-green-200 text-green-700"
                    : item.equipment_type === "busbar"
                    ? "bg-zinc-900 text-white border-zinc-900"
                    : "bg-white border-zinc-200 text-zinc-600"
                }`}>
                  {label}
                </span>
              </span>
            );
          })}
          {/* Ekleme noktası: en sona (yükten sonra) */}
          <button
            type="button"
            onClick={() => setInsertAfterIdx(chain.length - 1)}
            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-colors ${
              insertAfterIdx === chain.length - 1
                ? "border-blue-500 bg-blue-500 text-white"
                : "border-zinc-300 bg-white text-zinc-400 hover:border-blue-400"
            }`}
            title="En sona ekle"
          >
            {insertAfterIdx === chain.length - 1 ? "✓" : "+"}
          </button>
        </div>
      </div>

      {/* Tip seçici */}
      <div className="space-y-2">
        <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
          Ekipman tipi
        </p>
        {ADD_EQ_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="text-[10px] font-semibold text-zinc-400 mb-1">{group.label}</p>
            <div className="flex flex-wrap gap-1.5">
              {group.items.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => {
                    setSelType(item.value);
                    setError("");
                    setTimeout(() => nameRef.current?.focus(), 50);
                  }}
                  className={`px-2.5 py-1 rounded-lg border text-xs font-semibold transition-colors ${
                    selType === item.value
                      ? "bg-zinc-900 border-zinc-900 text-white"
                      : `${COLOR_MAP[group.color]} hover:opacity-80`
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* İsim */}
      <input
        ref={nameRef}
        value={name}
        onChange={(e) => { setName(e.target.value); setError(""); }}
        placeholder="Ekipman adı (örn: KNT-101)"
        autoComplete="off"
        className="w-full rounded-xl border-2 border-zinc-200 bg-white px-3 py-2.5 text-base outline-none focus:border-zinc-900"
        onKeyDown={(e) => e.key === "Enter" && save()}
      />

      {error && <p className="text-xs text-red-600 font-medium">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-xl border-2 border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-600 active:bg-zinc-50"
        >
          Vazgeç
        </button>
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="flex-1 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white active:bg-blue-700 disabled:opacity-50"
        >
          {busy ? "Ekleniyor…" : "Zincire Ekle"}
        </button>
      </div>
    </li>
  );
}

/**
 * Fideri ve zincirdeki "artık çocuğu kalmayan" tüm ata ekipmanları siler.
 * Örn: P-101 silinince CT → TMŞ → BUSBAR da silinir (başka çocukları yoksa).
 */
async function cascadeDeleteFider(item: Equipment, allEq: Equipment[]) {
  const now = new Date().toISOString();
  const deletedIds = new Set<string>();

  // 1. Fiderin tüm alt ekipmanlarını topla (normalde yok, yine de güvenli taraf)
  function collectDescendants(id: string) {
    allEq.filter((e) => e.parent_id === id).forEach((child) => {
      deletedIds.add(child.id);
      collectDescendants(child.id);
    });
  }
  deletedIds.add(item.id);
  collectDescendants(item.id);

  // 2. Zinciri yukarı dolaş; başka çocuğu kalmayan her atayı sil
  let cur: Equipment | undefined = item;
  while (cur && cur.parent_id) {
    const parentId: string = cur.parent_id;
    const parent: Equipment | undefined = allEq.find((e) => e.id === parentId);
    if (!parent) break;
    const remainingChildren = allEq.filter(
      (e) => e.parent_id === parentId && !deletedIds.has(e.id),
    );
    if (remainingChildren.length === 0) {
      deletedIds.add(parentId);
      cur = parent;
    } else {
      break;
    }
  }

  // 3. Toplu soft-delete
  await supabase
    .from("equipment")
    .update({ visible: false, deleted_at: now })
    .in("id", [...deletedIds]);
}

function FiderRow({
  equipment: eq,
  allEquipment,
  onChange,
}: {
  equipment: Equipment;
  allEquipment: Equipment[];
  onChange: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const typeLabel = eq.equipment_type ? (EQ_TYPE_LABEL[eq.equipment_type] ?? eq.equipment_type) : null;
  const chain = getChainLabel(eq.id, allEquipment);
  return (
    <>
      <EquipmentRow
        equipment={eq}
        allEquipment={allEquipment}
        onChange={onChange}
        typeShort={typeLabel}
        chainLabel={chain}
        onAdd={() => setAdding((v) => !v)}
        addActive={adding}
      />
      {adding && (
        <AddToChainForm
          feederItem={eq}
          allEquipment={allEquipment}
          onSaved={() => { setAdding(false); onChange(); }}
          onClose={() => setAdding(false)}
        />
      )}
    </>
  );
}

function EquipmentRow({
  equipment,
  allEquipment,
  onChange,
  typeShort,
  chainLabel,
  onAdd,
  addActive,
}: {
  equipment: Equipment;
  allEquipment: Equipment[];
  onChange: () => void;
  typeShort?: string | null;
  chainLabel?: string;
  onAdd?: () => void;
  addActive?: boolean;
}) {
  const confirm = useConfirm();
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
    const chainLabel2 = getChainLabel(equipment.id, allEquipment);
    const chainInfo = chainLabel2 ? ` (${chainLabel2} → ${equipment.name})` : ` "${equipment.name}"`;
    const ok = await confirm({
      title: "Fideri sil",
      message: `${chainInfo} zinciriyle birlikte silinsin mi?`,
      confirmText: "Sil",
      destructive: true,
    });
    if (!ok) return;
    await cascadeDeleteFider(equipment, allEquipment);
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
        <div className="flex items-center gap-2">
          {typeShort && (
            <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-500">
              {typeShort}
            </span>
          )}
          <span className="text-base font-semibold text-zinc-900">{equipment.name}</span>
        </div>
        {chainLabel && (
          <div className="mt-0.5 text-[11px] text-zinc-400 tracking-wide">{chainLabel}</div>
        )}
        {equipment.description && (
          <div className="mt-0.5 text-sm text-zinc-500">{equipment.description}</div>
        )}
      </button>
      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          aria-label="Ekipman ekle"
          title="Zincire ekipman ekle"
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold transition-colors ${
            addActive
              ? "bg-blue-600 text-white"
              : "text-blue-500 active:bg-blue-50"
          }`}
        >
          +
        </button>
      )}
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

function PanelTreeIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="6" height="6" rx="1" />
      <rect x="15" y="3" width="6" height="6" rx="1" />
      <rect x="15" y="15" width="6" height="6" rx="1" />
      <path d="M6 9v3h12V9" />
      <line x1="18" y1="12" x2="18" y2="15" />
    </svg>
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
