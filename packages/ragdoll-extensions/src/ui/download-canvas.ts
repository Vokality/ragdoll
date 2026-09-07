import { serializeCanvasSvg, type CanvasDocument } from "../canvas.js";

export function downloadCanvasSvg(drawing: CanvasDocument): void {
  const url = URL.createObjectURL(
    new Blob([serializeCanvasSvg(drawing)], { type: "image/svg+xml" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `${drawing.title.replace(/[^a-zA-Z0-9_-]/g, "_") || "drawing"}.svg`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
