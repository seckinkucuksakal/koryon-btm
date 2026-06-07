import ExcelJS from "exceljs";
import { useCallback, useEffect, useRef, useState } from "react";
import { PANEL_TYPE_LABELS, supabase } from "../lib/supabase";
import type { Database, Json } from "../lib/database.types";
import SingleLineDiagram from "./SingleLineDiagram";

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
  { v: "tms",         l: "TMŞ"     },
  { v: "mccb",        l: "MCCB"    },
  { v: "mcb",         l: "MCB"     },
  { v: "fuse_switch", l: "Sigorta" },
  { v: "acb",         l: "ACB"     },
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
  protection: string | "none" | "skip" | null; protectionValue: string;
  ct: "yes" | "no" | "skip" | null; ctRatio: string;
  starter: string | "none" | "skip" | null;
  cable: "yes" | "no" | "skip" | null;
  cableDamar: string; cableKesit: string; cableAciklama: string;
  details: Record<string, string>;
};
const INIT: FiderDraft = {
  loadType: "motor", loadName: "", loadPower: "",
  busbar: null, protection: null, protectionValue: "",
  ct: null, ctRatio: "", starter: null,
  cable: null, cableDamar: "", cableKesit: "", cableAciklama: "",
  details: {},
};

type ChainNode = { type: string; label: string };
function buildChain(d: FiderDraft): ChainNode[] {
  const n: ChainNode[] = [];
  if (d.busbar === "yes") n.push({ type: "busbar", label: "BUSBAR" });
  if (d.protection && !["none","skip"].includes(d.protection))
    n.push({ type: d.protection, label: (TYPE_LABEL[d.protection] ?? d.protection) + (d.protectionValue ? ` ${d.protectionValue}` : "") });
  if (d.ct === "yes") n.push({ type: "ct", label: `CT${d.ctRatio ? ` ${d.ctRatio}` : ""}` });
  if (d.starter && !["none","skip"].includes(d.starter))
    n.push({ type: d.starter, label: TYPE_LABEL[d.starter] ?? d.starter });
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

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
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
      const { data } = await supabase.from("equipment").insert({
        panel_id: panel.id,
        name: n.label,
        equipment_type: n.type,
        parent_id: prevId,
        sort_order: ord++,
        metadata: meta as Json,
      }).select().single();
      if (data) prevId = data.id;
    }
    setSaving(false);
    await load();
    setStep(7);
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
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "#f1f5f9" }}>
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

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden" style={{ maxWidth: 1400, margin: "0 auto", width: "100%" }}>

        {/* Left: single-line diagram */}
        <div className="hidden md:flex md:w-[55%] flex-col border-r border-zinc-200 bg-white overflow-hidden">
          <div className="shrink-0 px-4 py-2 border-b border-zinc-100 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Tek Hat Diyagramı</p>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
              {equipment.filter((e) => !e.parent_id).length} fider
            </span>
          </div>
          <div className="flex-1 overflow-auto">
            <SingleLineDiagram equipment={equipment} />
          </div>
        </div>

        {/* Right: wizard */}
        <div className="flex flex-1 flex-col overflow-hidden bg-white md:bg-transparent">

          {/* Mobile: compact chain strip */}
          {step < 7 && buildChain(draft).length > 0 && (
            <div className="md:hidden shrink-0 border-b border-zinc-200 bg-white px-4 py-2">
              <div className="flex items-center gap-1 overflow-x-auto">
                {buildChain(draft).map((n, i) => (
                  <span key={i} className="flex shrink-0 items-center gap-1 text-xs font-bold text-zinc-700">
                    {i > 0 && <span className="text-zinc-300">└</span>}
                    <span className="rounded bg-zinc-100 px-2 py-0.5">{n.label}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-1 flex-col overflow-y-auto">
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
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  WIZARD ALANI
// ══════════════════════════════════════════════════════════════════════════════

const STEP_LABELS = [
  "Yük Bilgisi", "Bara", "Koruma Elemanı",
  "Akım Trafosu", "Yol Verme", "Çıkış Kablosu",
  "Yük Detayları", "Tamamlandı",
];

type WP = {
  step: number; draft: FiderDraft; upd: (p: Partial<FiderDraft>) => void;
  onNext: () => void; onBack: () => void; onSave: () => void;
  onNewFider: () => void; onClose: () => void;
  saving: boolean; preview: ChainNode[];
};

function WizardArea(props: WP) {
  const { step, onBack, onClose } = props;
  return (
    <div className="flex flex-1 flex-col">
      {step < 7 && (
        <div className="shrink-0 border-b border-zinc-200 bg-white px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={step === 0 ? onClose : onBack}
              className="flex items-center gap-1 text-sm font-semibold text-zinc-500 active:text-zinc-800">
              <ChevronLeft /> {step === 0 ? "Kapat" : "Geri"}
            </button>
            <span className="text-xs font-semibold text-zinc-400">
              {step + 1} / 7 · {STEP_LABELS[step]}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
            <div className="h-full rounded-full bg-zinc-900 transition-all duration-300"
              style={{ width: `${((step + 1) / 7) * 100}%` }} />
          </div>
        </div>
      )}
      <div className="flex-1 overflow-y-auto px-5 py-6">
        <div className="mx-auto max-w-sm">
          {step === 0 && <S0 {...props} />}
          {step === 1 && <S1 {...props} />}
          {step === 2 && <S2 {...props} />}
          {step === 3 && <S3 {...props} />}
          {step === 4 && <S4 {...props} />}
          {step === 5 && <S5 {...props} />}
          {step === 6 && <S6 {...props} />}
          {step === 7 && <S7 {...props} />}
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

// ── S2: Koruma ────────────────────────────────────────────────────────────────

function S2({ draft, upd, onNext }: WP) {
  const hasProt = draft.protection && !["none","skip"].includes(draft.protection);
  return (
    <div>
      <Q>Koruma elemanı var mı?</Q>
      <Grid>
        {PROT_TYPES.map((t) => (
          <Btn key={t.v} active={draft.protection === t.v} onClick={() => upd({ protection: t.v })}>{t.l}</Btn>
        ))}
        <Btn active={draft.protection === "none"} muted onClick={() => { upd({ protection: "none" }); setTimeout(onNext, 160); }}>Yok</Btn>
        <Btn active={draft.protection === "skip"} muted onClick={() => { upd({ protection: "skip" }); setTimeout(onNext, 160); }}>Bilmiyorum</Btn>
      </Grid>
      {hasProt && (
        <div className="mt-4">
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-zinc-500">
            Değer / Akım <span className="font-normal text-zinc-400">(opsiyonel)</span>
          </label>
          <input autoFocus value={draft.protectionValue}
            onChange={(e) => upd({ protectionValue: e.target.value })}
            placeholder="Örn. 630A"
            autoComplete="off"
            className="w-full rounded-2xl border-2 border-zinc-200 bg-white px-4 py-3.5 text-base outline-none focus:border-zinc-900" />
          <NextBtn onClick={onNext} />
        </div>
      )}
      {!hasProt && <SkipBtn onClick={() => { upd({ protection: "skip" }); onNext(); }} />}
    </div>
  );
}

// ── S3: CT ────────────────────────────────────────────────────────────────────

function S3({ draft, upd, onNext }: WP) {
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
        <div className="mt-4">
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-zinc-500">
            CT Oranı <span className="font-normal text-zinc-400">(opsiyonel)</span>
          </label>
          <input autoFocus value={draft.ctRatio}
            onChange={(e) => upd({ ctRatio: e.target.value })}
            placeholder="Örn. 600/5"
            autoComplete="off"
            className="w-full rounded-2xl border-2 border-zinc-200 bg-white px-4 py-3.5 text-base outline-none focus:border-zinc-900" />
          <NextBtn onClick={onNext} />
        </div>
      )}
    </div>
  );
}

// ── S4: Yol Verme ─────────────────────────────────────────────────────────────

function S4({ draft, upd, onNext }: WP) {
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
      {hasStart && <NextBtn onClick={onNext} />}
      {!hasStart && <SkipBtn onClick={() => { upd({ starter: "skip" }); onNext(); }} />}
    </div>
  );
}

// ── S5: Kablo ─────────────────────────────────────────────────────────────────

function S5({ draft, upd, onNext }: WP) {
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

// ── S6: Yük Detayları ─────────────────────────────────────────────────────────

function S6({ draft, upd, onSave, saving }: WP) {
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

// ── S7: Tamamlandı ────────────────────────────────────────────────────────────

function S7({ draft, onNewFider, onClose }: WP) {
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
