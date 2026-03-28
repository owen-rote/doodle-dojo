interface ChatInputProps {
  onSend: (message: string) => void;
  placeholder?: string;
}

export default function ChatInput({
  onSend,
  placeholder = "Ask the coach...",
}: ChatInputProps) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm">
      <input
        type="text"
        placeholder={placeholder}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            const value = e.currentTarget.value.trim();
            if (value) {
              onSend(value);
              e.currentTarget.value = "";
            }
          }
        }}
        className="w-full bg-transparent px-3 py-2.5 text-[13px] text-white/80 outline-none placeholder:text-white/25"
      />
    </div>
  );
}
