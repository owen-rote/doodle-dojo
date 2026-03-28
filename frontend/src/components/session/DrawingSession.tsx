"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { useCanvasStore } from "@/stores/canvasStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useGeminiLiveSession } from "@/hooks/useGeminiLiveSession";
import { mockStrokePlan } from "@/lib/mockStrokePlan";
import SessionHeader from "./SessionHeader";
import ReferencePanel from "./ReferencePanel";
import ToolBar from "./ToolBar";
import ProgressBar from "./ProgressBar";

const DrawingCanvas = dynamic(
  () => import("@/components/canvas/DrawingCanvas"),
  { ssr: false }
);

export default function DrawingSession() {
  const { activeTool, setTool, brushSize, setBrushSize, undo, clearCanvas } =
    useCanvasStore();
  const { progress, sessionTitle, resetSession, setSession, referenceImageUrl } =
    useSessionStore();

  const { sendChat, prepareVoicePlayback } =
    useGeminiLiveSession(referenceImageUrl);

  // Load mock data on mount
  useEffect(() => {
    setSession({
      sessionTitle: "Pikachu Sketch",
      referenceImageUrl: "/mock/pikachu.png",
      strokePlan: mockStrokePlan,
    });
  }, [setSession]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="flex h-screen flex-col bg-[#0a0a0f]"
    >
      <SessionHeader
        sessionTitle={sessionTitle || "Untitled Drawing"}
        onSave={() => {
          /* TODO: export canvas as PNG */
        }}
        onReset={() => {
          clearCanvas();
          resetSession();
        }}
      />

      <div className="flex flex-1 overflow-hidden">
        <ReferencePanel
          onChatSend={sendChat}
          onBeforeVoiceEnable={prepareVoicePlayback}
        />

        <main className="relative flex flex-1 flex-col p-5">
          {/* Ambient glow behind canvas */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-500/[0.03] blur-[100px]" />
          </div>

          {/* Top Row: Toolbar + Progress */}
          <div className="relative z-10 flex items-center justify-between">
            <ToolBar
              activeTool={activeTool}
              brushSize={brushSize}
              onToolChange={setTool}
              onSizeChange={setBrushSize}
              onUndo={undo}
            />
            <ProgressBar percentage={progress} />
          </div>

          {/* Drawing Canvas */}
          <div className="relative z-10 mt-4 flex-1 overflow-hidden rounded-xl border border-white/10 bg-white shadow-[0_0_30px_rgba(168,85,247,0.05)]">
            <DrawingCanvas />
          </div>
        </main>
      </div>
    </motion.div>
  );
}
