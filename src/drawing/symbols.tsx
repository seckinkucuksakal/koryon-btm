import type { LayoutSymbolKey, SldSymbolKey } from "./types";

// 80x80 referans kutu içinde tasarlanmış sembol path'leri.
// Sembol orijini (0,0) sol-üst köşedir; merkez = 40,40.

export const SYMBOL_BOX = 80;

export type PropertyField = {
  key: string;
  label: string;
  placeholder?: string;
  /** Etiket altında görünecek kısa form (boş bırakılırsa tam değer) */
  shortFormat?: (value: string) => string;
};

export type SymbolDef<K extends string> = {
  key: K;
  name: string;
  /** Palette / canvas içinde aynı path; viewport 80x80 */
  Shape: () => React.ReactElement;
  /** İlk eklendiğindeki property alanları */
  fields: PropertyField[];
  /** Etiket için ana property anahtarı (örn. tag) */
  primary?: string;
  /** Etiket altında özet satırlar üreten fonksiyon */
  summary?: (props: Record<string, string>) => string[];
};

// =====================================================================
// SLD sembolleri
// =====================================================================

const COMMON_TAG: PropertyField = {
  key: "tag",
  label: "Etiket / Tag",
  placeholder: "M-101",
};

const sldMotor: SymbolDef<SldSymbolKey> = {
  key: "motor",
  name: "Motor",
  primary: "tag",
  fields: [
    COMMON_TAG,
    { key: "power", label: "Güç (kW)", placeholder: "160" },
    { key: "voltage", label: "Gerilim (V)", placeholder: "400" },
    { key: "current", label: "Akım (A)", placeholder: "295" },
    { key: "starter", label: "Yol Verme", placeholder: "DOL / VFD" },
  ],
  summary: (p) => {
    const lines: string[] = [];
    if (p.power) lines.push(`${p.power} kW`);
    if (p.voltage) lines.push(`${p.voltage} V`);
    if (p.starter) lines.push(p.starter);
    return lines;
  },
  Shape: () => (
    <g>
      <circle cx={40} cy={40} r={28} fill="#fff" stroke="#111827" strokeWidth={2.5} />
      <text x={40} y={47} textAnchor="middle" fontSize={24} fontWeight={700} fill="#111827">
        M
      </text>
    </g>
  ),
};

const sldVfd: SymbolDef<SldSymbolKey> = {
  key: "vfd",
  name: "VFD",
  primary: "tag",
  fields: [
    COMMON_TAG,
    { key: "power", label: "Güç (kW)", placeholder: "55" },
    { key: "voltage", label: "Gerilim (V)", placeholder: "400" },
  ],
  summary: (p) => [p.power && `${p.power} kW`].filter(Boolean) as string[],
  Shape: () => (
    <g>
      <rect x={12} y={18} width={56} height={44} fill="#fff" stroke="#111827" strokeWidth={2.5} rx={4} />
      <text x={40} y={46} textAnchor="middle" fontSize={16} fontWeight={700} fill="#111827">
        VFD
      </text>
    </g>
  ),
};

const sldSoftStarter: SymbolDef<SldSymbolKey> = {
  key: "soft-starter",
  name: "Soft Starter",
  primary: "tag",
  fields: [COMMON_TAG, { key: "power", label: "Güç (kW)" }],
  summary: (p) => [p.power && `${p.power} kW`].filter(Boolean) as string[],
  Shape: () => (
    <g>
      <rect x={12} y={18} width={56} height={44} fill="#fff" stroke="#111827" strokeWidth={2.5} rx={4} />
      <path d="M18 56 L36 28 L62 28" fill="none" stroke="#111827" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  ),
};

const sldMccb: SymbolDef<SldSymbolKey> = {
  key: "mccb",
  name: "MCCB",
  primary: "tag",
  fields: [
    COMMON_TAG,
    { key: "rating", label: "Akım (A)", placeholder: "250" },
    { key: "icu", label: "Icu (kA)" },
  ],
  summary: (p) => [p.rating && `${p.rating}A`].filter(Boolean) as string[],
  Shape: () => (
    <g>
      <rect x={20} y={14} width={40} height={52} fill="#fff" stroke="#111827" strokeWidth={2.5} rx={3} />
      <line x1={40} y1={14} x2={40} y2={26} stroke="#111827" strokeWidth={2.5} />
      <line x1={40} y1={66} x2={40} y2={54} stroke="#111827" strokeWidth={2.5} />
      <path d="M30 30 L40 38 L50 30" fill="none" stroke="#111827" strokeWidth={2.5} />
    </g>
  ),
};

