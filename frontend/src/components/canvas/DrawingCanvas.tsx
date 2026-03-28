"use client";

import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { Stage, Layer, Line, Circle } from "react-konva";
import type Konva from "konva";
import { useCanvasStore } from "@/stores/canvasStore";
import { guidePointsNormalized } from "@/lib/live/mockGuidePoints";

function effectiveWidth(tool: string, base: number): number {
  if (tool === "brush") return base * 2.5;
  if (tool === "eraser") return base * 4;
  return base;
}

const NORM_GUIDE = guidePointsNormalized();

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
    setKonvaStage,
  } = useCanvasStore();

  const guideDots = useMemo(() => {
    if (size.width < 8 || size.height < 8) return [];
    return NORM_GUIDE.map((p) => ({
      x: p.x * size.width,
      y: p.y * size.height,
    }));
  }, [size.width, size.height]);

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

  useEffect(() => {
    const stage = stageRef.current;
    setKonvaStage(stage);
    return () => setKonvaStage(null);
  }, [size.width, size.height, setKonvaStage]);

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
          <span className="text-[18px] text-gray-400">Start drawing here...</span>
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
          <Layer listening={false}>
            {guideDots.map((pt, i) => (
              <Circle
                key={i}
                x={pt.x}
                y={pt.y}
                radius={2.2}
                fill="rgba(55, 65, 80, 0.38)"
                listening={false}
              />
            ))}
          </Layer>

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
