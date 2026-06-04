// Tüm vektör çizim sahnesi için ortak veri modeli.
// JSON olarak saklanır, gelecekte DXF/SVG/PDF'e dönüştürülebilir.

export type DrawingKind = "freehand" | "layout" | "sld";

export type SceneJSON = {
  version: 1;
  kind: DrawingKind;
  width: number; // sahne (kağıt) genişliği — px birimi
  height: number;
  grid: number; // grid aralığı px
  objects: SceneObject[];
  /** mm <-> px birim çarpanı (layout modunda mesafe ölçümü için) */
  unitsPerPixel?: number;
  /** Layout modunda gösterilecek birim adı, "m" gibi */
  unitLabel?: string;
};

export type SceneObject =
  | RoomBoxObject
  | WallObject
  | DoorObject
  | WindowObject
  | CableTrayObject
  | LayoutSymbolObject
  | DimensionObject
  | SldSymbolObject
  | SldWireObject;

type Base = {
  id: string;
};

export type RoomBoxObject = Base & {
  type: "room";
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
};

export type WallObject = Base & {
  type: "wall";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  thickness?: number;
};

export type DoorObject = Base & {
  type: "door";
  x: number;
  y: number;
  w: number;
  rotation: number;
};

export type WindowObject = Base & {
  type: "window";
  x: number;
  y: number;
  w: number;
  rotation: number;
};

export type CableTrayObject = Base & {
  type: "tray";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type DimensionObject = Base & {
  type: "dimension";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label?: string;
};

export type LayoutSymbolKey =
  | "mcc"
  | "panel"
  | "transformer"
  | "ups"
  | "motor"
  | "pump"
  | "junction";

export type LayoutSymbolObject = Base & {
  type: "layout-symbol";
  symbol: LayoutSymbolKey;
  x: number;
  y: number;
  rotation: number;
  properties: Record<string, string>;
};

export type SldSymbolKey =
  | "mcc"
  | "panel"
  | "mccb"
  | "mcb"
  | "fuse"
  | "contactor"
  | "motor"
  | "vfd"
  | "soft-starter"
  | "transformer"
  | "generator"
  | "ups"
  | "busbar"
  | "terminal"
  | "junction";

export type SldSymbolObject = Base & {
  type: "sld-symbol";
  symbol: SldSymbolKey;
  x: number;
  y: number;
  rotation: number;
  properties: Record<string, string>;
};

export type SldWireObject = Base & {
  type: "wire";
  fromId: string;
  toId: string;
  properties: Record<string, string>;
};

export const DEFAULT_SCENE = (kind: Exclude<DrawingKind, "freehand">): SceneJSON => ({
  version: 1,
  kind,
  width: 1600,
  height: 1100,
  grid: 20,
  objects: [],
  unitsPerPixel: kind === "layout" ? 0.05 : undefined, // 1px = 5cm (yaklaşık)
  unitLabel: kind === "layout" ? "m" : undefined,
});
