/**
 * Core Extension Bootstrapper - Handles first-run installation and updates of core extensions.
 *
 * Core extensions (character, tasks, pomodoro) are installed from GitHub releases
 * rather than being bundled with the app. This allows for:
 * - Smaller app bundle size
 * - Independent extension updates
 * - Consistent installation mechanism for all extensions
 *
 * On first run: Shows setup screen while installing core extensions
 * On subsequent runs: Checks for updates in background
 */

import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import { ExtensionInstaller } from "./extension-installer.js";

// =============================================================================
// Types
// =============================================================================

export interface CoreExtension {
  id: string;
  name: string;
  repoUrl: string;
  /** Tag pattern to match releases (e.g., "extension-character-v" for tags like "extension-character-v0.1.0") */
  tagPrefix: string;
  /** Minimum required version */
  minVersion?: string;
}

export interface CoreSetupStatus {
  /** Whether all core extensions are installed */
  isComplete: boolean;
  /** Whether this is the first run (no core extensions installed) */
  isFirstRun: boolean;
  /** Status of each core extension */
  extensions: CoreExtensionStatus[];
  /** Overall progress (0-100) */
  progress: number;
  /** Current operation description */
  currentOperation: string;
}

export interface CoreExtensionStatus {
  id: string;
  name: string;
  status: "pending" | "installing" | "installed" | "failed" | "updating";
  version?: string;
  error?: string;
}

export type SetupProgressCallback = (status: CoreSetupStatus) => void;

// =============================================================================
// Core Extensions Configuration
// =============================================================================

/**
 * List of core extensions that must be installed for the app to function.
 * These are fetched from GitHub releases on first run.
 */
export const CORE_EXTENSIONS: CoreExtension[] = [
  {
    id: "character",
    name: "Character",
    repoUrl: "https://github.com/vokality/ragdoll",
    tagPrefix: "extension-character-v",
  },
  {
    id: "tasks",
    name: "Task Manager",
    repoUrl: "https://github.com/vokality/ragdoll",
    tagPrefix: "extension-tasks-v",
  },
  {
    id: "pomodoro",
    name: "Pomodoro Timer",
    repoUrl: "https://github.com/vokality/ragdoll",
    tagPrefix: "extension-pomodoro-v",
  },
];

// Storage key for tracking core extension setup
const CORE_SETUP_COMPLETE_KEY = "core-extensions-setup-complete";
const CORE_VERSIONS_KEY = "core-extensions-versions";

// =============================================================================
// Core Extension Bootstrapper
// =============================================================================

export class CoreExtensionBootstrapper {
  private installer: ExtensionInstaller;
  private setupFilePath: string;
  private versionsFilePath: string;
  private isDevelopment: boolean;

  constructor(userDataPath: string, installer: ExtensionInstaller, isDevelopment = false) {
    this.installer = installer;
    this.setupFilePath = path.join(userDataPath, "core-setup.json");
    this.versionsFilePath = path.join(userDataPath, "core-versions.json");
    this.isDevelopment = isDevelopment;
  }

  // ===========================================================================
  // Public API
  // ===========================================================================

  /**
   * Check if core extension setup is needed (first run).
   * In development mode, extensions are loaded from workspace so setup is skipped.
   * In production mode, extensions are bundled with the app so setup is also skipped.
   */
  needsSetup(): boolean {
    // Extensions are now bundled with the app in both dev and production modes.
    // No need to download from GitHub releases anymore.
    return false;
  }

  /**
   * Get the current setup status.
   */
  getStatus(): CoreSetupStatus {
    const installed = this.installer.getInstalledExtensions();

    const extensions: CoreExtensionStatus[] = CORE_EXTENSIONS.map((core) => {
      const ext = installed.find((i) => i.id === core.id);
      return {
        id: core.id,
        name: core.name,
        status: ext ? "installed" : "pending",
        version: ext?.version,
      };
    });

    const installedCount = extensions.filter((e) => e.status === "installed").length;
    const isComplete = installedCount === CORE_EXTENSIONS.length;

    return {
      isComplete,
      isFirstRun: this.needsSetup(),
      extensions,
      progress: Math.round((installedCount / CORE_EXTENSIONS.length) * 100),
      currentOperation: isComplete ? "Ready" : "Waiting to start",
    };
  }

  /**
   * Run the initial setup to install all core extensions.
   * Shows progress to the user during first run.
   */
  async runSetup(onProgress?: SetupProgressCallback): Promise<CoreSetupStatus> {
    const status: CoreSetupStatus = {
      isComplete: false,
      isFirstRun: true,
      extensions: CORE_EXTENSIONS.map((core) => ({
        id: core.id,
        name: core.name,
        status: "pending",
      })),
      progress: 0,
      currentOperation: "Starting setup...",
    };

    const updateProgress = (update: Partial<CoreSetupStatus>) => {
      Object.assign(status, update);
      onProgress?.(status);
    };

    console.info("[CoreBootstrapper] Starting core extension setup");

    for (let i = 0; i < CORE_EXTENSIONS.length; i++) {
      const core = CORE_EXTENSIONS[i];
      const extStatus = status.extensions[i];

      // Update status to installing
      extStatus.status = "installing";
      updateProgress({
        currentOperation: `Installing ${core.name}...`,
        progress: Math.round((i / CORE_EXTENSIONS.length) * 100),
      });

      try {
        // Build the release URL with the tag prefix to get the latest matching release
        const releaseUrl = await this.findLatestRelease(core);

        if (!releaseUrl) {
          throw new Error(`No release found for ${core.name}`);
        }

        console.info(`[CoreBootstrapper] Installing ${core.id} from ${releaseUrl}`);
        const result = await this.installer.installFromGitHub(releaseUrl);

        if (result.success) {
          extStatus.status = "installed";
          extStatus.version = result.version;
          console.info(`[CoreBootstrapper] Installed ${core.id} v${result.version}`);
        } else {
          extStatus.status = "failed";
          extStatus.error = result.error || "Unknown error";
          console.error(`[CoreBootstrapper] Failed to install ${core.id}:`, result.error);
        }
      } catch (error) {
        extStatus.status = "failed";
        extStatus.error = error instanceof Error ? error.message : "Unknown error";
        console.error(`[CoreBootstrapper] Error installing ${core.id}:`, error);
      }
    }

    // Check if all extensions installed successfully
    const allInstalled = status.extensions.every((e) => e.status === "installed");
    status.isComplete = allInstalled;
    status.progress = 100;
    status.currentOperation = allInstalled ? "Setup complete" : "Setup completed with errors";

    if (allInstalled) {
      this.markSetupComplete();
      this.saveVersions(status.extensions);
    }

    updateProgress(status);
    return status;
  }

