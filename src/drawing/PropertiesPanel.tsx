import {
  CABLE_FIELDS,
  LAYOUT_SYMBOLS,
  SLD_SYMBOLS,
  type PropertyField,
} from "./symbols";
import type { SceneObject } from "./types";

type Props = {
  obj: SceneObject | null;
  onChange: (id: string, patch: Partial<SceneObject>) => void;
  onRotate: () => void;
  onDelete: () => void;
};

export default function PropertiesPanel({
  obj,
  onChange,
  onRotate,
  onDelete,
}: Props) {
  if (!obj) {
    return (
      <div className="rounded-xl border-2 border-dashed border-zinc-200 bg-white p-3 text-center text-xs text-zinc-400">
        Bir nesne seç
      </div>
    );
  }

  const supportsRotate =
    obj.type === "layout-symbol" ||
    obj.type === "sld-symbol" ||
    obj.type === "door" ||
    obj.type === "window";

  let fields: PropertyField[] = [];
  let symbolTitle = "";

  if (obj.type === "layout-symbol") {
    const def = LAYOUT_SYMBOLS[obj.symbol];
    fields = def?.fields ?? [];
    symbolTitle = def?.name ?? "Sembol";
  } else if (obj.type === "sld-symbol") {
    const def = SLD_SYMBOLS[obj.symbol];
    fields = def?.fields ?? [];
    symbolTitle = def?.name ?? "Sembol";
  } else if (obj.type === "wire") {
    fields = CABLE_FIELDS;
    symbolTitle = "Kablo";
  } else if (obj.type === "room") {
    symbolTitle = "Oda";
  } else if (obj.type === "wall") {
    symbolTitle = "Duvar";
  } else if (obj.type === "tray") {
    symbolTitle = "Kablo Tablası";
  } else if (obj.type === "door") {
    symbolTitle = "Kapı";
  } else if (obj.type === "window") {
    symbolTitle = "Pencere";
  } else if (obj.type === "dimension") {
    symbolTitle = "Ölçü";
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex-1 text-sm font-semibold text-zinc-900">
          {symbolTitle}
        </div>
        {supportsRotate && (
          <button
            type="button"
            onClick={onRotate}
            className="rounded-lg border-2 border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-semibold active:bg-zinc-50"
          >
            Döndür 90°
          </button>
        )}
        <button
          type="button"
          onClick={onDelete}
          aria-label="Sil"
          className="rounded-lg border-2 border-rose-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-600 active:bg-rose-50"
        >
          Sil
        </button>
      </div>

      {(obj.type === "layout-symbol" ||
        obj.type === "sld-symbol" ||
        obj.type === "wire") && (
        <div className="space-y-2">
          {fields.map((f) => (
            <label key={f.key} className="block">
              <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                {f.label}
              </div>
              <input
                type="text"
                value={obj.properties[f.key] ?? ""}
                placeholder={f.placeholder}
                onChange={(e) =>
                  onChange(obj.id, {
                    properties: { ...obj.properties, [f.key]: e.target.value },
                  } as Partial<SceneObject>)
                }
                className="w-full rounded-lg border-2 border-zinc-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-zinc-900"
              />
            </label>
          ))}
        </div>
      )}

      {obj.type === "room" && (
        <div className="space-y-2">
          <NumberField
            label="Genişlik (px)"
            value={obj.w}
            onChange={(v) => onChange(obj.id, { w: v } as Partial<SceneObject>)}
          />
          <NumberField
            label="Yükseklik (px)"
            value={obj.h}
            onChange={(v) => onChange(obj.id, { h: v } as Partial<SceneObject>)}
          />
          <label className="block">
            <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              Etiket
            </div>
            <input
              type="text"
              value={obj.label ?? ""}
              onChange={(e) =>
                onChange(obj.id, { label: e.target.value } as Partial<SceneObject>)
              }
              className="w-full rounded-lg border-2 border-zinc-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-zinc-900"
            />
          </label>
        </div>
      )}

      {(obj.type === "door" || obj.type === "window") && (
        <NumberField
          label="Genişlik (px)"
          value={obj.w}
          onChange={(v) => onChange(obj.id, { w: v } as Partial<SceneObject>)}
        />
      )}

      {obj.type === "dimension" && (
        <label className="block">
          <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            Etiket (boş bırak: otomatik)
          </div>
          <input
            type="text"
            value={obj.label ?? ""}
            onChange={(e) =>
              onChange(obj.id, { label: e.target.value } as Partial<SceneObject>)
            }
            className="w-full rounded-lg border-2 border-zinc-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-zinc-900"
          />
        </label>
      )}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-full rounded-lg border-2 border-zinc-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-zinc-900"
      />
    </label>
  );
}
