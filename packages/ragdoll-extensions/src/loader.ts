/**
 * Extension Loader - Discovers and loads extensions from npm packages.
 *
 * Extensions are npm packages that:
 * 1. Have `"ragdollExtension": true` in their package.json
 * 2. Export either:
 *    - A `createExtension(config?)` function that returns a RagdollExtension
 *    - A default export that is a RagdollExtension
 *    - An `extension` named export that is a RagdollExtension
 *
 * @example
 * ```ts
 * const loader = new ExtensionLoader(registry, {
 *   searchPaths: [path.join(process.cwd(), "node_modules")],
 * });
 *
 * // Discover and load all extensions
 * const loaded = await loader.discoverAndLoad();
 * console.log(`Loaded ${loaded.length} extensions`);
 *
 * // Or load a specific package
 * await loader.loadPackage("@example/my-extension");
 * ```
 */

import type { ExtensionRegistry } from "./registry.js";
import type {
  ExtensionContributionMetadata,
  ExtensionHostEnvironment,
  ExtensionManifest,
  RegisterOptions,
  RegistryCapabilityEvent,
  RagdollExtension,
  ConfigSchema,
  OAuthConfig,
} from "./types.js";

// =============================================================================
// Types
// =============================================================================

/**
 * Extended ragdollExtension field in package.json
 */
export interface ExtensionPackageManifest {
  /** Custom extension ID (defaults to package name) */
  id?: string;
  /** Human-readable name */
  name?: string;
  /** Short description */
  description?: string;
  /** Entry point (relative to package root) */
  entry?: string;
  /** Whether users can disable this extension */
  canDisable?: boolean;
  /** Capabilities this extension provides */
  capabilities?: Array<"tools" | "slots" | "services" | "stateChannels">;
  /** Host capabilities required by this extension */
  requiredCapabilities?: string[];
  /** Configuration passed to createExtension() (legacy) */
  config?: Record<string, unknown>;

  /**
   * Configuration schema - defines what config the extension needs
   * The host will prompt users for these values and pass them to the extension
   */
  configSchema?: ConfigSchema;

  /**
   * OAuth configuration - if present, the host handles OAuth flow
   * and provides tokens to the extension via host.oauth
   */
  oauth?: OAuthConfig;
}

/**
 * Metadata from a package.json that identifies a ragdoll extension
 */
export interface ExtensionPackageJson {
  name: string;
  version: string;
  main?: string;
  module?: string;
  exports?: Record<string, unknown> | string;
  ragdollExtension?: boolean | ExtensionPackageManifest;
}

/**
 * Parsed extension package info (includes config/oauth requirements)
 */
export interface ExtensionPackageInfo {
  packageName: string;
  packagePath: string;
  extensionId: string;
  name: string;
  description?: string;
  version: string;
  canDisable: boolean;
  configSchema?: ConfigSchema;
  oauth?: OAuthConfig;
  requiredCapabilities?: string[];
}

/**
 * Result of loading an extension package
 */
export interface LoadResult {
  packageName: string;
  extensionId: string;
  success: boolean;
  error?: string;
  /** Package info including config/oauth requirements */
  packageInfo?: ExtensionPackageInfo;
}

/**
 * Configuration for the extension loader
 */
export interface ExtensionLoaderConfig {
  /**
   * Paths to search for node_modules directories.
   * Defaults to common locations relative to process.cwd().
   */
  searchPaths?: string[];

  /**
   * Custom function to read a file (for testing/alternative environments).
   * Defaults to using fs.promises.readFile.
   */
  readFile?: (path: string) => Promise<string>;

  /**
   * Custom function to read directory contents.
   * Defaults to using fs.promises.readdir.
   */
  readDir?: (path: string) => Promise<string[]>;

  /**
   * Custom function to check if a path exists.
   * Defaults to using fs.promises.access.
   */
  pathExists?: (path: string) => Promise<boolean>;

  /**
   * Custom function to dynamically import a module.
   * Defaults to using dynamic import().
   */
  importModule?: (modulePath: string) => Promise<unknown>;

