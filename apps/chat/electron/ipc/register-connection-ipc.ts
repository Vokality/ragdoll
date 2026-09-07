import { z } from "zod";
import { IPC_CHANNELS, connectionSaveSchema } from "../electron-api.js";
import type { ConnectionService } from "../services/connection-service.js";
import type { IpcRegistrar } from "./registrar.js";

export function registerConnectionIpc(
  ipc: IpcRegistrar,
  connections: ConnectionService,
): void {
  const id = z.uuid();
  ipc.handle(IPC_CHANNELS.connections.list, () => connections.list());
  ipc.handle(IPC_CHANNELS.connections.save, (_event, input: unknown) =>
    connections.save(connectionSaveSchema.parse(input)),
  );
  ipc.handle(IPC_CHANNELS.connections.connect, (_event, value: unknown) =>
    connections.connect(id.parse(value)),
  );
  ipc.handle(IPC_CHANNELS.connections.disconnect, (_event, value: unknown) =>
    connections.disconnect(id.parse(value)),
  );
  ipc.handle(
    IPC_CHANNELS.connections.setEnabled,
    (_event, value: unknown, enabled: unknown) =>
      connections.setEnabled(id.parse(value), z.boolean().parse(enabled)),
  );
  ipc.handle(IPC_CHANNELS.connections.remove, (_event, value: unknown) =>
    connections.remove(id.parse(value)),
  );
}
