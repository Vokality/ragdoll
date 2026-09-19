import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { Mesh, Vector3 } from "three";
import { RagdollCharacter } from "../../src/components/ragdoll-character.tsx";
import { computeRenderData } from "../../src/components/render-data.ts";
import { applyAxes } from "../../src/models/expression-axes.ts";
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
const moodDuration = (duration) => Math.max(0.05, duration);
const overlaySettled = (target) => {
  const mixed = target.getMixedExpression();
  const end = applyAxes(target.getExpression(), target.getAxisOverlay());
  return (
    nearly(mixed.mouth.cornerPull, end.mouth.cornerPull, 1e-4) &&
    nearly(mixed.leftEye.pupilOffset.x, end.leftEye.pupilOffset.x, 1e-4) &&
    nearly(mixed.leftEye.pupilOffset.y, end.leftEye.pupilOffset.y, 1e-4)
  );
};
const moodSettled = (target, mood) => {
  const current = target.getExpression();
  const preset = target.getGeometry().getExpressionForMood(mood);
  return (
    nearly(current.mouth.cornerPull, preset.mouth.cornerPull) &&
    nearly(current.leftEye.openness, preset.leftEye.openness)
  );
};
const waitSettled = async (target, { startedAt, minDuration, mood }) => {
  const deadline = startedAt + 8000;
  let previous;
  let stable = 0;
  while (performance.now() < deadline) {
    await waitFrame();
    const elapsed = (performance.now() - startedAt) / 1000;
    const mixed = target.getMixedExpression();
    const sample = [
      mixed.mouth.cornerPull,
      mixed.leftEye.pupilOffset.x,
      mixed.leftEye.pupilOffset.y,
    ]
      .map((value) => value.toFixed(5))
      .join(",");
    stable = sample === previous ? stable + 1 : 0;
    previous = sample;
    if (
      elapsed >= minDuration &&
      overlaySettled(target) &&
      (!mood || moodSettled(target, mood)) &&
      stable >= 1
    )
      return mixed;
  }
  throw new Error(
    `expression did not settle after ${minDuration}s${mood ? ` (${mood})` : ""}`,
  );
};
const eyeballs = (head) =>
  head.root.children.filter(
    (child) =>
      child instanceof Mesh &&
      child !== head.skin &&
      Math.abs(child.position.x) > 10,
  );

try {
  render("human", "default");
  check(controller, "Controller was not exposed");
  check(
    document.querySelector("canvas"),
    "Character did not mount a canvas",
  );
  const head = new AnatomicalHead();
  try {
    const neutralAt = performance.now();
    controller.setMood("neutral", 0);
    await waitSettled(controller, {
      startedAt: neutralAt,
      minDuration: moodDuration(0),
      mood: "neutral",
    });

    controller.setExpression({ smile: 0.5, gazeX: 0.6, gazeY: 0.2 }, 0);
    const halfSmile = await waitSettled(controller, {
      startedAt: performance.now(),
      minDuration: 0,
    });
    check(
      nearly(halfSmile.mouth.cornerPull, 0.5),
      `half smile cornerPull was ${halfSmile.mouth.cornerPull}, expected ≈ 0.5`,
    );
    check(
      halfSmile.leftEye.pupilOffset.x > 0,
      `gazeX 0.6 pupilOffset.x was ${halfSmile.leftEye.pupilOffset.x}, expected > 0`,
    );

    controller.setExpression({ gazeX: 1 }, 0);
    await waitSettled(controller, {
      startedAt: performance.now(),
      minDuration: 0,
    });
    const gazeData = computeRenderData(controller);
    check(
      gazeData.expression.leftEye.pupilOffset.x > 0,
      `gazeX +1 render pupilOffset.x was ${gazeData.expression.leftEye.pupilOffset.x}, expected > 0`,
    );
    head.update(gazeData);
    const eyes = eyeballs(head);
    check(eyes.length === 2, `expected two eyeballs, got ${eyes.length}`);
    const rightEye =
      eyes[0].position.x > eyes[1].position.x ? eyes[0] : eyes[1];
    const leftEye = rightEye === eyes[0] ? eyes[1] : eyes[0];
    const towardRight = Math.sign(rightEye.position.x - leftEye.position.x);
    for (const eye of eyes) {
      // Local +Z is face-facing (eyes sit at +Z toward the camera).
      const look = new Vector3(0, 0, 1).applyEuler(eye.rotation);
      check(
        look.x * towardRight > 0,
        `gazeX +1 look x=${look.x} did not point toward the character's right (right-eye x=${rightEye.position.x})`,
      );
    }

    controller.triggerAction("wink");
    const winkDeadline = performance.now() + 5000;
    let winked = false;
    while (performance.now() < winkDeadline) {
      await waitFrame();
      const withAction = controller.getExpressionWithAction();
      if (withAction.rightEye.openness < withAction.leftEye.openness - 0.05) {
        winked = true;
        break;
      }
    }
    check(winked, "wink did not close the right eye more than the left");

    const sadAt = performance.now();
    controller.setMood("sad", 0);
    const sad = await waitSettled(controller, {
      startedAt: sadAt,
      minDuration: moodDuration(0),
      mood: "sad",
    });
    check(
      sad.leftEye.pupilOffset.x > 0,
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
