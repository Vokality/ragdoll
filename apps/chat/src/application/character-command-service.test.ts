import { expect, it } from "bun:test";
import type { ExpressionPatch, FacialMood } from "@vokality/ragdoll";
import {
  CharacterCommandService,
  type CharacterCommands,
  type CharacterStateReply,
} from "./character-command-service";

function fakeController(
  overrides: Partial<CharacterCommands> = {},
): CharacterCommands {
  return {
    setMood() {},
    triggerAction() {},
    clearAction() {},
    setHeadPose() {},
    setExpression() {},
    resetExpression() {},
    getState: () => ({
      mood: "neutral",
      action: null,
      headPose: { yaw: 0, pitch: 0 },
      joints: {
        headPivot: { x: 0, y: 0, z: 0 },
        neck: { x: 0, y: 0, z: 0 },
      },
      animation: { action: null, actionProgress: 0, isTalking: false },
    }),
    getAxisOverlay: () => ({}),
    ...overrides,
  };
}

const createService = (reply: CharacterStateReply = () => undefined) =>
  new CharacterCommandService(reply);

it("reacts to actual lifecycle events and preserves explicit expressions on completion", () => {
  const moods: FacialMood[] = [];
  const actions: string[] = [];
  const controller = fakeController({
    setMood: (mood) => {
      moods.push(mood);
    },
    triggerAction: (action) => {
      actions.push(action);
    },
    setHeadPose() {},
    setExpression() {},
  });
  const service = createService();
  service.react(controller, "working");
  service.react(controller, "completed");
  expect(moods).toEqual(["thinking", "smile"]);
  service.react(controller, "working");
  service.execute(controller, "setMood", { mood: "surprise" });
  service.react(controller, "completed");
  expect(moods.at(-1)).toBe("surprise");
  service.react(controller, "working");
  service.react(controller, "timer-completed");
  expect(actions).toEqual(["wink"]);
  service.react(controller, "failed");
  expect(moods.at(-1)).toBe("sad");
});

it("executes setExpression with the parsed patch and omitted duration", () => {
  const calls: Array<{ patch: ExpressionPatch; duration?: number }> = [];
  const controller = fakeController({
    setMood() {},
    triggerAction() {},
    setHeadPose() {},
    setExpression: (patch, duration) => {
      calls.push({ patch, duration });
    },
  });
  createService().execute(controller, "setExpression", {
    smile: 0.5,
    gazeY: -1,
  });
  expect(calls).toEqual([
    { patch: { smile: 0.5, gazeY: -1 }, duration: undefined },
  ]);
});

it("strips duration from the setExpression patch", () => {
  const calls: Array<{ patch: ExpressionPatch; duration?: number }> = [];
  const controller = fakeController({
    setMood() {},
    triggerAction() {},
    setHeadPose() {},
    setExpression: (patch, duration) => {
      calls.push({ patch, duration });
    },
  });
  createService().execute(controller, "setExpression", {
    smile: 0.5,
    duration: 0.3,
  });
  expect(calls).toEqual([{ patch: { smile: 0.5 }, duration: 0.3 }]);
});

it("rejects invalid setExpression args", () => {
  const controller = fakeController({
    setMood() {},
    triggerAction() {},
    setHeadPose() {},
    setExpression() {},
  });
  const service = createService();
  expect(() =>
    service.execute(controller, "setExpression", { smile: 1.1 }),
  ).toThrow();
  expect(() =>
    service.execute(controller, "setExpression", { eyesOpen: 1.31 }),
  ).toThrow();
  expect(() =>
    service.execute(controller, "setExpression", { gazeX: 1.1 }),
  ).toThrow();
  expect(() =>
    service.execute(controller, "setExpression", { brows: -1.01 }),
  ).toThrow();
  expect(() =>
    service.execute(controller, "setExpression", { duration: 5.01 }),
  ).toThrow();
  expect(() =>
    service.execute(controller, "setExpression", { smile: Number.NaN }),
  ).toThrow();
  expect(() =>
    service.execute(controller, "setExpression", {
      frown: Number.POSITIVE_INFINITY,
    }),
  ).toThrow();
});

