import type { Database } from "../lib/database.types";

type Eq = Database["public"]["Tables"]["equipment"]["Row"];

// ── Layout constants ───────────────────────────────────────────────────────────

const COL_W = 150;
const EL_W = 96;
const EL_H = 44;
const EL_R = 22;   // motor circle radius
const ROW_H = 86;
const BUSBAR_Y = 44;
const BUSBAR_H = 10;
const MARGIN = 24;

// ── Type helpers ───────────────────────────────────────────────────────────────

const DIAG_LABEL: Record<string, string> = {
  busbar: "BUSBAR", tms: "TMŞ", mccb: "MCCB", mcb: "MCB", acb: "ACB",
  fuse_switch: "SİG.", load_break_switch: "YGŞ",
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
  if (["tms","mccb","mcb","acb","fuse_switch","load_break_switch"].includes(type)) return "switch";
  if (["ct","pt","role","koruma_role","enerji_analizoru"].includes(type)) return "prot";
  if (["vfd","soft_starter","dol","star_delta","kontaktor","yardimci_role"].includes(type)) return "drive";
  if (["motor","pompa","fan","heater","ups","alt_pano","jb","aydinlatma","diger"].includes(type)) return "load";
  if (["kablo","guc_kablosu","kontrol_kablosu","fiber_kablo"].includes(type)) return "cable";
  return "gray";
}

const IS_LOAD = new Set(["motor","pompa","fan","heater","ups","alt_pano","jb","aydinlatma","diger"]);
const IS_SWITCH = new Set(["tms","mccb","mcb","acb","fuse_switch","load_break_switch"]);
const IS_CIRCLE_LOAD = new Set(["motor","pompa","fan"]);

// ── Tree builder ───────────────────────────────────────────────────────────────

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

// ── Diagram ────────────────────────────────────────────────────────────────────

