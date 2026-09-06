import { expect, it } from "bun:test";
import type { IpcMain } from "electron";
import { IpcRegistrar } from "./registrar.js";
import { registerCardIpc } from "./register-card-ipc.js";
import { ExtensionCardService } from "../services/extension-card-service.js";
import { IPC_CHANNELS } from "../electron-api.js";

it("card IPC validates selection and requires renderer authority", async () => {
  const handlers = new Map<string, Parameters<IpcMain["handle"]>[1]>();
  let authorized = true;
  const registrar = new IpcRegistrar(
    {
      handle: (name, handler) => {
        handlers.set(name, handler);
      },
      removeHandler: (name) => {
        handlers.delete(name);
      },
    },
    () => authorized,
  );
  const cards = new ExtensionCardService(
    {
      getAllSlots: () => [
        {
          slotId: "tasks.main",
          extensionId: "tasks",
          label: "Tasks",
          icon: "checklist",
          priority: 0,
        },
      ],
      getSlotState: () => ({
        visible: true,
        badge: null,
        panel: { type: "list", title: "Tasks", items: [] },
      }),
    },
    () => {},
  );
  registerCardIpc(registrar, cards);
  const invoke = (channel: string, ...args: unknown[]): unknown => {
    const handler = handlers.get(channel);
    if (!handler) throw new Error("Missing handler");
    return Reflect.apply(handler, undefined, [undefined, ...args]);
  };
  expect(await invoke(IPC_CHANNELS.cards.select, "tasks.main")).toEqual({
    success: true,
  });
  expect(await invoke(IPC_CHANNELS.cards.getActive)).toBe("tasks.main");
  expect(await invoke(IPC_CHANNELS.cards.select, 42)).toMatchObject({
    success: false,
  });
  expect(cards.getActive()).toBe("tasks.main");
  authorized = false;
  expect(() => invoke(IPC_CHANNELS.cards.select, null)).toThrow("Unauthorized");
  expect(cards.getActive()).toBe("tasks.main");
  authorized = true;
  expect(await invoke(IPC_CHANNELS.cards.select, null)).toEqual({
    success: true,
  });
  expect(cards.getActive()).toBeNull();
  await registrar.dispose();
});