  /**
   * Whether to continue loading other extensions if one fails.
   * Defaults to true.
   */
  continueOnError?: boolean;

  /**
   * Default options to pass when registering extensions (aside from host/config).
   */
  registerOptions?: Omit<RegisterOptions, "host" | "config"> & { config?: Record<string, unknown> };

  /**
   * Static host environment to provide to every extension.
   */
  hostEnvironment?: ExtensionHostEnvironment;

  /**
   * Resolve a host environment for a specific extension manifest.
   */
  getHostEnvironment?: (manifest: ExtensionManifest) => ExtensionHostEnvironment;

  /**
   * Called whenever an extension contribution is fully registered.
   */
  onContributionLoaded?: (metadata: ExtensionContributionMetadata) => void;

  /**
   * Called whenever a capability is registered with the registry.
   */
  onCapabilityRegistered?: (event: RegistryCapabilityEvent) => void;
}

/**
 * Module exports from an extension package
 */
interface ExtensionModuleExports {
  default?: RagdollExtension | ((config?: Record<string, unknown>) => RagdollExtension);
  extension?: RagdollExtension;
  createExtension?: (config?: Record<string, unknown>) => RagdollExtension;
}

type NormalizedLoaderConfig = {
  searchPaths: string[];
  readFile: (path: string) => Promise<string>;
  readDir: (path: string) => Promise<string[]>;
  pathExists: (path: string) => Promise<boolean>;
  importModule: (modulePath: string) => Promise<unknown>;
  continueOnError: boolean;
  registerOptions: Omit<RegisterOptions, "host" | "config"> & { config?: Record<string, unknown> };
  hostEnvironment?: ExtensionHostEnvironment;
  getHostEnvironment?: (manifest: ExtensionManifest) => ExtensionHostEnvironment;
  onContributionLoaded?: (metadata: ExtensionContributionMetadata) => void;
  onCapabilityRegistered?: (event: RegistryCapabilityEvent) => void;
};

// =============================================================================
// Default Implementations
// =============================================================================

async function defaultReadFile(filePath: string): Promise<string> {
  const fs = await import("fs/promises");
  return fs.readFile(filePath, "utf-8");
}

async function defaultReadDir(dirPath: string): Promise<string[]> {
  const fs = await import("fs/promises");
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}

async function defaultPathExists(checkPath: string): Promise<boolean> {
  const fs = await import("fs/promises");
  try {
    await fs.access(checkPath);
    return true;
  } catch {
    return false;
  }
}

async function defaultImportModule(modulePath: string): Promise<unknown> {
  return import(modulePath);
}

// =============================================================================
// Extension Loader
// =============================================================================

/**
 * Discovers and loads ragdoll extensions from npm packages.
 */
export class ExtensionLoader {
  private registry: ExtensionRegistry;
  private config: NormalizedLoaderConfig;
  private loadedPackages: Map<string, string> = new Map(); // packageName -> extensionId
  private packageInfoCache: Map<string, ExtensionPackageInfo> = new Map(); // packageName -> info
  private registryDisposers: Array<() => void> = [];

  constructor(registry: ExtensionRegistry, config: ExtensionLoaderConfig = {}) {
    this.registry = registry;
    this.config = {
      searchPaths: config.searchPaths ?? [],
      readFile: config.readFile ?? defaultReadFile,
      readDir: config.readDir ?? defaultReadDir,
      pathExists: config.pathExists ?? defaultPathExists,
      importModule: config.importModule ?? defaultImportModule,
      continueOnError: config.continueOnError ?? true,
      registerOptions: config.registerOptions ?? {},
      hostEnvironment: config.hostEnvironment,
      getHostEnvironment: config.getHostEnvironment,
      onContributionLoaded: config.onContributionLoaded,
      onCapabilityRegistered: config.onCapabilityRegistered,
    };

    if (this.config.onContributionLoaded) {
      const dispose = this.registry.on("extension:registered", (event) => {
        const metadata = this.registry.getContributionMetadata(event.extensionId);
        if (metadata) {
          this.config.onContributionLoaded?.(metadata);
        }
      });
      this.registryDisposers.push(dispose);
    }

    if (this.config.onCapabilityRegistered) {
      const dispose = this.registry.on("capability:registered", (event) => {
        this.config.onCapabilityRegistered?.(event as RegistryCapabilityEvent);
      });
      this.registryDisposers.push(dispose);
    }
  }

