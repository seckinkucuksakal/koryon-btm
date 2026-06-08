import ExcelJS from "exceljs";
import { useCallback, useEffect, useRef, useState } from "react";
import { PANEL_TYPE_LABELS, supabase } from "../lib/supabase";
import type { Database, Json } from "../lib/database.types";
import SingleLineDiagram from "./SingleLineDiagram";
import { useConfirm } from "./ConfirmDialog";

type Panel = Database["public"]["Tables"]["panels"]["Row"];
type Eq = Database["public"]["Tables"]["equipment"]["Row"];

// ── Sabitler ──────────────────────────────────────────────────────────────────

const LOAD_TYPES = [
  { v: "motor",      l: "Motor"      },
  { v: "pompa",      l: "Pompa"      },
  { v: "fan",        l: "Fan"        },
  { v: "heater",     l: "Heater"     },
  { v: "ups",        l: "UPS"        },
  { v: "alt_pano",   l: "Alt Pano"   },
  { v: "jb",         l: "JB"         },
  { v: "aydinlatma", l: "Aydınlatma" },
  { v: "diger",      l: "Diğer"      },
];
const PROT_TYPES = [
  { v: "tms",          l: "TMŞ"     },
  { v: "mccb",         l: "MCCB"    },
  { v: "mcb",          l: "MCB"     },
  { v: "fuse_switch",  l: "Sigorta" },
  { v: "acb",          l: "ACB"     },
  { v: "mks",          l: "MKŞ"     },
  { v: "kakr",         l: "KAKR"    },
  { v: "mov",          l: "MOV"     },
  { v: "diger_koruma", l: "Diğer"   },
];
const START_TYPES = [
  { v: "dol",          l: "DOL"       },
  { v: "kontaktor",    l: "Kontaktör" },
  { v: "star_delta",   l: "Y-Δ"       },
  { v: "soft_starter", l: "Soft St."  },
  { v: "vfd",          l: "VFD"       },
];

const TYPE_LABEL: Record<string, string> = {};
[...LOAD_TYPES, ...PROT_TYPES, ...START_TYPES,
  { v: "busbar", l: "BUSBAR" }, { v: "ct", l: "CT" }, { v: "kablo", l: "KABLO" },
].forEach((t) => (TYPE_LABEL[t.v] = t.l));

const DETAIL_FIELDS: Record<string, { key: string; label: string; unit?: string }[]> = {
  motor:      [{ key: "guc", label: "Güç", unit: "kW" }, { key: "gerilim", label: "Gerilim", unit: "V" }, { key: "akım", label: "Akım", unit: "A" }, { key: "cosphi", label: "Cosφ" }],
  pompa:      [{ key: "guc", label: "Güç", unit: "kW" }, { key: "gerilim", label: "Gerilim", unit: "V" }, { key: "akım", label: "Akım", unit: "A" }],
  fan:        [{ key: "guc", label: "Güç", unit: "kW" }, { key: "gerilim", label: "Gerilim", unit: "V" }],
  heater:     [{ key: "guc", label: "Güç", unit: "kW" }, { key: "gerilim", label: "Gerilim", unit: "V" }],
  ups:        [{ key: "guc", label: "Güç", unit: "kVA" }, { key: "marka", label: "Marka" }, { key: "model", label: "Model" }],
  alt_pano:   [{ key: "panel_adi", label: "Panel Adı" }, { key: "besleme_gucu", label: "Besleme Gücü" }],
  jb:         [{ key: "boyut", label: "Boyut (mm)" }, { key: "koruma_sinifi", label: "IP Sınıfı" }],
  aydinlatma: [{ key: "guc", label: "Güç", unit: "W" }, { key: "gerilim", label: "Gerilim", unit: "V" }],
  diger:      [{ key: "aciklama", label: "Açıklama" }],
};

// ── FiderDraft ────────────────────────────────────────────────────────────────

type FiderDraft = {
  loadType: string; loadName: string; loadPower: string;
  busbar: "yes" | "no" | "skip" | null;
  // Birinci koruma elemanı
  protection: string | "none" | "skip" | null;
  protectionName: string;   // "Diğer" seçilince serbest isim
  protectionTag: string;    // TAG / etiket (opsiyonel)
  protectionValue: string;  // akım/değer (opsiyonel)
  // İkinci koruma elemanı
  protection2: string | "none" | "skip" | null;
  protection2Name: string;
  protection2Tag: string;
  protection2Value: string;
  ct: "yes" | "no" | "skip" | null;
  ctRatio: string;
  ctTag: string;
  starter: string | "none" | "skip" | null;
  starterTag: string;
  starterValue: string;
  cable: "yes" | "no" | "skip" | null;
  cableDamar: string; cableKesit: string; cableAciklama: string;
  details: Record<string, string>;
};
const INIT: FiderDraft = {
  loadType: "motor", loadName: "", loadPower: "",
  busbar: null,
  protection: null, protectionName: "", protectionTag: "", protectionValue: "",
  protection2: null, protection2Name: "", protection2Tag: "", protection2Value: "",
  ct: null, ctRatio: "", ctTag: "",
  starter: null, starterTag: "", starterValue: "",
  cable: null, cableDamar: "", cableKesit: "", cableAciklama: "",
  details: {},
};

type ChainNode = { type: string; label: string };

/**
 * Diagram/liste için etiket oluşturur.
 * - TAG varsa: "KF-101 · 630A" veya "KF-101"
 * - Sadece değer varsa: "630A"  (tip zaten üst satırda gösteriliyor)
 * - İkisi de yoksa: typeAbbr (tip kısaltması)
 */
function makeLabel(typeAbbr: string, tag: string, value: string): string {
  const t = tag.trim();
  const v = value.trim();
  if (t) return v ? `${t} · ${v}` : t;
  if (v) return v;
  return typeAbbr;
}