it("does not force a smile after setExpression completes", () => {
  const moods: FacialMood[] = [];
  const controller = fakeController({
    setMood: (mood) => {
      moods.push(mood);
    },
    triggerAction() {},
    setHeadPose() {},
    setExpression() {},
  });
  const service = createService();
  service.execute(controller, "setExpression", { smile: 0.5 });
  service.react(controller, "completed");
  expect(moods).toEqual([]);
});

it('react("working") calls setMood("thinking", 0.3)', () => {
  const moods: Array<{ mood: FacialMood; duration?: number }> = [];
  const controller = fakeController({
    setMood: (mood, duration) => {
      moods.push({ mood, duration });
    },
    triggerAction() {},
    setHeadPose() {},
    setExpression() {},
  });
  createService().react(controller, "working");
  expect(moods).toEqual([{ mood: "thinking", duration: 0.3 }]);
});

it('react("working") then react("completed") without execute still auto-smiles', () => {
  const moods: FacialMood[] = [];
  const controller = fakeController({
    setMood: (mood) => {
      moods.push(mood);
    },
    triggerAction() {},
    setHeadPose() {},
    setExpression() {},
  });
  const service = createService();
  service.react(controller, "working");
  service.react(controller, "completed");
  expect(moods).toEqual(["thinking", "smile"]);
});

it("a rejected command does not suppress the automatic completion smile", () => {
  const moods: FacialMood[] = [];
  const controller = fakeController({
    setMood: (mood) => {
      moods.push(mood);
    },
    triggerAction() {},
    setHeadPose() {},
    setExpression() {},
  });
  const service = createService();
  service.react(controller, "working");
  expect(() => service.execute(controller, "unknownCommand", {})).toThrow();
  expect(() =>
    service.execute(controller, "setMood", { mood: "not-a-mood" }),
  ).toThrow();
  service.react(controller, "completed");
  expect(moods).toEqual(["thinking", "smile"]);
});

it("routes clearAction and resetExpression to the controller", () => {
  const calls: unknown[] = [];
  const controller = fakeController({
    clearAction: () => {
      calls.push("clearAction");
    },
    resetExpression: (axes, duration) => {
      calls.push({ axes, duration });
    },
  });
  const service = createService();
  service.execute(controller, "clearAction", {});
  service.execute(controller, "resetExpression", {
    axes: ["gazeX"],
    duration: 0,
  });
  service.execute(controller, "resetExpression", {});
  expect(calls).toEqual([
    "clearAction",
    { axes: ["gazeX"], duration: 0 },
    { axes: undefined, duration: undefined },
  ]);
  expect(() =>
    service.execute(controller, "resetExpression", { axes: ["chin"] }),
  ).toThrow("Invalid axis");
});

it("answers a state read in degrees without counting as a reaction", () => {
  const replies: Array<Parameters<CharacterStateReply>> = [];
  const moods: FacialMood[] = [];
  const controller = fakeController({
    setMood: (mood) => {
      moods.push(mood);
    },
    getState: () => ({
      mood: "thinking",
      action: "talk",
      headPose: { yaw: Math.PI / 18, pitch: -Math.PI / 36 },
      joints: {
        headPivot: { x: 0, y: 0, z: 0 },
        neck: { x: 0, y: 0, z: 0 },
      },
      animation: { action: "talk", actionProgress: 0.5, isTalking: true },
    }),
    getAxisOverlay: () => ({ gazeX: 0.5 }),
  });
  const service = createService((...reply) => replies.push(reply));

  service.react(controller, "working");
  service.execute(controller, "getCharacterState", { requestId: "state-1" });
  service.react(controller, "completed");

  expect(replies).toEqual([
    [
      "state-1",
      {
        mood: "thinking",
        action: "talk",
        headPose: { yawDegrees: 10, pitchDegrees: -5 },
        expression: { gazeX: 0.5 },
      },
    ],
  ]);
  expect(moods).toEqual(["thinking", "smile"]);
});
