import type { DrawingTool } from "@/types";

interface ToolBarProps {
  activeTool: DrawingTool;
  brushSize: number;
  onToolChange: (tool: DrawingTool) => void;
  onSizeChange: (size: number) => void;
  onUndo: () => void;
}

export default function ToolBar({
  activeTool,
  brushSize,
  onToolChange,
  onSizeChange,
  onUndo,
}: ToolBarProps) {
  return (
    <div className="inline-flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 p-2 backdrop-blur-sm">
      <div className="flex gap-1">
        {(["pen", "brush", "eraser"] as const).map((tool) => (
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
      </div>

      <div className="h-5 w-px bg-white/10" />

      <div className="flex items-center gap-2">
        <span className="text-[12px] text-white/30">Size</span>
        <input
          type="range"
          min={1}
          max={20}
          value={brushSize}
          onChange={(e) => onSizeChange(Number(e.target.value))}
          className="w-24 accent-purple-500"
        />
      </div>
    </div>
  );
}
