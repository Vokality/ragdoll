import { expect, it } from "bun:test";
import { canvasDocumentSchema, serializeCanvasSvg } from "../src/canvas.js";

it("exports escaped text and rejects executable SVG attributes and paints", () => {
  const document = canvasDocumentSchema.parse({
    title: "<Drawing>",
    width: 640,
    height: 400,
    background: "#fff",
    elements: [
      {
        id: "label",
        type: "text",
        x: 20,
        y: 30,
        text: '<script>alert("x")</script>',
        fontSize: 20,
        anchor: "start",
        fill: "#000",
        stroke: "none",
        strokeWidth: 0,
        opacity: 1,
      },
    ],
  });
  const svg = serializeCanvasSvg(document);
  expect(svg).toContain("&lt;script&gt;");
  expect(svg).not.toContain("<script>");
  expect(svg).toContain('viewBox="0 0 640 400"');
  expect(
    canvasDocumentSchema.safeParse({ ...document, width: Infinity }).success,
  ).toBe(false);
  expect(
    canvasDocumentSchema.safeParse({
      ...document,
      elements: [...document.elements, ...document.elements],
    }).success,
  ).toBe(false);
  expect(
    canvasDocumentSchema.safeParse({
      ...document,
      elements: document.elements.map((element) => ({
        ...element,
        onload: "alert(1)",
      })),
    }).success,
  ).toBe(false);
});
