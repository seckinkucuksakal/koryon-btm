import {
  CABLE_FIELDS,
  cableSummary,
  LAYOUT_SYMBOLS,
  SLD_SYMBOLS,
  SYMBOL_BOX,
} from "./symbols";
import type {
  DimensionObject,
  DoorObject,
  LayoutSymbolObject,
  RoomBoxObject,
  SceneJSON,
  SceneObject,
  SldSymbolObject,
  SldWireObject,
  WallObject,
  WindowObject,
  CableTrayObject,
} from "./types";
import {
  distance,
  formatDistance,
  midpoint,
  orthogonalPath,
  symbolCenter,
} from "./utils";

const SELECT_COLOR = "#2563eb";

type Common = {
  selected?: boolean;
  onPointerDown?: (e: React.PointerEvent) => void;
};

export function renderObject(
  obj: SceneObject,
  scene: SceneJSON,
  props: Common,
): React.ReactElement | null {
  switch (obj.type) {
    case "room":
      return <RoomRenderer key={obj.id} obj={obj} {...props} />;
    case "wall":
      return <WallRenderer key={obj.id} obj={obj} {...props} />;
    case "door":
      return <DoorRenderer key={obj.id} obj={obj} {...props} />;
    case "window":
      return <WindowRenderer key={obj.id} obj={obj} {...props} />;
    case "tray":
      return <TrayRenderer key={obj.id} obj={obj} {...props} />;
    case "dimension":
      return (
        <DimensionRenderer key={obj.id} obj={obj} scene={scene} {...props} />
      );
    case "layout-symbol":
      return <LayoutSymbolRenderer key={obj.id} obj={obj} {...props} />;
    case "sld-symbol":
      return <SldSymbolRenderer key={obj.id} obj={obj} {...props} />;
    case "wire":
      return (
        <WireRenderer key={obj.id} obj={obj} scene={scene} {...props} />
      );
    default:
      return null;
  }
}

// =====================================================================

function RoomRenderer({
  obj,
  selected,
  onPointerDown,
}: { obj: RoomBoxObject } & Common) {
  return (
    <g style={{ cursor: "move" }} onPointerDown={onPointerDown}>
      <rect
        x={obj.x}
        y={obj.y}
        width={obj.w}
        height={obj.h}
        fill="#fff"
        stroke={selected ? SELECT_COLOR : "#111827"}
        strokeWidth={selected ? 3 : 4}
      />
      {obj.label && (
        <text
          x={obj.x + 12}
          y={obj.y + 24}
          fontSize={16}
          fontWeight={600}
          fill="#111827"
        >
          {obj.label}
        </text>
      )}
      {selected && <Handles x={obj.x} y={obj.y} w={obj.w} h={obj.h} />}
    </g>
  );
}

function WallRenderer({
  obj,
  selected,
  onPointerDown,
}: { obj: WallObject } & Common) {
  const t = obj.thickness ?? 6;
  return (
    <g onPointerDown={onPointerDown} style={{ cursor: "move" }}>
      <line
        x1={obj.x1}
        y1={obj.y1}
        x2={obj.x2}
        y2={obj.y2}
        stroke="transparent"
        strokeWidth={Math.max(16, t * 2)}
      />
      <line
        x1={obj.x1}
        y1={obj.y1}
        x2={obj.x2}
        y2={obj.y2}
        stroke={selected ? SELECT_COLOR : "#111827"}
        strokeWidth={t}
        strokeLinecap="round"
      />
    </g>
  );
}

function TrayRenderer({
  obj,
  selected,
  onPointerDown,
}: { obj: CableTrayObject } & Common) {
  return (
    <g onPointerDown={onPointerDown} style={{ cursor: "move" }}>
      <line
        x1={obj.x1}
        y1={obj.y1}
        x2={obj.x2}
        y2={obj.y2}
        stroke="transparent"
        strokeWidth={20}
      />
      <line
        x1={obj.x1}
        y1={obj.y1}
        x2={obj.x2}
        y2={obj.y2}
        stroke={selected ? SELECT_COLOR : "#16a34a"}
        strokeWidth={6}
        strokeDasharray="2 6"
        strokeLinecap="round"
      />
    </g>
  );
}