function buildChain(d: FiderDraft): ChainNode[] {
  const n: ChainNode[] = [];
  if (d.busbar === "yes") n.push({ type: "busbar", label: "BUSBAR" });

  if (d.protection && !["none","skip"].includes(d.protection)) {
    const abbr = d.protection === "diger_koruma"
      ? (d.protectionName.trim() || "Diğer")
      : (TYPE_LABEL[d.protection] ?? d.protection);
    n.push({ type: d.protection, label: makeLabel(abbr, d.protectionTag, d.protectionValue) });
  }
  if (d.protection2 && !["none","skip"].includes(d.protection2)) {
    const abbr2 = d.protection2 === "diger_koruma"
      ? (d.protection2Name.trim() || "Diğer")
      : (TYPE_LABEL[d.protection2] ?? d.protection2);
    n.push({ type: d.protection2, label: makeLabel(abbr2, d.protection2Tag, d.protection2Value) });
  }

  if (d.ct === "yes")
    n.push({ type: "ct", label: makeLabel("CT", d.ctTag, d.ctRatio) });

  if (d.starter && !["none","skip"].includes(d.starter))
    n.push({ type: d.starter, label: makeLabel(TYPE_LABEL[d.starter] ?? d.starter, d.starterTag, d.starterValue) });

  if (d.cable === "yes") {
    let cl = "KABLO";
    if (d.cableDamar && d.cableKesit) cl = `${d.cableDamar}x${d.cableKesit}mm²`;
    else if (d.cableAciklama) cl = d.cableAciklama;
    n.push({ type: "kablo", label: cl });
  }
  if (d.loadName) n.push({ type: d.loadType, label: d.loadName + (d.loadPower ? ` · ${d.loadPower}` : "") });
  return n;
}

// ── Excel export ──────────────────────────────────────────────────────────────

const IS_PROT   = new Set(["tms","mccb","mcb","acb","fuse_switch","load_break_switch"]);
const IS_CT     = new Set(["ct","pt"]);
const IS_DRIVE  = new Set(["vfd","soft_starter","dol","star_delta","kontaktor"]);
const IS_CABLE  = new Set(["kablo","guc_kablosu","kontrol_kablosu","fiber_kablo"]);

/** Leaf → full ancestor chain (top → bottom, including leaf itself) */
function buildFullChain(leafId: string, allEq: Eq[]): Eq[] {
  const chain: Eq[] = [];
  let cur = allEq.find((e) => e.id === leafId);
  while (cur) {
    chain.unshift(cur);
    cur = cur.parent_id ? allEq.find((e) => e.id === cur!.parent_id) : undefined;
  }
  return chain;
}

/** Collect all "feeder" chains: leaf items that are not busbar */
function getFeederChains(allEq: Eq[]): Eq[][] {
  const leaves = allEq.filter(
    (e) => !allEq.some((c) => c.parent_id === e.id) && e.equipment_type !== "busbar"
  );
  return leaves.map((leaf) => buildFullChain(leaf.id, allEq));
}

async function downloadExcel(panel: Panel, equipment: Eq[], panelLabel: string) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Koryon BTM";
  const ws = wb.addWorksheet("Fider Listesi");

  // ── Title ──────────────────────────────────────────────────────────────────
  const COLS = 12;
  ws.mergeCells(1, 1, 1, COLS);
  const titleCell = ws.getCell("A1");
  titleCell.value = `${panel.name}  ·  ${panelLabel}  —  Fider Listesi`;
  titleCell.font = { bold: true, size: 13, color: { argb: "FFFFFFFF" } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 28;

  ws.addRow([]); // spacer

  // ── Headers ────────────────────────────────────────────────────────────────
  const headers = [
    "Sıra", "Fider Adı", "Yük Tipi",
    "Bara", "Koruma Elemanı", "CT / PT",
    "Yol Verme", "Kablo",
    "Güç", "Gerilim (V)", "Akım (A)", "Not",
  ];
  const hRow = ws.addRow(headers);
  hRow.height = 22;
  hRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      bottom: { style: "medium", color: { argb: "FF334155" } },
    };
  });

  ws.columns = [
    { width: 6 },  // Sıra
    { width: 14 }, // Fider Adı
    { width: 12 }, // Yük Tipi
    { width: 8 },  // Bara
    { width: 16 }, // Koruma
    { width: 12 }, // CT
    { width: 14 }, // Yol Verme
    { width: 16 }, // Kablo
    { width: 10 }, // Güç
    { width: 10 }, // Gerilim
    { width: 10 }, // Akım
    { width: 20 }, // Not
  ];

  // ── Data rows: one row per feeder ─────────────────────────────────────────
  const chains = getFeederChains(equipment);

  chains.forEach((chain, idx) => {
    const leaf = chain[chain.length - 1];
    const meta =
      leaf.metadata && typeof leaf.metadata === "object" && !Array.isArray(leaf.metadata)
        ? (leaf.metadata as Record<string, unknown>)
        : {};

    const hasBusbar = chain.some((e) => e.equipment_type === "busbar");
    const prot   = chain.find((e) => IS_PROT.has(e.equipment_type ?? ""));
    const ct     = chain.find((e) => IS_CT.has(e.equipment_type ?? ""));
    const drive  = chain.find((e) => IS_DRIVE.has(e.equipment_type ?? ""));
    const cable  = chain.find((e) => IS_CABLE.has(e.equipment_type ?? ""));
    const yukTip = leaf.equipment_type ? (TYPE_LABEL[leaf.equipment_type] ?? leaf.equipment_type) : "";

    const row = ws.addRow([
      idx + 1,
      leaf.name,
      yukTip,
      hasBusbar ? "✓" : "",
      prot  ? prot.name  : "",
      ct    ? ct.name    : "",
      drive ? drive.name : "",
      cable ? cable.name : "",
      String(meta["guc"] ?? ""),
      String(meta["gerilim"] ?? ""),
      String(meta["akım"] ?? ""),
      leaf.description ?? "",
    ]);

    row.height = 20;
    const isEven = idx % 2 === 1;
    row.eachCell((cell, colNum) => {
      if (isEven) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
      }
      cell.alignment = { vertical: "middle", horizontal: colNum === 1 ? "center" : "left" };
      cell.border = {
        top:    { style: "hair", color: { argb: "FFE2E8F0" } },
        bottom: { style: "hair", color: { argb: "FFE2E8F0" } },
        left:   { style: "hair", color: { argb: "FFE2E8F0" } },
        right:  { style: "hair", color: { argb: "FFE2E8F0" } },
      };
    });
    // Bold fider name
    row.getCell(2).font = { bold: true };
  });

  // ── Download ───────────────────────────────────────────────────────────────
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf as BlobPart], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${panel.name.replace(/[^\w\-]/g, "_")}_fider_listesi.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

