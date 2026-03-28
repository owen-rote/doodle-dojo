import Link from "next/link";

interface SessionHeaderProps {
  sessionTitle: string;
  onSave: () => void;
  onReset: () => void;
}

export default function SessionHeader({
  sessionTitle,
  onSave,
  onReset,
}: SessionHeaderProps) {
  return (
    <header className="relative flex h-14 shrink-0 items-center justify-between border-b border-white/10 bg-[#0a0a0f] px-5">
      {/* Subtle bottom glow */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-purple-500/40 to-transparent" />

      <div className="flex items-center gap-3 text-[14px]">
        <span className="bg-gradient-to-r from-purple-400 to-violet-400 bg-clip-text font-semibold text-transparent">
          AI Drawing Coach
        </span>
        <span className="text-white/20">|</span>
        <span className="text-white/50">{sessionTitle}</span>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onSave}
          className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-[13px] font-medium text-emerald-400 transition-all hover:border-emerald-500/50 hover:bg-emerald-500/20"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onReset}
          className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-1.5 text-[13px] font-medium text-red-400 transition-all hover:border-red-500/50 hover:bg-red-500/20"
        >
          Reset
        </button>
        <Link
          href="/"
          className="rounded-lg border border-white/10 bg-white/5 px-4 py-1.5 text-[13px] font-medium text-white/60 transition-all hover:border-white/20 hover:bg-white/10 hover:text-white/80"
        >
          Exit
        </Link>
      </div>
    </header>
  );
}
