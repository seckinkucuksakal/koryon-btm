import { useReducer, useRef } from "react";
import type { Database } from "../lib/database.types";

type Eq = Database["public"]["Tables"]["equipment"]["Row"];

// ── Layout constants ───────────────────────────────────────────────────────────

const COL_W  = 180;   // kolon genişliği
const EL_W   = 130;   // kutu genişliği
const EL_H   = 52;    // kutu yüksekliği
const EL_R   = 28;    // daire yarıçapı (motor/pompa/fan)
const ROW_H  = 100;   // satır yüksekliği
const BUSBAR_Y = 50;
const BUSBAR_H = 12;
const MARGIN   = 28;
const FONT     = "'Inter','Segoe UI',system-ui,sans-serif";

const DIAG_LABEL: Record<string, string> = {
  busbar: "BUSBAR", tms: "TMŞ", mccb: "MCCB", mcb: "MCB", acb: "ACB",
  fuse_switch: "SİG.", load_break_switch: "YGŞ", mks: "MKŞ",
  kakr: "KAKR", mov: "MOV", diger_koruma: "—",
  ct: "CT", pt: "PT", role: "RÖLE", koruma_role: "KOR.RÖLE",
  enerji_analizoru: "ENJ.AN.",
  vfd: "VFD", soft_starter: "SS", dol: "DOL", star_delta: "Y-Δ",
  kontaktor: "KNT", yardimci_role: "YRD.RÖLE",
  plc: "PLC", io_modulu: "I/O", timer: "TMR",
  motor: "M", pompa: "P", fan: "FAN", heater: "IST",
  ups: "UPS", alt_pano: "ALT\nPANO", jb: "JB", aydinlatma: "AYD.",
  kablo: "KBL", guc_kablosu: "KBL", kontrol_kablosu: "KBL", fiber_kablo: "FBR",
  diger: "—",
};

type EColor = "switch" | "prot" | "drive" | "load" | "cable" | "gray";

const COLORS: Record<EColor, { stroke: string; fill: string; text: string }> = {
  switch: { stroke: "#2563eb", fill: "#dbeafe", text: "#1e40af" },
  prot:   { stroke: "#7c3aed", fill: "#ede9fe", text: "#5b21b6" },
  drive:  { stroke: "#ea580c", fill: "#ffedd5", text: "#c2410c" },
  load:   { stroke: "#16a34a", fill: "#dcfce7", text: "#15803d" },
  cable:  { stroke: "#dc2626", fill: "#fee2e2", text: "#b91c1c" },
  gray:   { stroke: "#6b7280", fill: "#f3f4f6", text: "#374151" },
};

function getColor(type: string | null): EColor {
  if (!type) return "gray";
  if (["tms","mccb","mcb","acb","fuse_switch","load_break_switch","mks","kakr","mov","diger_koruma"].includes(type)) return "switch";
  if (["ct","pt","role","koruma_role","enerji_analizoru"].includes(type)) return "prot";
  if (["vfd","soft_starter","dol","star_delta","kontaktor","yardimci_role"].includes(type)) return "drive";
  if (["motor","pompa","fan","heater","ups","alt_pano","jb","aydinlatma","diger"].includes(type)) return "load";
  if (["kablo","guc_kablosu","kontrol_kablosu","fiber_kablo"].includes(type)) return "cable";
  return "gray";
}

const IS_CIRCLE_LOAD = new Set(["motor","pompa","fan"]);

type Feeder = { items: Eq[]; fromBusbar: boolean };

function buildFeeders(items: Eq[]): { feeders: Feeder[]; hasBusbar: boolean } {
  const feeders: Feeder[] = [];
  const busbarRoots = items.filter((e) => !e.parent_id && e.equipment_type === "busbar");
  const otherRoots  = items.filter((e) => !e.parent_id && e.equipment_type !== "busbar");

  busbarRoots.forEach((b) => {
    const children = items.filter((e) => e.parent_id === b.id);
    if (children.length === 0) {
      feeders.push({ items: [], fromBusbar: true });
    } else {
      children.forEach((c) => feeders.push({ items: chainFrom(c, items), fromBusbar: true }));
    }
  });

  otherRoots.forEach((r) => feeders.push({ items: chainFrom(r, items), fromBusbar: false }));
  return { feeders, hasBusbar: busbarRoots.length > 0 };
}

