import type { IpcMain, IpcMainInvokeEvent } from "electron";

export class IpcRegistrar {
  private readonly channels: string[] = [];

  constructor(private readonly ipc: IpcMain) {}

  handle<TArgs extends unknown[], TResult>(
    channel: string,
    handler: (
      event: IpcMainInvokeEvent,
      ...args: TArgs
    ) => TResult | Promise<TResult>,
  ): void {
    this.ipc.handle(channel, handler);
    this.channels.push(channel);
  }

  dispose(): void {
    for (const channel of this.channels) this.ipc.removeHandler(channel);
    this.channels.length = 0;
  }
}
