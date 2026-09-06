/** Holds Electron's quit event until asynchronous application cleanup settles. */
export class QuitCoordinator {
  private state: "running" | "stopping" | "stopped" = "running";

  constructor(
    private readonly cleanup: () => Promise<void>,
    private readonly quit: () => void,
    private readonly reportError: (error: unknown) => void,
  ) {}

  get isQuitting(): boolean {
    return this.state !== "running";
  }

  readonly beforeQuit = (event: { preventDefault(): void }): void => {
    if (this.state === "stopped") return;
    event.preventDefault();
    if (this.state === "stopping") return;
    this.state = "stopping";
    void this.finish();
  };

  private async finish(): Promise<void> {
    try {
      await this.cleanup();
    } catch (error) {
      this.reportError(error);
    } finally {
      this.state = "stopped";
      this.quit();
    }
  }
}
