import * as vscode from "vscode";
import { validateCommand, type RawCommand } from "./command-validator";
import type { EmoteSettings } from "./emote-settings";
import { RagdollPanel } from "./ragdoll-panel";
import { VALID_ACTIONS, VALID_MOODS, VALID_TONES } from "./types";
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

  async selectMood(): Promise<void> {
    const selected = await vscode.window.showQuickPick(
      VALID_MOODS.map((mood) => ({ label: mood, id: mood })),
      { placeHolder: "Select a facial mood" },
    );
    if (selected) {
      await this.executeRaw({ type: "setMood", mood: selected.id });
    }
  }

  async selectAction(): Promise<void> {
    const selected = await vscode.window.showQuickPick(
      VALID_ACTIONS.map((action) => ({ label: action, id: action })),
      { placeHolder: "Select an action (wink, talk, or shake)" },
    );
    if (selected) {
      await this.executeRaw({
        type: "triggerAction",
        action: selected.id,
      });
    }
  }

  async selectHeadPose(): Promise<void> {
    const yaw = await vscode.window.showInputBox({
      prompt: "Head yaw in degrees (-35 to 35)",
      value: "0",
    });
    if (yaw === undefined) return;
    const pitch = await vscode.window.showInputBox({
      prompt: "Head pitch in degrees (-20 to 20)",
      value: "0",
    });
    if (pitch === undefined) return;
    await this.executeRaw({
      type: "setHeadPose",
      yawDegrees: Number(yaw),
      pitchDegrees: Number(pitch),
    });
  }

  async selectSpeechBubble(): Promise<void> {
    const text = await vscode.window.showInputBox({
      prompt: "Speech bubble text (leave empty to clear)",
    });
    if (text === undefined) return;
    const tone = await vscode.window.showQuickPick(
      VALID_TONES.map((value) => ({ label: value, id: value })),
      { placeHolder: "Select a speech-bubble tone" },
    );
    await this.executeRaw({
      type: "setSpeechBubble",
      text,
      tone: tone?.id,
    });
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
