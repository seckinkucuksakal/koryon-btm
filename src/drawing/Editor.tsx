import { useEffect, useMemo, useRef, useState } from "react";
import Palette, { type Tool } from "./Palette";
import PropertiesPanel from "./PropertiesPanel";
import { renderObject } from "./ObjectRenderers";
import { useScene } from "./useScene";
import { LAYOUT_SYMBOLS, SLD_SYMBOLS, SYMBOL_BOX } from "./symbols";
import {
  DEFAULT_SCENE,
  type DrawingKind,
  type LayoutSymbolKey,
  type SceneJSON,
  type SceneObject,
  type SldSymbolKey,
} from "./types";
import { snap, uid } from "./utils";
import {
  downloadFile,
  sceneToSvgString,
  svgStringToPngBlob,
} from "./exportScene";

type Props = {
  /** "layout" | "sld" — freehand burada değil */
  kind: Exclude<DrawingKind, "freehand">;
  /** Düzenleme modunda mevcut sahne; yoksa boş başlar */
  initialScene?: SceneJSON;
  /** Kaydet butonuna basıldığında çağrılır. PNG'yi yüklemek senin sorumluluğunda. */
  onSave: (data: { scene: SceneJSON; png: Blob }) => Promise<void> | void;
  saving?: boolean;
};

type DragState =
  | null
  | {
      type: "pan";
      clientX: number;
      clientY: number;
      vbX: number;
      vbY: number;
    }
  | {
      type: "move";
      id: string;
      origin: SceneObject;
      cursorX: number;
      cursorY: number;
    };

type Draft =
  | null
  | {
      kind: "wall" | "tray" | "dimension" | "room";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
    };

