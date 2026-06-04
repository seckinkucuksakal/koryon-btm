import { useCallback, useEffect, useRef, useState } from "react";
import { getSignedUrl } from "../lib/storage";

export type LightboxItem = {
  path: string;
  title?: string;
};

type Props = {
  items: LightboxItem[];
  index: number;
  onClose: () => void;
  onIndexChange?: (i: number) => void;
};

const ZOOM_LEVELS = [1, 1.75, 3];

export default function Lightbox({ items, index, onClose, onIndexChange }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [downloading, setDownloading] = useState(false);
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(
    null,
  );
  const touchStartRef = useRef<{ x: number; y: number; t: number } | null>(null);

  const item = items[index];
  const total = items.length;

  const goPrev = useCallback(() => {
    if (total <= 1) return;
    onIndexChange?.((index - 1 + total) % total);
  }, [index, total, onIndexChange]);

  const goNext = useCallback(() => {
    if (total <= 1) return;
    onIndexChange?.((index + 1) % total);
  }, [index, total, onIndexChange]);

  // Reset zoom when navigating
  useEffect(() => {
    setZoom(0);
    setOffset({ x: 0, y: 0 });
  }, [index]);

  // Load signed url
  useEffect(() => {
    if (!item) return;
    let cancelled = false;
    setLoading(true);
    setSrc(null);
    getSignedUrl(item.path).then((url) => {
      if (cancelled) return;
      setSrc(url);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [item]);

  // Keyboard nav
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "+" || e.key === "=") cycleZoom(1);
      else if (e.key === "-" || e.key === "_") cycleZoom(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goPrev, goNext, onClose]);

  // Lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  function cycleZoom(direction: 1 | -1) {
    setZoom((z) => {
      const next = Math.min(ZOOM_LEVELS.length - 1, Math.max(0, z + direction));
      if (next === 0) setOffset({ x: 0, y: 0 });
      return next;
    });
  }

  async function handleDownload() {
    if (!src) return;
    setDownloading(true);
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ext = guessExtension(item.path, blob.type);
      const base = (item.title?.trim() || sanitize(item.path) || "image")
        .replace(/\.[^.]+$/, "");
      a.download = `${base}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.warn("download failed", err);
    } finally {
      setDownloading(false);
    }
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (zoom === 0) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = {
      x: e.clientX,
      y: e.clientY,
      ox: offset.x,
      oy: offset.y,
    };
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = dragRef.current;
    if (!d) return;
    setOffset({
      x: d.ox + (e.clientX - d.x),
      y: d.oy + (e.clientY - d.y),
    });
  }

  function onPointerUp() {
    dragRef.current = null;
  }

  function onTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    if (zoom !== 0) return;
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  }

  function onTouchEnd(e: React.TouchEvent<HTMLDivElement>) {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;
    if (zoom !== 0) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    const dt = Date.now() - start.t;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5 && dt < 600) {
      if (dx < 0) goNext();
      else goPrev();
    }
  }

  if (!item) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/95 text-white"
      role="dialog"
      aria-modal="true"
    >
      <header className="relative z-10 flex items-center gap-2 px-3 py-2 sm:px-4">
        <div className="min-w-0 flex-1 text-sm">
          {item.title && (
            <div className="truncate font-semibold">{item.title}</div>
          )}
          {total > 1 && (
            <div className="text-xs text-zinc-400">
              {index + 1} / {total}
            </div>
          )}
        </div>

        <ToolbarButton
          onClick={() => cycleZoom(-1)}
          disabled={zoom === 0}
          label="Uzaklaştır"
        >
          <ZoomOutIcon />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => cycleZoom(1)}
          disabled={zoom === ZOOM_LEVELS.length - 1}
          label="Yakınlaştır"
        >
          <ZoomInIcon />
        </ToolbarButton>
        <ToolbarButton
          onClick={handleDownload}
          disabled={!src || downloading}
          label="İndir"
        >
          {downloading ? <Spinner /> : <DownloadIcon />}
        </ToolbarButton>
        <ToolbarButton onClick={onClose} label="Kapat">
          <CloseIcon />
        </ToolbarButton>
      </header>

      <div
        className="relative flex-1 select-none overflow-hidden"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {loading || !src ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Spinner large />
          </div>
        ) : (
          <img
            src={src}
            alt={item.title ?? ""}
            draggable={false}
            onDoubleClick={() => cycleZoom(zoom === 0 ? 1 : -1)}
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${ZOOM_LEVELS[zoom]})`,
              transition: dragRef.current ? "none" : "transform 0.18s ease-out",
              cursor:
                zoom === 0 ? "zoom-in" : dragRef.current ? "grabbing" : "grab",
            }}
            className="absolute inset-0 m-auto max-h-full max-w-full object-contain"
          />
        )}

        {total > 1 && (
          <>
            <NavButton side="left" onClick={goPrev} />
            <NavButton side="right" onClick={goNext} />
          </>
        )}
      </div>
    </div>
  );
}

function ToolbarButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-white transition active:bg-white/20 disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function NavButton({
  side,
  onClick,
}: {
  side: "left" | "right";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Önceki" : "Sonraki"}
      className={`absolute top-1/2 -translate-y-1/2 ${
        side === "left" ? "left-2" : "right-2"
      } flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white transition active:bg-white/25`}
    >
      {side === "left" ? <ChevronLeftIcon /> : <ChevronRightIcon />}
    </button>
  );
}

function sanitize(p: string): string {
  const last = p.split("/").pop() ?? "";
  return last.replace(/[^\w.\-]/g, "_");
}

function guessExtension(path: string, mime: string): string {
  const fromPath = path.split(".").pop()?.toLowerCase();
  if (fromPath && /^[a-z0-9]{2,5}$/.test(fromPath)) return fromPath;
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  return "png";
}

function CloseIcon() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function ZoomInIcon() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="11" y1="8" x2="11" y2="14" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  );
}

function ZoomOutIcon() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function Spinner({ large }: { large?: boolean }) {
  const s = large ? "h-10 w-10 border-4" : "h-5 w-5 border-2";
  return (
    <div
      className={`animate-spin rounded-full border-white/30 border-t-white ${s}`}
    />
  );
}
