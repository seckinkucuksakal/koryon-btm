import { useEffect, useState } from "react";
import { getSignedUrl } from "../lib/storage";

type Props = {
  path: string;
  alt?: string;
  className?: string;
  onClick?: () => void;
};

export default function StorageImage({ path, alt, className, onClick }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSrc(null);
    setFailed(false);
    getSignedUrl(path).then((url) => {
      if (cancelled) return;
      if (url) setSrc(url);
      else setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (failed) {
    return (
      <div
        className={`flex items-center justify-center rounded-xl bg-zinc-100 text-xs text-zinc-400 ${className ?? ""}`}
      >
        Yüklenemedi
      </div>
    );
  }

  if (!src) {
    return (
      <div
        className={`animate-pulse rounded-xl bg-zinc-200 ${className ?? ""}`}
      />
    );
  }

  return (
    <img
      src={src}
      alt={alt ?? ""}
      onClick={onClick}
      className={className}
      loading="lazy"
      decoding="async"
    />
  );
}
