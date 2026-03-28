"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { Stage, Layer, Line, Circle, Image as KonvaImage } from "react-konva";
import type Konva from "konva";
import { useCanvasStore } from "@/stores/canvasStore";
import { useSessionStore } from "@/stores/sessionStore";

function effectiveWidth(tool: string, base: number): number {
  if (tool === "brush") return base * 2.5;
  if (tool === "eraser") return base * 4;
  return base;
}

// ─── Flood Fill Algorithm ───

function hexToRgb(hex: string): [number, number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b, 255];
}

function colorsMatch(
  data: Uint8ClampedArray,
  idx: number,
  target: [number, number, number, number],
  tolerance: number
): boolean {
  return (
    Math.abs(data[idx] - target[0]) <= tolerance &&
    Math.abs(data[idx + 1] - target[1]) <= tolerance &&
    Math.abs(data[idx + 2] - target[2]) <= tolerance &&
    Math.abs(data[idx + 3] - target[3]) <= tolerance
  );
}

function colorsSame(
  a: [number, number, number, number],
  b: [number, number, number, number]
): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
}

function floodFill(
  imageData: ImageData,
  startX: number,
  startY: number,
  fillColor: [number, number, number, number],
  tolerance: number = 32
): ImageData {
  const { width, height, data } = imageData;
  const x = Math.floor(startX);
  const y = Math.floor(startY);

  if (x < 0 || x >= width || y < 0 || y >= height) return imageData;

  const startIdx = (y * width + x) * 4;
  const targetColor: [number, number, number, number] = [
    data[startIdx],
    data[startIdx + 1],
    data[startIdx + 2],
    data[startIdx + 3],
  ];

  if (colorsSame(targetColor, fillColor)) return imageData;

  const stack: [number, number][] = [[x, y]];
  const visited = new Uint8Array(width * height);

  while (stack.length > 0) {
    const [cx, cy] = stack.pop()!;
    const pixelIdx = cy * width + cx;

    if (cx < 0 || cx >= width || cy < 0 || cy >= height) continue;
    if (visited[pixelIdx]) continue;

    const dataIdx = pixelIdx * 4;
    if (!colorsMatch(data, dataIdx, targetColor, tolerance)) continue;

    visited[pixelIdx] = 1;
    data[dataIdx] = fillColor[0];
    data[dataIdx + 1] = fillColor[1];
    data[dataIdx + 2] = fillColor[2];
    data[dataIdx + 3] = fillColor[3];

    stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }

  return imageData;
}

// ─── Hook to load an image from a URL into an HTMLImageElement ───

function useImage(url: string | null): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!url) {
      setImage(null);
      return;
    }
    let cancelled = false;
    const img = new window.Image();
    img.onload = () => {
      if (!cancelled) setImage(img);
    };
    img.src = url;
    return () => { cancelled = true; };
  }, [url]);

  return image;
}

// ─── Component ───

