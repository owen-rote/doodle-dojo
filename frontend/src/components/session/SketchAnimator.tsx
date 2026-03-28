"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { ExportedCanvasSnapshot } from "@/lib/canvasExport";
import { base64ToBlob } from "@/lib/canvasExport";

interface SketchAnimatorProps {
  isVisible: boolean;
  sessionTitle: string;
  onSaveSketch: () => void;
  onCaptureSnapshot: (options?: { maxDimension?: number }) => ExportedCanvasSnapshot | null;
}

const DEFAULT_PROMPT =
  "Bring the sketch to life. Add color and keep the original drawing recognizable. If the subject is a person, make them smile and wave naturally. Otherwise, make the subject do a simple, joyful dance.";

function makeFilename(sessionTitle: string, extension: string) {
  const slug = sessionTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${slug || "sketch"}-${extension}`;
}

export default function SketchAnimator({
  isVisible,
  sessionTitle,
  onSaveSketch,
  onCaptureSnapshot,
}: SketchAnimatorProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoFilename, setVideoFilename] = useState("sketch-animation.mp4");

  useEffect(() => {
    return () => {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [videoUrl]);

  useEffect(() => {
    if (!isVisible) {
      setModalOpen(false);
      setError(null);
      setVideoUrl(null);
    }
  }, [isVisible]);

  const statusText = isGenerating
    ? "Veo 3 is animating your sketch. This can take a minute or two."
    : videoUrl
      ? "Your animation is ready to preview and save."
      : "Send the current sketch to Veo 3 and save the MP4 when it comes back.";

  async function handleAnimate() {
    const snapshot = onCaptureSnapshot({ maxDimension: 1280 });
    if (!snapshot) {
      setError("Could not capture the current sketch.");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/animate-sketch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: snapshot.base64,
          imageMimeType: snapshot.mimeType,
          prompt: DEFAULT_PROMPT,
          aspectRatio: snapshot.width >= snapshot.height ? "16:9" : "9:16",
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        video?: string;
        mimeType?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || "Failed to animate sketch.");
      }

      if (!data.video || !data.mimeType) {
        throw new Error("Veo returned an empty video response.");
      }

      const nextVideoUrl = URL.createObjectURL(
        base64ToBlob(data.video, data.mimeType)
      );

      setVideoUrl(nextVideoUrl);
      setVideoFilename(makeFilename(sessionTitle, "animation.mp4"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to animate sketch.");
    } finally {
      setIsGenerating(false);
    }
  }

  function handleSaveVideo() {
    if (!videoUrl) return;

    const link = document.createElement("a");
    link.href = videoUrl;
    link.download = videoFilename;
    link.click();
  }

  return (
    <>
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="pointer-events-none absolute bottom-6 right-6 z-20 max-w-sm"
          >
            <div className="pointer-events-auto overflow-hidden rounded-3xl border border-white/15 bg-[#11111a]/95 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-400/80 to-transparent" />

              <div className="mb-3 flex items-center gap-2">
                <span className="rounded-full border border-fuchsia-400/25 bg-fuchsia-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-fuchsia-200">
                  Sketch Ready
                </span>
              </div>

              <h3 className="text-lg font-semibold text-white">
                Animate your sketch and save it
              </h3>
              <p className="mt-2 text-sm leading-6 text-white/60">
                Turn the current canvas into a short Veo 3 clip once you finish a stroke.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(true)}
                  className="rounded-full border border-fuchsia-400/40 bg-fuchsia-400/15 px-4 py-2 text-sm font-medium text-fuchsia-100 transition hover:border-fuchsia-300/60 hover:bg-fuchsia-400/25"
                >
                  Animate with Veo 3
                </button>
                <button
                  type="button"
                  onClick={onSaveSketch}
                  className="rounded-full border border-white/12 bg-white/6 px-4 py-2 text-sm font-medium text-white/75 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
                >
                  Save PNG
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm"
            onClick={() => {
              if (!isGenerating) {
                setModalOpen(false);
              }
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="relative w-full max-w-5xl overflow-hidden rounded-[28px] border border-white/12 bg-[#0d0d15] shadow-[0_32px_120px_rgba(0,0,0,0.45)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_top,_rgba(217,70,239,0.25),_transparent_68%)]" />

              <div className="relative flex min-h-[640px] flex-col items-center justify-center bg-white/[0.03] p-6 md:p-8">
                <div className="mb-5 flex w-full max-w-4xl items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-fuchsia-200/80">
                      Veo 3
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">
                      Animate your sketch
                    </h2>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-white/60">
                      {statusText}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    disabled={isGenerating}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/60 transition hover:border-white/20 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Close
                  </button>
                </div>

                <div className="flex w-full max-w-4xl flex-col items-center">
                  <p className="text-center text-xs font-semibold uppercase tracking-[0.22em] text-white/35">
                    Preview
                  </p>

                  <div className="mt-4 flex min-h-[420px] w-full items-center justify-center overflow-hidden rounded-[24px] border border-white/10 bg-[#08080d]">
                    {videoUrl ? (
                      <video
                        key={videoUrl}
                        src={videoUrl}
                        controls
                        className="h-full min-h-[420px] w-full rounded-[24px] object-contain"
                      />
                    ) : (
                      <div className="flex max-w-xs flex-col items-center justify-center px-6 text-center">
                        <div
                          className={`mb-4 h-12 w-12 rounded-full border ${
                            isGenerating
                              ? "animate-spin border-fuchsia-300/60 border-t-transparent"
                              : "border-white/12"
                          }`}
                        />
                        <p className="text-sm font-medium text-white/70">
                          {isGenerating ? "Rendering your animation..." : "Video preview will appear here."}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-white/35">
                          {isGenerating
                            ? "Veo is processing the inline sketch image and generating an MP4."
                            : "Generate once you like the current stroke work on the canvas."}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={handleAnimate}
                      disabled={isGenerating}
                      className="rounded-full border border-fuchsia-400/40 bg-fuchsia-400/15 px-3 py-1.5 text-xs font-medium text-fuchsia-100 transition hover:border-fuchsia-300/60 hover:bg-fuchsia-400/25 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isGenerating ? "Animating..." : videoUrl ? "Animate again" : "Generate video"}
                    </button>
                    <button
                      type="button"
                      onClick={onSaveSketch}
                      disabled={isGenerating}
                      className="rounded-full border border-white/12 bg-white/6 px-3 py-1.5 text-xs font-medium text-white/75 transition hover:border-white/20 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Save sketch
                    </button>
                    {videoUrl && (
                      <button
                        type="button"
                        onClick={handleSaveVideo}
                        className="rounded-full border border-emerald-400/35 bg-emerald-400/12 px-3 py-1.5 text-xs font-medium text-emerald-100 transition hover:border-emerald-300/55 hover:bg-emerald-400/20"
                      >
                        Save MP4
                      </button>
                    )}
                  </div>

                  {error && (
                    <div className="mt-6 w-full rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                      {error}
                    </div>
                  )}

                  <div className="mt-6 w-full rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-white/45">
                    The current sketch is sent as inline image data, then the finished video is returned here for download.
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