  /**
   * Discover all extension packages in the search paths and load them.
   *
   * @returns Array of load results
   */
  async discoverAndLoad(): Promise<LoadResult[]> {
    const results: LoadResult[] = [];
    const discovered = await this.discoverPackages();

    for (const packageName of discovered) {
      const result = await this.loadPackage(packageName);
      results.push(result);

      if (!result.success && !this.config.continueOnError) {
        break;
      }
    }

    return results;
  }

  /**
   * Discover extension packages without loading them.
   *
   * @returns Array of package names that are ragdoll extensions
   */
  async discoverPackages(): Promise<string[]> {
    const extensionPackages: string[] = [];

    for (const searchPath of this.config.searchPaths) {
      const packages = await this.scanDirectory(searchPath);
      extensionPackages.push(...packages);
    }

    // Deduplicate
    return [...new Set(extensionPackages)];
  }

  /**
   * Scan a node_modules directory for extension packages.
   * Also handles user extensions directories where packages are in subdirectories
   * named by extension ID rather than package name.
   */
  private async scanDirectory(nodeModulesPath: string): Promise<string[]> {
    const extensions: string[] = [];

    if (!(await this.config.pathExists(nodeModulesPath))) {
      return extensions;
    }

    // Check if this is a user extensions directory (not node_modules)
    // User extensions are installed in subdirectories named by extension ID
    const isUserExtensionsDir = !nodeModulesPath.includes("node_modules");

    try {
      if (isUserExtensionsDir) {
        // For user extensions directory, scan subdirectories recursively
        // Each subdirectory contains an extension with its own package.json
        const entries = await this.config.readDir(nodeModulesPath);

        for (const entry of entries) {
          // Skip hidden files/directories and temp files
          if (entry.startsWith(".")) {
            continue;
          }

          const subdirPath = this.joinPath(nodeModulesPath, entry);

          // Check if this subdirectory contains a package.json
          const packageJsonPath = this.joinPath(subdirPath, "package.json");
          if (await this.config.pathExists(packageJsonPath)) {
            try {
              const content = await this.config.readFile(packageJsonPath);
              const pkg = JSON.parse(content) as ExtensionPackageJson;

              // If it's an extension package, use the package name from package.json
              if (pkg.ragdollExtension && pkg.name) {
                extensions.push(pkg.name);
              }
            } catch {
              // Skip invalid package.json files
              continue;
            }
          }
        }
      } else {
        // Standard node_modules structure
        const entries = await this.config.readDir(nodeModulesPath);

        for (const entry of entries) {
          // Handle scoped packages (@org/package)
          if (entry.startsWith("@")) {
            const scopePath = this.joinPath(nodeModulesPath, entry);
            const scopedPackages = await this.config.readDir(scopePath);

            for (const scopedPkg of scopedPackages) {
              const pkgName = `${entry}/${scopedPkg}`;
              const pkgPath = this.joinPath(scopePath, scopedPkg);

              if (await this.isExtensionPackage(pkgPath)) {
                extensions.push(pkgName);
              }
            }
          } else {
            // Regular package
            const pkgPath = this.joinPath(nodeModulesPath, entry);

            if (await this.isExtensionPackage(pkgPath)) {
              extensions.push(entry);
            }
          }
        }
      }
    } catch {
      // Directory read failed, skip silently
    }

    return extensions;
  }

  /**
   * Check if a package directory contains a ragdoll extension.
   */
  private async isExtensionPackage(packagePath: string): Promise<boolean> {
    const packageJsonPath = this.joinPath(packagePath, "package.json");

    if (!(await this.config.pathExists(packageJsonPath))) {
      return false;
    }

    try {
      const content = await this.config.readFile(packageJsonPath);
      const pkg = JSON.parse(content) as ExtensionPackageJson;
      return !!pkg.ragdollExtension;
    } catch {
      return false;
    }
  }