// ══════════════════════════════════════════════════════════════════════════════
//  MODAL
// ══════════════════════════════════════════════════════════════════════════════

export default function PanelEquipmentModal({
  panel, onClose, onSaved,
}: {
  panel: Panel; onClose: () => void; onSaved: () => void;
}) {
  const [equipment, setEquipment] = useState<Eq[]>([]);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<FiderDraft>(INIT);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [mobileTab, setMobileTab] = useState<"wizard" | "diagram" | "edit">("wizard");
  const [desktopPanel, setDesktopPanel] = useState<"wizard" | "edit">("wizard");

  // ── iOS-safe body scroll lock ──────────────────────────────────────────────
  useEffect(() => {
    const scrollY = window.scrollY;
    const body = document.body;
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";
    return () => {
      body.style.position = "";
      body.style.top = "";
      body.style.width = "";
      body.style.overflow = "";
      window.scrollTo(0, scrollY);
    };
  }, []);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("equipment").select("*")
      .eq("panel_id", panel.id).eq("visible", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    setEquipment(data ?? []);
  }, [panel.id]);
  useEffect(() => { load(); }, [load]);

  function upd(partial: Partial<FiderDraft>) {
    setDraft((d) => ({ ...d, ...partial }));
  }

  async function saveFider() {
    const chain = buildChain(draft);
    if (!chain.length) return;
    setSaving(true);
    const rootCount = equipment.filter((e) => !e.parent_id).length;
    let prevId: string | null = null;
    let ord = rootCount;
    for (let i = 0; i < chain.length; i++) {
      const n = chain[i];
      const isLoad = i === chain.length - 1;
      const meta: Record<string, string> = {};
      if (isLoad) {
        (DETAIL_FIELDS[draft.loadType] ?? []).forEach((f) => {
          if (draft.details[f.key]) meta[f.key] = draft.details[f.key];
        });
      }
      const { data }: { data: { id: string } | null } = await supabase
        .from("equipment")
        .insert({
          panel_id: panel.id,
          name: n.label,
          equipment_type: n.type,
          parent_id: prevId,
          sort_order: ord++,
          metadata: meta as Json,
        })
        .select("id")
        .single();
      if (data) prevId = data.id;
    }
    setSaving(false);
    await load();
    setStep(8);
  }

  async function handleExport() {
    setExporting(true);
    const panelLabel =
      PANEL_TYPE_LABELS[panel.panel_type as keyof typeof PANEL_TYPE_LABELS] ?? panel.panel_type;
    await downloadExcel(panel, equipment, panelLabel);
    setExporting(false);
  }

  function resetWizard() { setDraft(INIT); setStep(0); }
  function handleClose() { onSaved(); onClose(); }

  const panelLabel =
    PANEL_TYPE_LABELS[panel.panel_type as keyof typeof PANEL_TYPE_LABELS] ?? panel.panel_type;

  return (
    // touch-action:none → mobilde kaydırma olayları modal'dan dışarı sızmaz
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "#f1f5f9", touchAction: "none" }}
      onTouchMove={(e) => e.stopPropagation()}
    >
      {/* ── Header ── */}
      <header className="shrink-0 flex items-center gap-3 bg-zinc-900 px-4 py-3">
        {/* Download button — left */}
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting || equipment.length === 0}
          title="Excel olarak indir"
          className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white active:bg-emerald-700 disabled:opacity-40"
        >
          {exporting ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            <DownloadIcon />
          )}
          <span className="hidden sm:inline">İndir</span>
        </button>

        {/* Panel info */}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{panelLabel}</p>
          <h1 className="truncate text-base font-bold text-white leading-tight">{panel.name}</h1>
        </div>

        {/* Close */}
        <button
          type="button"
          onClick={handleClose}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-700 text-white active:bg-zinc-600"
        >
          <XIcon />
        </button>
      </header>

      {/* ── Mobil tab bar (md'de gizli) ── */}
      <div className="md:hidden shrink-0 flex border-b border-zinc-200 bg-white">
        {(["wizard", "diagram", "edit"] as const).map((tab) => {
          const labels = { wizard: "Yeni Fider", diagram: "Tek Hat", edit: "Düzenle" };
          const active = mobileTab === tab;
          const count = tab === "edit"
            ? equipment.filter((e) => LOAD_TYPES.some((l) => l.v === e.equipment_type)).length
            : null;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setMobileTab(tab)}
              className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${
                active ? "border-b-2 border-zinc-900 text-zinc-900" : "text-zinc-400"
              }`}
            >
              {labels[tab]}
              {count !== null && count > 0 && (
                <span className="ml-1 rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Body ── */}
      <div
        className="flex flex-1 overflow-hidden"
        style={{ maxWidth: 1400, margin: "0 auto", width: "100%" }}
      >
        {/* Left: single-line diagram — desktop her zaman, mobilde "Tek Hat" tabı seçiliyse */}
        <div
          className={`flex flex-col border-r border-zinc-200 bg-white overflow-hidden
            ${mobileTab === "diagram" ? "flex w-full" : "hidden"}
            md:flex md:w-[55%]`}
        >
          <div className="shrink-0 px-4 py-2 border-b border-zinc-100 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Tek Hat Diyagramı</p>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
              {equipment.filter((e) => !e.parent_id).length} fider
            </span>
          </div>
          <div className="flex-1 overflow-hidden">
            <SingleLineDiagram equipment={equipment} panelName={panel.name} />
          </div>
        </div>

        {/* ── Right panel ── */}
        <div
          className={[
            "flex-col overflow-hidden bg-white",
            // Mobile: görünür olduğu tab'lar
            (mobileTab === "wizard" || mobileTab === "edit") ? "flex w-full" : "hidden",
            // Desktop: her zaman flex (içerik kendi toggle'ıyla yönetilir)
            "md:flex md:flex-1",
          ].join(" ")}
        >
          {/* Tab bar — masaüstü */}
          <div className="hidden md:flex shrink-0 border-b border-zinc-200 bg-white">
            {(["wizard", "edit"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setDesktopPanel(p)}
                className={`px-5 py-2.5 text-sm font-semibold transition-colors ${
                  desktopPanel === p
                    ? "border-b-2 border-zinc-900 text-zinc-900"
                    : "text-zinc-400 hover:text-zinc-700"
                }`}
              >
                {p === "wizard" ? "Yeni Fider" : "Ekipmanları Düzenle"}
              </button>
            ))}
          </div>

          {/* ── Wizard ─────────────────────────────────────────────────────── */}
          <div
            className={[
              "flex-col overflow-hidden flex-1",
              // Mobil: sadece wizard tab'ında göster
              mobileTab === "wizard" ? "flex" : "hidden",
              // Masaüstü: sadece wizard panel'inde göster
              desktopPanel === "wizard" ? "md:flex" : "md:hidden",
            ].join(" ")}
          >
            <WizardArea
              step={step}
              draft={draft}
              upd={upd}
              onNext={() => setStep((s) => s + 1)}
              onBack={() => setStep((s) => Math.max(0, s - 1))}
              onSave={saveFider}
              onNewFider={resetWizard}
              onClose={handleClose}
              saving={saving}
              preview={buildChain(draft)}
            />
          </div>

          {/* ── Düzenle ────────────────────────────────────────────────────── */}
          <div
            className={[
              "flex-col overflow-hidden flex-1",
              // Mobil: sadece edit tab'ında göster
              mobileTab === "edit" ? "flex" : "hidden",
              // Masaüstü: sadece edit panel'inde göster
              desktopPanel === "edit" ? "md:flex" : "md:hidden",
            ].join(" ")}
          >
            <FiderEditPanel equipment={equipment} onChange={load} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  WIZARD ALANI
// ══════════════════════════════════════════════════════════════════════════════

const STEP_LABELS = [
  "Yük Bilgisi",    // 0
  "Bara",           // 1
  "1. Koruma",      // 2
  "2. Koruma",      // 3 ← yeni
  "Akım Trafosu",   // 4
  "Yol Verme",      // 5
  "Çıkış Kablosu",  // 6
  "Yük Detayları",  // 7
  "Tamamlandı",     // 8
];

type WP = {
  step: number; draft: FiderDraft; upd: (p: Partial<FiderDraft>) => void;
  onNext: () => void; onBack: () => void; onSave: () => void;
  onNewFider: () => void; onClose: () => void;
  saving: boolean; preview: ChainNode[];
};

function WizardArea(props: WP) {
  const { step, onBack, onClose } = props;
  const scrollRef = useRef<HTMLDivElement>(null);

  // Her adım değişiminde scroll pozisyonunu sıfırla —
  // bunu yapmadan hit-test kayar ve yanlış elemanlara tıklanır.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = 0;
  }, [step]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {step < 8 && (
        <div className="shrink-0 border-b border-zinc-200 bg-white px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={step === 0 ? onClose : onBack}
              className="flex items-center gap-1 text-sm font-semibold text-zinc-500 active:text-zinc-800"
            >
              <ChevronLeft /> {step === 0 ? "Kapat" : "Geri"}
            </button>
            <span className="text-xs font-semibold text-zinc-400">
              {step + 1} / 8 · {STEP_LABELS[step]}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
            <div
              className="h-full rounded-full bg-zinc-900 transition-all duration-300"
              style={{ width: `${((step + 1) / 8) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Tek ve tek scroll container — ref ile sıfırlama yapılır */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overscroll-contain px-5 py-6"
        style={{ WebkitOverflowScrolling: "touch" } as React.CSSProperties}
      >
        <div className="mx-auto max-w-sm">
          {step === 0 && <S0 {...props} />}   {/* Yük Bilgisi   */}
          {step === 1 && <S1 {...props} />}   {/* Bara           */}
          {step === 2 && <S2 {...props} />}   {/* 1. Koruma      */}
          {step === 3 && <S3 {...props} />}   {/* 2. Koruma      */}
          {step === 4 && <S4 {...props} />}   {/* CT             */}
          {step === 5 && <S5 {...props} />}   {/* Yol Verme      */}
          {step === 6 && <S6 {...props} />}   {/* Kablo          */}
          {step === 7 && <S7 {...props} />}   {/* Yük Detayları  */}
          {step === 8 && <S8 {...props} />}   {/* Tamamlandı     */}
        </div>
      </div>
    </div>
  );
}

// ── Shared UI ─────────────────────────────────────────────────────────────────

function Q({ children }: { children: React.ReactNode }) {
  return <p className="mb-5 text-xl font-bold text-zinc-900 leading-snug">{children}</p>;
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}

function Btn({
  active, onClick, children, muted,
}: {
  active?: boolean; onClick: () => void; children: React.ReactNode; muted?: boolean;
}) {
  return (
    <button type="button" onClick={onClick}
      className={`flex min-h-[54px] w-full items-center justify-center rounded-2xl border-2 px-3 text-sm font-bold transition active:scale-[0.98]
        ${active ? "border-zinc-900 bg-zinc-900 text-white"
          : muted ? "border-zinc-200 bg-white text-zinc-400 active:bg-zinc-50"
          : "border-zinc-200 bg-white text-zinc-800 active:bg-zinc-50"}`}>
      {children}
    </button>
  );
}

function NextBtn({ onClick, label = "İleri →", disabled }: { onClick: () => void; label?: string; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="mt-6 w-full rounded-2xl bg-zinc-900 py-5 text-base font-bold text-white active:bg-zinc-800 disabled:opacity-40">
      {label}
    </button>
  );
}

function SkipBtn({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="mt-3 w-full py-3 text-sm font-semibold text-zinc-400 active:text-zinc-600">
      Bilmiyorum / Sonra Dolduracağım
    </button>
  );
}

function TagInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-zinc-500">
        TAG / Etiket <span className="font-normal text-zinc-400">(opsiyonel · örn. KF-101)</span>
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="KF-101"
        autoCapitalize="characters"
        autoComplete="off"
        className="w-full rounded-2xl border-2 border-zinc-200 bg-white px-4 py-3 text-base font-bold outline-none focus:border-zinc-900 tracking-wider"
      />
    </div>
  );
}

