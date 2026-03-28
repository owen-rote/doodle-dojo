import Link from "next/link";
import type { DrawingTool } from "@/types";
import ColorPicker from "./ColorPicker";

interface SessionHeaderProps {
  sessionTitle: string;
  activeTool: DrawingTool;
  brushSize: number;
  fillColor: string;
  onToolChange: (tool: DrawingTool) => void;
  onSizeChange: (size: number) => void;
  onFillColorChange: (color: string) => void;
  onUndo: () => void;
  onSave: () => void;
  onReset: () => void;
}

export default function SessionHeader({
  sessionTitle,
  activeTool,
  brushSize,
  fillColor,
  onToolChange,
  onSizeChange,
  onFillColorChange,
  onUndo,
  onSave,
  onReset,
}: SessionHeaderProps) {
  return (
    <div className="relative z-30 shrink-0 px-6 pt-4">
      <header className="flex h-14 items-center justify-between rounded-full border border-white/10 bg-white/5 px-5 backdrop-blur-sm">
        {/* Left: Logo + Title */}
        <div className="flex items-center gap-3 text-[14px]">
          <img src="/logo.svg" alt="DoodleDojo" className="h-6 w-6 rounded-full" />
          <span className="bg-gradient-to-r from-purple-400 to-violet-400 bg-clip-text font-semibold text-transparent">
            DoodleDojo
          </span>
          <span className="text-white/20">|</span>
          <span className="text-white/50">{sessionTitle}</span>
        </div>

        {/* Center: Tools */}
        <div className="flex items-center gap-1">
          {(["pen", "brush", "eraser", "fill"] as const).map((tool) => (
            <button
              key={tool}
              type="button"
              onClick={() => onToolChange(tool)}
              className={`rounded-lg px-3 py-1.5 text-[13px] font-medium capitalize transition-all duration-100 ${
                activeTool === tool
                  ? "bg-purple-500/20 text-purple-300 shadow-[0_0_8px_rgba(168,85,247,0.15)]"
                  : "text-white/40 hover:bg-white/5 hover:text-white/60"
              }`}
            >
              {tool}
            </button>
          ))}

          <button
            type="button"
            onClick={onUndo}
            className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-white/40 hover:bg-white/5 hover:text-white/60"
          >
            Undo
          </button>

          <div className="mx-2 h-5 w-px bg-white/10" />

          <div className="flex items-center gap-2">
            <span className="text-[12px] text-white/30">Size</span>
            <input
              type="range"
              min={1}
              max={20}
              value={brushSize}
              onChange={(e) => onSizeChange(Number(e.target.value))}
              className="w-20 accent-purple-500"
            />
          </div>

          <div className="mx-2 h-5 w-px bg-white/10" />

          <ColorPicker color={fillColor} onChange={onFillColorChange} />
        </div>

        {/* Right: Actions */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onSave}
            className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-[13px] font-medium text-emerald-400 transition-all hover:border-emerald-500/50 hover:bg-emerald-500/20"
          >
            Save
          </button>
          <button
            type="button"
            onClick={onReset}
            className="rounded-full border border-red-500/30 bg-red-500/10 px-4 py-1.5 text-[13px] font-medium text-red-400 transition-all hover:border-red-500/50 hover:bg-red-500/20"
          >
            Reset
          </button>
          <Link
            href="/"
            className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[13px] font-medium text-white/60 transition-all hover:border-white/20 hover:bg-white/10 hover:text-white/80"
          >
            Exit
          </Link>
        </div>
      </header>
    </div>
  );
}