function DoorRenderer({
  obj,
  selected,
  onPointerDown,
}: { obj: DoorObject } & Common) {
  const w = obj.w;
  return (
    <g
      onPointerDown={onPointerDown}
      transform={`translate(${obj.x} ${obj.y}) rotate(${obj.rotation})`}
      style={{ cursor: "move" }}
    >
      <line
        x1={0}
        y1={0}
        x2={w}
        y2={0}
        stroke={selected ? SELECT_COLOR : "#111827"}
        strokeWidth={2.5}
      />
      <path
        d={`M 0 0 A ${w} ${w} 0 0 1 ${w} ${w}`}
        fill="none"
        stroke={selected ? SELECT_COLOR : "#6b7280"}
        strokeWidth={1.5}
      />
    </g>
  );
}

function WindowRenderer({
  obj,
  selected,
  onPointerDown,
}: { obj: WindowObject } & Common) {
  return (
    <g
      onPointerDown={onPointerDown}
      transform={`translate(${obj.x} ${obj.y}) rotate(${obj.rotation})`}
      style={{ cursor: "move" }}
    >
      <rect
        x={0}
        y={-3}
        width={obj.w}
        height={6}
        fill="#fff"
        stroke={selected ? SELECT_COLOR : "#111827"}
        strokeWidth={2}
      />
      <line
        x1={0}
        y1={0}
        x2={obj.w}
        y2={0}
        stroke={selected ? SELECT_COLOR : "#111827"}
        strokeWidth={1.5}
        strokeDasharray="4 4"
      />
    </g>
  );
}

function DimensionRenderer({
  obj,
  scene,
  selected,
  onPointerDown,
}: { obj: DimensionObject; scene: SceneJSON } & Common) {
  const { x: mx, y: my } = midpoint(obj.x1, obj.y1, obj.x2, obj.y2);
  const len = distance(obj.x1, obj.y1, obj.x2, obj.y2);
  const label = obj.label || formatDistance(scene, len);
  const dx = obj.x2 - obj.x1;
  const dy = obj.y2 - obj.y1;
  const L = Math.max(1, Math.sqrt(dx * dx + dy * dy));
  const nx = -dy / L;
  const ny = dx / L;
  const off = 8;
  const stroke = selected ? SELECT_COLOR : "#0ea5e9";
  return (
    <g onPointerDown={onPointerDown} style={{ cursor: "move" }}>
      <line
        x1={obj.x1}
        y1={obj.y1}
        x2={obj.x2}
        y2={obj.y2}
        stroke={stroke}
        strokeWidth={2}
      />
      <line
        x1={obj.x1 + nx * off}
        y1={obj.y1 + ny * off}
        x2={obj.x1 - nx * off}
        y2={obj.y1 - ny * off}
        stroke={stroke}
        strokeWidth={2}
      />
      <line
        x1={obj.x2 + nx * off}
        y1={obj.y2 + ny * off}
        x2={obj.x2 - nx * off}
        y2={obj.y2 - ny * off}
        stroke={stroke}
        strokeWidth={2}
      />
      <rect
        x={mx - 32}
        y={my - 11}
        width={64}
        height={22}
        rx={4}
        fill="#fff"
        stroke={stroke}
      />
      <text
        x={mx}
        y={my + 5}
        textAnchor="middle"
        fontSize={13}
        fontWeight={600}
        fill="#0c4a6e"
      >
        {label}
      </text>
    </g>
  );
}

function LayoutSymbolRenderer({
  obj,
  selected,
  onPointerDown,
}: { obj: LayoutSymbolObject } & Common) {
  const def = LAYOUT_SYMBOLS[obj.symbol];
  if (!def) return null;
  return (
    <SymbolBody
      obj={obj}
      Shape={def.Shape}
      label={def.primary ? obj.properties[def.primary] : undefined}
      summary={def.summary?.(obj.properties) ?? []}
      symbolName={def.name}
      selected={selected}
      onPointerDown={onPointerDown}
    />
  );
}

function SldSymbolRenderer({
  obj,
  selected,
  onPointerDown,
}: { obj: SldSymbolObject } & Common) {
  const def = SLD_SYMBOLS[obj.symbol];
  if (!def) return null;
  return (
    <SymbolBody
      obj={obj}
      Shape={def.Shape}
      label={def.primary ? obj.properties[def.primary] : undefined}
      summary={def.summary?.(obj.properties) ?? []}
      symbolName={def.name}
      selected={selected}
      onPointerDown={onPointerDown}
    />
  );
}