// ── S0: Yük Bilgisi ───────────────────────────────────────────────────────────

function S0({ draft, upd, onNext }: WP) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div>
      <Q>Bu fider hangi yükü besliyor?</Q>
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-400">Yük Tipi</p>
      <div className="mb-5 flex flex-wrap gap-2">
        {LOAD_TYPES.map((t) => (
          <button key={t.v} type="button" onClick={() => upd({ loadType: t.v })}
            className={`rounded-xl px-4 py-2.5 text-sm font-bold transition
              ${draft.loadType === t.v ? "bg-zinc-900 text-white" : "border-2 border-zinc-200 bg-white text-zinc-700 active:bg-zinc-50"}`}>
            {t.l}
          </button>
        ))}
      </div>
      <div className="mb-4">
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-zinc-500">
          Fider / Yük Adı <span className="text-rose-500">*</span>
        </label>
        <input ref={ref} value={draft.loadName}
          onChange={(e) => upd({ loadName: e.target.value })}
          onKeyDown={(e) => { if (e.key === "Enter" && draft.loadName.trim()) onNext(); }}
          placeholder="Örn. P-101, FAN-201, G-101"
          autoCapitalize="characters" autoComplete="off"
          className="w-full rounded-2xl border-2 border-zinc-200 bg-white px-4 py-4 text-lg font-bold outline-none focus:border-zinc-900" />
      </div>
      <div className="mb-6">
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-zinc-500">
          Güç <span className="font-normal text-zinc-400">(opsiyonel · kW / W)</span>
        </label>
        <input value={draft.loadPower}
          onChange={(e) => upd({ loadPower: e.target.value })}
          onKeyDown={(e) => { if (e.key === "Enter" && draft.loadName.trim()) onNext(); }}
          placeholder="Örn. 75 kW"
          autoComplete="off"
          className="w-full rounded-2xl border-2 border-zinc-200 bg-white px-4 py-3.5 text-base outline-none focus:border-zinc-900" />
      </div>
      <NextBtn onClick={onNext} disabled={!draft.loadName.trim()} />
    </div>
  );
}

