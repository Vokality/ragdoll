import { expect, it } from "bun:test";
import type {
  CharacterController,
  ExpressionPatch,
  FacialMood,
} from "@vokality/ragdoll";
import { CharacterCommandService } from "./character-command-service";

type CharacterCommands = Pick<
  CharacterController,
  "setMood" | "triggerAction" | "setHeadPose" | "setExpression"
>;

it("reacts to actual lifecycle events and preserves explicit expressions on completion", () => {
  const moods: FacialMood[] = [];
  const actions: string[] = [];
  const controller: CharacterCommands = {
    setMood: (mood) => {
      moods.push(mood);
    },
    triggerAction: (action) => {
      actions.push(action);
    },
    setHeadPose() {},
    setExpression() {},
  };
  const service = new CharacterCommandService();
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
  const controller: CharacterCommands = {
    setMood() {},
    triggerAction() {},
    setHeadPose() {},
    setExpression: (patch, duration) => {
      calls.push({ patch, duration });
    },
  };
  new CharacterCommandService().execute(controller, "setExpression", {
    smile: 0.5,
    gazeY: -1,
  });
  expect(calls).toEqual([
    { patch: { smile: 0.5, gazeY: -1 }, duration: undefined },
  ]);
});

it("strips duration from the setExpression patch", () => {
  const calls: Array<{ patch: ExpressionPatch; duration?: number }> = [];
  const controller: CharacterCommands = {
    setMood() {},
    triggerAction() {},
    setHeadPose() {},
    setExpression: (patch, duration) => {
      calls.push({ patch, duration });
    },
  };
  new CharacterCommandService().execute(controller, "setExpression", {
    smile: 0.5,
    duration: 0.3,
  });
  expect(calls).toEqual([{ patch: { smile: 0.5 }, duration: 0.3 }]);
});

it("rejects invalid setExpression args", () => {
  const controller: CharacterCommands = {
    setMood() {},
    triggerAction() {},
    setHeadPose() {},
    setExpression() {},
  };
  const service = new CharacterCommandService();
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
  const controller: CharacterCommands = {
    setMood: (mood) => {
      moods.push(mood);
    },
    triggerAction() {},
    setHeadPose() {},
    setExpression() {},
  };
  const service = new CharacterCommandService();
  service.execute(controller, "setExpression", { smile: 0.5 });
  service.react(controller, "completed");
  expect(moods).toEqual([]);
});

it('react("working") calls setMood("thinking", 0.3)', () => {
  const moods: Array<{ mood: FacialMood; duration?: number }> = [];
  const controller: CharacterCommands = {
    setMood: (mood, duration) => {
      moods.push({ mood, duration });
    },
    triggerAction() {},
    setHeadPose() {},
    setExpression() {},
  };
  new CharacterCommandService().react(controller, "working");
  expect(moods).toEqual([{ mood: "thinking", duration: 0.3 }]);
});

it('react("working") then react("completed") without execute still auto-smiles', () => {
  const moods: FacialMood[] = [];
  const controller: CharacterCommands = {
    setMood: (mood) => {
      moods.push(mood);
    },
    triggerAction() {},
    setHeadPose() {},
    setExpression() {},
  };
  const service = new CharacterCommandService();
  service.react(controller, "working");
  service.react(controller, "completed");
  expect(moods).toEqual(["thinking", "smile"]);
});
