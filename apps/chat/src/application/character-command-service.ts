import type { CharacterReaction } from "../../electron/electron-api";
import type { CharacterController } from "@vokality/ragdoll";
import {
  parseCharacterCommand,
  type CharacterStateSnapshot,
} from "@vokality/ragdoll-extension-character";

export type CharacterCommands = Pick<
  CharacterController,
  | "setMood"
  | "triggerAction"
  | "clearAction"
  | "setHeadPose"
  | "setExpression"
  | "resetExpression"
  | "getState"
  | "getAxisOverlay"
>;

/** Sends the answer to a getCharacterState request back to the host. */
export type CharacterStateReply = (
  requestId: string,
  state: CharacterStateSnapshot,
) => void;

const toDegrees = (radians: number): number =>
  Math.round(((radians * 180) / Math.PI) * 10) / 10;

export class CharacterCommandService {
  private explicitReaction = false;

  constructor(private readonly replyState: CharacterStateReply) {}

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
    // Only a command that took effect replaces the automatic reaction; a
    // rejected one must not leave the face stuck on "thinking".
    if (this.dispatch(controller, name, args)) this.explicitReaction = true;
  }

  private dispatch(
    controller: CharacterCommands,
    name: string,
    args: Record<string, unknown>,
  ): boolean {
    // The extension owns the argument shapes and ranges; this only maps a
    // parsed command onto the controller.
    const command = parseCharacterCommand(name, args);
    switch (command.tool) {
      case "setMood":
        controller.setMood(command.args.mood, command.args.duration);
        return true;
      case "triggerAction":
        controller.triggerAction(command.args.action, command.args.duration);
        return true;
      case "clearAction":
        controller.clearAction();
        return true;
      case "setHeadPose": {
        const { yawDegrees, pitchDegrees, duration } = command.args;
        controller.setHeadPose(
          {
            yaw:
              yawDegrees === undefined
                ? undefined
                : (yawDegrees * Math.PI) / 180,
            pitch:
              pitchDegrees === undefined
                ? undefined
                : (pitchDegrees * Math.PI) / 180,
          },
          duration,
        );
        return true;
      }
      case "setExpression": {
        const { duration, ...patch } = command.args;
        controller.setExpression(patch, duration);
        return true;
      }
      case "resetExpression":
        controller.resetExpression(command.args.axes, command.args.duration);
        return true;
      case "getCharacterState": {
        const state = controller.getState();
        this.replyState(command.args.requestId, {
          mood: state.mood,
          action:
            state.action === null || state.action === "none"
              ? null
              : state.action,
          headPose: {
            yawDegrees: toDegrees(state.headPose.yaw),
            pitchDegrees: toDegrees(state.headPose.pitch),
          },
          expression: { ...controller.getAxisOverlay() },
        });
        // Looking is not a reaction; the automatic one still applies.
        return false;
      }
      default:
        return command satisfies never;
    }
  }
}