// ── S1: Bara ──────────────────────────────────────────────────────────────────

function S1({ draft, upd, onNext }: WP) {
  function pick(v: FiderDraft["busbar"]) { upd({ busbar: v }); setTimeout(onNext, 160); }
  return (
    <div>
      <Q>Yük bara üzerinden mi besleniyor?</Q>
      <Grid>
        <Btn active={draft.busbar === "yes"} onClick={() => pick("yes")}>✔ Evet</Btn>
        <Btn active={draft.busbar === "no"} onClick={() => pick("no")}>✘ Hayır</Btn>
        <Btn active={draft.busbar === "skip"} onClick={() => pick("skip")} muted>Bilmiyorum</Btn>
        <div />
      </Grid>
    </div>
  );
}

// ── S2: 1. Koruma ─────────────────────────────────────────────────────────────

function S2({ draft, upd, onNext }: WP) {
  const sel = draft.protection;
  const hasProt = sel && !["none","skip"].includes(sel);
  const isDiger = sel === "diger_koruma";
  return (
    <div>
      <Q>Koruma elemanı var mı?</Q>
      <Grid>
        {PROT_TYPES.map((t) => (
          <Btn key={t.v} active={sel === t.v} onClick={() => upd({ protection: t.v })}>{t.l}</Btn>
        ))}
        <Btn active={sel === "none"} muted onClick={() => { upd({ protection: "none", protection2: null }); setTimeout(onNext, 160); }}>Yok</Btn>
        <Btn active={sel === "skip"} muted onClick={() => { upd({ protection: "skip", protection2: null }); setTimeout(onNext, 160); }}>Bilmiyorum</Btn>
      </Grid>

      {hasProt && (
        <div className="mt-4 space-y-3">
          {isDiger && (
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-zinc-500">
                Ekipman Adı <span className="text-rose-500">*</span>
              </label>
              <input autoFocus value={draft.protectionName}
                onChange={(e) => upd({ protectionName: e.target.value })}
                placeholder="Örn. KAKR, RCD, SPD…"
                autoComplete="off"
                className="w-full rounded-2xl border-2 border-zinc-200 bg-white px-4 py-3.5 text-base outline-none focus:border-zinc-900" />
            </div>
          )}
          <TagInput value={draft.protectionTag} onChange={(v) => upd({ protectionTag: v })} />
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-zinc-500">
              Değer / Akım <span className="font-normal text-zinc-400">(opsiyonel)</span>
            </label>
            <input value={draft.protectionValue}
              autoFocus={!isDiger}
              onChange={(e) => upd({ protectionValue: e.target.value })}
              placeholder="Örn. 630A, 3x25A"
              autoComplete="off"
              className="w-full rounded-2xl border-2 border-zinc-200 bg-white px-4 py-3.5 text-base outline-none focus:border-zinc-900" />
          </div>
          <NextBtn onClick={onNext} disabled={isDiger && !draft.protectionName.trim()} />
        </div>
      )}
      {!hasProt && <SkipBtn onClick={() => { upd({ protection: "skip" }); onNext(); }} />}
    </div>
  );
}

// ── S3: 2. Koruma elemanı ─────────────────────────────────────────────────────

