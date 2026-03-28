"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSessionStore } from "@/stores/sessionStore";

// ─── Intersection Observer hook for scroll-triggered fade-up ───
function useFadeUp() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Fallback: if IntersectionObserver is slow (iPadOS Safari),
    // force visibility after a short delay
    const fallbackTimer = setTimeout(() => {
      el.classList.add("opacity-100", "translate-y-0");
      el.classList.remove("opacity-0", "translate-y-8");
    }, 1500);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          clearTimeout(fallbackTimer);
          el.classList.add("opacity-100", "translate-y-0");
          el.classList.remove("opacity-0", "translate-y-8");
          observer.unobserve(el);
        }
      },
      { threshold: 0.05, rootMargin: "0px 0px 100px 0px" }
    );
    observer.observe(el);
    return () => {
      clearTimeout(fallbackTimer);
      observer.disconnect();
    };
  }, []);
  return ref;
}

// ─── Navbar ───
function Navbar() {
  return (
    <nav className="fixed top-0 z-50 w-full border-b border-white/5 bg-[#0a0a0f]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <svg className="h-5 w-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Z" />
          </svg>
          <span className="text-lg font-bold text-white">DrawCoach</span>
        </div>

        <div className="hidden items-center gap-8 text-sm text-gray-400 lg:flex">
          <a href="#how-it-works" className="transition hover:text-white">How it Works</a>
          <a href="#about" className="transition hover:text-white">About</a>
        </div>

        <a
          href="#start"
          className="btn-shine rounded-full bg-gradient-to-r from-purple-600 to-violet-500 px-5 py-2 text-sm font-medium text-white shadow-lg shadow-purple-500/25 transition hover:shadow-purple-500/40"
        >
          Start Drawing
        </a>
      </div>
    </nav>
  );
}

// ─── Hero Section ───
function HeroSection() {
  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 pt-16">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 animate-[pulse_6s_ease-in-out_infinite] rounded-full bg-purple-600/20 blur-[120px]" />
        <div className="absolute left-1/3 top-1/3 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 animate-[pulse_8s_ease-in-out_infinite_1s] rounded-full bg-violet-500/10 blur-[100px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-3xl text-center">
        <div className="hero-fadein mx-auto mb-8 inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-1.5 text-sm text-purple-300 shadow-[0_0_15px_rgba(124,58,237,0.15)]">
          <span className="h-1.5 w-1.5 rounded-full bg-purple-400 shadow-[0_0_6px_rgba(168,85,247,0.6)]" />
          Powered by Gemini Live
        </div>

        <h1 className="hero-fadein hero-delay-1 text-5xl font-bold leading-tight tracking-tight text-white lg:text-7xl">
          Learn to Draw,
          <br />
          <span className="bg-gradient-to-r from-purple-400 to-violet-300 bg-clip-text text-transparent">
            One Stroke at a Time.
          </span>
        </h1>

        <p className="hero-fadein hero-delay-2 mx-auto mt-6 max-w-xl text-lg leading-relaxed text-gray-400">
          Upload any image or describe what you want to draw. Our AI coach guides you stroke by stroke with live voice feedback.
        </p>

        <div className="hero-fadein hero-delay-3 mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a
            href="#start"
            className="btn-shine rounded-full bg-gradient-to-r from-purple-600 to-pink-500 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-purple-600/30 transition hover:shadow-purple-600/50 hover:brightness-110"
          >
            Start Drawing
          </a>
          <a
            href="#how-it-works"
            className="rounded-full border border-white/15 px-8 py-3.5 text-base font-semibold text-gray-300 transition hover:border-white/30 hover:text-white"
          >
            See How It Works
          </a>
        </div>

        <p className="hero-fadein hero-delay-3 mt-8 text-sm text-gray-500">
          No login required &middot; Works with any sketch style
        </p>
      </div>
    </section>
  );
}

// ─── Loading Screen ───
const loadingMessages = [
  { text: "Analyzing your reference...", icon: "eye" },
  { text: "Polishing pixels...", icon: "sparkle" },
  { text: "Tracing the outlines...", icon: "pen" },
  { text: "Mapping every curve...", icon: "curve" },
  { text: "Generating stroke guides...", icon: "brush" },
  { text: "Teaching the AI coach...", icon: "brain" },
  { text: "Warming up the canvas...", icon: "canvas" },
  { text: "Almost there...", icon: "rocket" },
];

