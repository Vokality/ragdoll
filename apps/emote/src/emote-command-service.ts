import * as vscode from "vscode";
import { validateCommand, type RawCommand } from "./command-validator";
import type { EmoteSettings } from "./emote-settings";
import { RagdollPanel } from "./ragdoll-panel";
import type { ThemeId, VariantId } from "./types";

const THEME_OPTIONS: Array<{
  label: string;
  description: string;
  id: ThemeId;
}> = [
  {
    label: "Default",
    description: "Warm, human-like appearance",
    id: "default",
  },
  { label: "Robot", description: "Metallic, futuristic robot", id: "robot" },
  { label: "Alien", description: "Green, otherworldly alien", id: "alien" },
  {
    label: "Monochrome",
    description: "Classic black and white",
    id: "monochrome",
  },
];

const VARIANT_OPTIONS: Array<{
  label: string;
  description: string;
  id: VariantId;
}> = [
  {
    label: "Human",
    description: "Standard human character with balanced proportions",
    id: "human",
  },
  {
    label: "Einstein",
    description: "Einstein caricature with wild hair and bushy mustache",
    id: "einstein",
  },
];

export class EmoteCommandService {
  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly settings: EmoteSettings,
  ) {}

  async executeRaw(raw: RawCommand): Promise<void> {
    const result = validateCommand(raw);
    if (!result.ok) throw new Error(result.reason);
    const command = result.command;

    switch (command.type) {
      case "show":
        this.show();
        return;
      case "hide":
        RagdollPanel.hide();
        return;
      case "clearAction":
        RagdollPanel.currentPanel?.postMessage({ type: "clearAction" });
        return;
      case "setMood":
        this.panel().postMessage(command);
        return;
      case "triggerAction":
        this.panel().postMessage(command);
        return;
      case "setHeadPose":
        this.panel().postMessage({
          type: "setHeadPose",
          yaw:
            command.yawDegrees === undefined
              ? undefined
              : (command.yawDegrees * Math.PI) / 180,
          pitch:
            command.pitchDegrees === undefined
              ? undefined
              : (command.pitchDegrees * Math.PI) / 180,
          duration: command.duration,
        });
        return;
      case "setSpeechBubble":
        this.panel().postMessage(command);
        return;
      case "setTheme":
        await this.settings.setTheme(command.themeId);
        return;
      case "setVariant":
        await this.settings.setVariant(command.variantId);
        return;
    }
  }

  toggle(): void {
    if (RagdollPanel.currentPanel) {
      RagdollPanel.hide();
    } else {
      this.show();
    }
  }

  async selectTheme(): Promise<void> {
    const selected = await vscode.window.showQuickPick(THEME_OPTIONS, {
      placeHolder: `Select theme (current: ${this.settings.getTheme()})`,
    });
    if (selected) {
      await this.executeRaw({ type: "setTheme", themeId: selected.id });
    }
  }

  async selectVariant(): Promise<void> {
    const selected = await vscode.window.showQuickPick(VARIANT_OPTIONS, {
      placeHolder: `Select character variant (current: ${this.settings.getVariant()})`,
    });
    if (selected) {
      await this.executeRaw({ type: "setVariant", variantId: selected.id });
    }
  }

  syncAppearance(): void {
    this.syncTheme();
    this.syncVariant();
  }

  syncTheme(): void {
    if (!RagdollPanel.currentPanel) return;
    RagdollPanel.currentPanel.postMessage({
      type: "setTheme",
      themeId: this.settings.getTheme(),
    });
  }

  syncVariant(): void {
    if (!RagdollPanel.currentPanel) return;
    RagdollPanel.currentPanel.postMessage({
      type: "setVariant",
      variantId: this.settings.getVariant(),
    });
  }

  private show(): void {
    this.panel();
    this.syncAppearance();
  }

  private panel(): RagdollPanel {
    return (
      RagdollPanel.currentPanel ?? RagdollPanel.createOrShow(this.extensionUri)
    );
  }
}