function S3({ draft, upd, onNext }: WP) {
  const sel = draft.protection2;
  const hasProt2 = sel && !["none","skip"].includes(sel);
  const isDiger = sel === "diger_koruma";
  return (
    <div>
      <Q>İkinci bir koruma elemanı var mı?</Q>
      <p className="mb-4 text-sm text-zinc-500">
        (Örn. KAKR → Sigorta zinciri, ya da MOV / SPD sonrasında başka bir koruma)
      </p>
      <Grid>
        {PROT_TYPES.map((t) => (
          <Btn key={t.v} active={sel === t.v} onClick={() => upd({ protection2: t.v })}>{t.l}</Btn>
        ))}
        <Btn active={sel === "none"} muted onClick={() => { upd({ protection2: "none" }); setTimeout(onNext, 160); }}>Yok</Btn>
        <Btn active={sel === "skip"} muted onClick={() => { upd({ protection2: "skip" }); setTimeout(onNext, 160); }}>Bilmiyorum</Btn>
      </Grid>

      {hasProt2 && (
        <div className="mt-4 space-y-3">
          {isDiger && (
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-zinc-500">
                Ekipman Adı <span className="text-rose-500">*</span>
              </label>
              <input autoFocus value={draft.protection2Name}
                onChange={(e) => upd({ protection2Name: e.target.value })}
                placeholder="Örn. KAKR, RCD, SPD…"
                autoComplete="off"
                className="w-full rounded-2xl border-2 border-zinc-200 bg-white px-4 py-3.5 text-base outline-none focus:border-zinc-900" />
            </div>
          )}
          <TagInput value={draft.protection2Tag} onChange={(v) => upd({ protection2Tag: v })} />
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-zinc-500">
              Değer / Akım <span className="font-normal text-zinc-400">(opsiyonel)</span>
            </label>
            <input value={draft.protection2Value}
              autoFocus={!isDiger}
              onChange={(e) => upd({ protection2Value: e.target.value })}
              placeholder="Örn. 30mA, 100A"
              autoComplete="off"
              className="w-full rounded-2xl border-2 border-zinc-200 bg-white px-4 py-3.5 text-base outline-none focus:border-zinc-900" />
          </div>
          <NextBtn onClick={onNext} disabled={isDiger && !draft.protection2Name.trim()} />
        </div>
      )}
      {!hasProt2 && <SkipBtn onClick={() => { upd({ protection2: "skip" }); onNext(); }} />}
    </div>
  );
}

// ── S4: CT ────────────────────────────────────────────────────────────────────

function S4({ draft, upd, onNext }: WP) {
  function pick(v: FiderDraft["ct"]) { upd({ ct: v }); if (v !== "yes") setTimeout(onNext, 160); }
  return (
    <div>
      <Q>Akım trafosu (CT) mevcut mu?</Q>
      <Grid>
        <Btn active={draft.ct === "yes"} onClick={() => pick("yes")}>✔ Evet</Btn>
        <Btn active={draft.ct === "no"} onClick={() => pick("no")}>✘ Hayır</Btn>
        <Btn active={draft.ct === "skip"} muted onClick={() => pick("skip")}>Bilmiyorum</Btn>
        <div />
      </Grid>
      {draft.ct === "yes" && (
        <div className="mt-4 space-y-3">
          <TagInput value={draft.ctTag} onChange={(v) => upd({ ctTag: v })} />
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-zinc-500">
              CT Oranı <span className="font-normal text-zinc-400">(opsiyonel)</span>
            </label>
            <input autoFocus value={draft.ctRatio}
              onChange={(e) => upd({ ctRatio: e.target.value })}
              placeholder="Örn. 600/5"
              autoComplete="off"
              className="w-full rounded-2xl border-2 border-zinc-200 bg-white px-4 py-3.5 text-base outline-none focus:border-zinc-900" />
          </div>
          <NextBtn onClick={onNext} />
        </div>
      )}
    </div>
  );
}

// ── S5: Yol Verme ─────────────────────────────────────────────────────────────

function S5({ draft, upd, onNext }: WP) {
  const hasStart = draft.starter && !["none","skip"].includes(draft.starter);
  return (
    <div>
      <Q>Yol verme ekipmanı var mı?</Q>
      <Grid>
        {START_TYPES.map((t) => (
          <Btn key={t.v} active={draft.starter === t.v} onClick={() => upd({ starter: t.v })}>{t.l}</Btn>
        ))}
        <Btn active={draft.starter === "none"} muted onClick={() => { upd({ starter: "none" }); setTimeout(onNext, 160); }}>Yok</Btn>
        <Btn active={draft.starter === "skip"} muted onClick={() => { upd({ starter: "skip" }); setTimeout(onNext, 160); }}>Bilmiyorum</Btn>
      </Grid>
      {hasStart && (
        <div className="mt-4 space-y-3">
          <TagInput value={draft.starterTag} onChange={(v) => upd({ starterTag: v })} />
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-zinc-500">
              Değer / Kapasite <span className="font-normal text-zinc-400">(opsiyonel)</span>
            </label>
            <input autoFocus value={draft.starterValue}
              onChange={(e) => upd({ starterValue: e.target.value })}
              placeholder="Örn. 55kW, 110A"
              autoComplete="off"
              className="w-full rounded-2xl border-2 border-zinc-200 bg-white px-4 py-3.5 text-base outline-none focus:border-zinc-900" />
          </div>
          <NextBtn onClick={onNext} />
        </div>
      )}
      {!hasStart && <SkipBtn onClick={() => { upd({ starter: "skip" }); onNext(); }} />}
    </div>
  );
}

// ── S6: Kablo ─────────────────────────────────────────────────────────────────

function S6({ draft, upd, onNext }: WP) {
  function pick(v: FiderDraft["cable"]) { upd({ cable: v }); if (v !== "yes") setTimeout(onNext, 160); }
  return (
    <div>
      <Q>Çıkış kablosu bilgisi mevcut mu?</Q>
      <Grid>
        <Btn active={draft.cable === "yes"} onClick={() => pick("yes")}>✔ Evet</Btn>
        <Btn active={draft.cable === "no"} onClick={() => pick("no")}>✘ Hayır</Btn>
        <Btn active={draft.cable === "skip"} muted onClick={() => pick("skip")}>Bilmiyorum</Btn>
        <div />
      </Grid>
      {draft.cable === "yes" && (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-zinc-500">Damar Sayısı</label>
              <input autoFocus value={draft.cableDamar} onChange={(e) => upd({ cableDamar: e.target.value })}
                placeholder="3" autoComplete="off"
                className="w-full rounded-2xl border-2 border-zinc-200 bg-white px-4 py-3.5 text-base outline-none focus:border-zinc-900" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-zinc-500">Kesit (mm²)</label>
              <input value={draft.cableKesit} onChange={(e) => upd({ cableKesit: e.target.value })}
                placeholder="240+120" autoComplete="off"
                className="w-full rounded-2xl border-2 border-zinc-200 bg-white px-4 py-3.5 text-base outline-none focus:border-zinc-900" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-zinc-500">Açıklama</label>
            <input value={draft.cableAciklama} onChange={(e) => upd({ cableAciklama: e.target.value })}
              placeholder="Opsiyonel" autoComplete="off"
              className="w-full rounded-2xl border-2 border-zinc-200 bg-white px-4 py-3.5 text-base outline-none focus:border-zinc-900" />
          </div>
          <NextBtn onClick={onNext} />
        </div>
      )}
    </div>
  );
}

