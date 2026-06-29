import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import EditableTitle from "./EditableTitle";

export type LocalPhotoItem = {
  url: string;
  filename?: string;
  label?: string;
  /** Verilirse lightbox başlığından düzenlenebilir. */
  onSaveLabel?: (next: string) => Promise<void> | void;
};

type Props = {
  photos: LocalPhotoItem[];
  index: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
};

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const ZOOM_STEP = 1.6;
const DBL_TAP_SCALE = 2.5;

export default function LocalPhotoLightbox({
  photos,
  index,
  onClose,
  onIndexChange,
}: Props) {
  const [downloading, setDownloading] = useState(false);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement | null>(null);
  const scaleRef = useRef(scale);
  const offsetRef = useRef(offset);
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(
    null,
  );

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);
  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]);

  const photo = photos[index];
  const total = photos.length;

  const goPrev = useCallback(() => {
    if (total <= 1 || scaleRef.current > 1) return;
    onIndexChange((index - 1 + total) % total);
  }, [index, total, onIndexChange]);

  const goNext = useCallback(() => {
    if (total <= 1 || scaleRef.current > 1) return;
    onIndexChange((index + 1) % total);
  }, [index, total, onIndexChange]);

  const goPrevRef = useRef(goPrev);
  const goNextRef = useRef(goNext);
  useEffect(() => {
    goPrevRef.current = goPrev;
    goNextRef.current = goNext;
  }, [goPrev, goNext]);

  useEffect(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, [index]);

  const zoomTo = useCallback(
    (
      nextScale: number,
      sx: number,
      sy: number,
      fromScale = scaleRef.current,
      fromOffset = offsetRef.current,
    ) => {
      const clamped = Math.max(MIN_SCALE, Math.min(MAX_SCALE, nextScale));
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) {
        setScale(clamped);
        if (clamped <= MIN_SCALE) setOffset({ x: 0, y: 0 });
        return;
      }
      const cx = sx - rect.left - rect.width / 2;
      const cy = sy - rect.top - rect.height / 2;
      const r = clamped / fromScale;

      setScale(clamped);
      if (clamped <= MIN_SCALE + 0.001) {
        setOffset({ x: 0, y: 0 });
      } else {
        setOffset({
          x: cx + r * (fromOffset.x - cx),
          y: cy + r * (fromOffset.y - cy),
        });
      }
    },
    [],
  );

  const zoomBy = useCallback(
    (factor: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      zoomTo(
        scaleRef.current * factor,
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
      );
    },
    [zoomTo],
  );

  const resetZoom = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") goPrevRef.current();
      else if (e.key === "ArrowRight") goNextRef.current();
      else if (e.key === "+" || e.key === "=") zoomBy(ZOOM_STEP);
      else if (e.key === "-" || e.key === "_") zoomBy(1 / ZOOM_STEP);
      else if (e.key === "0") resetZoom();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, zoomBy, resetZoom]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function handleWheel(e: WheelEvent) {
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * 0.0015);
      zoomTo(scaleRef.current * factor, e.clientX, e.clientY);
    }

    type Pinch = {
      d0: number;
      s0: number;
      ox: number;
      oy: number;
      midX: number;
      midY: number;
    };
    type Pan = { x: number; y: number; ox: number; oy: number };
    type Swipe = { x: number; y: number; t: number };

    let pinch: Pinch | null = null;
    let pan: Pan | null = null;
    let swipe: Swipe | null = null;
    let lastTap = 0;

    function distance(t1: Touch, t2: Touch) {
      return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    }

    function handleTouchStart(e: TouchEvent) {
      if (e.touches.length === 2) {
        e.preventDefault();
        const [t1, t2] = [e.touches[0], e.touches[1]];
        pinch = {
          d0: distance(t1, t2),
          s0: scaleRef.current,
          ox: offsetRef.current.x,
          oy: offsetRef.current.y,
          midX: (t1.clientX + t2.clientX) / 2,
          midY: (t1.clientY + t2.clientY) / 2,
        };
        pan = null;
        swipe = null;
      } else if (e.touches.length === 1) {
        const t = e.touches[0];
        if (scaleRef.current > 1) {
          pan = {
            x: t.clientX,
            y: t.clientY,
            ox: offsetRef.current.x,
            oy: offsetRef.current.y,
          };
          swipe = null;
        } else {
          swipe = { x: t.clientX, y: t.clientY, t: Date.now() };
          pan = null;
        }
      }
    }

    function handleTouchMove(e: TouchEvent) {
      if (e.touches.length === 2 && pinch) {
        e.preventDefault();
        const [t1, t2] = [e.touches[0], e.touches[1]];
        const d = distance(t1, t2);
        const ratio = d / pinch.d0;
        const newScale = Math.max(
          MIN_SCALE,
          Math.min(MAX_SCALE, pinch.s0 * ratio),
        );
        zoomTo(newScale, pinch.midX, pinch.midY, pinch.s0, {
          x: pinch.ox,
          y: pinch.oy,
        });
      } else if (e.touches.length === 1 && pan) {
        e.preventDefault();
        const t = e.touches[0];
        setOffset({
          x: pan.ox + (t.clientX - pan.x),
          y: pan.oy + (t.clientY - pan.y),
        });
      }
    }

    function handleTouchEnd(e: TouchEvent) {
      if (e.touches.length < 2) pinch = null;

      if (e.touches.length === 0) {
        if (swipe && scaleRef.current === 1) {
          const t = e.changedTouches[0];
          const dx = t.clientX - swipe.x;
          const dy = t.clientY - swipe.y;
          const dt = Date.now() - swipe.t;
          const swipedHorizontal =
            Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5 && dt < 600;
          const tappedNoMove =
            Math.abs(dx) < 10 && Math.abs(dy) < 10 && dt < 300;

          if (swipedHorizontal) {
            if (dx < 0) goNextRef.current();
            else goPrevRef.current();
          } else if (tappedNoMove) {
            const now = Date.now();
            if (now - lastTap < 300) {
              const tch = e.changedTouches[0];
              if (scaleRef.current > 1) resetZoom();
              else zoomTo(DBL_TAP_SCALE, tch.clientX, tch.clientY);
              lastTap = 0;
            } else {
              lastTap = now;
            }
          }
        }
        swipe = null;
        pan = null;
      }
    }

    el.addEventListener("wheel", handleWheel, { passive: false });
    el.addEventListener("touchstart", handleTouchStart, { passive: false });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    el.addEventListener("touchend", handleTouchEnd);
    el.addEventListener("touchcancel", handleTouchEnd);

    return () => {
      el.removeEventListener("wheel", handleWheel);
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
      el.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [zoomTo, resetZoom]);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "mouse") return;
    if (scale <= 1) return;
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

  function onDoubleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (scale > 1) resetZoom();
    else zoomTo(DBL_TAP_SCALE, e.clientX, e.clientY);
  }

  async function handleDownload() {
    if (!photo) return;
    setDownloading(true);
    try {
      const res = await fetch(photo.url);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ext = guessExtension(blob.type, photo.filename);
      const base =
        photo.filename?.replace(/\.[^.]+$/, "") ??
        photo.label?.replace(/\s+/g, "-").toLowerCase() ??
        `pano-foto-${index + 1}`;
      a.download = `${base}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  if (!photo) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/95 text-white"
      role="dialog"
      aria-modal="true"
      aria-label={photo.label ?? "Fotoğraf önizleme"}
    >
      <header className="flex items-center gap-2 px-3 py-2 sm:px-4">
        <div className="min-w-0 flex-1">
          {photo.onSaveLabel ? (
            <EditableTitle
              value={photo.label ?? ""}
              onSave={photo.onSaveLabel}
              ariaLabel="Görsel adını düzenle"
              placeholder="Görsel adı"
              allowEmpty
              className="block w-full truncate rounded-md text-left text-base font-semibold text-white transition active:bg-white/10"
              inputClassName="w-full rounded-lg border border-white/30 bg-white/10 px-2 py-1 text-base font-semibold text-white outline-none focus:border-white/60 placeholder:text-white/50"
              emptyClassName="italic text-white/50"
            />
          ) : (
            <p className="truncate text-base font-semibold">
              {photo.label ?? `Fotoğraf ${index + 1}`}
            </p>
          )}
          {total > 1 && (
            <p className="text-xs text-zinc-400">
              {index + 1} / {total}
            </p>
          )}
        </div>
        <ToolbarButton
          onClick={() => zoomBy(1 / ZOOM_STEP)}
          disabled={scale <= MIN_SCALE + 0.01}
          label="Uzaklaştır"
        >
          <ZoomOutIcon />
        </ToolbarButton>
        <div className="hidden min-w-[3.5rem] text-center text-xs tabular-nums text-zinc-300 sm:block">
          {Math.round(scale * 100)}%
        </div>
        <ToolbarButton
          onClick={() => zoomBy(ZOOM_STEP)}
          disabled={scale >= MAX_SCALE - 0.01}
          label="Yakınlaştır"
        >
          <ZoomInIcon />
        </ToolbarButton>
        <ToolbarButton
          onClick={handleDownload}
          disabled={downloading}
          label="İndir"
        >
          {downloading ? <Spinner /> : <DownloadIcon />}
        </ToolbarButton>
        <ToolbarButton onClick={onClose} label="Kapat">
          <CloseIcon />
        </ToolbarButton>
      </header>

      <div
        ref={containerRef}
        className="relative flex-1 select-none touch-none overflow-hidden"
        onClick={(e) => {
          if (e.target === e.currentTarget && scale === 1) onClose();
        }}
        onDoubleClick={onDoubleClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <img
          src={photo.url}
          alt={photo.label ?? `Fotoğraf ${index + 1}`}
          draggable={false}
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transition: dragRef.current ? "none" : "transform 0.18s ease-out",
            cursor:
              scale === 1 ? "zoom-in" : dragRef.current ? "grabbing" : "grab",
            willChange: "transform",
          }}
          className="absolute inset-0 m-auto max-h-full max-w-full object-contain"
        />

        {total > 1 && scale <= 1 && (
          <>
            <NavButton side="left" onClick={goPrev} />
            <NavButton side="right" onClick={goNext} />
          </>
        )}
      </div>
    </div>
  );
}

function guessExtension(mime: string, filename?: string): string {
  const fromName = filename?.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName;
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("heic")) return "heic";
  return "jpg";
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
  children: ReactNode;
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
      aria-label={side === "left" ? "Önceki fotoğraf" : "Sonraki fotoğraf"}
      className={`absolute top-1/2 -translate-y-1/2 ${
        side === "left" ? "left-2" : "right-2"
      } flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white transition active:bg-white/25`}
    >
      {side === "left" ? <ChevronLeftIcon /> : <ChevronRightIcon />}
    </button>
  );
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

function Spinner() {
  return (
    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
  );
}