const sldMcb: SymbolDef<SldSymbolKey> = {
  key: "mcb",
  name: "MCB",
  primary: "tag",
  fields: [COMMON_TAG, { key: "rating", label: "Akım (A)", placeholder: "32" }],
  summary: (p) => [p.rating && `${p.rating}A`].filter(Boolean) as string[],
  Shape: () => (
    <g>
      <rect x={26} y={18} width={28} height={44} fill="#fff" stroke="#111827" strokeWidth={2.5} rx={3} />
      <line x1={40} y1={18} x2={40} y2={28} stroke="#111827" strokeWidth={2.5} />
      <line x1={40} y1={62} x2={40} y2={52} stroke="#111827" strokeWidth={2.5} />
      <path d="M32 32 L48 44" stroke="#111827" strokeWidth={2.5} strokeLinecap="round" />
    </g>
  ),
};

const sldFuse: SymbolDef<SldSymbolKey> = {
  key: "fuse",
  name: "Sigorta",
  primary: "tag",
  fields: [COMMON_TAG, { key: "rating", label: "Akım (A)" }],
  summary: (p) => [p.rating && `${p.rating}A`].filter(Boolean) as string[],
  Shape: () => (
    <g>
      <rect x={28} y={18} width={24} height={44} fill="#fff" stroke="#111827" strokeWidth={2.5} rx={3} />
      <line x1={40} y1={18} x2={40} y2={62} stroke="#111827" strokeWidth={2.5} />
    </g>
  ),
};

const sldContactor: SymbolDef<SldSymbolKey> = {
  key: "contactor",
  name: "Kontaktör",
  primary: "tag",
  fields: [COMMON_TAG, { key: "rating", label: "Akım (A)" }],
  summary: () => [],
  Shape: () => (
    <g>
      <rect x={20} y={20} width={40} height={40} fill="#fff" stroke="#111827" strokeWidth={2.5} rx={3} />
      <circle cx={32} cy={40} r={2.5} fill="#111827" />
      <circle cx={48} cy={40} r={2.5} fill="#111827" />
      <line x1={32} y1={40} x2={50} y2={28} stroke="#111827" strokeWidth={2.5} />
    </g>
  ),
};

const sldMcc: SymbolDef<SldSymbolKey> = {
  key: "mcc",
  name: "MCC",
  primary: "tag",
  fields: [
    COMMON_TAG,
    { key: "voltage", label: "Gerilim (V)" },
    { key: "current", label: "Akım (A)" },
  ],
  summary: () => [],
  Shape: () => (
    <g>
      <rect x={8} y={14} width={64} height={52} fill="#fff" stroke="#111827" strokeWidth={2.5} rx={3} />
      <text x={40} y={45} textAnchor="middle" fontSize={16} fontWeight={700} fill="#111827">
        MCC
      </text>
    </g>
  ),
};

const sldPanel: SymbolDef<SldSymbolKey> = {
  key: "panel",
  name: "Pano",
  primary: "tag",
  fields: [COMMON_TAG, { key: "voltage", label: "Gerilim (V)" }],
  summary: () => [],
  Shape: () => (
    <g>
      <rect x={12} y={14} width={56} height={52} fill="#fff" stroke="#111827" strokeWidth={2.5} rx={3} />
      <line x1={20} y1={26} x2={60} y2={26} stroke="#111827" strokeWidth={1.5} />
      <line x1={20} y1={36} x2={60} y2={36} stroke="#111827" strokeWidth={1.5} />
      <line x1={20} y1={46} x2={60} y2={46} stroke="#111827" strokeWidth={1.5} />
      <line x1={20} y1={56} x2={60} y2={56} stroke="#111827" strokeWidth={1.5} />
    </g>
  ),
};

const sldTransformer: SymbolDef<SldSymbolKey> = {
  key: "transformer",
  name: "Trafo",
  primary: "tag",
  fields: [
    COMMON_TAG,
    { key: "rating", label: "Güç (kVA)" },
    { key: "ratio", label: "Oran (Up/Us)", placeholder: "33/0.4" },
  ],
  summary: (p) => {
    const lines = [] as string[];
    if (p.rating) lines.push(`${p.rating} kVA`);
    if (p.ratio) lines.push(p.ratio);
    return lines;
  },
  Shape: () => (
    <g fill="#fff" stroke="#111827" strokeWidth={2.5}>
      <circle cx={40} cy={30} r={14} />
      <circle cx={40} cy={50} r={14} />
    </g>
  ),
};

