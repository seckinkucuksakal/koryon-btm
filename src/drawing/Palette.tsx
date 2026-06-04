import {
  LAYOUT_SYMBOL_ORDER,
  LAYOUT_SYMBOLS,
  SLD_SYMBOL_ORDER,
  SLD_SYMBOLS,
  SYMBOL_BOX,
} from "./symbols";
import type { LayoutSymbolKey, SldSymbolKey } from "./types";

export type Tool =
  | "select"
  | "wire"
  | "wall"
  | "tray"
  | "room"
  | "door"
  | "window"
  | "dimension";

type Props = {
  mode: "layout" | "sld";
  tool: Tool;
  setTool: (t: Tool) => void;
  onAddLayoutSymbol: (key: LayoutSymbolKey) => void;
  onAddSldSymbol: (key: SldSymbolKey) => void;
};

export default function Palette({
  mode,
  tool,
  setTool,
  onAddLayoutSymbol,
  onAddSldSymbol,
}: Props) {
  return (
    <div className="space-y-4">
      <ToolGroup>
        <ToolBtn
          active={tool === "select"}
          onClick={() => setTool("select")}
          label="Seç"
        >
          <SelectIcon />
        </ToolBtn>
        {mode === "sld" && (
          <ToolBtn
            active={tool === "wire"}
            onClick={() => setTool("wire")}
            label="Kablo"
          >
            <WireIcon />
          </ToolBtn>
        )}
        {mode === "layout" && (
          <>
            <ToolBtn
              active={tool === "room"}
              onClick={() => setTool("room")}
              label="Oda"
            >
              <RoomIcon />
            </ToolBtn>
            <ToolBtn
              active={tool === "wall"}
              onClick={() => setTool("wall")}
              label="Duvar"
            >
              <WallIcon />
            </ToolBtn>
            <ToolBtn
              active={tool === "door"}
              onClick={() => setTool("door")}
              label="Kapı"
            >
              <DoorIcon />
            </ToolBtn>
            <ToolBtn
              active={tool === "window"}
              onClick={() => setTool("window")}
              label="Pencere"
            >
              <WindowIcon />
            </ToolBtn>
            <ToolBtn
              active={tool === "tray"}
              onClick={() => setTool("tray")}
              label="Tabla"
            >
              <TrayIcon />
            </ToolBtn>
            <ToolBtn
              active={tool === "dimension"}
              onClick={() => setTool("dimension")}
              label="Ölçü"
            >
              <RulerIcon />
            </ToolBtn>
          </>
        )}
      </ToolGroup>

      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {mode === "layout" ? "Ekipman" : "Sembol"}
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-2 lg:grid-cols-3">
          {mode === "layout"
            ? LAYOUT_SYMBOL_ORDER.map((key) => {
                const def = LAYOUT_SYMBOLS[key];
                return (
                  <SymbolButton
                    key={key}
                    name={def.name}
                    onClick={() => onAddLayoutSymbol(key)}
                  >
                    <def.Shape />
                  </SymbolButton>
                );
              })
            : SLD_SYMBOL_ORDER.map((key) => {
                const def = SLD_SYMBOLS[key];
                return (
                  <SymbolButton
                    key={key}
                    name={def.name}
                    onClick={() => onAddSldSymbol(key)}
                  >
                    <def.Shape />
                  </SymbolButton>
                );
              })}
        </div>
      </div>
    </div>
  );
}

function ToolGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-1.5">{children}</div>;
}

function ToolBtn({
  active,
  onClick,
  label,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`flex h-11 w-11 items-center justify-center rounded-xl border-2 transition ${
        active
          ? "border-zinc-900 bg-zinc-900 text-white"
          : "border-zinc-200 bg-white text-zinc-700 active:bg-zinc-50"
      }`}
    >
      {children}
    </button>
  );
}

function SymbolButton({
  name,
  onClick,
  children,
}: {
  name: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1 rounded-xl border-2 border-zinc-200 bg-white p-2 active:bg-zinc-50"
    >
      <svg
        viewBox={`0 0 ${SYMBOL_BOX} ${SYMBOL_BOX}`}
        width={48}
        height={48}
        className="shrink-0"
      >
        {children}
      </svg>
      <span className="text-[11px] font-medium text-zinc-700">{name}</span>
    </button>
  );
}

function SelectIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3l7 18 2-7 7-2z" />
    </svg>
  );
}

function WireIcon() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx={5} cy={5} r={2} />
      <circle cx={19} cy={19} r={2} />
      <path d="M7 5h6v8h6" />
    </svg>
  );
}

function RoomIcon() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x={3} y={4} width={18} height={16} />
    </svg>
  );
}

function WallIcon() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round">
      <line x1={4} y1={12} x2={20} y2={12} />
    </svg>
  );
}

function DoorIcon() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1={4} y1={20} x2={20} y2={20} />
      <path d="M4 20 A 16 16 0 0 1 20 4" />
    </svg>
  );
}

function WindowIcon() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <line x1={3} y1={12} x2={21} y2={12} />
      <line x1={3} y1={9} x2={21} y2={9} strokeDasharray="3 3" />
      <line x1={3} y1={15} x2={21} y2={15} strokeDasharray="3 3" />
    </svg>
  );
}

function TrayIcon() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeDasharray="2 4">
      <line x1={3} y1={12} x2={21} y2={12} />
    </svg>
  );
}

function RulerIcon() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1={4} y1={12} x2={20} y2={12} />
      <line x1={4} y1={9} x2={4} y2={15} />
      <line x1={20} y1={9} x2={20} y2={15} />
      <line x1={9} y1={10} x2={9} y2={14} />
      <line x1={15} y1={10} x2={15} y2={14} />
    </svg>
  );
}
