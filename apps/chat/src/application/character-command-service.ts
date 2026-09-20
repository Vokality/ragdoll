import type { CharacterReaction } from "../../electron/electron-api";
import type { CharacterController, FacialMood } from "@vokality/ragdoll";
import { z } from "zod";

const moodCommandSchema = z.object({
  mood: z.enum([
    "neutral",
    "smile",
    "frown",
    "laugh",
    "angry",
    "sad",
    "surprise",
    "confusion",
    "thinking",
  ] satisfies [FacialMood, ...FacialMood[]]),
  duration: z.number().min(0).max(5).optional(),
});

const actionCommandSchema = z.object({
  action: z.enum(["wink", "talk", "shake"]),
  duration: z.number().min(0.2).max(5).optional(),
});

const headPoseCommandSchema = z.object({
  yawDegrees: z.number().min(-35).max(35).optional(),
  pitchDegrees: z.number().min(-20).max(20).optional(),
  duration: z.number().min(0.1).max(2).optional(),
});

const expressionCommandSchema = z.object({
  smile: z.number().min(0).max(1).optional(),
  frown: z.number().min(0).max(1).optional(),
  brows: z.number().min(-1).max(1).optional(),
  eyesOpen: z.number().min(0).max(1.3).optional(),
  jaw: z.number().min(0).max(1).optional(),
  gazeX: z.number().min(-1).max(1).optional(),
  gazeY: z.number().min(-1).max(1).optional(),
  duration: z.number().min(0).max(5).optional(),
});

type CharacterCommands = Pick<
  CharacterController,
  "setMood" | "triggerAction" | "setHeadPose" | "setExpression"
>;

export class CharacterCommandService {
  private explicitReaction = false;
  react(controller: CharacterCommands, reaction: CharacterReaction): void {
    if (reaction === "working") {
      this.explicitReaction = false;
      controller.setMood("thinking", 0.3);
    } else if (reaction === "failed") {
      controller.setMood("sad", 0.3);
    } else if (!this.explicitReaction) {
      controller.setMood("smile", 0.4);
      if (reaction === "timer-completed") controller.triggerAction("wink", 0.8);
    }
  }

  execute(
    controller: CharacterCommands,
    name: string,
    args: Record<string, unknown>,
  ): void {
    this.dispatch(controller, name, args);
    // Only a command that took effect replaces the automatic reaction; a
    // rejected one must not leave the face stuck on "thinking".
    this.explicitReaction = true;
  }

  private dispatch(
    controller: CharacterCommands,
    name: string,
    args: Record<string, unknown>,
  ): void {
    switch (name) {
      case "setMood": {
        const command = moodCommandSchema.parse(args);
        controller.setMood(command.mood, command.duration);
        return;
      }
      case "triggerAction": {
        const command = actionCommandSchema.parse(args);
        controller.triggerAction(command.action, command.duration);
        return;
      }
      case "setHeadPose": {
        const command = headPoseCommandSchema.parse(args);
        controller.setHeadPose(
          {
            yaw:
              command.yawDegrees === undefined
                ? undefined
                : (command.yawDegrees * Math.PI) / 180,
            pitch:
              command.pitchDegrees === undefined
                ? undefined
                : (command.pitchDegrees * Math.PI) / 180,
          },
          command.duration,
        );
        return;
      }
      case "setExpression": {
        const command = expressionCommandSchema.parse(args);
        const { duration, ...patch } = command;
        controller.setExpression(patch, duration);
        return;
      }
      default:
        throw new Error(`Unsupported character command: ${name}`);
    }
  }
}
