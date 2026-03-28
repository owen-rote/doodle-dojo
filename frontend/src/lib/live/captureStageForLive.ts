import type Konva from "konva";

function drawDataUrlOnCanvas(
  ctx: CanvasRenderingContext2D,
  dataUrl: string,
  w: number,
  h: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, w, h);
      resolve();
    };
    img.onerror = () => reject(new Error("layer image decode failed"));
    img.src = dataUrl;
  });
}

/**
 * JPEG base64 (no data: prefix): white background + every Konva layer in order.
 * Layer 0 = dotted guide; later layers = user ink — both are sent so Live can
 * compare the stroke to the guide in real time.
 */
export async function captureDrawingForLiveApi(
  stage: Konva.Stage | null
): Promise<string | null> {
  if (!stage) return null;
  const w = Math.floor(stage.width());
  const h = Math.floor(stage.height());
  if (w < 2 || h < 2) return null;

  const layers = stage.getLayers();
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < layers.length; i++) {
    const dataUrl = layers[i].toDataURL({
      pixelRatio: 1,
      mimeType: "image/png",
      quality: 1,
    });
    await drawDataUrlOnCanvas(ctx, dataUrl, w, h);
  }

  const jpeg = out.toDataURL("image/jpeg", 0.84);
  const comma = jpeg.indexOf(",");
  if (comma === -1) return null;
  return jpeg.slice(comma + 1);
}
