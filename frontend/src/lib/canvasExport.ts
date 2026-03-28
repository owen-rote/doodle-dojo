import type Konva from "konva";

export interface ExportedCanvasSnapshot {
  dataUrl: string;
  base64: string;
  mimeType: string;
  width: number;
  height: number;
}

interface ExportStageOptions {
  mimeType?: string;
  quality?: number;
  pixelRatio?: number;
  backgroundColor?: string;
  maxDimension?: number;
}

export function exportStageSnapshot(
  stage: Konva.Stage,
  {
    mimeType = "image/png",
    quality = 1,
    pixelRatio = 2,
    backgroundColor = "#FFFFFF",
    maxDimension,
  }: ExportStageOptions = {}
): ExportedCanvasSnapshot {
  const stageCanvas = stage.toCanvas({ pixelRatio });
  const longestSide = Math.max(stageCanvas.width, stageCanvas.height);
  const scale =
    maxDimension && longestSide > maxDimension
      ? maxDimension / longestSide
      : 1;

  const targetWidth = Math.max(1, Math.round(stageCanvas.width * scale));
  const targetHeight = Math.max(1, Math.round(stageCanvas.height * scale));

  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = targetWidth;
  exportCanvas.height = targetHeight;

  const context = exportCanvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to create a canvas context for export.");
  }

  context.fillStyle = backgroundColor;
  context.fillRect(0, 0, targetWidth, targetHeight);
  context.drawImage(stageCanvas, 0, 0, targetWidth, targetHeight);

  const dataUrl =
    mimeType === "image/jpeg"
      ? exportCanvas.toDataURL(mimeType, quality)
      : exportCanvas.toDataURL(mimeType);

  const [, base64 = ""] = dataUrl.split(",", 2);

  return {
    dataUrl,
    base64,
    mimeType,
    width: targetWidth,
    height: targetHeight,
  };
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

export function base64ToBlob(base64: string, mimeType: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
}
