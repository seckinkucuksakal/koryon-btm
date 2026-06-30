import { useState } from "react";
import {
  normalizePanelWorkflowStatus,
  PANEL_WORKFLOW_LABELS,
  type PanelLabelWorkflowStatus,
} from "../lib/panelLabelCatalog";

type Props = {
  value: PanelLabelWorkflowStatus | null;
  disabled?: boolean;
  onChange: (status: PanelLabelWorkflowStatus) => Promise<void> | void;
};

const OPTIONS: PanelLabelWorkflowStatus[] = [
  "neutral",
  "in_progress",
  "completed",
];

function statusStyles(
  status: PanelLabelWorkflowStatus,
  active: boolean,
): string {
  if (status === "neutral") {
    return active
      ? "border-zinc-400 bg-zinc-100 text-zinc-900"
      : "border-zinc-200 bg-zinc-50 text-zinc-700 active:bg-zinc-100";
  }
  if (status === "in_progress") {
    return active
      ? "border-amber-400 bg-amber-100 text-amber-950"
      : "border-amber-200 bg-amber-50 text-amber-900 active:bg-amber-100";
  }
  return active
    ? "border-emerald-400 bg-emerald-100 text-emerald-950"
    : "border-emerald-200 bg-emerald-50 text-emerald-900 active:bg-emerald-100";
}

export default function PanelWorkflowStatusButtons({
  value,
  disabled,
  onChange,
}: Props) {
  const [busy, setBusy] = useState<PanelLabelWorkflowStatus | null>(null);
  const current = normalizePanelWorkflowStatus(value);

  const handlePick = async (status: PanelLabelWorkflowStatus) => {
    if (disabled || busy || current === status) return;
    setBusy(status);
    try {
      await onChange(status);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3"
      role="group"
      aria-label="Pano durumu"
    >
      {OPTIONS.map((status) => {
        const active = current === status;
        const isBusy = busy === status;

        return (
          <button
            key={status}
            type="button"
            disabled={disabled || !!busy}
            onClick={() => void handlePick(status)}
            className={`rounded-xl border-2 px-3 py-2 text-sm font-semibold transition disabled:opacity-50 sm:flex-1 ${statusStyles(status, active)}`}
          >
            {isBusy ? "…" : PANEL_WORKFLOW_LABELS[status]}
          </button>
        );
      })}
    </div>
  );
}