function SymbolBody({
  obj,
  Shape,
  label,
  summary,
  symbolName,
  selected,
  onPointerDown,
}: {
  obj: { id: string; x: number; y: number; rotation: number };
  Shape: () => React.ReactElement;
  label?: string;
  summary: string[];
  symbolName: string;
  selected?: boolean;
  onPointerDown?: (e: React.PointerEvent) => void;
}) {
  const half = SYMBOL_BOX / 2;
  return (
    <g
      data-id={obj.id}
      onPointerDown={onPointerDown}
      style={{ cursor: "move" }}
    >
      <g transform={`translate(${obj.x} ${obj.y}) rotate(${obj.rotation} ${half} ${half})`}>
        <Shape />
        {selected && (
          <rect
            x={2}
            y={2}
            width={SYMBOL_BOX - 4}
            height={SYMBOL_BOX - 4}
            fill="none"
            stroke={SELECT_COLOR}
            strokeWidth={2}
            strokeDasharray="6 4"
          />
        )}
      </g>
      <text
        x={obj.x + half}
        y={obj.y + SYMBOL_BOX + 14}
        textAnchor="middle"
        fontSize={13}
        fontWeight={700}
        fill="#111827"
      >
        {label || symbolName}
      </text>
      {summary.map((line, i) => (
        <text
          key={i}
          x={obj.x + half}
          y={obj.y + SYMBOL_BOX + 14 + 14 * (i + 1)}
          textAnchor="middle"
          fontSize={11}
          fill="#374151"
        >
          {line}
        </text>
      ))}
    </g>
  );
}

function WireRenderer({
  obj,
  scene,
  selected,
  onPointerDown,
}: { obj: SldWireObject; scene: SceneJSON } & Common) {
  const from = scene.objects.find((o) => o.id === obj.fromId);
  const to = scene.objects.find((o) => o.id === obj.toId);
  if (
    !from ||
    !to ||
    !("x" in from) ||
    !("y" in from) ||
    !("x" in to) ||
    !("y" in to)
  )
    return null;
  const a = symbolCenter({ x: from.x as number, y: from.y as number });
  const b = symbolCenter({ x: to.x as number, y: to.y as number });
  const d = orthogonalPath(a.cx, a.cy, b.cx, b.cy);
  const lines = cableSummary(obj.properties);
  const mid = midpoint(a.cx, a.cy, b.cx, b.cy);
  return (
    <g onPointerDown={onPointerDown} style={{ cursor: "pointer" }}>
      <path
        d={d}
        fill="none"
        stroke="transparent"
        strokeWidth={18}
      />
      <path
        d={d}
        fill="none"
        stroke={selected ? SELECT_COLOR : "#111827"}
        strokeWidth={selected ? 2.5 : 2}
      />
      {lines.length > 0 && (
        <g>
          <rect
            x={mid.x - 38}
            y={mid.y - 10 - (lines.length - 1) * 7}
            width={76}
            height={20 + (lines.length - 1) * 14}
            rx={4}
            fill="#fff"
            stroke="#9ca3af"
            strokeWidth={1}
          />
          {lines.map((line, i) => (
            <text
              key={i}
              x={mid.x}
              y={mid.y + 4 + i * 14 - (lines.length - 1) * 7}
              textAnchor="middle"
              fontSize={11}
              fontWeight={i === 0 ? 700 : 400}
              fill="#111827"
            >
              {line}
            </text>
          ))}
        </g>
      )}
    </g>
  );
}

function Handles({
  x,
  y,
  w,
  h,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
}) {
  const s = 8;
  const points = [
    [x, y],
    [x + w, y],
    [x, y + h],
    [x + w, y + h],
  ];
  return (
    <>
      {points.map(([px, py], i) => (
        <rect
          key={i}
          x={px - s / 2}
          y={py - s / 2}
          width={s}
          height={s}
          fill={SELECT_COLOR}
        />
      ))}
    </>
  );
}

export const CABLE_FIELDS_REF = CABLE_FIELDS;
