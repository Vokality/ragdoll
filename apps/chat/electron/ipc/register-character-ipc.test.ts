import { expect, it } from "bun:test";
import type { IpcMain } from "electron";
import { CHARACTER_STATE_TOPIC } from "@vokality/ragdoll-extension-character";
import { IpcRegistrar } from "./registrar.js";
import { registerCharacterIpc } from "./register-character-ipc.js";
import { ExtensionMessageBus } from "../services/extension-message-bus.js";
import { IPC_CHANNELS } from "../electron-api.js";

it("delivers a validated character state reply to the character extension only", async () => {
  const handlers = new Map<string, Parameters<IpcMain["handle"]>[1]>();
  const registrar = new IpcRegistrar(
    {
      handle: (name, handler) => {
        handlers.set(name, handler);
      },
      removeHandler: (name) => {
        handlers.delete(name);
      },
    },
    () => true,
  );
  const bus = new ExtensionMessageBus(() => undefined);
  const received: unknown[] = [];
  bus
    .forExtension("character")
    .subscribe(CHARACTER_STATE_TOPIC, (payload) => received.push(payload));
  registerCharacterIpc(registrar, bus);
  const reply = async (...args: unknown[]): Promise<unknown> => {
    const handler = handlers.get(IPC_CHANNELS.character.stateReply);
    if (!handler) throw new Error("Missing handler");
    return Reflect.apply(handler, undefined, [undefined, ...args]);
  };
  const state = {
    mood: "smile",
    action: null,
    headPose: { yawDegrees: 10, pitchDegrees: 0 },
    expression: { gazeX: 0.5 },
  };

  expect(await reply("state-1", state)).toEqual({ success: true });
  expect(received).toEqual([{ requestId: "state-1", state }]);

  for (const invalid of [
    { ...state, mood: "bored" },
    { ...state, headPose: { yawDegrees: NaN, pitchDegrees: 0 } },
    { ...state, expression: { chin: 1 } },
    { ...state, injected: true },
  ]) {
    await expect(reply("state-2", invalid)).rejects.toThrow();
  }
  await expect(reply("", state)).rejects.toThrow();
  expect(received).toHaveLength(1);

  // Other extensions cannot listen in on the character's topic.
  expect(() =>
    bus.forExtension("notes").subscribe(CHARACTER_STATE_TOPIC, () => {}),
  ).toThrow("cannot use IPC topic");
  await registrar.dispose();
});
