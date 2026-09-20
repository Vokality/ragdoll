import { z } from "zod";
import {
  CHARACTER_STATE_TOPIC,
  EXPRESSION_AXES,
  VALID_ACTIONS,
  VALID_MOODS,
  type CharacterStateSnapshot,
} from "@vokality/ragdoll-extension-character";
import { IPC_CHANNELS, type OperationResult } from "../electron-api.js";
import type { ExtensionMessageBus } from "../services/extension-message-bus.js";
import type { IpcRegistrar } from "./registrar.js";

const requestIdSchema = z.string().min(1).max(64);

const characterStateSchema = z.strictObject({
  mood: z.enum(VALID_MOODS),
  action: z.enum(VALID_ACTIONS).nullable(),
  headPose: z.strictObject({
    yawDegrees: z.number().finite(),
    pitchDegrees: z.number().finite(),
  }),
  expression: z.partialRecord(z.enum(EXPRESSION_AXES), z.number().finite()),
}) satisfies z.ZodType<CharacterStateSnapshot>;

/** Carries the renderer's answer to a character state read back to the extension. */
export function registerCharacterIpc(
  ipc: IpcRegistrar,
  messageBus: Pick<ExtensionMessageBus, "deliver">,
): void {
  ipc.handle(
    IPC_CHANNELS.character.stateReply,
    (_event, requestId: unknown, state: unknown): OperationResult => {
      messageBus.deliver(CHARACTER_STATE_TOPIC, {
        requestId: requestIdSchema.parse(requestId),
        state: characterStateSchema.parse(state),
      });
      return { success: true };
    },
  );
}