const sldGenerator: SymbolDef<SldSymbolKey> = {
  key: "generator",
  name: "Jeneratör",
  primary: "tag",
  fields: [COMMON_TAG, { key: "rating", label: "Güç (kVA)" }],
  summary: (p) => [p.rating && `${p.rating} kVA`].filter(Boolean) as string[],
  Shape: () => (
    <g>
      <circle cx={40} cy={40} r={28} fill="#fff" stroke="#111827" strokeWidth={2.5} />
      <text x={40} y={47} textAnchor="middle" fontSize={20} fontWeight={700} fill="#111827">
        G
      </text>
    </g>
  ),
};

const sldUps: SymbolDef<SldSymbolKey> = {
  key: "ups",
  name: "UPS",
  primary: "tag",
  fields: [COMMON_TAG, { key: "rating", label: "Güç (kVA)" }],
  summary: (p) => [p.rating && `${p.rating} kVA`].filter(Boolean) as string[],
  Shape: () => (
    <g>
      <rect x={12} y={18} width={56} height={44} fill="#fff" stroke="#111827" strokeWidth={2.5} rx={3} />
      <text x={40} y={46} textAnchor="middle" fontSize={16} fontWeight={700} fill="#111827">
        UPS
      </text>
    </g>
  ),
};

const sldBusbar: SymbolDef<SldSymbolKey> = {
  key: "busbar",
  name: "Bara",
  primary: "tag",
  fields: [COMMON_TAG, { key: "rating", label: "Akım (A)" }],
  summary: () => [],
  Shape: () => (
    <g>
      <rect x={6} y={36} width={68} height={8} fill="#111827" />
    </g>
  ),
};

const sldTerminal: SymbolDef<SldSymbolKey> = {
  key: "terminal",
  name: "Klemens",
  primary: "tag",
  fields: [COMMON_TAG],
  summary: () => [],
  Shape: () => (
    <g stroke="#111827" strokeWidth={2.5} fill="#fff">
      <rect x={20} y={28} width={6} height={24} />
      <rect x={32} y={28} width={6} height={24} />
      <rect x={44} y={28} width={6} height={24} />
      <rect x={56} y={28} width={6} height={24} />
    </g>
  ),
};

const sldJunction: SymbolDef<SldSymbolKey> = {
  key: "junction",
  name: "Buat (JB)",
  primary: "tag",
  fields: [COMMON_TAG],
  summary: () => [],
  Shape: () => (
    <g>
      <rect x={20} y={20} width={40} height={40} fill="#fff" stroke="#111827" strokeWidth={2.5} rx={3} />
      <line x1={20} y1={20} x2={60} y2={60} stroke="#111827" strokeWidth={2} />
      <line x1={60} y1={20} x2={20} y2={60} stroke="#111827" strokeWidth={2} />
    </g>
  ),
};

export const SLD_SYMBOLS: Record<SldSymbolKey, SymbolDef<SldSymbolKey>> = {
  mcc: sldMcc,
  panel: sldPanel,
  mccb: sldMccb,
  mcb: sldMcb,
  fuse: sldFuse,
  contactor: sldContactor,
  motor: sldMotor,
  vfd: sldVfd,
  "soft-starter": sldSoftStarter,
  transformer: sldTransformer,
  generator: sldGenerator,
  ups: sldUps,
  busbar: sldBusbar,
  terminal: sldTerminal,
  junction: sldJunction,
};

export const SLD_SYMBOL_ORDER: SldSymbolKey[] = [
  "mcc",
  "panel",
  "mccb",
  "mcb",
  "fuse",
  "contactor",
  "transformer",
  "generator",
  "ups",
  "motor",
  "vfd",
  "soft-starter",
  "busbar",
  "terminal",
  "junction",
];

// =====================================================================
// Layout sembolleri (üst görünüm — top-down)
// =====================================================================

const layoutTagFields: PropertyField[] = [
  { key: "tag", label: "Etiket", placeholder: "Pano-1A" },
];

const layoutMcc: SymbolDef<LayoutSymbolKey> = {
  key: "mcc",
  name: "MCC",
  primary: "tag",
  fields: [...layoutTagFields, { key: "size", label: "Boyut" }],
  Shape: () => (
    <g>
      <rect x={6} y={14} width={68} height={52} fill="#fff" stroke="#111827" strokeWidth={2.5} rx={2} />
      <text x={40} y={45} textAnchor="middle" fontSize={16} fontWeight={700} fill="#111827">
        MCC
      </text>
    </g>
  ),
  summary: () => [],
};

