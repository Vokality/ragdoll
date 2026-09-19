import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { Mesh, Vector3 } from "three";
import { RagdollCharacter } from "../../src/components/ragdoll-character.tsx";
import { computeRenderData } from "../../src/components/render-data.ts";
import { AnatomicalHead } from "../../src/renderers/three/anatomical-head.ts";
import { getTheme } from "../../src/themes/index.ts";

const root = createRoot(document.getElementById("root"));
let controller;
const ready = (value) => {
  controller = value;
  controller.setIdleEnabled(false);
};
const reportError = (error) => {
  throw error;
};
const render = (variant, theme) =>
  flushSync(() =>
    root.render(
      React.createElement(
        StrictMode,
        null,
        React.createElement(RagdollCharacter, {
          variant,
          theme: getTheme(theme),
          onControllerReady: ready,
          onEventSubscriberError: reportError,
        }),
      ),
    ),
  );
const check = (condition, message) => {
  if (!condition) throw new Error(message);
};
const nearly = (actual, expected, epsilon = 0.02) =>
  Math.abs(actual - expected) <= epsilon;
const waitFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
const waitFor = async (predicate, message) => {
  const deadline = performance.now() + 8000;
  while (performance.now() < deadline) {
    if (predicate()) return;
    await waitFrame();
  }
  throw new Error(message);
};
const waitSettled = async (target, minDuration = 0) => {
  const startedAt = performance.now();
  let previous;
  await waitFor(() => {
    const mixed = target.getMixedExpression();
    const sample = [
      mixed.mouth.cornerPull,
      mixed.leftEye.pupilOffset.x,
      mixed.leftEye.pupilOffset.y,
    ]
      .map((value) => value.toFixed(5))
      .join(",");
    const elapsed = (performance.now() - startedAt) / 1000;
    const stable = previous !== undefined && sample === previous;
    previous = sample;
    return elapsed >= minDuration && stable;
  }, `expression did not settle after ${minDuration}s`);
  return target.getMixedExpression();
};

try {
  render("human", "default");
  check(controller, "Controller was not exposed");
  check(
    document.querySelector("canvas"),
    "Character did not mount a canvas",
  );
  const head = new AnatomicalHead();
  try {
    controller.setMood("neutral", 0);
    await waitSettled(controller, 0.05);

    controller.setExpression({ smile: 0.5, gazeX: 0.6, gazeY: 0.2 }, 0);
    const halfSmile = await waitSettled(controller);
    check(
      nearly(halfSmile.mouth.cornerPull, 0.5),
      `half smile cornerPull was ${halfSmile.mouth.cornerPull}, expected ≈ 0.5`,
    );
    check(
      halfSmile.leftEye.pupilOffset.x < 0,
      `gazeX 0.6 pupilOffset.x was ${halfSmile.leftEye.pupilOffset.x}, expected < 0`,
    );

    controller.setExpression({ gazeX: 1 }, 0);
    await waitSettled(controller);
    const gazeData = computeRenderData(controller);
    check(
      nearly(gazeData.expression.leftEye.pupilOffset.x, -4),
      `gazeX +1 render pupilOffset.x was ${gazeData.expression.leftEye.pupilOffset.x}, expected ≈ -4`,
    );
    head.update(gazeData);
    const eyes = head.root.children.filter(
      (child) =>
        child instanceof Mesh &&
        child !== head.skin &&
        Math.abs(child.position.x) > 10,
    );
    check(eyes.length === 2, `expected two eyeballs, got ${eyes.length}`);
    for (const eye of eyes) {
      // Local +Z is face-facing; character's right is −X (ARKit _R).
      const look = new Vector3(0, 0, 1).applyEuler(eye.rotation);
      check(
        look.x < 0,
        `gazeX +1 look x=${look.x} did not point toward the character's right (−X)`,
      );
    }

    controller.triggerAction("wink");
    await waitFor(() => {
      const withAction = controller.getExpressionWithAction();
      return withAction.rightEye.openness < withAction.leftEye.openness - 0.05;
    }, "wink did not close the right eye more than the left");

    controller.setMood("sad", 0);
    const sad = await waitSettled(controller, 0.05);
    check(
      sad.leftEye.pupilOffset.x < 0,
      `sticky gaze pupilOffset.x was ${sad.leftEye.pupilOffset.x} after sad`,
    );
    check(
      sad.mouth.cornerPull < 0 && !nearly(sad.mouth.cornerPull, 0.5),
      `sad cornerPull was ${sad.mouth.cornerPull}, expected negative (not leftover 0.5)`,
    );
  } finally {
    head.dispose();
  }
  root.unmount();
  document.getElementById("result").textContent =
    "PASS: half smile, gaze to character's right, wink overlay, sticky gaze after sad";
} catch (error) {
  document.getElementById("result").textContent = `FAIL: ${error.message}`;
  throw error;
}