function chainFrom(start: Eq, all: Eq[]): Eq[] {
  const chain: Eq[] = [start];
  let cur = start;
  for (let i = 0; i < 30; i++) {
    const kids = all.filter((e) => e.parent_id === cur.id);
    if (!kids.length) break;
    cur = kids[0];
    chain.push(cur);
  }
  return chain;
}

// ── Zoom/pan hook ──────────────────────────────────────────────────────────────

const MIN_SCALE = 0.25;
const MAX_SCALE = 4;
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

function useDiagramTransform() {
  // Render tetikleyici — state olmayan değerleri ref'te tut, sadece render için dispatch
  const [, redraw] = useReducer((x: number) => x + 1, 0);

  const scaleRef = useRef(1);
  const oxRef    = useRef(0);
  const oyRef    = useRef(0);

  // Sürükleme durumu
  const ptrs     = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef(0); // son pinch mesafesi

  function commit() { redraw(); }

  // ── React Pointer Event handlers (JSX'e doğrudan bağlanır) ─────────────────

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.current.size < 2) pinchRef.current = 0;
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!ptrs.current.has(e.pointerId)) return;
    const prev = ptrs.current.get(e.pointerId)!;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const all = Array.from(ptrs.current.values());

    if (all.length === 1) {
      // Tek parmak ya da fare → PAN
      oxRef.current += e.clientX - prev.x;
      oyRef.current += e.clientY - prev.y;
      commit();
    } else if (all.length >= 2) {
      // İki parmak → PINCH ZOOM
      const [a, b] = all;
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      if (pinchRef.current > 0) {
        scaleRef.current = clamp(scaleRef.current * (d / pinchRef.current), MIN_SCALE, MAX_SCALE);
        commit();
      }
      pinchRef.current = d;
    }
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    ptrs.current.delete(e.pointerId);
    if (ptrs.current.size === 0) pinchRef.current = 0;
  }

  function onWheel(e: React.WheelEvent<HTMLDivElement>) {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    scaleRef.current = clamp(scaleRef.current * factor, MIN_SCALE, MAX_SCALE);
    commit();
  }

  const handlers = { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onWheel };

  function zoomIn()    { scaleRef.current = clamp(scaleRef.current * 1.3, MIN_SCALE, MAX_SCALE); commit(); }
  function zoomOut()   { scaleRef.current = clamp(scaleRef.current / 1.3, MIN_SCALE, MAX_SCALE); commit(); }
  function resetView() { scaleRef.current = 1; oxRef.current = 0; oyRef.current = 0; commit(); }

  return {
    scale: scaleRef.current,
    ox: oxRef.current,
    oy: oyRef.current,
    handlers,
    zoomIn,
    zoomOut,
    resetView,
  };
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function SingleLineDiagram({ equipment, panelName }: { equipment: Eq[]; panelName?: string }) {
  const { scale, ox, oy, handlers, zoomIn, zoomOut, resetView } = useDiagramTransform();
  const svgRef = useRef<SVGSVGElement>(null);

  function downloadSVG() {
    const svg = svgRef.current;
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${panelName ?? "tek-hat"}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadPNG() {
    const svg = svgRef.current;
    if (!svg) return;
    const w = svg.viewBox.baseVal.width  || svg.clientWidth;
    const h = svg.viewBox.baseVal.height || svg.clientHeight;
    const xml = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width  = w * 2;   // 2× for retina sharpness
      canvas.height = h * 2;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#fafafa";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${panelName ?? "tek-hat"}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }, "image/png");
    };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
  }

  if (equipment.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div>
          <p className="text-3xl mb-3">⚡</p>
          <p className="text-sm font-medium text-zinc-400">
            Fider eklendikçe tek hat diyagramı burada oluşur
          </p>
        </div>
      </div>
    );
  }

  const { feeders, hasBusbar } = buildFeeders(equipment);
  const numCols = Math.max(1, feeders.length);
  const maxDepth = Math.max(0, ...feeders.map((f) => f.items.length));

  const svgW = MARGIN * 2 + numCols * COL_W;
  const svgH = hasBusbar
    ? BUSBAR_Y + BUSBAR_H + maxDepth * ROW_H + 60
    : maxDepth * ROW_H + 60;

  const busbarX1 = MARGIN;
  const busbarX2 = svgW - MARGIN;

  return (
    <div className="relative h-full w-full overflow-hidden select-none" style={{ background: "#fafafa" }}>
      {/* ── Pan/zoom container — pointer events doğrudan burada yakalanır ── */}
      <div
        className="h-full w-full overflow-hidden"
        style={{ touchAction: "none", cursor: "grab" }}
        {...handlers}
      >
        <div
          style={{
            transform: `translate(${ox}px, ${oy}px) scale(${scale})`,
            transformOrigin: "0 0",
            willChange: "transform",
            pointerEvents: "none",
          }}
        >
          <svg
            ref={svgRef}
            width={svgW}
            height={svgH}
            viewBox={`0 0 ${svgW} ${svgH}`}
            style={{ display: "block", fontFamily: FONT }}
            aria-label="Tek hat diyagramı"
          >
            {/* BUSBAR */}
            {hasBusbar && (
              <>
                <rect x={busbarX1} y={BUSBAR_Y} width={busbarX2 - busbarX1} height={BUSBAR_H} rx={4} fill="#0f172a" />
                <text x={busbarX1 + 8} y={BUSBAR_Y - 8} fontSize={13} fill="#64748b"
                  fontFamily={FONT} fontWeight="700" letterSpacing="2">BUSBAR</text>
              </>
            )}

            {/* Feeders */}
            {feeders.map((feeder, fi) => {
              const cx = MARGIN + fi * COL_W + COL_W / 2;
              const baseY = hasBusbar ? BUSBAR_Y + BUSBAR_H : 10;

              return (
                <g key={fi}>
                  {hasBusbar && feeder.fromBusbar && feeder.items.length > 0 && (
                    <line x1={cx} y1={baseY} x2={cx} y2={baseY + ROW_H * 0.4}
                      stroke="#475569" strokeWidth={1.5} />
                  )}

                  {feeder.items.map((eq, ei) => {
                    const elCY = baseY + (ei + 0.5) * ROW_H;
                    const prevElBottom = baseY + (ei === 0
                      ? ROW_H * 0.4
                      : (ei - 0.5) * ROW_H + (IS_CIRCLE_LOAD.has(feeder.items[ei - 1]?.equipment_type ?? "") ? EL_R : EL_H / 2));
                    const thisElTop = elCY - (IS_CIRCLE_LOAD.has(eq.equipment_type ?? "") ? EL_R : EL_H / 2);
                    const hasNext = ei < feeder.items.length - 1;
                    const nextEq = hasNext ? feeder.items[ei + 1] : null;
                    const thisElBottom = elCY + (IS_CIRCLE_LOAD.has(eq.equipment_type ?? "") ? EL_R : EL_H / 2);
                    const nextElTop = hasNext
                      ? baseY + (ei + 1.5) * ROW_H - (IS_CIRCLE_LOAD.has(nextEq?.equipment_type ?? "") ? EL_R : EL_H / 2)
                      : 0;

                    const c = COLORS[getColor(eq.equipment_type)];
                    const typeL = eq.equipment_type ? (DIAG_LABEL[eq.equipment_type] ?? eq.equipment_type.toUpperCase()) : "?";
                    const rawName = eq.name.length > 18 ? eq.name.slice(0, 17) + "…" : eq.name;
                    // Eğer isim sadece tip kısaltmasıyla aynıysa alt satırı gizle
                    const nameShort = rawName === typeL ? null : rawName;
                    const isCircle = IS_CIRCLE_LOAD.has(eq.equipment_type ?? "");
                    const isCable = ["kablo","guc_kablosu","kontrol_kablosu","fiber_kablo"].includes(eq.equipment_type ?? "");

                    return (
                      <g key={eq.id}>
                        {(ei > 0 || (hasBusbar && feeder.fromBusbar)) && (
                          <line x1={cx} y1={ei === 0 ? baseY + ROW_H * 0.4 : prevElBottom}
                            x2={cx} y2={thisElTop - 2} stroke="#94a3b8" strokeWidth={1.5} />
                        )}
                        {hasNext && (
                          <line x1={cx} y1={thisElBottom + 2} x2={cx} y2={nextElTop - 2}
                            stroke={isCable ? "#dc2626" : "#94a3b8"} strokeWidth={1.5}
                            strokeDasharray={isCable ? "5,3" : undefined} />
                        )}

                        {isCircle ? (
                          <>
                            <circle cx={cx} cy={elCY} r={EL_R} fill={c.fill} stroke={c.stroke} strokeWidth={2.5} />
                            <text x={cx} y={elCY} textAnchor="middle" dominantBaseline="central"
                              fontSize={15} fontWeight="800" fill={c.text} fontFamily={FONT}>{typeL}</text>
                            {nameShort && (
                              <text x={cx} y={elCY + EL_R + 14} textAnchor="middle" dominantBaseline="central"
                                fontSize={12} fontWeight="600" fill="#1e293b" fontFamily={FONT}>{nameShort}</text>
                            )}
                          </>
                        ) : (
                          <>
                            <rect x={cx - EL_W / 2} y={elCY - EL_H / 2} width={EL_W} height={EL_H}
                              rx={6} fill={c.fill} stroke={c.stroke} strokeWidth={2} />
                            {nameShort ? (
                              <>
                                {/* İki satır: üst = tip, alt = tag/değer */}
                                <text x={cx} y={elCY - 9} textAnchor="middle" dominantBaseline="central"
                                  fontSize={12} fontWeight="800" fill={c.text} fontFamily={FONT} letterSpacing="0.5">{typeL}</text>
                                <text x={cx} y={elCY + 10} textAnchor="middle" dominantBaseline="central"
                                  fontSize={11} fontWeight="600" fill="#1e293b" fontFamily={FONT}>{nameShort}</text>
                              </>
                            ) : (
                              /* Tek satır: ortalanmış tip */
                              <text x={cx} y={elCY} textAnchor="middle" dominantBaseline="central"
                                fontSize={13} fontWeight="800" fill={c.text} fontFamily={FONT} letterSpacing="0.5">{typeL}</text>
                            )}
                          </>
                        )}
                      </g>
                    );
                  })}

                  {feeder.items.length === 0 && hasBusbar && (
                    <line x1={cx} y1={baseY} x2={cx} y2={baseY + 40}
                      stroke="#cbd5e1" strokeWidth={1.5} strokeDasharray="4,3" />
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* ── İndirme butonları — sol üst ── */}
      <div className="absolute top-3 left-3 flex gap-1.5 z-10">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); downloadPNG(); }}
          className="flex items-center gap-1 rounded-xl bg-white/95 shadow-md border border-zinc-200 px-2.5 py-1.5 text-[11px] font-bold text-zinc-700 active:bg-zinc-100 select-none"
          title="PNG olarak indir"
        >
          ↓ PNG
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); downloadSVG(); }}
          className="flex items-center gap-1 rounded-xl bg-white/95 shadow-md border border-zinc-200 px-2.5 py-1.5 text-[11px] font-bold text-zinc-700 active:bg-zinc-100 select-none"
          title="SVG olarak indir"
        >
          ↓ SVG
        </button>
      </div>

      {/* ── Kontrol butonları ── */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1.5 z-10">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); zoomIn(); }}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/95 shadow-md border border-zinc-200 text-zinc-700 text-xl font-bold active:bg-zinc-100 select-none"
          aria-label="Yakınlaştır"
        >+</button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); zoomOut(); }}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/95 shadow-md border border-zinc-200 text-zinc-700 text-xl font-bold active:bg-zinc-100 select-none"
          aria-label="Uzaklaştır"
        >−</button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); resetView(); }}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/95 shadow-md border border-zinc-200 text-zinc-500 text-base active:bg-zinc-100 select-none"
          aria-label="Sıfırla"
          title="Görünümü sıfırla"
        >⌖</button>
      </div>

      {/* Zoom yüzdesi */}
      <div className="absolute bottom-3 left-3 z-10">
        <div className="rounded-lg bg-white/90 px-2 py-1 text-[10px] font-mono font-bold text-zinc-500 shadow-sm border border-zinc-100 select-none">
          {Math.round(scale * 100)}%
        </div>
      </div>
    </div>
  );
}
