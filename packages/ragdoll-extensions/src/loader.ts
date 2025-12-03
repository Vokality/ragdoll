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
import type { RagdollExtension, RegisterOptions } from "./types.js";

// =============================================================================
// Types
// =============================================================================

/**
 * Metadata from a package.json that identifies a ragdoll extension
 */
export interface ExtensionPackageJson {
  name: string;
  version: string;
  main?: string;
  module?: string;
  exports?: Record<string, unknown> | string;
  ragdollExtension?:
    | boolean
    | {
        /** Custom extension ID (defaults to package name) */
        id?: string;
        /** Configuration passed to createExtension() */
        config?: Record<string, unknown>;
      };
}

/**
 * Result of loading an extension package
 */
export interface LoadResult {
  packageName: string;
  extensionId: string;
  success: boolean;
  error?: string;
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
   * Default options to pass when registering extensions.
   */
  registerOptions?: RegisterOptions;
}

/**
 * Module exports from an extension package
 */
interface ExtensionModuleExports {
  default?: RagdollExtension | ((config?: Record<string, unknown>) => RagdollExtension);
  extension?: RagdollExtension;
  createExtension?: (config?: Record<string, unknown>) => RagdollExtension;
}

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
  private config: Required<ExtensionLoaderConfig>;
  private loadedPackages: Map<string, string> = new Map(); // packageName -> extensionId

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
    };
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
   */
  private async scanDirectory(nodeModulesPath: string): Promise<string[]> {
    const extensions: string[] = [];

    if (!(await this.config.pathExists(nodeModulesPath))) {
      return extensions;
    }

    try {
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
      };
    }

    try {
      // Read package.json to get metadata
      const packageJson = await this.readPackageJson(packageName);
      if (!packageJson) {
        return {
          packageName,
          extensionId: "",
          success: false,
          error: `Package '${packageName}' not found or invalid`,
        };
      }

      // Determine extension configuration
      const extensionConfig = this.resolveExtensionConfig(packageJson, config);

      // Import the module
      const moduleExports = (await this.config.importModule(
        packageName
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
      const extensionId = extensionConfig.id ?? extension.id;

      // Create wrapper extension if ID override is needed
      const finalExtension =
        extensionId !== extension.id
          ? this.createIdOverrideWrapper(extension, extensionId)
          : extension;

      // Register with the registry
      await this.registry.register(finalExtension, this.config.registerOptions);

      // Track loaded package
      this.loadedPackages.set(packageName, extensionId);

      return {
        packageName,
        extensionId,
        success: true,
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

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  /**
   * Read and parse package.json for a package.
   */
  private async readPackageJson(
    packageName: string
  ): Promise<ExtensionPackageJson | null> {
    // Try to find the package in search paths
    for (const searchPath of this.config.searchPaths) {
      const packagePath = this.joinPath(searchPath, ...packageName.split("/"));
      const packageJsonPath = this.joinPath(packagePath, "package.json");

      if (await this.config.pathExists(packageJsonPath)) {
        try {
          const content = await this.config.readFile(packageJsonPath);
          return JSON.parse(content) as ExtensionPackageJson;
        } catch {
          continue;
        }
      }
    }

    return null;
  }

  /**
   * Resolve extension configuration from package.json and overrides.
   */
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

    const ext = obj as Record<string, unknown>;
    return (
      typeof ext.id === "string" &&
      typeof ext.name === "string" &&
      typeof ext.version === "string" &&
      Array.isArray(ext.tools)
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
      get id() {
        return newId;
      },
      get name() {
        return extension.name;
      },
      get version() {
        return extension.version;
      },
      get tools() {
        return extension.tools;
      },
      initialize: extension.initialize?.bind(extension),
      destroy: extension.destroy?.bind(extension),
    };
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