// ── S7: Yük Detayları ─────────────────────────────────────────────────────────

function S7({ draft, upd, onSave, saving }: WP) {
  const fields = DETAIL_FIELDS[draft.loadType] ?? [];
  return (
    <div>
      <Q>
        <span className="block text-base font-semibold text-zinc-400 mb-1">Son adım — opsiyonel</span>
        {draft.loadName} detayları
      </Q>
      {fields.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-6">
          {fields.map((f) => (
            <div key={f.key}>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-zinc-500">
                {f.label}{f.unit ? ` (${f.unit})` : ""}
              </label>
              <input value={draft.details[f.key] ?? ""}
                onChange={(e) => upd({ details: { ...draft.details, [f.key]: e.target.value } })}
                placeholder="—" autoComplete="off"
                className="w-full rounded-2xl border-2 border-zinc-200 bg-white px-4 py-3.5 text-base outline-none focus:border-zinc-900" />
            </div>
          ))}
        </div>
      )}
      <p className="mb-3 text-center text-xs text-zinc-400">Tüm alanlar opsiyonel. Boş bırakabilirsin.</p>
      <button type="button" onClick={onSave} disabled={saving}
        className="w-full rounded-2xl bg-zinc-900 py-5 text-base font-bold text-white active:bg-zinc-800 disabled:opacity-50">
        {saving ? "Kaydediliyor…" : "✓ Fideri Oluştur"}
      </button>
    </div>
  );
}

// ── S8: Tamamlandı ────────────────────────────────────────────────────────────

