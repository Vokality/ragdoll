import type { IpcMain, IpcMainInvokeEvent } from "electron";

export class IpcRegistrar {
  private readonly channels: string[] = [];
  private readonly pending = new Set<Promise<unknown>>();
  private disposed = false;

  constructor(
    private readonly ipc: Pick<IpcMain, "handle" | "removeHandler">,
    private readonly authorize: (event: IpcMainInvokeEvent) => boolean,
  ) {}

  handle<TArgs extends unknown[], TResult>(
    channel: string,
    handler: (
      event: IpcMainInvokeEvent,
      ...args: TArgs
    ) => TResult | Promise<TResult>,
  ): void {
    if (this.disposed) throw new Error("IPC registrar is disposed");
    this.ipc.handle(channel, (event, ...args: TArgs) => {
      if (this.disposed) throw new Error("IPC registrar is disposed");
      if (!this.authorize(event)) throw new Error("Unauthorized IPC sender");
      const result = Promise.resolve().then(() => handler(event, ...args));
      this.pending.add(result);
      void result.then(
        () => this.pending.delete(result),
        () => this.pending.delete(result),
      );
      return result;
    });
    this.channels.push(channel);
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    for (const channel of this.channels) this.ipc.removeHandler(channel);
    this.channels.length = 0;
    await Promise.allSettled(this.pending);
  }
}
