interface VoiceToggleProps {
  isEnabled: boolean;
  onToggle: () => void;
  /** Called before enabling voice — use to unlock AudioContext on user gesture */
  onBeforeVoiceEnable?: () => void;
}

export default function VoiceToggle({
  isEnabled,
  onToggle,
  onBeforeVoiceEnable,
}: VoiceToggleProps) {
  const handleClick = () => {
    if (!isEnabled && onBeforeVoiceEnable) {
      onBeforeVoiceEnable();
    }
    onToggle();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`w-full rounded-lg border px-4 py-2 text-center text-[13px] font-medium transition-all ${
        isEnabled
          ? "border-purple-500/40 bg-purple-500/20 text-purple-300 hover:bg-purple-500/30"
          : "border-white/10 bg-white/5 text-white/40 hover:border-white/20 hover:text-white/60"
      }`}
    >
      Voice Feedback {isEnabled ? "ON" : "OFF"}
    </button>
  );
}
