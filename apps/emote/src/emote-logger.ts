import * as vscode from "vscode";

export class EmoteLogger {
  private readonly output: vscode.OutputChannel;
  private readonly shownErrorKeys = new Set<string>();

  constructor(context: vscode.ExtensionContext) {
    this.output = vscode.window.createOutputChannel("Emote");
    context.subscriptions.push(this.output);
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    this.log("info", message, metadata);
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    this.log("warn", message, metadata);
  }

  error(message: string, metadata?: Record<string, unknown>): void {
    this.log("error", message, metadata);
  }

  notifyErrorOnce(key: string, message: string): void {
    if (this.shownErrorKeys.has(key)) return;
    this.shownErrorKeys.add(key);
    void vscode.window
      .showErrorMessage(message, "Open Emote Output")
      .then((selection) => {
        if (selection === "Open Emote Output") this.output.show(true);
      });
  }

  private log(
    level: "info" | "warn" | "error",
    message: string,
    metadata?: Record<string, unknown>,
  ): void {
    const suffix = metadata ? ` ${JSON.stringify(metadata)}` : "";
    this.output.appendLine(
      `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}${suffix}`,
    );
  }
}
