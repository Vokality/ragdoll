import { CharacterScene } from "../../src/renderers/three/character-scene.ts";
import { CharacterController } from "../../src/controllers/character-controller.ts";
import { computeRenderData } from "../../src/components/render-data.ts";
const controls = Object.fromEntries(
  ["variant", "theme", "mood", "pitch", "blink"].map((id) => [
    id,
    document.getElementById(id),
  ]),
);
let controller;
const views = [-90, -35, 0, 35, 90, 180].map((yaw) => {
  const article = document.createElement("article");
  const label = document.createElement("p");
  label.textContent = `${yaw}°`;
  const canvas = document.createElement("canvas");
  article.append(label, canvas);
  document.getElementById("views").append(article);
  return {
    canvas,
    yaw: (yaw * Math.PI) / 180,
    scene: new CharacterScene(canvas),
  };
});
function draw() {
  const data = computeRenderData(controller);
  if (controls.blink.checked) {
    data.expression.leftEye.openness = 0;
    data.expression.rightEye.openness = 0;
  }
  for (const { scene, canvas, yaw } of views) {
    scene.setSize(canvas.clientWidth, canvas.clientHeight);
    scene.setData({
      ...data,
      yaw,
      pitch: (Number(controls.pitch.value) * Math.PI) / 180,
    });
  }
}
function reset() {
  controller?.destroy();
  controller = new CharacterController({
    variantId: controls.variant.value,
    themeId: controls.theme.value,
    onEventSubscriberError: console.error,
  });
  controller.setIdleEnabled(false);
  controller.setMood(controls.mood.value, 0.05);
  for (let i = 0; i < 20; i++) controller.update(0.05);
  draw();
}
for (const control of Object.values(controls))
  control.addEventListener("input", reset);
window.addEventListener("resize", draw);
window.addEventListener("pagehide", () => {
  controller.destroy();
  views.forEach(({ scene }) => scene.dispose());
});
reset();
