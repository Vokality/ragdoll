import * as vscode from "vscode";
import { randomBytes } from "node:crypto";
import type { ExtensionMessage, WebviewMessage } from "./types";

export class RagdollPanel {
  public static currentPanel: RagdollPanel | undefined;
  private static readonly viewType = "emote.character";

  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private disposables: vscode.Disposable[] = [];
  private isReady = false;
  private isDisposed = false;
  private pendingMessages: ExtensionMessage[] = [];

  public static createOrShow(extensionUri: vscode.Uri): RagdollPanel {
    const column = vscode.ViewColumn.Beside;

    // If we already have a panel, show it
    if (RagdollPanel.currentPanel) {
      RagdollPanel.currentPanel.panel.reveal(column);
      return RagdollPanel.currentPanel;
    }

    // Otherwise, create a new panel
    const panel = vscode.window.createWebviewPanel(
      RagdollPanel.viewType,
      "Emote",
      {
        viewColumn: column,
        preserveFocus: true,
      },
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, "dist", "webview"),
        ],
      },
    );

    // Set the tab icon
    panel.iconPath = {
      light: vscode.Uri.joinPath(extensionUri, "media", "icon-light.svg"),
      dark: vscode.Uri.joinPath(extensionUri, "media", "icon-dark.svg"),
    };

    RagdollPanel.currentPanel = new RagdollPanel(panel, extensionUri);
    return RagdollPanel.currentPanel;
  }

  public static hide(): void {
    RagdollPanel.currentPanel?.dispose();
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this.panel = panel;
    this.extensionUri = extensionUri;

    // Set the webview's initial html content
    this.panel.webview.html = this.getHtmlContent();

    // Listen for when the panel is disposed
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    // Handle messages from the webview
    this.panel.webview.onDidReceiveMessage(
      (value: unknown) => {
        if (!isWebviewMessage(value)) {
          vscode.window.showErrorMessage(
            "Emote received an invalid message from its webview.",
          );
          return;
        }

        const message = value;
        if (message.type === "ready") {
          this.isReady = true;
          // Send any pending messages
          for (const msg of this.pendingMessages) {
            this.panel.webview.postMessage(msg);
          }
          this.pendingMessages = [];
        } else if (message.type === "error") {
          vscode.window.showErrorMessage(`Ragdoll: ${message.message}`);
        }
      },
      null,
      this.disposables,
    );
  }

  /**
   * Send a message to the webview
   */
  public postMessage(message: ExtensionMessage): void {
    if (this.isReady) {
      this.panel.webview.postMessage(message);
    } else {
      // Queue the message until the webview is ready
      this.pendingMessages.push(message);
    }
  }

  public dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    RagdollPanel.currentPanel = undefined;

    // Clean up resources
    this.panel.dispose();

    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  private getHtmlContent(): string {
    const webview = this.panel.webview;
    const webviewPath = vscode.Uri.joinPath(
      this.extensionUri,
      "dist",
      "webview",
    );

    // Get URIs for the webview assets
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(webviewPath, "assets", "index.js"),
    );

    // Use a nonce for script security
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} data:;">
  <title>Emote</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    html, body, #root {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: var(--vscode-editor-background, #1e1e1e);
    }
    @keyframes blink {
      0%, 50% { opacity: 1; }
      51%, 100% { opacity: 0; }
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  return randomBytes(16).toString("hex");
}

function isWebviewMessage(value: unknown): value is WebviewMessage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const message = value as Record<string, unknown>;
  return (
    message.type === "ready" ||
    (message.type === "error" && typeof message.message === "string")
  );
}