  /**
   * Load a specific extension package by name.
   *
   * @param packageName - The npm package name (e.g., "@example/my-extension")
   * @param config - Optional configuration to pass to createExtension()
   */
  async loadPackage(
    packageName: string,
    config?: Record<string, unknown>
  ): Promise<LoadResult> {
    // Check if already loaded
    if (this.loadedPackages.has(packageName)) {
      return {
        packageName,
        extensionId: this.loadedPackages.get(packageName)!,
        success: true,
        packageInfo: this.packageInfoCache.get(packageName),
      };
    }

    try {
      // Read package.json to get metadata and resolve package path
      const { packageJson, packagePath } = await this.readPackageJsonWithPath(packageName);
      if (!packageJson || !packagePath) {
        return {
          packageName,
          extensionId: "",
          success: false,
          error: `Package '${packageName}' not found or invalid`,
        };
      }

      // Extract and cache package info
      const packageInfo = this.extractPackageInfo(packageName, packagePath, packageJson) ?? undefined;
      if (packageInfo) {
        this.packageInfoCache.set(packageName, packageInfo);
      }

      // Determine extension configuration
      const extensionConfig = this.resolveExtensionConfig(packageJson, config);

      // Resolve the entry point
      const entryPoint = this.resolveEntryPoint(packageJson);
      const fullModulePath = this.joinPath(packagePath, entryPoint);

      // Import the module using the full resolved path
      const moduleExports = (await this.config.importModule(
        fullModulePath
      )) as ExtensionModuleExports;

      // Extract the extension
      const extension = this.extractExtension(
        moduleExports,
        extensionConfig.config
      );

      if (!extension) {
        return {
          packageName,
          extensionId: "",
          success: false,
          error: `Package '${packageName}' does not export a valid extension`,
        };
      }

      // Override extension ID if specified
      const extensionId = extensionConfig.id ?? extension.manifest.id;

      // Create wrapper extension if ID override is needed
      const finalExtension =
        extensionId !== extension.manifest.id
          ? this.createIdOverrideWrapper(extension, extensionId)
          : extension;

      const host = this.resolveHostEnvironment(finalExtension.manifest);
      const baseOptions = this.config.registerOptions ?? {};

      // Register with the registry
      await this.registry.register(finalExtension, {
        ...baseOptions,
        host,
        config: extensionConfig.config ?? baseOptions.config,
      });

      // Track loaded package
      this.loadedPackages.set(packageName, extensionId);

      return {
        packageName,
        extensionId,
        success: true,
        packageInfo,
      };
    } catch (error) {
      return {
        packageName,
        extensionId: "",
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error loading package",
      };
    }
  }

  /**
   * Unload a previously loaded package.
   *
   * @param packageName - The npm package name to unload
   */
  async unloadPackage(packageName: string): Promise<boolean> {
    const extensionId = this.loadedPackages.get(packageName);
    if (!extensionId) {
      return false;
    }

    const unregistered = await this.registry.unregister(extensionId);
    if (unregistered) {
      this.loadedPackages.delete(packageName);
    }

    return unregistered;
  }

  /**
   * Reload a package (unload then load again).
   *
   * @param packageName - The npm package name to reload
   * @param config - Optional new configuration
   */
  async reloadPackage(
    packageName: string,
    config?: Record<string, unknown>
  ): Promise<LoadResult> {
    await this.unloadPackage(packageName);
    return this.loadPackage(packageName, config);
  }

  /**
   * Get list of currently loaded packages.
   */
  getLoadedPackages(): Array<{ packageName: string; extensionId: string }> {
    return Array.from(this.loadedPackages.entries()).map(
      ([packageName, extensionId]) => ({
        packageName,
        extensionId,
      })
    );
  }

  /**
   * Check if a package is currently loaded.
   */
  isPackageLoaded(packageName: string): boolean {
    return this.loadedPackages.has(packageName);
  }