export default function SingleLineDiagram({ equipment }: { equipment: Eq[] }) {
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
    <div className="h-full w-full overflow-auto" style={{ background: "#fafafa" }}>
      <svg
        width={svgW}
        height={svgH}
        viewBox={`0 0 ${svgW} ${svgH}`}
        style={{ minWidth: svgW, display: "block" }}
        aria-label="Tek hat diyagramı"
      >
        {/* ── BUSBAR ── */}
        {hasBusbar && (
          <>
            <rect
              x={busbarX1}
              y={BUSBAR_Y}
              width={busbarX2 - busbarX1}
              height={BUSBAR_H}
              rx={3}
              fill="#0f172a"
            />
            <text
              x={busbarX1 + 6}
              y={BUSBAR_Y - 7}
              fontSize={9}
              fill="#94a3b8"
              fontFamily="'Courier New',monospace"
              fontWeight="700"
              letterSpacing="1"
            >
              BUSBAR
            </text>
          </>
        )}

        {/* ── Feeders ── */}
        {feeders.map((feeder, fi) => {
          const cx = MARGIN + fi * COL_W + COL_W / 2;
          const baseY = hasBusbar ? BUSBAR_Y + BUSBAR_H : 10;

          return (
            <g key={fi}>
              {/* Tap line from busbar to first element */}
              {hasBusbar && feeder.fromBusbar && feeder.items.length > 0 && (
                <line
                  x1={cx}
                  y1={baseY}
                  x2={cx}
                  y2={baseY + ROW_H * 0.4}
                  stroke="#475569"
                  strokeWidth={1.5}
                />
              )}

              {feeder.items.map((eq, ei) => {
                const elCY = baseY + (ei + 0.5) * ROW_H;
                const prevElBottom = baseY + (ei === 0 ? ROW_H * 0.4 : (ei - 0.5) * ROW_H + (IS_CIRCLE_LOAD.has(feeder.items[ei - 1]?.equipment_type ?? "") ? EL_R : EL_H / 2));
                const thisElTop = elCY - (IS_CIRCLE_LOAD.has(eq.equipment_type ?? "") ? EL_R : EL_H / 2);
                const hasNext = ei < feeder.items.length - 1;
                const nextEq = hasNext ? feeder.items[ei + 1] : null;
                const thisElBottom = elCY + (IS_CIRCLE_LOAD.has(eq.equipment_type ?? "") ? EL_R : EL_H / 2);
                const nextElTop = hasNext
                  ? baseY + (ei + 1.5) * ROW_H - (IS_CIRCLE_LOAD.has(nextEq?.equipment_type ?? "") ? EL_R : EL_H / 2)
                  : 0;

                const c = COLORS[getColor(eq.equipment_type)];
                const typeL = eq.equipment_type ? (DIAG_LABEL[eq.equipment_type] ?? eq.equipment_type.toUpperCase()) : "?";
                const nameShort = eq.name.length > 11 ? eq.name.slice(0, 10) + "…" : eq.name;
                const isCircle = IS_CIRCLE_LOAD.has(eq.equipment_type ?? "");
                const isSwitch = IS_SWITCH.has(eq.equipment_type ?? "");
                const isCable = ["kablo","guc_kablosu","kontrol_kablosu","fiber_kablo"].includes(eq.equipment_type ?? "");

                return (
                  <g key={eq.id}>
                    {/* Connector from above */}
                    {(ei > 0 || (hasBusbar && feeder.fromBusbar)) && (
                      <line
                        x1={cx}
                        y1={ei === 0 ? baseY + ROW_H * 0.4 : prevElBottom}
                        x2={cx}
                        y2={thisElTop - 2}
                        stroke="#94a3b8"
                        strokeWidth={1.5}
                      />
                    )}

                    {/* Connector to below */}
                    {hasNext && (
                      <line
                        x1={cx}
                        y1={thisElBottom + 2}
                        x2={cx}
                        y2={nextElTop - 2}
                        stroke={isCable ? "#dc2626" : "#94a3b8"}
                        strokeWidth={1.5}
                        strokeDasharray={isCable ? "5,3" : undefined}
                      />
                    )}

                    {/* ── Element symbol ── */}
                    {isCircle ? (
                      <>
                        {/* Circle for motors/pumps/fans */}
                        <circle cx={cx} cy={elCY} r={EL_R} fill={c.fill} stroke={c.stroke} strokeWidth={2} />
                        <text x={cx} y={elCY} textAnchor="middle" dominantBaseline="central"
                          fontSize={12} fontWeight="700" fill={c.text} fontFamily="sans-serif">{typeL}</text>
                        {/* Name below */}
                        <text x={cx} y={elCY + EL_R + 12} textAnchor="middle" dominantBaseline="central"
                          fontSize={9} fontWeight="600" fill="#334155" fontFamily="sans-serif">{nameShort}</text>
                      </>
                    ) : (
                      <>
                        <rect
                          x={cx - EL_W / 2}
                          y={elCY - EL_H / 2}
                          width={EL_W}
                          height={EL_H}
                          rx={5}
                          fill={c.fill}
                          stroke={c.stroke}
                          strokeWidth={1.5}
                        />
                        {/* Switch diagonal */}
                        {isSwitch && (
                          <line
                            x1={cx - EL_W / 2 + 10}
                            y1={elCY + EL_H / 2 - 8}
                            x2={cx + EL_W / 2 - 10}
                            y2={elCY - EL_H / 2 + 8}
                            stroke={c.stroke}
                            strokeWidth={1.5}
                          />
                        )}
                        {/* CT circles */}
                        {eq.equipment_type === "ct" && (
                          <>
                            <circle cx={cx - 10} cy={elCY} r={7} fill="none" stroke={c.stroke} strokeWidth={1.5} />
                            <circle cx={cx + 10} cy={elCY} r={7} fill="none" stroke={c.stroke} strokeWidth={1.5} />
                          </>
                        )}
                        {/* Type label */}
                        <text x={cx} y={elCY - 7} textAnchor="middle" dominantBaseline="central"
                          fontSize={10} fontWeight="700" fill={c.text} fontFamily="sans-serif"
                          letterSpacing="0.5">{typeL}</text>
                        {/* Name label */}
                        <text x={cx} y={elCY + 8} textAnchor="middle" dominantBaseline="central"
                          fontSize={9} fill="#475569" fontFamily="sans-serif">{nameShort}</text>
                      </>
                    )}
                  </g>
                );
              })}

              {/* Empty feeder stub */}
              {feeder.items.length === 0 && hasBusbar && (
                <line x1={cx} y1={baseY} x2={cx} y2={baseY + 40}
                  stroke="#cbd5e1" strokeWidth={1.5} strokeDasharray="4,3" />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
