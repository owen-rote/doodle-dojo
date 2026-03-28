export default function Hero() {
  return (
    <div className="flex flex-col items-center">
      {/* Title Pill */}
      <div className="rounded-full bg-gray-800 px-8 py-3 text-[16px] font-medium text-white">
        DoodleDojo
      </div>

      {/* Tagline Card */}
      <div className="mt-6 w-full max-w-md rounded-2xl bg-accent-blue-light px-6 py-4 text-center">
        <p className="text-[18px] font-medium text-text-primary">
          Turn ideas into art
        </p>
        <p className="mt-1 text-[14px] text-text-secondary">
          Your dojo for learning to draw
        </p>
      </div>
    </div>
  );
}