export default function DrawingEditor({
  kind,
  initialScene,
  onSave,
  saving,
}: Props) {
  const start = useMemo<SceneJSON>(
    () => initialScene ?? DEFAULT_SCENE(kind),
    [kind, initialScene],
  );
  const {
    scene,
    pushHistory,
    addObject,
    updateObject,
    deleteObject,
    undo,
    redo,
  } = useScene(start);

  const [tool, setTool] = useState<Tool>("select");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(null);
  const [wireFromId, setWireFromId] = useState<string | null>(null);
  const [vb, setVb] = useState({
    x: 0,
    y: 0,
    w: scene.width,
    h: scene.height,
  });
  const [mobileSheet, setMobileSheet] = useState<"none" | "palette" | "props">(
    "none",
  );

  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<DragState>(null);

  // Klavye kısayolları
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedId) {
          deleteObject(selectedId);
          setSelectedId(null);
        }
      } else if (e.key === "Escape") {
        setSelectedId(null);
        setDraft(null);
        setWireFromId(null);
        setTool("select");
      } else if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, deleteObject, undo, redo]);

  function clientToScene(clientX: number, clientY: number) {
    const rect = svgRef.current!.getBoundingClientRect();
    const rx = (clientX - rect.left) / rect.width;
    const ry = (clientY - rect.top) / rect.height;
    return { x: vb.x + rx * vb.w, y: vb.y + ry * vb.h };
  }

  function zoomBy(factor: number, anchor?: { x: number; y: number }) {
    const newW = Math.min(Math.max(vb.w * factor, scene.width * 0.2), scene.width * 4);
    const newH = (newW / vb.w) * vb.h;
    if (!anchor) {
      // anchor canvas merkezi
      anchor = { x: vb.x + vb.w / 2, y: vb.y + vb.h / 2 };
    }
    const rx = (anchor.x - vb.x) / vb.w;
    const ry = (anchor.y - vb.y) / vb.h;
    setVb({
      x: anchor.x - rx * newW,
      y: anchor.y - ry * newH,
      w: newW,
      h: newH,
    });
  }

  function fitToScreen() {
    setVb({ x: 0, y: 0, w: scene.width, h: scene.height });
  }

  function handleAddLayoutSymbol(key: LayoutSymbolKey) {
    const id = uid("ls");
    const cx = snap(vb.x + vb.w / 2 - SYMBOL_BOX / 2, scene.grid);
    const cy = snap(vb.y + vb.h / 2 - SYMBOL_BOX / 2, scene.grid);
    const def = LAYOUT_SYMBOLS[key];
    const properties: Record<string, string> = {};
    def.fields.forEach((f) => (properties[f.key] = ""));
    addObject({
      id,
      type: "layout-symbol",
      symbol: key,
      x: cx,
      y: cy,
      rotation: 0,
      properties,
    });
    setSelectedId(id);
    setTool("select");
    setMobileSheet("props");
  }

  function handleAddSldSymbol(key: SldSymbolKey) {
    const id = uid("sld");
    const cx = snap(vb.x + vb.w / 2 - SYMBOL_BOX / 2, scene.grid);
    const cy = snap(vb.y + vb.h / 2 - SYMBOL_BOX / 2, scene.grid);
    const def = SLD_SYMBOLS[key];
    const properties: Record<string, string> = {};
    def.fields.forEach((f) => (properties[f.key] = ""));
    addObject({
      id,
      type: "sld-symbol",
      symbol: key,
      x: cx,
      y: cy,
      rotation: 0,
      properties,
    });
    setSelectedId(id);
    setTool("select");
    setMobileSheet("props");
  }

  function handleSvgPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    const target = e.target as Element;
    const isBg =
      target === e.currentTarget ||
      (target as HTMLElement).dataset?.bg === "1";
    if (!isBg) return;

    const { x, y } = clientToScene(e.clientX, e.clientY);
    const sx = snap(x, scene.grid);
    const sy = snap(y, scene.grid);

    if (tool === "select") {
      setSelectedId(null);
      svgRef.current?.setPointerCapture(e.pointerId);
      dragRef.current = {
        type: "pan",
        clientX: e.clientX,
        clientY: e.clientY,
        vbX: vb.x,
        vbY: vb.y,
      };
      return;
    }

    if (tool === "door" || tool === "window") {
      const id = uid("o");
      addObject({ id, type: tool, x: sx, y: sy, w: 60, rotation: 0 });
      setSelectedId(id);
      return;
    }

    if (
      tool === "wall" ||
      tool === "tray" ||
      tool === "dimension" ||
      tool === "room"
    ) {
      if (!draft) {
        setDraft({ kind: tool, x1: sx, y1: sy, x2: sx, y2: sy });
      } else if (draft.kind === tool) {
        finalizeDraft({ ...draft, x2: sx, y2: sy });
      }
      return;
    }

    if (tool === "wire") {
      setWireFromId(null);
    }
  }

  function finalizeDraft(d: NonNullable<Draft>) {
    const id = uid("o");
    if (d.kind === "wall") {
      addObject({ id, type: "wall", x1: d.x1, y1: d.y1, x2: d.x2, y2: d.y2 });
    } else if (d.kind === "tray") {
      addObject({ id, type: "tray", x1: d.x1, y1: d.y1, x2: d.x2, y2: d.y2 });
    } else if (d.kind === "dimension") {
      addObject({
        id,
        type: "dimension",
        x1: d.x1,
        y1: d.y1,
        x2: d.x2,
        y2: d.y2,
      });
    } else if (d.kind === "room") {
      const x = Math.min(d.x1, d.x2);
      const y = Math.min(d.y1, d.y2);
      const w = Math.abs(d.x2 - d.x1);
      const h = Math.abs(d.y2 - d.y1);
      if (w < 20 || h < 20) {
        setDraft(null);
        return;
      }
      addObject({ id, type: "room", x, y, w, h });
    }
    setDraft(null);
    setSelectedId(id);
  }

  function handleSvgPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const ds = dragRef.current;
    if (ds?.type === "pan") {
      const rect = svgRef.current!.getBoundingClientRect();
      const dxScene = ((e.clientX - ds.clientX) / rect.width) * vb.w;
      const dyScene = ((e.clientY - ds.clientY) / rect.height) * vb.h;
      setVb((v) => ({ ...v, x: ds.vbX - dxScene, y: ds.vbY - dyScene }));
      return;
    }
    if (ds?.type === "move") {
      const { x, y } = clientToScene(e.clientX, e.clientY);
      const dx = x - ds.cursorX;
      const dy = y - ds.cursorY;
      const moved = applyMove(ds.origin, dx, dy, scene.grid);
      updateObject(ds.id, moved as Partial<SceneObject>, false);
      return;
    }
    if (draft) {
      const { x, y } = clientToScene(e.clientX, e.clientY);
      setDraft({ ...draft, x2: snap(x, scene.grid), y2: snap(y, scene.grid) });
    }
  }

  function handleSvgPointerUp(e: React.PointerEvent<SVGSVGElement>) {
    if (dragRef.current) {
      svgRef.current?.releasePointerCapture?.(e.pointerId);
    }
    dragRef.current = null;
  }

  function handleSvgWheel(e: React.WheelEvent<SVGSVGElement>) {
    if (!e.ctrlKey && Math.abs(e.deltaY) < 1) return;
    e.preventDefault();
    const { x, y } = clientToScene(e.clientX, e.clientY);
    const factor = e.deltaY < 0 ? 0.85 : 1 / 0.85;
    zoomBy(factor, { x, y });
  }

  function handleObjectPointerDown(obj: SceneObject, e: React.PointerEvent) {
    if (tool === "wire") {
      e.stopPropagation();
      if (obj.type !== "sld-symbol") return;
      if (!wireFromId) {
        setWireFromId(obj.id);
      } else if (wireFromId === obj.id) {
        setWireFromId(null);
      } else {
        const id = uid("wire");
        const props: Record<string, string> = {};
        addObject({
          id,
          type: "wire",
          fromId: wireFromId,
          toId: obj.id,
          properties: props,
        });
        setSelectedId(id);
        setWireFromId(null);
      }
      return;
    }

    e.stopPropagation();
    setSelectedId(obj.id);

    if (!canMove(obj)) return;

    pushHistory();
    svgRef.current?.setPointerCapture(e.pointerId);
    const { x, y } = clientToScene(e.clientX, e.clientY);
    dragRef.current = {
      type: "move",
      id: obj.id,
      origin: { ...obj },
      cursorX: x,
      cursorY: y,
    };
  }

  function rotateSelected() {
    const obj = scene.objects.find((o) => o.id === selectedId);
    if (!obj) return;
    if (
      obj.type === "layout-symbol" ||
      obj.type === "sld-symbol" ||
      obj.type === "door" ||
      obj.type === "window"
    ) {
      updateObject(obj.id, {
        rotation: ((obj.rotation ?? 0) + 90) % 360,
      } as Partial<SceneObject>);
    }
  }

  async function handleSave() {
    const svg = sceneToSvgString(scene);
    const png = await svgStringToPngBlob(svg, scene.width, scene.height, 2);
    await onSave({ scene, png });
  }

  function handleExportSvg() {
    const svg = sceneToSvgString(scene);
    downloadFile(
      `cizim-${kind}-${Date.now()}.svg`,
      new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
    );
  }

  async function handleExportPng() {
    const svg = sceneToSvgString(scene);
    const png = await svgStringToPngBlob(svg, scene.width, scene.height, 2);
    downloadFile(`cizim-${kind}-${Date.now()}.png`, png);
  }

  function handleExportJson() {
    downloadFile(
      `cizim-${kind}-${Date.now()}.json`,
      new Blob([JSON.stringify(scene, null, 2)], { type: "application/json" }),
    );
  }

  const selected = scene.objects.find((o) => o.id === selectedId) ?? null;
  const mode = kind;

  return (
    <div className="flex h-[calc(100vh-7rem)] min-h-[520px] flex-col gap-2 sm:h-[calc(100vh-9rem)]">
      <Toolbar
        onUndo={undo}
        onRedo={redo}
        onRotate={rotateSelected}
        canRotate={
          !!selected &&
          (selected.type === "layout-symbol" ||
            selected.type === "sld-symbol" ||
            selected.type === "door" ||
            selected.type === "window")
        }
        onDelete={() => {
          if (selectedId) {
            deleteObject(selectedId);
            setSelectedId(null);
          }
        }}
        canDelete={!!selected}
        onSave={handleSave}
        saving={saving}
        onZoomIn={() => zoomBy(0.85)}
        onZoomOut={() => zoomBy(1 / 0.85)}
        onFit={fitToScreen}
        onExportSvg={handleExportSvg}
        onExportPng={handleExportPng}
        onExportJson={handleExportJson}
      />

      <div className="grid flex-1 min-h-0 gap-2 md:grid-cols-[14rem_minmax(0,1fr)_16rem]">
        {/* Sol palette: md+ */}
        <aside className="hidden overflow-y-auto rounded-2xl border-2 border-zinc-200 bg-white p-3 md:block">
          <Palette
            mode={mode}
            tool={tool}
            setTool={setTool}
            onAddLayoutSymbol={handleAddLayoutSymbol}
            onAddSldSymbol={handleAddSldSymbol}
          />
        </aside>

        {/* Canvas */}
        <div className="relative min-h-0 overflow-hidden rounded-2xl border-2 border-zinc-200 bg-white">
          <svg
            ref={svgRef}
            className="block h-full w-full touch-none"
            viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
            preserveAspectRatio="xMidYMid meet"
            onPointerDown={handleSvgPointerDown}
            onPointerMove={handleSvgPointerMove}
            onPointerUp={handleSvgPointerUp}
            onPointerCancel={handleSvgPointerUp}
            onWheel={handleSvgWheel}
          >
            <defs>
              <pattern
                id="dot-grid"
                x={0}
                y={0}
                width={scene.grid}
                height={scene.grid}
                patternUnits="userSpaceOnUse"
              >
                <circle cx={0} cy={0} r={1} fill="#d4d4d8" />
              </pattern>
            </defs>

            <rect
              data-bg="1"
              x={-scene.width}
              y={-scene.height}
              width={scene.width * 3}
              height={scene.height * 3}
              fill="#fafafa"
            />
            <rect
              data-bg="1"
              x={0}
              y={0}
              width={scene.width}
              height={scene.height}
              fill="#ffffff"
              stroke="#e4e4e7"
              strokeWidth={1}
            />
            <rect
              data-bg="1"
              x={0}
              y={0}
              width={scene.width}
              height={scene.height}
              fill="url(#dot-grid)"
              pointerEvents="none"
            />

            {scene.objects.map((o) =>
              renderObject(o, scene, {
                selected: o.id === selectedId,
                onPointerDown: (e: React.PointerEvent) =>
                  handleObjectPointerDown(o, e),
              }),
            )}

            {draft && (
              <DraftPreview draft={draft} />
            )}

            {wireFromId && (
              <WireSourceMarker
                fromId={wireFromId}
                scene={scene}
              />
            )}
          </svg>

          {/* Üstüne yarı saydam tool ipucu */}
          {(tool !== "select" || draft || wireFromId) && (
            <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-zinc-900/80 px-3 py-1 text-xs text-white">
              {hintText(tool, draft, wireFromId)}
            </div>
          )}

          {/* Mobile sheet butonları */}
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2 md:hidden">
            <button
              type="button"
              onClick={() =>
                setMobileSheet((s) => (s === "palette" ? "none" : "palette"))
              }
              className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-lg active:bg-zinc-800"
            >
              Sembol / Araç
            </button>
            <button
              type="button"
              onClick={() =>
                setMobileSheet((s) => (s === "props" ? "none" : "props"))
              }
              className="rounded-full border-2 border-zinc-200 bg-white px-4 py-2 text-sm font-semibold shadow-lg active:bg-zinc-50"
            >
              Özellikler
            </button>
          </div>
        </div>

        {/* Sağ properties: md+ */}
        <aside className="hidden overflow-y-auto rounded-2xl border-2 border-zinc-200 bg-white p-3 md:block">
          <PropertiesPanel
            obj={selected}
            onChange={(id, patch) => updateObject(id, patch)}
            onRotate={rotateSelected}
            onDelete={() => {
              if (selectedId) {
                deleteObject(selectedId);
                setSelectedId(null);
              }
            }}
          />
        </aside>
      </div>

      {/* Mobile bottom sheet */}
      {mobileSheet !== "none" && (
        <div className="fixed inset-x-0 bottom-0 z-30 max-h-[60vh] overflow-y-auto rounded-t-2xl border-t-2 border-zinc-200 bg-white p-4 shadow-2xl md:hidden">
          <div className="mb-3 flex items-center">
            <div className="text-sm font-semibold text-zinc-900">
              {mobileSheet === "palette" ? "Sembol / Araç" : "Özellikler"}
            </div>
            <button
              type="button"
              onClick={() => setMobileSheet("none")}
              className="ml-auto rounded-lg border-2 border-zinc-200 px-3 py-1.5 text-xs font-semibold active:bg-zinc-50"
            >
              Kapat
            </button>
          </div>
          {mobileSheet === "palette" ? (
            <Palette
              mode={mode}
              tool={tool}
              setTool={(t) => {
                setTool(t);
                if (t === "select") setMobileSheet("none");
              }}
              onAddLayoutSymbol={(k) => {
                handleAddLayoutSymbol(k);
                setMobileSheet("none");
              }}
              onAddSldSymbol={(k) => {
                handleAddSldSymbol(k);
                setMobileSheet("none");
              }}
            />
          ) : (
            <PropertiesPanel
              obj={selected}
              onChange={(id, patch) => updateObject(id, patch)}
              onRotate={rotateSelected}
              onDelete={() => {
                if (selectedId) {
                  deleteObject(selectedId);
                  setSelectedId(null);
                  setMobileSheet("none");
                }
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

function applyMove(
  obj: SceneObject,
  dx: number,
  dy: number,
  grid: number,
): Partial<SceneObject> {
  switch (obj.type) {
    case "layout-symbol":
    case "sld-symbol":
    case "door":
    case "window":
    case "room":
      return {
        x: snap(obj.x + dx, grid),
        y: snap(obj.y + dy, grid),
      } as Partial<SceneObject>;
    case "wall":
    case "tray":
    case "dimension":
      return {
        x1: snap(obj.x1 + dx, grid),
        y1: snap(obj.y1 + dy, grid),
        x2: snap(obj.x2 + dx, grid),
        y2: snap(obj.y2 + dy, grid),
      } as Partial<SceneObject>;
    case "wire":
      return {};
  }
}

function canMove(obj: SceneObject): boolean {
  return obj.type !== "wire";
}

function hintText(
  tool: Tool,
  draft: Draft,
  wireFrom: string | null,
): string {
  if (tool === "wire" && !wireFrom) return "Bir sembole dokun: kablo başlangıcı";
  if (tool === "wire" && wireFrom) return "Bir sembole dokun: kablo hedefi";
  if (tool === "wall") return draft ? "İkinci noktaya dokun" : "Duvarın başlangıcına dokun";
  if (tool === "tray") return draft ? "İkinci noktaya dokun" : "Tablanın başlangıcına dokun";
  if (tool === "dimension") return draft ? "İkinci noktaya dokun" : "Ölçüm başlangıcına dokun";
  if (tool === "room") return draft ? "Karşı köşeye dokun" : "Odanın bir köşesine dokun";
  if (tool === "door") return "Kapı için bir noktaya dokun";
  if (tool === "window") return "Pencere için bir noktaya dokun";
  return "";
}

function DraftPreview({ draft }: { draft: NonNullable<Draft> }) {
  const stroke = "#2563eb";
  if (draft.kind === "wall") {
    return (
      <line
        x1={draft.x1}
        y1={draft.y1}
        x2={draft.x2}
        y2={draft.y2}
        stroke={stroke}
        strokeWidth={3}
        strokeDasharray="6 4"
        pointerEvents="none"
      />
    );
  }
  if (draft.kind === "tray") {
    return (
      <line
        x1={draft.x1}
        y1={draft.y1}
        x2={draft.x2}
        y2={draft.y2}
        stroke={stroke}
        strokeWidth={3}
        strokeDasharray="3 6"
        pointerEvents="none"
      />
    );
  }
  if (draft.kind === "dimension") {
    return (
      <line
        x1={draft.x1}
        y1={draft.y1}
        x2={draft.x2}
        y2={draft.y2}
        stroke={stroke}
        strokeWidth={2}
        strokeDasharray="4 3"
        pointerEvents="none"
      />
    );
  }
  // room
  const x = Math.min(draft.x1, draft.x2);
  const y = Math.min(draft.y1, draft.y2);
  const w = Math.abs(draft.x2 - draft.x1);
  const h = Math.abs(draft.y2 - draft.y1);
  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      fill="rgba(37,99,235,0.05)"
      stroke={stroke}
      strokeWidth={2}
      strokeDasharray="6 4"
      pointerEvents="none"
    />
  );
}

function WireSourceMarker({
  fromId,
  scene,
}: {
  fromId: string;
  scene: SceneJSON;
}) {
  const obj = scene.objects.find((o) => o.id === fromId);
  if (!obj || !("x" in obj) || !("y" in obj)) return null;
  return (
    <rect
      x={(obj.x as number) - 4}
      y={(obj.y as number) - 4}
      width={SYMBOL_BOX + 8}
      height={SYMBOL_BOX + 8}
      fill="none"
      stroke="#22c55e"
      strokeWidth={3}
      strokeDasharray="6 4"
      pointerEvents="none"
    />
  );
}

// =====================================================================
// Toolbar
// =====================================================================

function Toolbar({
  onUndo,
  onRedo,
  onRotate,
  canRotate,
  onDelete,
  canDelete,
  onSave,
  saving,
  onZoomIn,
  onZoomOut,
  onFit,
  onExportSvg,
  onExportPng,
  onExportJson,
}: {
  onUndo: () => void;
  onRedo: () => void;
  onRotate: () => void;
  canRotate: boolean;
  onDelete: () => void;
  canDelete: boolean;
  onSave: () => void;
  saving?: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onExportSvg: () => void;
  onExportPng: () => void;
  onExportJson: () => void;
}) {
  const [exportOpen, setExportOpen] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border-2 border-zinc-200 bg-white p-2">
      <TbBtn onClick={onUndo} title="Geri Al">
        <UndoIcon />
      </TbBtn>
      <TbBtn onClick={onRedo} title="İleri Al">
        <RedoIcon />
      </TbBtn>
      <Sep />
      <TbBtn onClick={onRotate} disabled={!canRotate} title="Döndür 90°">
        <RotateIcon />
      </TbBtn>
      <TbBtn
        onClick={onDelete}
        disabled={!canDelete}
        title="Sil"
        danger
      >
        <TrashIcon />
      </TbBtn>
      <Sep />
      <TbBtn onClick={onZoomIn} title="Yakınlaştır">
        <PlusIcon />
      </TbBtn>
      <TbBtn onClick={onZoomOut} title="Uzaklaştır">
        <MinusIcon />
      </TbBtn>
      <TbBtn onClick={onFit} title="Sığdır">
        <FitIcon />
      </TbBtn>
      <Sep />
      <div className="relative">
        <TbBtn
          onClick={() => setExportOpen((o) => !o)}
          title="Dışa Aktar"
        >
          <DownloadIcon />
        </TbBtn>
        {exportOpen && (
          <div className="absolute left-0 top-full z-20 mt-1 min-w-[10rem] overflow-hidden rounded-xl border-2 border-zinc-200 bg-white shadow-lg">
            <ExportItem
              onClick={() => {
                onExportPng();
                setExportOpen(false);
              }}
            >
              PNG indir
            </ExportItem>
            <ExportItem
              onClick={() => {
                onExportSvg();
                setExportOpen(false);
              }}
            >
              SVG indir
            </ExportItem>
            <ExportItem
              onClick={() => {
                onExportJson();
                setExportOpen(false);
              }}
            >
              JSON indir
            </ExportItem>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="ml-auto rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white active:bg-zinc-800 disabled:opacity-50"
      >
        {saving ? "Kaydediliyor..." : "Kaydet"}
      </button>
    </div>
  );
}

function TbBtn({
  onClick,
  disabled,
  title,
  danger,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  title: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={`flex h-10 w-10 items-center justify-center rounded-xl border-2 transition disabled:opacity-30 ${
        danger
          ? "border-rose-200 text-rose-600 active:bg-rose-50"
          : "border-zinc-200 text-zinc-700 active:bg-zinc-50"
      }`}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <div className="mx-1 h-6 w-px bg-zinc-200" />;
}

function ExportItem({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full px-3 py-2 text-left text-sm hover:bg-zinc-50"
    >
      {children}
    </button>
  );
}

function UndoIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7v6h6" />
      <path d="M3 13a9 9 0 1 0 3-7" />
    </svg>
  );
}
function RedoIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 7v6h-6" />
      <path d="M21 13a9 9 0 1 1-3-7" />
    </svg>
  );
}
function RotateIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
      <polyline points="21 3 21 8 16 8" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
      <line x1={12} y1={5} x2={12} y2={19} />
      <line x1={5} y1={12} x2={19} y2={12} />
    </svg>
  );
}
function MinusIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
      <line x1={5} y1={12} x2={19} y2={12} />
    </svg>
  );
}
function FitIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 9 4 4 9 4" />
      <polyline points="20 9 20 4 15 4" />
      <polyline points="4 15 4 20 9 20" />
      <polyline points="20 15 20 20 15 20" />
    </svg>
  );
}
function DownloadIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1={12} y1={15} x2={12} y2={3} />
    </svg>
  );
}