function LoadingIcon({ icon }: { icon: string }) {
  const cls = "h-6 w-6";
  switch (icon) {
    case "eye":
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.64 0 8.577 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.64 0-8.577-3.007-9.963-7.178Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        </svg>
      );
    case "sparkle":
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
        </svg>
      );
    case "pen":
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Z" />
        </svg>
      );
    case "curve":
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
        </svg>
      );
    case "brush":
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 0 0-5.78 1.128 2.25 2.25 0 0 1-2.4 2.245 4.5 4.5 0 0 0 8.4-2.245c0-.399-.078-.78-.22-1.128Zm0 0a15.998 15.998 0 0 0 3.388-1.62m-5.043-.025a15.994 15.994 0 0 1 1.622-3.395m3.42 3.42a15.995 15.995 0 0 0 4.764-4.648l3.876-5.814a1.151 1.151 0 0 0-1.597-1.597L14.146 6.32a15.996 15.996 0 0 0-4.649 4.763m3.42 3.42a6.776 6.776 0 0 0-3.42-3.42" />
        </svg>
      );
    case "brain":
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 0 0 2.25-2.25V6.75a2.25 2.25 0 0 0-2.25-2.25H6.75A2.25 2.25 0 0 0 4.5 6.75v10.5a2.25 2.25 0 0 0 2.25 2.25Z" />
        </svg>
      );
    case "canvas":
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.41a2.25 2.25 0 0 1 3.182 0l2.909 2.91m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm12.75-11.25h.008v.008h-.008V8.25Z" />
        </svg>
      );
    case "rocket":
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 0 0-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 0 1-2.448-2.448 14.9 14.9 0 0 1 .06-.312m-2.24 2.39a4.493 4.493 0 0 0-1.757 4.306 4.493 4.493 0 0 0 4.306-1.758M16.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" />
        </svg>
      );
    default:
      return null;
  }
}

