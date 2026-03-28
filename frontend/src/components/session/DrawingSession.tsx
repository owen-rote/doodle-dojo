"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { useCanvasStore } from "@/stores/canvasStore";
import { useSessionStore } from "@/stores/sessionStore";
import { mockStrokePlan } from "@/lib/mockStrokePlan";
import { useGeminiLiveSession } from "@/hooks/useGeminiLiveSession";
import { useStrokeGuide } from "@/hooks/useStrokeGuide";
import SessionHeader from "./SessionHeader";
import ReferencePanel from "./ReferencePanel";

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
  } = useCanvasStore();
  const { progress, sessionTitle, resetSession, setSession } = useSessionStore();

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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="flex h-screen flex-col bg-[#0a0a0f]"
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
        onSave={() => {
          /* TODO: export canvas as PNG */
        }}
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
        </main>
      </div>
    </motion.div>
  );
}