  /**
   * Check for updates to core extensions in the background.
   * No-op since extensions are now bundled with the app.
   */
  async checkAndUpdateInBackground(): Promise<void> {
    // Extensions are bundled with the app, so no background updates needed.
    // Updates will come with new app releases.
    console.info("[CoreBootstrapper] Extensions are bundled with the app - no updates needed");
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  /**
   * Find the latest release URL for a core extension.
   */
  private async findLatestRelease(core: CoreExtension): Promise<string | null> {
    try {
      // Parse repo owner and name from URL
      const match = core.repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (!match) return null;

      const [, owner, repo] = match;

      // Fetch releases and find the latest one matching the tag prefix
      const releases = await this.fetchReleases(owner, repo);

      for (const release of releases) {
        if (release.tag_name.startsWith(core.tagPrefix)) {
          return `${core.repoUrl}/releases/tag/${release.tag_name}`;
        }
      }

      return null;
    } catch (error) {
      console.error(`[CoreBootstrapper] Error finding release for ${core.id}:`, error);
      return null;
    }
  }

  /**
   * Fetch the latest version number for a core extension.
   */
  private async fetchLatestVersion(core: CoreExtension): Promise<string | null> {
    try {
      const match = core.repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (!match) return null;

      const [, owner, repo] = match;
      const releases = await this.fetchReleases(owner, repo);

      for (const release of releases) {
        if (release.tag_name.startsWith(core.tagPrefix)) {
          // Extract version from tag (e.g., "extension-character-v0.1.0" -> "0.1.0")
          const version = release.tag_name.slice(core.tagPrefix.length);
          return version;
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Fetch releases from GitHub API.
   */
  private async fetchReleases(owner: string, repo: string): Promise<Array<{ tag_name: string }>> {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: "api.github.com",
        path: `/repos/${owner}/${repo}/releases?per_page=30`,
        method: "GET",
        headers: {
          "User-Agent": "Lumen-Core-Bootstrapper",
          Accept: "application/vnd.github.v3+json",
        },
      };

      const req = https.request(options, (res: any) => {
        let data = "";
        res.on("data", (chunk: string) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode === 200) {
            try {
              resolve(JSON.parse(data));
            } catch {
              reject(new Error("Failed to parse releases"));
            }
          } else {
            reject(new Error(`GitHub API error: ${res.statusCode}`));
          }
        });
      });

      req.on("error", reject);
      req.end();
    });
  }

  /**
   * Compare version strings (semver-like).
   */
  private isNewerVersion(latest: string, current: string): boolean {
    const parseVersion = (v: string) =>
      v.split(".").map((n) => parseInt(n, 10) || 0);

    const latestParts = parseVersion(latest);
    const currentParts = parseVersion(current);

    for (let i = 0; i < Math.max(latestParts.length, currentParts.length); i++) {
      const l = latestParts[i] || 0;
      const c = currentParts[i] || 0;
      if (l > c) return true;
      if (l < c) return false;
    }

    return false;
  }

  /**
   * Mark setup as complete.
   */
  private markSetupComplete(): void {
    try {
      const data = { [CORE_SETUP_COMPLETE_KEY]: true };
      fs.writeFileSync(this.setupFilePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error("[CoreBootstrapper] Failed to mark setup complete:", error);
    }
  }

  /**
   * Save installed versions for future update checks.
   */
  private saveVersions(extensions: CoreExtensionStatus[]): void {
    try {
      const versions: Record<string, string> = {};
      for (const ext of extensions) {
        if (ext.version) {
          versions[ext.id] = ext.version;
        }
      }
      fs.writeFileSync(this.versionsFilePath, JSON.stringify({ [CORE_VERSIONS_KEY]: versions }, null, 2));
    } catch (error) {
      console.error("[CoreBootstrapper] Failed to save versions:", error);
    }
  }
}

// =============================================================================
// Factory
// =============================================================================

let instance: CoreExtensionBootstrapper | null = null;

export function getCoreExtensionBootstrapper(
  userDataPath: string,
  installer: ExtensionInstaller,
  isDevelopment = false
): CoreExtensionBootstrapper {
  if (!instance) {
    instance = new CoreExtensionBootstrapper(userDataPath, installer, isDevelopment);
  }
  return instance;
}

export function resetCoreExtensionBootstrapper(): void {
  instance = null;
}