function S8({ draft, onNewFider, onClose }: WP) {
  const chain = buildChain(draft);
  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-4xl">✓</div>
      <h2 className="mb-1 text-2xl font-bold text-zinc-900">{draft.loadName}</h2>
      <p className="mb-6 text-sm text-zinc-500">Fider başarıyla oluşturuldu</p>
      <div className="mb-8 w-full rounded-2xl border-2 border-zinc-200 bg-white p-4 text-left font-mono text-sm">
        {chain.map((n, i) => (
          <div key={i} style={{ paddingLeft: i * 14 }} className="flex items-center gap-1">
            {i > 0 && <span className="text-zinc-300 text-xs">└─</span>}
            <span className={i === chain.length - 1 ? "font-bold text-emerald-700" : "text-zinc-700"}>{n.label}</span>
          </div>
        ))}
      </div>
      <div className="flex w-full flex-col gap-3">
        <button type="button" onClick={onNewFider}
          className="w-full rounded-2xl border-2 border-zinc-900 py-4 text-base font-bold text-zinc-900 active:bg-zinc-50">
          + Yeni Fider Ekle
        </button>
        <button type="button" onClick={onClose}
          className="w-full rounded-2xl bg-zinc-100 py-4 text-base font-semibold text-zinc-600 active:bg-zinc-200">
          Kapat
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  FİDER DÜZENLEME PANELİ
// ══════════════════════════════════════════════════════════════════════════════

const ALL_EQ_LABELS: Record<string, string> = {
  busbar: "BUSBAR",
  tms: "TMŞ", mccb: "MCCB", mcb: "MCB", acb: "ACB", fuse_switch: "Sigorta", mks: "MKŞ",
  ct: "CT", pt: "PT",
  vfd: "VFD", soft_starter: "Soft St.", dol: "DOL", star_delta: "Y-Δ", kontaktor: "Kontaktör",
  kablo: "Kablo", guc_kablosu: "Kablo", kontrol_kablosu: "Kab.", fiber_kablo: "Fiber",
  motor: "Motor", pompa: "Pompa", fan: "Fan", heater: "Isıtıcı",
  ups: "UPS", alt_pano: "Alt Pano", jb: "JB", aydinlatma: "Ayd.", diger: "Diğer",
};

const LOAD_TYPE_SET = new Set([
  "motor","pompa","fan","heater","ups","alt_pano","jb","aydinlatma","diger",
]);

/** Bir fider'ın tüm zincirini döndürür: kök → yaprak */
function buildFiderChain(leafId: string, allEq: Eq[]): Eq[] {
  const chain: Eq[] = [];
  let cur: Eq | undefined = allEq.find((e) => e.id === leafId);
  while (cur) {
    chain.unshift(cur);
    cur = cur.parent_id ? allEq.find((e) => e.id === cur!.parent_id) : undefined;
  }
  // busbar'ı gizle
  return chain.filter((e) => e.equipment_type !== "busbar");
}

function FiderEditPanel({ equipment, onChange }: { equipment: Eq[]; onChange: () => void }) {
  // Yaprak yük öğeleri = fiderler
  const fiders = equipment.filter(
    (e) =>
      LOAD_TYPE_SET.has(e.equipment_type ?? "") ||
      (!e.equipment_type && !equipment.some((c) => c.parent_id === e.id)),
  );

  if (fiders.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-zinc-400">
        Henüz ekipman yok. "Yeni Fider" sekmesinden fider ekleyin.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-4">
      <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">
        {fiders.length} fider — her öğeye dokunarak düzenle
      </p>
      {fiders.map((fider) => (
        <FiderCard
          key={fider.id}
          fider={fider}
          allEquipment={equipment}
          onChange={onChange}
        />
      ))}
    </div>
  );
}

/** Bir fiderin tüm zincirini kart içinde gösterir; her öğe düzenlenebilir */
function FiderCard({
  fider,
  allEquipment,
  onChange,
}: {
  fider: Eq;
  allEquipment: Eq[];
  onChange: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const confirm = useConfirm();
  const chain = buildFiderChain(fider.id, allEquipment);

  async function deleteFider() {
    const ok = await confirm({
      title: "Fideri sil",
      message: `"${fider.name}" ve tüm zinciri silinsin mi?`,
      confirmText: "Sil",
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    const deletedIds = new Set<string>([fider.id]);
    let cur: Eq | undefined = fider;
    while (cur && cur.parent_id) {
      const parentId: string = cur.parent_id;
      const parent: Eq | undefined = allEquipment.find((e) => e.id === parentId);
      if (!parent) break;
      const remaining = allEquipment.filter(
        (e) => e.parent_id === parentId && !deletedIds.has(e.id),
      );
      if (remaining.length === 0) { deletedIds.add(parentId); cur = parent; }
      else break;
    }
    await supabase
      .from("equipment")
      .update({ visible: false, deleted_at: new Date().toISOString() })
      .in("id", [...deletedIds]);
    setBusy(false);
    onChange();
  }

  return (
    <div className="overflow-hidden rounded-2xl border-2 border-zinc-200 bg-white">
      {/* Kart başlık — fider adı + sil butonu */}
      <div className="flex items-center gap-2 border-b border-zinc-100 bg-zinc-50 px-4 py-2.5">
        <span className="min-w-0 flex-1 truncate text-xs font-bold uppercase tracking-wider text-zinc-500">
          {fider.name}
        </span>
        <button
          type="button"
          onClick={deleteFider}
          disabled={busy}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 active:bg-zinc-200 active:text-rose-600 disabled:opacity-40"
          aria-label="Fideri sil"
        >
          <TrashMiniIcon />
        </button>
      </div>

      {/* Zincir öğeleri */}
      <div className="divide-y divide-zinc-100">
        {chain.map((eq, idx) => (
          <EqEditRow
            key={eq.id}
            eq={eq}
            isLoad={idx === chain.length - 1}
            onChange={onChange}
          />
        ))}
      </div>
    </div>
  );
}

// Kategoriye göre tip seçenekleri
const TYPE_OPTIONS_BY_CATEGORY: Record<string, { v: string; l: string }[]> = {
  protection: [
    { v: "tms", l: "TMŞ" }, { v: "mccb", l: "MCCB" }, { v: "mcb", l: "MCB" },
    { v: "mks", l: "MKŞ" }, { v: "acb", l: "ACB" }, { v: "fuse_switch", l: "Sigorta" },
  ],
  measurement: [
    { v: "ct", l: "CT" }, { v: "pt", l: "PT" },
  ],
  starter: [
    { v: "dol", l: "DOL" }, { v: "kontaktor", l: "Kontaktör" },
    { v: "star_delta", l: "Y-Δ" }, { v: "soft_starter", l: "Soft St." }, { v: "vfd", l: "VFD" },
  ],
  cable: [
    { v: "kablo", l: "Kablo" }, { v: "guc_kablosu", l: "Güç Kab." },
    { v: "kontrol_kablosu", l: "Kont. Kab." },
  ],
  load: [
    { v: "motor", l: "Motor" }, { v: "pompa", l: "Pompa" }, { v: "fan", l: "Fan" },
    { v: "heater", l: "Isıtıcı" }, { v: "ups", l: "UPS" }, { v: "alt_pano", l: "Alt Pano" },
    { v: "jb", l: "JB" }, { v: "aydinlatma", l: "Ayd." }, { v: "diger", l: "Diğer" },
  ],
};

function getCategoryForType(t: string | null): string {
  if (!t) return "load";
  if (["tms","mccb","mcb","mks","acb","fuse_switch"].includes(t)) return "protection";
  if (["ct","pt"].includes(t)) return "measurement";
  if (["dol","kontaktor","star_delta","soft_starter","vfd"].includes(t)) return "starter";
  if (["kablo","guc_kablosu","kontrol_kablosu"].includes(t)) return "cable";
  return "load";
}

/** Tek bir ekipman öğesi — isim + tip değiştirme desteği */
function EqEditRow({
  eq,
  isLoad,
  onChange,
}: {
  eq: Eq;
  isLoad: boolean;
  onChange: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(eq.name);
  const [eqType, setEqType] = useState(eq.equipment_type ?? "");
  const [busy, setBusy] = useState(false);

  const label = eq.equipment_type ? (ALL_EQ_LABELS[eq.equipment_type] ?? eq.equipment_type) : "?";
  const category = getCategoryForType(eq.equipment_type);
  const typeOptions = TYPE_OPTIONS_BY_CATEGORY[category] ?? [];

  function cancelEdit() {
    setEditing(false);
    setName(eq.name);
    setEqType(eq.equipment_type ?? "");
  }

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    await supabase.from("equipment").update({
      name: trimmed,
      equipment_type: eqType || null,
    }).eq("id", eq.id);
    setBusy(false);
    setEditing(false);
    onChange();
  }

  if (editing) {
    return (
      <div className="px-4 py-3 space-y-3 bg-zinc-50">
        {/* Tip seçimi */}
        {typeOptions.length > 0 && (
          <div>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">Tip</p>
            <div className="flex flex-wrap gap-1.5">
              {typeOptions.map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setEqType(opt.v)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                    eqType === opt.v
                      ? "bg-zinc-900 text-white"
                      : "bg-white border border-zinc-200 text-zinc-600 active:bg-zinc-100"
                  }`}
                >
                  {opt.l}
                </button>
              ))}
            </div>
          </div>
        )}
        {/* İsim */}
        <div>
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">Ad / Değer</p>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") cancelEdit(); }}
            className="w-full rounded-xl border-2 border-zinc-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-zinc-900"
            autoComplete="off"
          />
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={cancelEdit}
            className="flex-1 rounded-xl border-2 border-zinc-200 py-2.5 text-sm font-semibold text-zinc-600 active:bg-zinc-100">
            Vazgeç
          </button>
          <button type="button" onClick={save} disabled={busy || !name.trim()}
            className="flex-1 rounded-xl bg-zinc-900 py-2.5 text-sm font-bold text-white active:bg-zinc-800 disabled:opacity-50">
            {busy ? "…" : "Kaydet"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-zinc-50"
    >
      <span className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold uppercase ${
        isLoad ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-500"
      }`}>
        {label}
      </span>
      <span className={`min-w-0 flex-1 truncate text-sm font-semibold ${isLoad ? "text-emerald-800" : "text-zinc-800"}`}>
        {eq.name}
      </span>
      <PencilMiniIcon />
    </button>
  );
}

function PencilMiniIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-zinc-300">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}
function TrashMiniIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

// ── İkonlar ───────────────────────────────────────────────────────────────────

function XIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
function ChevronLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}
function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}
