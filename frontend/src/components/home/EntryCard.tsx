interface EntryCardProps {
  type: "image" | "text";
  icon: string;
  title: string;
  description: string;
  onClick: () => void;
}

export default function EntryCard({
  type,
  icon,
  title,
  description,
  onClick,
}: EntryCardProps) {
  const isImage = type === "image";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-[280px] cursor-pointer flex-col rounded-2xl border-2 p-6 text-left transition hover:scale-[1.02] ${
        isImage
          ? "border-accent-purple-medium bg-accent-purple-light"
          : "border-accent-green-medium bg-accent-green-light"
      }`}
    >
      <span className="text-[12px] opacity-60">{icon}</span>
      <h3 className="mt-1 text-[16px] font-semibold text-text-primary">{title}</h3>
      <p className="mt-1 text-[14px] opacity-80">{description}</p>
      <span
        className={`mt-3 inline-block text-[14px] font-medium ${
          isImage ? "text-accent-purple" : "text-accent-green"
        }`}
      >
        Start &rarr;
      </span>
    </button>
  );
}
