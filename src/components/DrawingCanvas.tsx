import { useEffect, useRef, useState } from "react";

type Props = {
  onSave: (blob: Blob) => Promise<void> | void;
  saving?: boolean;
};

export default function DrawingCanvas({ onSave, saving }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const historyRef = useRef<ImageData[]>([]);
  const [color, setColor] = useState("#111827");
  const [width, setWidth] = useState(4);
  const [hasContent, setHasContent] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function resize() {
      const c = canvasRef.current;
      if (!c) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = c.getBoundingClientRect();
      const ctx = c.getContext("2d");
      if (!ctx) return;
      const prev = historyRef.current.at(-1);

      c.width = rect.width * dpr;
      c.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, c.width, c.height);

      if (prev) {
        const tmp = document.createElement("canvas");
        tmp.width = prev.width;
        tmp.height = prev.height;
        tmp.getContext("2d")?.putImageData(prev, 0, 0);
        ctx.drawImage(tmp, 0, 0, c.width / dpr, c.height / dpr);
      }
    }

    resize();
    const obs = new ResizeObserver(resize);
    obs.observe(canvas);
    return () => obs.disconnect();
  }, []);

  function getPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  function snapshot() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    historyRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    if (historyRef.current.length > 30) historyRef.current.shift();
  }

  function pointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const canvas = canvasRef.current!;
    canvas.setPointerCapture(e.pointerId);
    snapshot();
    drawingRef.current = true;
    lastRef.current = getPos(e);
  }

  function pointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    const last = lastRef.current ?? pos;

    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();

    lastRef.current = pos;
    setHasContent(true);
  }

  function pointerUp() {
    drawingRef.current = false;
    lastRef.current = null;
  }

  function undo() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const prev = historyRef.current.pop();
    if (prev) {
      ctx.putImageData(prev, 0, 0);
      setHasContent(historyRef.current.length > 0);
    } else {
      clear();
    }
  }

  function clear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    historyRef.current = [];
    setHasContent(false);
  }

  async function handleSave() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/png"),
    );
    if (!blob) return;
    await onSave(blob);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <ToolColor color="#111827" current={color} setColor={setColor} />
        <ToolColor color="#dc2626" current={color} setColor={setColor} />
        <ToolColor color="#2563eb" current={color} setColor={setColor} />
        <ToolColor color="#16a34a" current={color} setColor={setColor} />

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={undo}
            className="rounded-xl border-2 border-zinc-200 bg-white px-3 py-2 text-sm font-semibold active:bg-zinc-50"
          >
            Geri al
          </button>
          <button
            type="button"
            onClick={clear}
            className="rounded-xl border-2 border-zinc-200 bg-white px-3 py-2 text-sm font-semibold active:bg-zinc-50"
          >
            Temizle
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <label className="text-xs text-zinc-500">Kalınlık</label>
        <input
          type="range"
          min={2}
          max={16}
          step={1}
          value={width}
          onChange={(e) => setWidth(Number(e.target.value))}
          className="flex-1"
        />
        <span className="w-6 text-right text-sm tabular-nums">{width}</span>
      </div>

      <div className="overflow-hidden rounded-2xl border-2 border-zinc-200 bg-white">
        <canvas
          ref={canvasRef}
          className="block h-[55vh] w-full touch-none"
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          onPointerCancel={pointerUp}
          onPointerLeave={pointerUp}
        />
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={!hasContent || saving}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-zinc-900 px-5 py-5 text-base font-semibold text-white shadow-sm transition active:scale-[0.99] active:bg-zinc-800 disabled:opacity-50"
      >
        {saving ? "Kaydediliyor..." : "Çizimi Kaydet"}
      </button>
    </div>
  );
}

function ToolColor({
  color,
  current,
  setColor,
}: {
  color: string;
  current: string;
  setColor: (c: string) => void;
}) {
  const active = current.toLowerCase() === color.toLowerCase();
  return (
    <button
      type="button"
      onClick={() => setColor(color)}
      aria-label={`Renk ${color}`}
      className={`h-10 w-10 rounded-full border-2 transition ${
        active ? "scale-110 border-zinc-900" : "border-zinc-200"
      }`}
      style={{ backgroundColor: color }}
    />
  );
}