const layoutPanel: SymbolDef<LayoutSymbolKey> = {
  key: "panel",
  name: "Pano",
  primary: "tag",
  fields: [...layoutTagFields, { key: "type", label: "Tip" }],
  Shape: () => (
    <g>
      <rect x={14} y={14} width={52} height={52} fill="#fff" stroke="#111827" strokeWidth={2.5} rx={2} />
      <line x1={22} y1={26} x2={58} y2={26} stroke="#111827" strokeWidth={1.5} />
      <line x1={22} y1={36} x2={58} y2={36} stroke="#111827" strokeWidth={1.5} />
      <line x1={22} y1={46} x2={58} y2={46} stroke="#111827" strokeWidth={1.5} />
    </g>
  ),
  summary: () => [],
};

const layoutTransformer: SymbolDef<LayoutSymbolKey> = {
  key: "transformer",
  name: "Trafo",
  primary: "tag",
  fields: [...layoutTagFields, { key: "rating", label: "Güç (kVA)" }],
  summary: (p) => [p.rating && `${p.rating} kVA`].filter(Boolean) as string[],
  Shape: () => (
    <g fill="#fff" stroke="#111827" strokeWidth={2.5}>
      <rect x={10} y={20} width={60} height={40} rx={4} />
      <circle cx={30} cy={40} r={10} />
      <circle cx={50} cy={40} r={10} />
    </g>
  ),
};

const layoutUps: SymbolDef<LayoutSymbolKey> = {
  key: "ups",
  name: "UPS",
  primary: "tag",
  fields: [...layoutTagFields, { key: "rating", label: "Güç (kVA)" }],
  summary: (p) => [p.rating && `${p.rating} kVA`].filter(Boolean) as string[],
  Shape: () => (
    <g>
      <rect x={10} y={18} width={60} height={44} fill="#fff" stroke="#111827" strokeWidth={2.5} rx={2} />
      <text x={40} y={46} textAnchor="middle" fontSize={14} fontWeight={700} fill="#111827">
        UPS
      </text>
    </g>
  ),
};

const layoutMotor: SymbolDef<LayoutSymbolKey> = {
  key: "motor",
  name: "Motor",
  primary: "tag",
  fields: [...layoutTagFields, { key: "power", label: "Güç (kW)" }],
  summary: (p) => [p.power && `${p.power} kW`].filter(Boolean) as string[],
  Shape: () => (
    <g>
      <circle cx={40} cy={40} r={28} fill="#fff" stroke="#111827" strokeWidth={2.5} />
      <text x={40} y={47} textAnchor="middle" fontSize={22} fontWeight={700} fill="#111827">
        M
      </text>
    </g>
  ),
};

const layoutPump: SymbolDef<LayoutSymbolKey> = {
  key: "pump",
  name: "Pompa",
  primary: "tag",
  fields: [...layoutTagFields, { key: "flow", label: "Debi" }],
  summary: () => [],
  Shape: () => (
    <g>
      <circle cx={40} cy={40} r={26} fill="#fff" stroke="#111827" strokeWidth={2.5} />
      <path d="M28 40 L52 30 L52 50 Z" fill="#111827" />
    </g>
  ),
};

const layoutJunction: SymbolDef<LayoutSymbolKey> = {
  key: "junction",
  name: "Buat",
  primary: "tag",
  fields: layoutTagFields,
  summary: () => [],
  Shape: () => (
    <g>
      <rect x={22} y={22} width={36} height={36} fill="#fff" stroke="#111827" strokeWidth={2.5} rx={3} />
      <line x1={22} y1={22} x2={58} y2={58} stroke="#111827" strokeWidth={2} />
    </g>
  ),
};

export const LAYOUT_SYMBOLS: Record<LayoutSymbolKey, SymbolDef<LayoutSymbolKey>> = {
  mcc: layoutMcc,
  panel: layoutPanel,
  transformer: layoutTransformer,
  ups: layoutUps,
  motor: layoutMotor,
  pump: layoutPump,
  junction: layoutJunction,
};

export const LAYOUT_SYMBOL_ORDER: LayoutSymbolKey[] = [
  "mcc",
  "panel",
  "transformer",
  "ups",
  "motor",
  "pump",
  "junction",
];

// =====================================================================
// Kablo (cable) property alanları — wire için kullanılır
// =====================================================================

export const CABLE_FIELDS: PropertyField[] = [
  { key: "type", label: "Kablo Tipi", placeholder: "NYY / N2XH" },
  { key: "size", label: "Kesit", placeholder: "3x120+70" },
  { key: "cores", label: "Damar Sayısı" },
  { key: "length", label: "Uzunluk (m)", placeholder: "85" },
  { key: "from", label: "Kaynak" },
  { key: "to", label: "Hedef" },
];

export function cableSummary(props: Record<string, string>): string[] {
  const lines: string[] = [];
  if (props.size) lines.push(props.size);
  if (props.length) lines.push(`L=${props.length}m`);
  return lines;
}