  /**
   * Get package info for an extension without loading it.
   * Returns configuration requirements (configSchema, oauth, etc.)
   */
  async getPackageInfo(packageName: string): Promise<ExtensionPackageInfo | null> {
    // Check cache first
    if (this.packageInfoCache.has(packageName)) {
      return this.packageInfoCache.get(packageName)!;
    }

    const { packageJson, packagePath } = await this.readPackageJsonWithPath(packageName);
    if (!packageJson || !packagePath) {
      return null;
    }

    const info = this.extractPackageInfo(packageName, packagePath, packageJson);
    if (info) {
      this.packageInfoCache.set(packageName, info);
    }
    return info;
  }

  /**
   * Get all cached package info.
   */
  getAllPackageInfo(): ExtensionPackageInfo[] {
    return Array.from(this.packageInfoCache.values());
  }

  /**
   * Get package info for a loaded extension by its ID.
   */
  getPackageInfoById(extensionId: string): ExtensionPackageInfo | undefined {
    for (const info of this.packageInfoCache.values()) {
      if (info.extensionId === extensionId) {
        return info;
      }
    }
    return undefined;
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  /**
   * Extract package info from package.json
   */
  private extractPackageInfo(
    packageName: string,
    packagePath: string,
    packageJson: ExtensionPackageJson
  ): ExtensionPackageInfo | null {
    const ragdollExt = packageJson.ragdollExtension;
    if (!ragdollExt) return null;

    const manifest = typeof ragdollExt === "boolean" ? {} : ragdollExt;

    return {
      packageName,
      packagePath,
      extensionId: manifest.id ?? packageName,
      name: manifest.name ?? packageJson.name,
      description: manifest.description,
      version: packageJson.version,
      canDisable: manifest.canDisable ?? true,
      configSchema: manifest.configSchema,
      oauth: manifest.oauth,
      requiredCapabilities: manifest.requiredCapabilities,
    };
  }

  /**
   * Read and parse package.json for a package, returning both the parsed JSON and the package path.
   */
  private async readPackageJsonWithPath(
    packageName: string
  ): Promise<{ packageJson: ExtensionPackageJson | null; packagePath: string | null }> {
    // Try to find the package in search paths
    for (const searchPath of this.config.searchPaths) {
      // First, try standard node_modules structure
      const packagePath = this.joinPath(searchPath, ...packageName.split("/"));
      const packageJsonPath = this.joinPath(packagePath, "package.json");

      if (await this.config.pathExists(packageJsonPath)) {
        try {
          const content = await this.config.readFile(packageJsonPath);
          const packageJson = JSON.parse(content) as ExtensionPackageJson;
          return { packageJson, packagePath };
        } catch {
          continue;
        }
      }

      // If not found and this is a user extensions directory, search subdirectories
      const isUserExtensionsDir = !searchPath.includes("node_modules");
      if (isUserExtensionsDir) {
        try {
          const entries = await this.config.readDir(searchPath);

          for (const entry of entries) {
            // Skip hidden files/directories
            if (entry.startsWith(".")) {
              continue;
            }

            const subdirPath = this.joinPath(searchPath, entry);
            const subdirPackageJsonPath = this.joinPath(subdirPath, "package.json");

            if (await this.config.pathExists(subdirPackageJsonPath)) {
              try {
                const content = await this.config.readFile(subdirPackageJsonPath);
                const packageJson = JSON.parse(content) as ExtensionPackageJson;

                // Check if this package.json matches the package name we're looking for
                if (packageJson.name === packageName) {
                  return { packageJson, packagePath: subdirPath };
                }
              } catch {
                continue;
              }
            }
          }
        } catch {
          // Directory read failed, continue to next search path
          continue;
        }
      }
    }

    return { packageJson: null, packagePath: null };
  }

  /**
   * Resolve the entry point file for a package based on its package.json.
   * Checks in order: exports, module, main, or defaults to "index.js".
   */
  private resolveEntryPoint(packageJson: ExtensionPackageJson): string {
    // Check exports field (modern packages)
    if (packageJson.exports) {
      if (typeof packageJson.exports === "string") {
        return packageJson.exports;
      }
      // If exports is an object, try common patterns
      if (typeof packageJson.exports === "object") {
        const exportsObj = packageJson.exports as Record<string, unknown>;
        if (typeof exportsObj["."] === "string") {
          return exportsObj["."];
        }
        if (typeof exportsObj["import"] === "string") {
          return exportsObj["import"];
        }
        if (typeof exportsObj["default"] === "string") {
          return exportsObj["default"];
        }
      }
    }

    // Check module field (ES modules)
    if (packageJson.module) {
      return packageJson.module;
    }

    // Check main field (CommonJS or fallback)
    if (packageJson.main) {
      return packageJson.main;
    }

    // Default to index.js
    return "index.js";
  }

  /**
   * Resolve extension configuration from package.json and overrides.
   */
  private resolveHostEnvironment(manifest: ExtensionManifest): ExtensionHostEnvironment {
    if (this.config.getHostEnvironment) {
      const env = this.config.getHostEnvironment(manifest);
      if (env) {
        return env;
      }
      throw new Error(
        `Host environment resolver did not return a value for extension '${manifest.id}'.`
      );
    }
    if (this.config.hostEnvironment) {
      return this.config.hostEnvironment;
    }
    throw new Error(
      `No host environment provided for extension '${manifest.id}'. Configure hostEnvironment or getHostEnvironment when creating the loader.`
    );
  }

  private resolveExtensionConfig(
    packageJson: ExtensionPackageJson,
    overrideConfig?: Record<string, unknown>
  ): { id?: string; config?: Record<string, unknown> } {
    const ragdollExt = packageJson.ragdollExtension;

    if (typeof ragdollExt === "boolean") {
      return { config: overrideConfig };
    }

    return {
      id: ragdollExt?.id,
      config: overrideConfig ?? ragdollExt?.config,
    };
  }

  /**
   * Extract a RagdollExtension from module exports.
   */
  private extractExtension(
    exports: ExtensionModuleExports,
    config?: Record<string, unknown>
  ): RagdollExtension | null {
    // Try createExtension function first
    if (typeof exports.createExtension === "function") {
      return exports.createExtension(config);
    }

    // Try named 'extension' export
    if (exports.extension && this.isValidExtension(exports.extension)) {
      return exports.extension;
    }

    // Try default export
    if (exports.default) {
      // Default could be a factory function
      if (typeof exports.default === "function") {
        const result = exports.default(config);
        if (this.isValidExtension(result)) {
          return result;
        }
      }
      // Or a direct extension object
      if (this.isValidExtension(exports.default)) {
        return exports.default as RagdollExtension;
      }
    }

    return null;
  }

  /**
   * Check if an object looks like a valid RagdollExtension.
   */
  private isValidExtension(obj: unknown): obj is RagdollExtension {
    if (!obj || typeof obj !== "object") {
      return false;
    }

    const ext = obj as RagdollExtension;
    const manifest = ext.manifest;
    return (
      typeof manifest?.id === "string" &&
      typeof manifest.name === "string" &&
      typeof manifest.version === "string" &&
      typeof ext.activate === "function"
    );
  }

  /**
   * Create a wrapper extension that overrides the ID.
   */
  private createIdOverrideWrapper(
    extension: RagdollExtension,
    newId: string
  ): RagdollExtension {
    return {
      manifest: {
        ...extension.manifest,
        id: newId,
      },
      activate: extension.activate.bind(extension),
      deactivate: extension.deactivate?.bind(extension),
    };
  }

  dispose(): void {
    for (const dispose of this.registryDisposers) {
      dispose();
    }
    this.registryDisposers = [];
  }

  /**
   * Join path segments (simple cross-platform implementation).
   */
  private joinPath(...segments: string[]): string {
    return segments.join("/").replace(/\/+/g, "/");
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create an extension loader.
 *
 * @example
 * ```ts
 * import path from "path";
 *
 * const loader = createLoader(registry, {
 *   searchPaths: [
 *     path.join(process.cwd(), "node_modules"),
 *     path.join(__dirname, "..", "node_modules"),
 *   ],
 * });
 *
 * await loader.discoverAndLoad();
 * ```
 */
export function createLoader(
  registry: ExtensionRegistry,
  config?: ExtensionLoaderConfig
): ExtensionLoader {
  return new ExtensionLoader(registry, config);
}
