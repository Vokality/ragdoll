import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import type { EmoteLogger } from "./emote-logger";

const EMOTE_DIRECTORY = path.join(os.homedir(), ".emote");
const STABLE_MCP_SERVER = path.join(EMOTE_DIRECTORY, "mcp-server.js");

export class McpSetupService {
  constructor(private readonly logger: EmoteLogger) {}

  install(extensionPath: string): void {
    try {
      const sourcePath = path.join(extensionPath, "dist", "mcp-server.js");
      if (!fs.existsSync(sourcePath)) {
        throw new Error(`MCP server build missing: ${sourcePath}`);
      }
      fs.mkdirSync(EMOTE_DIRECTORY, { recursive: true });
      const temporaryTarget = path.join(
        EMOTE_DIRECTORY,
        `mcp-server.${Date.now()}.tmp`,
      );
      fs.copyFileSync(sourcePath, temporaryTarget);
      fs.renameSync(temporaryTarget, STABLE_MCP_SERVER);
      if (process.platform !== "win32") fs.chmodSync(STABLE_MCP_SERVER, 0o744);
      this.logger.info("MCP server installed", { target: STABLE_MCP_SERVER });
    } catch (error) {
      this.logger.error("Failed to install MCP server", {
        error: error instanceof Error ? error.message : String(error),
      });
      this.logger.notifyErrorOnce(
        "install-mcp-server",
        "Emote could not install the MCP helper. Check the Emote output channel for details.",
      );
    }
  }

  async copyConfiguration(): Promise<void> {
    try {
      await vscode.env.clipboard.writeText(
        JSON.stringify(
          { emote: { command: "bun", args: [STABLE_MCP_SERVER] } },
          null,
          2,
        ),
      );
      const selection = await vscode.window.showInformationMessage(
        "Emote MCP config copied! Add it to mcpServers in ~/.cursor/mcp.json",
        "Open Config Location",
      );
      if (selection === "Open Config Location") {
        await vscode.commands.executeCommand(
          "vscode.open",
          vscode.Uri.file(path.join(os.homedir(), ".cursor", "mcp.json")),
        );
      }
    } catch (error) {
      this.logger.error("Failed to copy MCP config", {
        error: error instanceof Error ? error.message : String(error),
      });
      this.logger.notifyErrorOnce(
        "copy-mcp-config",
        "Emote could not copy the MCP config to your clipboard.",
      );
    }
  }

  async showFirstRunPrompt(context: vscode.ExtensionContext): Promise<void> {
    if (context.globalState.get<boolean>("mcpSetupShown")) return;
    const selection = await vscode.window.showInformationMessage(
      "Emote: To enable AI control, add the MCP server to your config",
      "Copy Config",
      "Later",
    );
    if (selection === "Copy Config") await this.copyConfiguration();
    await context.globalState.update("mcpSetupShown", true);
  }
}
