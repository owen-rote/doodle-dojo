"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { useCanvasStore } from "@/stores/canvasStore";
import { useSessionStore } from "@/stores/sessionStore";
import { mockStrokePlan } from "@/lib/mockStrokePlan";
import { useGeminiLiveSession } from "@/hooks/useGeminiLiveSession";
import { useStrokeGuide } from "@/hooks/useStrokeGuide";
import { downloadDataUrl, exportStageSnapshot } from "@/lib/canvasExport";
import SessionHeader from "./SessionHeader";
import ReferencePanel from "./ReferencePanel";
import SketchAnimator from "./SketchAnimator";

const DrawingCanvas = dynamic(
  () => import("@/components/canvas/DrawingCanvas"),
  { ssr: false }
);

export default function DrawingSession() {
  const {
    activeTool, setTool,
    brushSize, setBrushSize,
    fillColor, setFillColor,
    undo, clearCanvas,
    stage,
    userStrokes,
    fillImageUrl,
    isDrawing,
  } = useCanvasStore();
  const {
    sessionTitle,
    resetSession,
    setSession,
    guideStrokes,
    currentStrokeIndex,
    completedStrokeIndices,
  } = useSessionStore();

  const referenceImageUrl = useSessionStore((s) => s.referenceImageUrl);
  const { prepareVoicePlayback } = useGeminiLiveSession();
  useStrokeGuide();

  // Load mock data only if no reference image was set from the home page
  useEffect(() => {
    if (!referenceImageUrl) {
      setSession({
        sessionTitle: "Pikachu Sketch",
        referenceImageUrl: "/mock/pikachu.png",
        strokePlan: mockStrokePlan,
      });
    } else {
      setSession({
        sessionTitle: "My Sketch",
        strokePlan: mockStrokePlan,
      });
    }
  }, [setSession, referenceImageUrl]);

  const totalGuideStrokes = guideStrokes.length;
  const hasCompletedFinalStroke =
    totalGuideStrokes > 0 &&
    completedStrokeIndices.length >= totalGuideStrokes &&
    currentStrokeIndex >= totalGuideStrokes;

  const canAnimate =
    !isDrawing &&
    hasCompletedFinalStroke &&
    (userStrokes.length > 0 || fillImageUrl !== null);

  function makeFilename(extension: string) {
    const slug = (sessionTitle || "sketch")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    return `${slug || "sketch"}.${extension}`;
  }

  function captureSketch(options?: { maxDimension?: number }) {
    if (!stage) return null;

    return exportStageSnapshot(stage, {
      mimeType: "image/png",
      backgroundColor: "#FFFFFF",
      pixelRatio: 2,
      maxDimension: options?.maxDimension,
    });
  }

  function handleSaveSketch() {
    const snapshot = captureSketch();
    if (!snapshot) return;

    downloadDataUrl(snapshot.dataUrl, makeFilename("png"));
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="flex h-screen flex-col overflow-hidden bg-[#0a0a0f]"
    >
      <SessionHeader
        sessionTitle={sessionTitle || "Untitled Drawing"}
        activeTool={activeTool}
        brushSize={brushSize}
        fillColor={fillColor}
        onToolChange={setTool}
        onSizeChange={setBrushSize}
        onFillColorChange={setFillColor}
        onUndo={undo}
        onSave={handleSaveSketch}
        onReset={() => {
          clearCanvas();
          resetSession();
        }}
      />

      <div className="flex flex-1 overflow-hidden">
        <ReferencePanel onBeforeVoiceEnable={prepareVoicePlayback} />

        <main className="relative flex flex-1 flex-col p-4">
          {/* Ambient glow behind canvas */}
          <div className="glow-bg pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-500/[0.03] blur-[100px]" />
          </div>

          {/* Drawing Canvas — fills entire area */}
          <div className="relative z-10 flex-1 overflow-hidden rounded-xl border border-white/10 bg-white shadow-[0_0_30px_rgba(168,85,247,0.05)]">
            <DrawingCanvas />
          </div>

          <SketchAnimator
            isVisible={canAnimate}
            sessionTitle={sessionTitle || "Sketch"}
            onSaveSketch={handleSaveSketch}
            onCaptureSnapshot={captureSketch}
          />
        </main>
      </div>
    </motion.div>
  );
}
