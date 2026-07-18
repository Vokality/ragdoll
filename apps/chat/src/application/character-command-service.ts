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

export class CharacterCommandService {
  execute(
    controller: CharacterController,
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
      default:
        throw new Error(`Unsupported character command: ${name}`);
    }
  }
}
