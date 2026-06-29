import StorageImage from "./StorageImage";
import { isPanelAssetPdf } from "../lib/panelLabelCatalog";

type CoverSlot = {
  label: string;
  path: string | null;
  mimeType: string | null;
  count: number;
};

type Props = {
  tekHat: CoverSlot;
  panoIci: CoverSlot;
};

export default function PanelCoverPreview({ tekHat, panoIci }: Props) {
  const hasAny = tekHat.count > 0 || panoIci.count > 0;

  if (!hasAny) {
    return (
      <div className="flex h-20 w-28 shrink-0 flex-col overflow-hidden rounded-xl border-2 border-dashed border-zinc-200 bg-zinc-50">
        <div className="flex flex-1 items-center justify-center text-zinc-300">
          <PanelIcon />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-20 w-28 shrink-0 overflow-hidden rounded-xl border-2 border-zinc-200 bg-zinc-100">
      <CoverHalf slot={tekHat} side="left" />
      <CoverHalf slot={panoIci} side="right" />
    </div>
  );
}

function CoverHalf({
  slot,
  side,
}: {
  slot: CoverSlot;
  side: "left" | "right";
}) {
  const rounded =
    side === "left" ? "rounded-l-[10px]" : "rounded-r-[10px]";

  if (slot.count === 0) {
    return (
      <div
        className={`relative flex min-w-0 flex-1 flex-col items-center justify-center border-zinc-200 bg-zinc-50 ${side === "right" ? "border-l" : ""}`}
      >
        <span className="text-[9px] font-semibold uppercase tracking-wide text-zinc-400">
          {slot.label}
        </span>
      </div>
    );
  }

  const isPdf = slot.mimeType ? isPanelAssetPdf(slot.mimeType) : false;

  return (
    <div
      className={`relative min-w-0 flex-1 overflow-hidden ${side === "right" ? "border-l border-zinc-200" : ""}`}
    >
      {isPdf || !slot.path ? (
        <div
          className={`flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-red-50 to-zinc-100 ${rounded}`}
        >
          <span className="text-[8px] font-bold uppercase text-red-700">PDF</span>
        </div>
      ) : (
        <StorageImage
          path={slot.path}
          className={`h-full w-full ${rounded}`}
          thumbWidth={240}
          thumbHeight={160}
        />
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-1 pb-1 pt-4">
        <p className="truncate text-[9px] font-semibold text-white">
          {slot.label}
        </p>
        <p className="text-[9px] text-white/80">{slot.count} dosya</p>
      </div>
    </div>
  );
}

function PanelIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18" />
      <path d="M9 21V9" />
    </svg>
  );
}
