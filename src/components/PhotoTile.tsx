import StorageImage from "./StorageImage";
import { supabase } from "../lib/supabase";

type Props = {
  path: string;
  title?: string | null;
  onOpen: () => void;
  onDelete: () => void;
};

/**
 * Galeri ızgarasında bir fotoğraf karesi.
 * - Resme tıklayınca lightbox açılır.
 * - Sağ üstteki × butonu fotoğrafı soft-delete eder.
 * - Title varsa karenin altında küçük etiket olarak gösterilir.
 */
export default function PhotoTile({ path, title, onOpen, onDelete }: Props) {
  return (
    <div className="flex flex-col gap-1">
      <div className="relative">
        <button
          type="button"
          onClick={onOpen}
          className="block w-full overflow-hidden rounded-xl active:opacity-80 md:hover:opacity-90"
        >
          <StorageImage
            path={path}
            className="aspect-square w-full rounded-xl"
            thumbWidth={600}
          />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          aria-label="Fotoğrafı sil"
          title="Fotoğrafı sil"
          className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white shadow-sm backdrop-blur-sm transition active:bg-rose-600 md:hover:bg-black/80"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        {title && title.trim().length > 0 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 truncate rounded-b-xl bg-gradient-to-t from-black/70 via-black/40 to-transparent px-2 py-1.5 text-xs font-medium text-white">
            {title}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Fotoğrafı geri dönüşüm kutusuna taşır (visible=false).
 * Onay diyalogunu çağıran taraf yönetir, bu fonksiyon sadece DB güncellemesi yapar.
 */
export async function softDeletePhoto(photoId: string): Promise<void> {
  await supabase
    .from("photos")
    .update({ visible: false, deleted_at: new Date().toISOString() })
    .eq("id", photoId);
}