function LoadingScreen({ progress, messageIndex }: { progress: number; messageIndex: number }) {
  const msg = loadingMessages[messageIndex];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0a0a0f]">
      {/* Animated background orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 animate-[pulse_3s_ease-in-out_infinite] rounded-full bg-purple-600/20 blur-[120px]" />
        <div className="absolute left-1/4 top-1/3 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 animate-[pulse_4s_ease-in-out_infinite_0.5s] rounded-full bg-violet-500/15 blur-[100px]" />
        <div className="absolute right-1/4 bottom-1/3 h-[250px] w-[250px] animate-[pulse_5s_ease-in-out_infinite_1s] rounded-full bg-pink-500/10 blur-[80px]" />
      </div>

      {/* Floating particles */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="absolute h-1 w-1 rounded-full bg-purple-400/40"
            style={{
              left: `${10 + (i * 37) % 80}%`,
              top: `${5 + (i * 53) % 90}%`,
              animation: `pulse ${2 + (i % 3)}s ease-in-out infinite ${(i * 0.3) % 2}s`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 flex flex-col items-center">
        {/* Spinning ring */}
        <div className="relative mb-10">
          <div className="h-28 w-28 animate-spin rounded-full border-2 border-transparent border-t-purple-500 border-r-purple-500/30" style={{ animationDuration: "2s" }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-white/5 text-purple-400 backdrop-blur-sm transition-all duration-500">
              <LoadingIcon icon={msg.icon} />
            </div>
          </div>
        </div>

        {/* Message */}
        <div className="mb-8 h-8 overflow-hidden">
          <p
            key={messageIndex}
            className="animate-[fadeSlideUp_0.4s_ease-out] text-center text-lg font-medium text-white"
          >
            {msg.text}
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-64">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-purple-500 via-violet-400 to-pink-500 transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-3 text-center text-sm text-white/30">
            {Math.round(progress)}%
          </p>
        </div>

        {/* Branding */}
        <div className="mt-12 flex items-center gap-2 text-sm text-white/20">
          <svg className="h-4 w-4 text-purple-400/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Z" />
          </svg>
          DrawCoach
        </div>
      </div>
    </div>
  );
}

// ─── Start Drawing Section (multi-step) ───
type SketchStyle = "bw" | "colored";

function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      // Strip "data:<mime>;base64," prefix
      const base64 = dataUrl.split(",")[1];
      resolve({ base64, mimeType: file.type || "image/png" });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function StartDrawingSection() {
  const ref = useFadeUp();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const setSession = useSessionStore((s) => s.setSession);

  // Step: 1 = style selection, 2 = upload/text input
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedStyle, setSelectedStyle] = useState<SketchStyle | null>(null);
  const [activeTab, setActiveTab] = useState<"image" | "text">("image");
  const [textPrompt, setTextPrompt] = useState("");
  const [fileName, setFileName] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  function handleStyleSelect(style: SketchStyle) {
    setSelectedStyle(style);
  }

  function handleContinueToInput() {
    if (!selectedStyle) return;
    setStep(2);
  }

  function handleBackToStyles() {
    setStep(1);
  }

  // Indeterminate progress animation while waiting for API
  useEffect(() => {
    if (!loading) return;

    const progressTimer = setInterval(() => {
      setLoadingProgress((p) => {
        if (p >= 90) return 90; // Cap at 90% until response arrives
        const remaining = 90 - p;
        return p + remaining * 0.03;
      });
    }, 100);

    const msgTimer = setInterval(() => {
      setLoadingMsgIndex((i) => (i + 1) % loadingMessages.length);
    }, 1000);

    return () => {
      clearInterval(progressTimer);
      clearInterval(msgTimer);
    };
  }, [loading]);

  const generateStyleImage = useCallback(
    async (params: {
      inputType: "image" | "text";
      textPrompt?: string;
      imageBase64?: string;
      imageMimeType?: string;
    }) => {
      setError(null);
      setLoading(true);
      setLoadingProgress(0);
      setLoadingMsgIndex(0);

      abortRef.current = new AbortController();

      try {
        const res = await fetch("/api/generate-style", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            style: selectedStyle,
            inputType: params.inputType,
            textPrompt: params.textPrompt,
            imageBase64: params.imageBase64,
            imageMimeType: params.imageMimeType,
          }),
          signal: abortRef.current.signal,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to generate style image");
        }

        const data = await res.json();
        const referenceImageUrl = `data:${data.mimeType};base64,${data.image}`;

        // Store in session store
        setSession({
          referenceImageUrl,
          mode: params.inputType,
        });

        // Send reference image to backend (non-blocking — don't delay navigation)
        fetch("/api/upload-reference", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: data.image, mimeType: data.mimeType }),
        }).catch((err) => console.error("Backend upload failed:", err));

        // Complete the progress bar and navigate
        setLoadingProgress(100);
        await new Promise((r) => setTimeout(r, 400));
        router.push(`/session?mode=${params.inputType}&style=${selectedStyle}`);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Something went wrong");
        setLoading(false);
        setLoadingProgress(0);
      }
    },
    [selectedStyle, setSession, router]
  );

  async function handleFileSelect(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    const { base64, mimeType } = await fileToBase64(file);
    generateStyleImage({
      inputType: "image",
      imageBase64: base64,
      imageMimeType: mimeType,
    });
  }

  function handleTextSubmit() {
    if (!textPrompt.trim()) return;
    generateStyleImage({
      inputType: "text",
      textPrompt: textPrompt.trim(),
    });
  }

  return (
    <>
      {loading && <LoadingScreen progress={loadingProgress} messageIndex={loadingMsgIndex} />}
      <section id="start" className="px-6 py-24">
        <div
          ref={ref}
          className="mx-auto max-w-4xl opacity-0 translate-y-8 transition-all duration-700 ease-out"
        >
          {/* ─── Step indicator ─── */}
          <div className="mx-auto mb-10 flex w-fit items-center gap-3 text-sm">
            <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${step === 1 ? "bg-purple-600 text-white" : "bg-purple-600/20 text-purple-400"}`}>1</span>
            <span className={`font-medium ${step === 1 ? "text-white" : "text-gray-500"}`}>Choose Style</span>
            <div className="h-px w-8 bg-white/15" />
            <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${step === 2 ? "bg-purple-600 text-white" : "bg-white/10 text-gray-500"}`}>2</span>
            <span className={`font-medium ${step === 2 ? "text-white" : "text-gray-500"}`}>Add Reference</span>
          </div>

          {step === 1 ? (
            /* ═══════════════ STEP 1: Style Selection ═══════════════ */
            <div>
              <h2 className="mb-3 text-center text-3xl font-bold text-white lg:text-4xl">
                Choose your sketch style
              </h2>
              <p className="mb-10 text-center text-gray-400">
                See how your image will be transformed, then pick a style
              </p>

              {/* Input image → Style options layout */}
              <div className="flex items-center justify-center gap-4 lg:gap-6">
                {/* Input: Original image */}
                <div className="flex w-[200px] shrink-0 flex-col items-center">
                  <div className="relative w-full overflow-hidden rounded-2xl border border-dashed border-white/20 bg-white/[0.03] p-3">
                    <div className="absolute left-3 top-3 z-10 rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/50 backdrop-blur-sm">
                      Input
                    </div>
                    <img
                      src="/mock/royce-hall-original.webp"
                      alt="Original image"
                      className="aspect-square w-full rounded-xl object-cover opacity-70"
                    />
                  </div>
                  <p className="mt-3 text-xs font-medium text-gray-500">Your image</p>
                </div>

                {/* Arrow */}
                <div className="flex flex-col items-center gap-1 text-white/20">
                  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                  </svg>
                  <span className="text-[10px] font-medium uppercase tracking-wider text-white/25">becomes</span>
                </div>

                {/* Style options */}
                <div className="grid grid-cols-2 gap-4 lg:gap-6">
                  {/* Style 1: Black & White Sketch */}
                  <div className="flex flex-col items-center">
                    <button
                      onClick={() => handleStyleSelect("bw")}
                      className={`relative w-full overflow-hidden rounded-2xl border-2 p-3 backdrop-blur-md transition-all duration-300 ${
                        selectedStyle === "bw"
                          ? "border-purple-500 bg-purple-500/10 shadow-[0_0_30px_rgba(168,85,247,0.2)]"
                          : "border-white/10 bg-white/5 hover:border-purple-500/40"
                      }`}
                    >
                      {selectedStyle === "bw" && (
                        <div className="absolute right-3 top-3 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-purple-600">
                          <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        </div>
                      )}
                      <img
                        src="/mock/royce-hall-bw.webp"
                        alt="Black & White Sketch"
                        className="aspect-square w-full rounded-xl object-cover"
                      />
                    </button>
                    <p className={`mt-3 text-sm font-semibold ${selectedStyle === "bw" ? "text-purple-400" : "text-white"}`}>
                      Black &amp; White Sketch
                    </p>
                  </div>

                  {/* Style 2: Colored Sketch */}
                  <div className="flex flex-col items-center">
                    <button
                      onClick={() => handleStyleSelect("colored")}
                      className={`relative w-full overflow-hidden rounded-2xl border-2 p-3 backdrop-blur-md transition-all duration-300 ${
                        selectedStyle === "colored"
                          ? "border-purple-500 bg-purple-500/10 shadow-[0_0_30px_rgba(168,85,247,0.2)]"
                          : "border-white/10 bg-white/5 hover:border-purple-500/40"
                      }`}
                    >
                      {selectedStyle === "colored" && (
                        <div className="absolute right-3 top-3 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-purple-600">
                          <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        </div>
                      )}
                      <img
                        src="/mock/royce-hall-colored.webp"
                        alt="Colored Sketch"
                        className="aspect-square w-full rounded-xl object-cover"
                      />
                    </button>
                    <p className={`mt-3 text-sm font-semibold ${selectedStyle === "colored" ? "text-purple-400" : "text-white"}`}>
                      Colored Sketch
                    </p>
                  </div>
                </div>
              </div>

              {/* Continue button */}
              <div className="mt-10 flex justify-center">
                <button
                  onClick={handleContinueToInput}
                  disabled={!selectedStyle}
                  className="rounded-full bg-gradient-to-r from-purple-600 to-pink-500 px-10 py-3.5 text-base font-semibold text-white shadow-lg shadow-purple-600/30 transition hover:shadow-purple-600/50 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Continue
                </button>
              </div>
            </div>
          ) : (
            /* ═══════════════ STEP 2: Upload / Text Input ═══════════════ */
            <div className="mx-auto max-w-2xl">
              {/* Back button */}
              <button
                onClick={handleBackToStyles}
                className="mb-6 flex items-center gap-2 text-sm text-gray-400 transition hover:text-white"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
                Back to style selection
              </button>

              <h2 className="mb-3 text-center text-3xl font-bold text-white lg:text-4xl">
                Add your reference
              </h2>
              <p className="mb-10 text-center text-gray-400">
                Upload an image or describe what you&apos;d like to draw
                <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-0.5 text-xs text-purple-300">
                  {selectedStyle === "bw" ? "B&W Sketch" : "Colored Sketch"}
                </span>
              </p>

              {/* Tab switcher */}
              <div className="mx-auto mb-8 flex w-fit rounded-full border border-white/10 bg-white/5 p-1">
                <button
                  onClick={() => setActiveTab("image")}
                  className={`rounded-full px-6 py-2 text-sm font-medium transition-all ${
                    activeTab === "image"
                      ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  Upload Image
                </button>
                <button
                  onClick={() => setActiveTab("text")}
                  className={`rounded-full px-6 py-2 text-sm font-medium transition-all ${
                    activeTab === "text"
                      ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  Describe It
                </button>
              </div>

              {/* Content card */}
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-md">
                <div className="pointer-events-none absolute inset-0 -z-10">
                  <div className="absolute left-1/2 top-1/2 h-[200px] w-[200px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-600/10 blur-[60px]" />
                </div>

                {activeTab === "image" ? (
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleFileSelect(e.target.files?.[0])}
                    />
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragOver(false);
                        handleFileSelect(e.dataTransfer.files?.[0]);
                      }}
                      className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed py-16 transition-all ${
                        dragOver
                          ? "border-purple-400 bg-purple-500/10"
                          : "border-white/15 hover:border-purple-500/40 hover:bg-white/5"
                      }`}
                    >
                      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-500/15">
                        <svg className="h-7 w-7 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                        </svg>
                      </div>
                      <p className="text-base font-medium text-white">
                        {fileName || "Drop your image here"}
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        or click to browse &middot; PNG, JPG, WEBP
                      </p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="mb-4 flex items-start gap-3">
                      <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/15">
                        <svg className="h-5 w-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-base font-medium text-white">Describe your drawing</p>
                        <p className="text-sm text-gray-500">Be specific — the more detail, the better the guide</p>
                      </div>
                    </div>

                    <textarea
                      value={textPrompt}
                      onChange={(e) => setTextPrompt(e.target.value)}
                      placeholder="e.g. A cat sitting on a windowsill looking at the rain..."
                      rows={4}
                      className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white placeholder:text-gray-600 focus:border-purple-500/50 focus:outline-none focus:ring-1 focus:ring-purple-500/30"
                    />

                    <button
                      onClick={handleTextSubmit}
                      disabled={!textPrompt.trim() || loading}
                      className="mt-4 w-full rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 py-3 text-base font-semibold text-white shadow-lg shadow-purple-600/30 transition hover:shadow-purple-600/50 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {loading ? "Generating…" : "Generate Drawing Guide"}
                    </button>
                  </div>
                )}
              </div>

              {error && (
                <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-sm text-red-400">
                  {error}
                </div>
              )}

              <p className="mt-4 text-center text-xs text-gray-600">
                Your image stays on your device &middot; Nothing is stored
              </p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}


// ─── How It Works ───
const steps = [
  {
    title: "Pick a style",
    desc: "Choose Black & White or Colored Sketch.",
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.098 19.902a3.75 3.75 0 0 0 5.304 0l6.401-6.402M6.75 21A3.75 3.75 0 0 1 3 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 0 0 3.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072" />
      </svg>
    ),
  },
  {
    title: "Upload or describe",
    desc: "Drop an image or type what you want to draw.",
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
      </svg>
    ),
  },
  {
    title: "Draw with AI guidance",
    desc: "Follow stroke-by-stroke coaching with live voice feedback.",
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Z" />
      </svg>
    ),
  },
];

function HowItWorks() {
  const ref = useFadeUp();
  return (
    <section id="how-it-works" className="relative px-6 py-24 overflow-hidden">
      {/* Animated spotlight beams */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        {/* Primary spotlight cone */}
        <div
          className="spotlight-beam absolute h-[600px] w-[400px]"
          style={{
            top: "-100px",
            left: "50%",
            background: "conic-gradient(from 180deg at 50% 0%, transparent 30%, rgba(147,51,234,0.35) 47%, rgba(139,92,246,0.5) 50%, rgba(147,51,234,0.35) 53%, transparent 70%)",
            filter: "blur(40px)",
          }}
        />
        {/* Secondary pink beam */}
        <div
          className="spotlight-beam-reverse absolute h-[500px] w-[350px]"
          style={{
            top: "-80px",
            left: "50%",
            background: "conic-gradient(from 180deg at 50% 0%, transparent 35%, rgba(219,39,119,0.25) 48%, rgba(236,72,153,0.4) 50%, rgba(219,39,119,0.25) 52%, transparent 65%)",
            filter: "blur(50px)",
          }}
        />
        {/* Ambient glow that follows the beam */}
        <div className="spotlight-glow absolute top-1/3 left-1/2 h-[400px] w-[400px] rounded-full bg-purple-500/25 blur-[100px]" />
      </div>
      <div
        ref={ref}
        className="relative z-10 mx-auto max-w-5xl opacity-0 translate-y-8 transition-all duration-700 ease-out"
      >
        <h2 className="mb-12 text-center text-3xl font-bold text-white lg:text-4xl">
          How it works
        </h2>

        <div className="grid gap-6 lg:grid-cols-3">
          {steps.map((step, i) => (
            <div
              key={step.title}
              className="group rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-md transition-all duration-300 hover:border-purple-500/40 hover:shadow-[0_0_30px_-5px_rgba(168,85,247,0.35)] hover:-translate-y-1"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/15 text-purple-400 transition-all duration-300 group-hover:bg-purple-500/25 group-hover:shadow-[0_0_15px_-3px_rgba(168,85,247,0.5)]">
                {step.icon}
              </div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-purple-400">
                Step {i + 1}
              </div>
              <h3 className="mb-2 text-lg font-bold text-white">{step.title}</h3>
              <p className="text-sm leading-relaxed text-gray-400">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── About / CTA banner ───
function AboutSection() {
  const ref = useFadeUp();
  return (
    <section id="about" className="px-6 py-24">
      <div
        ref={ref}
        className="relative mx-auto max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-12 text-center opacity-0 translate-y-8 backdrop-blur-md transition-all duration-700 ease-out"
      >
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-600/15 blur-[80px]" />
        </div>
        <h2 className="text-3xl font-bold text-white lg:text-4xl">Ready to start drawing?</h2>
        <p className="mt-4 text-gray-400">
          No sign-up required. Pick a reference, choose your style, and let the AI coach guide every stroke.
        </p>
        <a
          href="#start"
          className="btn-shine mt-8 inline-block rounded-full bg-gradient-to-r from-purple-600 to-pink-500 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-purple-600/30 transition hover:shadow-purple-600/50 hover:brightness-110"
        >
          Start Drawing
        </a>
      </div>
    </section>
  );
}

// ─── Footer ───
function Footer() {
  return (
    <footer className="border-t border-white/5 px-6 py-8">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <svg className="h-4 w-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Z" />
          </svg>
          DrawCoach &copy; {new Date().getFullYear()}
        </div>
        <div className="flex gap-6 text-sm text-gray-500">
          <a href="#how-it-works" className="transition hover:text-gray-300">How it Works</a>
          <a href="#about" className="transition hover:text-gray-300">About</a>
        </div>
      </div>
    </footer>
  );
}

// ─── Main Landing Page ───
export default function HomeScreen() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white" style={{ scrollBehavior: "smooth" }}>
      <Navbar />
      <HeroSection />
      <StartDrawingSection />
      <HowItWorks />
      <AboutSection />
      <Footer />
    </div>
  );
}
