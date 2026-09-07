import { expect, it } from "bun:test";
import type { CharacterController, FacialMood } from "@vokality/ragdoll";
import { CharacterCommandService } from "./character-command-service";

it("reacts to actual lifecycle events and preserves explicit expressions on completion", () => {
  const moods: FacialMood[] = [];
  const actions: string[] = [];
  const controller: Pick<
    CharacterController,
    "setMood" | "triggerAction" | "setHeadPose"
  > = {
    setMood: (mood) => {
      moods.push(mood);
    },
    triggerAction: (action) => {
      actions.push(action);
    },
    setHeadPose() {},
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
