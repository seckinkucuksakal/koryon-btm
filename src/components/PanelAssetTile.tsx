import StorageImage from "./StorageImage";
import { isPanelAssetPdf } from "../lib/panelLabelCatalog";

type Props = {
  path: string;
  mimeType: string;
  title?: string | null;
  onOpen: () => void;
  onDelete: () => void;
};

export default function PanelAssetTile({
  path,
  mimeType,
  title,
  onOpen,
  onDelete,
}: Props) {
  const isPdf = isPanelAssetPdf(mimeType);

  return (
    <div className="flex flex-col gap-1">
      <div className="relative">
        <button
          type="button"
          onClick={onOpen}
          className="block w-full overflow-hidden rounded-xl active:opacity-80 md:hover:opacity-90"
        >
          {isPdf ? (
            <div className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-zinc-200 bg-gradient-to-br from-red-50 to-zinc-50">
              <PdfIcon />
              <span className="text-xs font-semibold uppercase tracking-wide text-red-700">
                PDF
              </span>
            </div>
          ) : (
            <StorageImage
              path={path}
              className="aspect-square w-full rounded-xl"
              thumbWidth={600}
            />
          )}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          aria-label={isPdf ? "PDF sil" : "Görseli sil"}
          title={isPdf ? "PDF sil" : "Görseli sil"}
          className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white shadow-sm backdrop-blur-sm transition active:bg-rose-600 md:hover:bg-black/80"
        >
          <CloseIcon />
        </button>
        {title && title.trim().length > 0 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 truncate rounded-b-xl bg-gradient-to-t from-black/70 via-black/40 to-transparent px-2 py-1.5 text-xs font-medium text-white">
            {title}
          </div>
        )}
        {isPdf && (
          <div className="pointer-events-none absolute left-1.5 top-1.5 rounded-md bg-red-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            PDF
          </div>
        )}
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
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
  );
}

function PdfIcon() {
  return (
    <svg
      width="36"
      height="36"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-red-600"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="9" y1="13" x2="15" y2="13" />
      <line x1="9" y1="17" x2="13" y2="17" />
    </svg>
  );
}
