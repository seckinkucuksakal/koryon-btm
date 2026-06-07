import { useEffect, useState } from "react";
import { getPublicUrl } from "../lib/storage";

type Props = {
  path: string;
  alt?: string;
  className?: string;
  /** object-fit davranışı. Varsayılan: cover. */
  fit?: "cover" | "contain";
  /** Yalnızca bu değer verilmişse Supabase Image Transformation devreye girer. */
  thumbWidth?: number;
  thumbHeight?: number;
  thumbQuality?: number;
  onClick?: () => void;
};

/**
 * Storage'tan bir resmi public URL ile gösterir.
 * - Verilen `thumbWidth` ile CDN tarafında resize edilmiş thumbnail döner; orijinal foto indirilmez.
 * - Resim ağdan inene kadar yerinde küçük bir spinner gösterir, yüklenince yumuşak fade-in.
 */
export default function StorageImage({
  path,
  alt,
  className,
  fit = "cover",
  thumbWidth,
  thumbHeight,
  thumbQuality,
  onClick,
}: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
    const url = thumbWidth
      ? getPublicUrl(path, {
          width: thumbWidth,
          height: thumbHeight,
          quality: thumbQuality ?? 70,
          resize: fit === "contain" ? "contain" : "cover",
        })
      : getPublicUrl(path);
    setSrc(url ?? null);
    if (!url) setFailed(true);
  }, [path, thumbWidth, thumbHeight, thumbQuality, fit]);

  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden bg-zinc-100 ${className ?? ""}`}
    >
      {!loaded && !failed && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700" />
        </div>
      )}

      {failed && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-zinc-400">
          Yüklenemedi
        </div>
      )}

      {src && !failed && (
        <img
          src={src}
          alt={alt ?? ""}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={`absolute inset-0 h-full w-full transition-opacity duration-300 ${
            fit === "contain" ? "object-contain" : "object-cover"
          } ${loaded ? "opacity-100" : "opacity-0"}`}
        />
      )}
    </div>
  );
}
