import type { SceneJSON, SceneObject } from "./types";
import { SYMBOL_BOX } from "./symbols";

export function snap(value: number, grid: number): number {
  return Math.round(value / grid) * grid;
}

export function uid(prefix = "o"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
}

export function distance(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

export function formatDistance(scene: SceneJSON, px: number): string {
  const upp = scene.unitsPerPixel ?? 1;
  const value = px * upp;
  if (scene.unitLabel) {
    if (value >= 1) return `${value.toFixed(2)} ${scene.unitLabel}`;
    return `${(value * 100).toFixed(0)} cm`;
  }
  return `${Math.round(px)} px`;
}

/** Sembolün ekrandaki bağlantı (port) koordinatları — basit: merkez */
export function symbolCenter(o: { x: number; y: number }) {
  return { cx: o.x + SYMBOL_BOX / 2, cy: o.y + SYMBOL_BOX / 2 };
}

/** İki sembol arasında ortogonal L-routing path noktaları */
export function orthogonalPath(
  ax: number,
  ay: number,
  bx: number,
  by: number,
): string {
  if (Math.abs(ax - bx) < 1 || Math.abs(ay - by) < 1) {
    return `M ${ax} ${ay} L ${bx} ${by}`;
  }
  const midY = ay + (by - ay) / 2;
  return `M ${ax} ${ay} L ${ax} ${midY} L ${bx} ${midY} L ${bx} ${by}`;
}

export function midpoint(
  ax: number,
  ay: number,
  bx: number,
  by: number,
): { x: number; y: number } {
  return { x: (ax + bx) / 2, y: (ay + by) / 2 };
}

export function findObject(
  scene: SceneJSON,
  id: string | null,
): SceneObject | undefined {
  if (!id) return undefined;
  return scene.objects.find((o) => o.id === id);
}
