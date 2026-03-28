"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { Stage, Layer, Line, Circle } from "react-konva";
import type Konva from "konva";
import { useCanvasStore } from "@/stores/canvasStore";
import { GUIDE_POINTS, GUIDE_POINT_RADIUS } from "@/lib/random_points";

function effectiveWidth(tool: string, base: number): number {
  if (tool === "brush") return base * 2.5;
  if (tool === "eraser") return base * 4;
  return base;
}

export default function DrawingCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const {
    activeTool,
    brushSize,
    userStrokes,
    currentStroke,
    isDrawing,
    startDrawing,
    addPoint,
    finishStroke,
    setStage,
  } = useCanvasStore();

  // Track canvas container size
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setSize({ width: Math.floor(width), height: Math.floor(height) });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Register the Konva stage in canvasStore so the live hook can capture frames
  useEffect(() => {
    if (stageRef.current) {
      setStage(stageRef.current);
    }
    return () => setStage(null);
  }, [size, setStage]);

  const getPointerPos = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return null;
    return stage.getPointerPosition();
  }, []);

  const handleMouseDown = useCallback(() => {
    const pos = getPointerPos();
    if (!pos) return;
    startDrawing(pos.x, pos.y);
  }, [getPointerPos, startDrawing]);

  const handleMouseMove = useCallback(() => {
    if (!isDrawing) return;
    const pos = getPointerPos();
    if (!pos) return;
    addPoint(pos.x, pos.y);
  }, [isDrawing, getPointerPos, addPoint]);

  const handleMouseUp = useCallback(() => {
    if (!isDrawing) return;
    finishStroke();
  }, [isDrawing, finishStroke]);

  const hasContent = userStrokes.length > 0 || currentStroke.length > 0;

  return (
    <div ref={containerRef} className="relative h-full w-full">
      {!hasContent && size.width > 0 && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <span className="text-[18px] text-gray-400">Connect the dots...</span>
        </div>
      )}

      {size.width > 0 && size.height > 0 && (
        <Stage
          ref={stageRef}
          width={size.width}
          height={size.height}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onTouchStart={handleMouseDown}
          onTouchMove={handleMouseMove}
          onTouchEnd={handleMouseUp}
          style={{ cursor: activeTool === "eraser" ? "crosshair" : "default" }}
        >
          {/* Guide dots — rendered first so strokes appear on top */}
          <Layer listening={false}>
            {GUIDE_POINTS.map((pt, i) => (
              <Circle
                key={i}
                x={pt.xRatio * size.width}
                y={pt.yRatio * size.height}
                radius={GUIDE_POINT_RADIUS}
                fill="#a855f7"
                opacity={0.75}
              />
            ))}
          </Layer>

          {/* Completed strokes */}
          <Layer>
            {userStrokes.map((stroke) => (
              <Line
                key={stroke.id}
                points={stroke.points}
                stroke={stroke.color}
                strokeWidth={effectiveWidth(stroke.tool, stroke.size)}
                tension={0.5}
                lineCap="round"
                lineJoin="round"
                globalCompositeOperation={
                  stroke.tool === "eraser" ? "destination-out" : "source-over"
                }
              />
            ))}
          </Layer>

          {/* Current stroke being drawn */}
          <Layer>
            {currentStroke.length >= 4 && (
              <Line
                points={currentStroke}
                stroke={activeTool === "eraser" ? "#FFFFFF" : "#1F2937"}
                strokeWidth={effectiveWidth(activeTool, brushSize)}
                tension={0.5}
                lineCap="round"
                lineJoin="round"
                globalCompositeOperation={
                  activeTool === "eraser" ? "destination-out" : "source-over"
                }
              />
            )}
          </Layer>
        </Stage>
      )}
    </div>
  );
}