export default function DrawingCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const {
    activeTool,
    brushSize,
    fillColor,
    fillImageUrl,
    userStrokes,
    currentStroke,
    isDrawing,
    startDrawing,
    addPoint,
    finishStroke,
    setFillImageUrl,
    snapshotForUndo,
    setStage,
  } = useCanvasStore();

  const guideStrokes = useSessionStore((s) => s.guideStrokes);
  const currentStrokeIndex = useSessionStore((s) => s.currentStrokeIndex);
  const guideImageWidth = useSessionStore((s) => s.guideImageWidth);
  const guideImageHeight = useSessionStore((s) => s.guideImageHeight);
  const fillImageEl = useImage(fillImageUrl);

  const validationMessage = useSessionStore((s) => s.validationMessage);

  // Uniform scale + centering to preserve aspect ratio
  const uniformLayout = (() => {
    if (!guideImageWidth || !guideImageHeight || !size.width || !size.height) return null;
    const scaleX = size.width / guideImageWidth;
    const scaleY = size.height / guideImageHeight;
    const scale = Math.min(scaleX, scaleY);
    const drawWidth = guideImageWidth * scale;
    const drawHeight = guideImageHeight * scale;
    const offsetX = (size.width - drawWidth) / 2;
    const offsetY = (size.height - drawHeight) / 2;
    return { scale, offsetX, offsetY, drawWidth, drawHeight };
  })();

  // Current stroke's guide dots, scaled with uniform aspect ratio
  const guideDots = (() => {
    const stroke = guideStrokes[currentStrokeIndex];
    if (!stroke || !uniformLayout) return [];
    const { scale, offsetX, offsetY } = uniformLayout;
    return stroke.points.map(([x, y]) => ({ x: x * scale + offsetX, y: y * scale + offsetY }));
  })();

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

  // Register the Konva stage in canvasStore
  useEffect(() => {
    if (stageRef.current) {
      setStage(stageRef.current);
    }
    return () => setStage(null);
  }, [size, setStage]);

  const getPointerPos = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return null;
    const pos = stage.getPointerPosition();
    if (!pos || !uniformLayout) return pos;
    // Clamp to the aspect-ratio-preserved drawing area
    const { offsetX, offsetY, drawWidth, drawHeight } = uniformLayout;
    return {
      x: Math.max(offsetX, Math.min(offsetX + drawWidth, pos.x)),
      y: Math.max(offsetY, Math.min(offsetY + drawHeight, pos.y)),
    };
  }, [uniformLayout]);

  // ─── Fill tool handler ───
  const handleFill = useCallback(() => {
    const stage = stageRef.current;
    const pos = getPointerPos();
    if (!stage || !pos) return;

    snapshotForUndo();

    const canvas = stage.toCanvas({ pixelRatio: 1 });
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const rgb = hexToRgb(fillColor);
    floodFill(imageData, pos.x, pos.y, rgb);
    ctx.putImageData(imageData, 0, 0);

    setFillImageUrl(canvas.toDataURL());
  }, [getPointerPos, fillColor, snapshotForUndo, setFillImageUrl]);

  const handleMouseDown = useCallback(() => {
    if (activeTool === "fill") {
      handleFill();
      return;
    }
    const pos = getPointerPos();
    if (!pos) return;
    startDrawing(pos.x, pos.y);
  }, [activeTool, getPointerPos, startDrawing, handleFill]);

  const handleMouseMove = useCallback(() => {
    if (!isDrawing || activeTool === "fill") return;
    const pos = getPointerPos();
    if (!pos) return;
    addPoint(pos.x, pos.y);
  }, [isDrawing, activeTool, getPointerPos, addPoint]);

  const handleMouseUp = useCallback(() => {
    if (!isDrawing || activeTool === "fill") return;
    finishStroke();
  }, [isDrawing, activeTool, finishStroke]);

  // Determine current stroke color: pen=black, brush=fillColor, eraser=white
  const currentStrokeColor =
    activeTool === "eraser"
      ? "#FFFFFF"
      : activeTool === "pen"
        ? "#000000"
        : fillColor;

  const hasContent = userStrokes.length > 0 || currentStroke.length > 0 || fillImageUrl !== null;

  const cursor =
    activeTool === "eraser" || activeTool === "fill"
      ? "crosshair"
      : "default";

  return (
    <div ref={containerRef} className="relative h-full w-full">
      {!hasContent && guideStrokes.length === 0 && size.width > 0 && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <span className="text-[18px] text-gray-400">Loading guide...</span>
        </div>
      )}

      {validationMessage && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <span className={`rounded-lg px-6 py-3 text-lg font-semibold text-white shadow-lg ${
            validationMessage.startsWith("Almost") ? "bg-amber-500/90" : "bg-red-500/90"
          }`}>
            {validationMessage}
          </span>
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
          style={{ cursor }}
        >
          {/* Guide stroke as a dotted line */}
          {guideDots.length > 1 && (
            <Layer listening={false}>
              <Line
                points={guideDots.flatMap((d) => [d.x, d.y])}
                stroke="#9CA3AF"
                strokeWidth={3}
                dash={[6, 6]}
                opacity={0.8}
                lineCap="round"
                lineJoin="round"
                tension={0.5}
              />
            </Layer>
          )}

          {/* Single layer: fill image + strokes + eraser all in one
              so that destination-out (eraser) works on everything */}
          <Layer>
            {fillImageEl && (
              <KonvaImage
                image={fillImageEl}
                x={0}
                y={0}
                width={size.width}
                height={size.height}
              />
            )}

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

            {currentStroke.length >= 4 && (
              <Line
                points={currentStroke}
                stroke={currentStrokeColor}
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
