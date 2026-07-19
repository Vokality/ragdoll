/**
 * Extension Loader - Discovers and loads extensions from package directories.
 *
 * Extension packages:
 * 1. Have `"ragdollExtension": true` in their package.json
 * 2. Export a `createExtension(config?)` function that returns a RagdollExtension
 *
 * @example
 * ```ts
 * const loader = createLoader(registry, {
 *   packageRoots: [{ path: extensionsDirectory, layout: "installed" }],
 *   fileSystem: hostFileSystem,
 *   hostEnvironment,
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
import { z } from "zod";
import {
  ConfigSchemaSchema,
  OAuthConfigSchema,
} from "./types/config-schema.js";
import type {
  ExtensionContributionMetadata,
  ExtensionHostEnvironment,
  ExtensionManifest,
  RegisterOptions,
  RegistryCapabilityEvent,
  RagdollExtension,
  ExtensionHostCapability,
} from "./types.js";

// =============================================================================
// Types
// =============================================================================

/**
 * Extended ragdollExtension field in package.json
 */
const ExtensionPackageManifestSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9._-]*$/),
    name: z.string().min(1),
    description: z.string().optional(),
    entry: z
      .string()
      .min(1)
      .refine(
        (entry) =>
          !entry.startsWith("/") &&
          !entry.startsWith("\\") &&
          !entry.split(/[\\/]/).includes(".."),
        "entry must stay within the extension package",
      ),
    canDisable: z.boolean(),
    capabilities: z
      .array(z.enum(["tools", "slots", "services", "stateChannels"]))
      .refine((values) => new Set(values).size === values.length, {
        message: "capabilities must not contain duplicates",
      }),
    requiredCapabilities: z
      .array(
        z.enum([
          "storage",
          "notifications",
          "conversationEvents",
          "timers",
          "scheduler",
          "ipc",
          "logger",
          "oauth",
          "config",
        ]),
      )
      .refine((values) => new Set(values).size === values.length, {
        message: "requiredCapabilities must not contain duplicates",
      }),
    optionalCapabilities: z
      .array(
        z.enum([
          "storage",
          "notifications",
          "conversationEvents",
          "timers",
          "scheduler",
          "ipc",
          "logger",
          "oauth",
          "config",
        ]),
      )
      .refine((values) => new Set(values).size === values.length, {
        message: "optionalCapabilities must not contain duplicates",
      }),
    configSchema: ConfigSchemaSchema.optional(),
    oauth: OAuthConfigSchema.optional(),
  })
  .strict()
  .superRefine((manifest, context) => {
    const duplicateCapability = manifest.requiredCapabilities.find(
      (capability) => manifest.optionalCapabilities.includes(capability),
    );
    if (duplicateCapability) {
      context.addIssue({
        code: "custom",
        path: ["optionalCapabilities"],
        message: `Capability '${duplicateCapability}' cannot be both required and optional`,
      });
    }
    if (!manifest.oauth) return;
    if (!manifest.requiredCapabilities.includes("oauth")) {
      context.addIssue({
        code: "custom",
        path: ["requiredCapabilities"],
        message: "OAuth metadata requires the oauth host capability",
      });
    }
    const clientIdField =
      manifest.configSchema?.[manifest.oauth.clientIdConfigKey];
    if (!clientIdField || clientIdField.type !== "string") {
      context.addIssue({
        code: "custom",
        path: ["oauth", "clientIdConfigKey"],
        message: "OAuth clientIdConfigKey must reference a string config field",
      });
    }
  });

export type ExtensionPackageManifest = z.infer<
  typeof ExtensionPackageManifestSchema
>;

const ExtensionPackageJsonSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  description: z.string().optional(),
  ragdollExtension: ExtensionPackageManifestSchema.optional(),
});

/**
 * Metadata from a package.json that identifies a ragdoll extension
 */
export interface ExtensionPackageJson {
  name: string;
  version: string;
  description?: string;
  ragdollExtension?: ExtensionPackageManifest;
}

export function parseExtensionPackageJson(
  content: string,
): ExtensionPackageJson {
  return ExtensionPackageJsonSchema.parse(JSON.parse(content));
}

/**
 * Parsed extension package info (includes config/oauth requirements)
 */
export interface ExtensionPackageDescriptor {
  packageName: string;
  extensionId: string;
  name: string;
  description?: string;
  version: string;
  canDisable: boolean;
  capabilities: ExtensionPackageManifest["capabilities"];
  configSchema?: ExtensionPackageManifest["configSchema"];
  oauth?: ExtensionPackageManifest["oauth"];
  requiredCapabilities: ExtensionHostCapability[];
  optionalCapabilities: ExtensionHostCapability[];
}

export interface ExtensionPackageInfo extends ExtensionPackageDescriptor {
  packagePath: string;
}

export function createExtensionPackageDescriptor(
  packageJson: ExtensionPackageJson,
): ExtensionPackageDescriptor | null {
  const manifest = packageJson.ragdollExtension;
  if (!manifest) return null;

  return {
    packageName: packageJson.name,
    extensionId: manifest.id,
    name: manifest.name,
    description: manifest.description,
    version: packageJson.version,
    canDisable: manifest.canDisable,
    capabilities: manifest.capabilities,
    configSchema: manifest.configSchema,
    oauth: manifest.oauth,
    requiredCapabilities: manifest.requiredCapabilities,
    optionalCapabilities: manifest.optionalCapabilities,
  };
}

export function wrapExtensionWithPackageManifest(
  extension: RagdollExtension,
  packageMetadata: Pick<
    ExtensionManifest,
    | "id"
    | "name"
    | "version"
    | "description"
    | "requiredCapabilities"
    | "optionalCapabilities"
  >,
): RagdollExtension {
  const runtimeRequired = extension.manifest.requiredCapabilities ?? [];
  const packageRequired = packageMetadata.requiredCapabilities ?? [];
  assertMatchingHostCapabilities(
    extension.manifest.id,
    "required",
    runtimeRequired,
    packageRequired,
  );
  const runtimeOptional = extension.manifest.optionalCapabilities ?? [];
  const packageOptional = packageMetadata.optionalCapabilities ?? [];
  assertMatchingHostCapabilities(
    extension.manifest.id,
    "optional",
    runtimeOptional,
    packageOptional,
  );

  return {
    manifest: {
      ...extension.manifest,
      ...packageMetadata,
      requiredCapabilities: packageRequired,
      optionalCapabilities: packageOptional,
    },
    activate: extension.activate.bind(extension),
    deactivate: extension.deactivate?.bind(extension),
  };
}

function assertMatchingHostCapabilities(
  extensionId: string,
  kind: "required" | "optional",
  runtimeCapabilities: ReadonlyArray<ExtensionHostCapability>,
  packageCapabilities: ReadonlyArray<ExtensionHostCapability>,
): void {
  const runtime = [...runtimeCapabilities].sort();
  const packageManifest = [...packageCapabilities].sort();
  if (
    runtime.length !== packageManifest.length ||
    runtime.some((capability, index) => capability !== packageManifest[index])
  ) {
    throw new Error(
      `Extension '${extensionId}' runtime ${kind} host capabilities do not match its package manifest`,
    );
  }
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
  packageInfo?: ExtensionPackageDescriptor;
}

/**
 * Configuration for the extension loader
 */
export interface ExtensionLoaderConfig {
  /**
   * Package roots to search. The host decides whether these are an installed
   * dependency tree, a user extension directory, or another package store.
   */
  packageRoots: ExtensionPackageRoot[];

  /**
   * Filesystem adapter supplied by the host runtime.
   */
  fileSystem: {
    readFile(path: string): Promise<string>;
    readDirectory(path: string): Promise<string[]>;
    pathExists(path: string): Promise<boolean>;
  };

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
  registerOptions?: Omit<RegisterOptions, "host" | "config"> & {
    config?: Record<string, unknown>;
  };

  /**
   * Static host environment to provide to every extension.
   */
  hostEnvironment?: ExtensionHostEnvironment;

  /**
   * Resolve a host environment for a specific extension manifest.
   */
  getHostEnvironment?: (
    manifest: ExtensionManifest,
  ) => ExtensionHostEnvironment;

  /**
   * Called whenever an extension contribution is fully registered.
   */
  onContributionLoaded?: (metadata: ExtensionContributionMetadata) => void;

  /**
   * Called whenever a capability is registered with the registry.
   */
  onCapabilityRegistered?: (event: RegistryCapabilityEvent) => void;
}

export interface ExtensionPackageRoot {
  path: string;
  layout: "packages" | "installed";
}

/**
 * Module exports from an extension package
 */
interface ExtensionModuleExports {
  createExtension?: (config?: Record<string, unknown>) => RagdollExtension;
}

type NormalizedLoaderConfig = {
  packageRoots: ExtensionPackageRoot[];
  readFile: (path: string) => Promise<string>;
  readDirectory: (path: string) => Promise<string[]>;
  pathExists: (path: string) => Promise<boolean>;
  importModule: (modulePath: string) => Promise<unknown>;
  continueOnError: boolean;
  registerOptions: Omit<RegisterOptions, "host" | "config"> & {
    config?: Record<string, unknown>;
  };
  hostEnvironment?: ExtensionHostEnvironment;
  getHostEnvironment?: (
    manifest: ExtensionManifest,
  ) => ExtensionHostEnvironment;
  onContributionLoaded?: (metadata: ExtensionContributionMetadata) => void;
  onCapabilityRegistered?: (event: RegistryCapabilityEvent) => void;
};

async function defaultImportModule(modulePath: string): Promise<unknown> {
  return import(modulePath);
}

// =============================================================================
// Extension Loader
// =============================================================================

/**
 * Discovers and loads Ragdoll extension packages through host-provided adapters.
 */
export class ExtensionLoader {
  private registry: ExtensionRegistry;
  private config: NormalizedLoaderConfig;
  private loadedPackages: Map<string, string> = new Map(); // packageName -> extensionId
  private packageInfoCache: Map<string, ExtensionPackageInfo> = new Map(); // packageName -> info
  private registryDisposers: Array<() => void> = [];

  constructor(registry: ExtensionRegistry, config: ExtensionLoaderConfig) {
    this.registry = registry;
    this.config = {
      packageRoots: config.packageRoots,
      readFile: config.fileSystem.readFile,
      readDirectory: config.fileSystem.readDirectory,
      pathExists: config.fileSystem.pathExists,
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
        const metadata = this.registry.getContributionMetadata(
          event.extensionId,
        );
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

    for (const packageRoot of this.config.packageRoots) {
      const packages = await this.scanDirectory(packageRoot);
      extensionPackages.push(...packages);
    }

    // Deduplicate
    return [...new Set(extensionPackages)];
  }

  /**
   * Scan a package root according to its explicitly configured layout.
   */
  private async scanDirectory(root: ExtensionPackageRoot): Promise<string[]> {
    const extensions: string[] = [];

    if (!(await this.config.pathExists(root.path))) {
      return extensions;
    }

    const entries = await this.config.readDirectory(root.path);
    if (root.layout === "installed") {
      for (const entry of entries) {
        if (entry.startsWith(".")) continue;
        const packagePath = this.joinPath(root.path, entry);
        const packageJsonPath = this.joinPath(packagePath, "package.json");
        if (!(await this.config.pathExists(packageJsonPath))) continue;
        const packageJson = parseExtensionPackageJson(
          await this.config.readFile(packageJsonPath),
        );
        if (packageJson.ragdollExtension) extensions.push(packageJson.name);
      }
      return extensions;
    }

    for (const entry of entries) {
      if (entry.startsWith("@")) {
        const scopePath = this.joinPath(root.path, entry);
        for (const scopedPackage of await this.config.readDirectory(
          scopePath,
        )) {
          const packagePath = this.joinPath(scopePath, scopedPackage);
          if (await this.isExtensionPackage(packagePath)) {
            extensions.push(`${entry}/${scopedPackage}`);
          }
        }
      } else {
        const packagePath = this.joinPath(root.path, entry);
        if (await this.isExtensionPackage(packagePath)) extensions.push(entry);
      }
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

    const content = await this.config.readFile(packageJsonPath);
    return Boolean(parseExtensionPackageJson(content).ragdollExtension);
  }

  /**
   * Load a specific extension package by name.
   *
   * @param packageName - The package name (e.g., "@example/my-extension")
   * @param config - Optional configuration to pass to createExtension()
   */
  async loadPackage(
    packageName: string,
    config?: Record<string, unknown>,
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
      const { packageJson, packagePath } =
        await this.readPackageJsonWithPath(packageName);
      if (!packageJson || !packagePath) {
        return {
          packageName,
          extensionId: "",
          success: false,
          error: `Package '${packageName}' not found or invalid`,
        };
      }

      const packageManifest = packageJson.ragdollExtension;
      if (!packageManifest) {
        return {
          packageName,
          extensionId: "",
          success: false,
          error: `Package '${packageName}' is not a Ragdoll extension`,
        };
      }

      const packageInfo = this.extractPackageInfo(
        packageName,
        packagePath,
        packageJson,
      );
      if (!packageInfo) {
        throw new Error(
          `Package '${packageName}' is missing extension metadata.`,
        );
      }
      this.packageInfoCache.set(packageName, packageInfo);

      const fullModulePath = this.joinPath(packagePath, packageManifest.entry);

      // Import the module using the full resolved path
      const moduleExports = (await this.config.importModule(
        fullModulePath,
      )) as ExtensionModuleExports;

      // Extract the extension
      const extension = this.extractExtension(moduleExports, config);

      if (!extension) {
        return {
          packageName,
          extensionId: "",
          success: false,
          error: `Package '${packageName}' must export a createExtension(config?) factory`,
        };
      }

      // Package metadata augments the runtime manifest without exposing host details
      // to the extension implementation.
      const extensionId = packageManifest.id;
      const finalExtension = wrapExtensionWithPackageManifest(extension, {
        id: extensionId,
        name: packageManifest.name,
        version: packageJson.version,
        description:
          packageManifest.description ??
          packageJson.description ??
          extension.manifest.description,
        requiredCapabilities: packageManifest.requiredCapabilities,
        optionalCapabilities: packageManifest.optionalCapabilities,
      });

      const host = this.resolveHostEnvironment(finalExtension.manifest);
      const baseOptions = this.config.registerOptions ?? {};

      // Register with the registry
      await this.registry.register(finalExtension, {
        ...baseOptions,
        host,
        config: config ?? baseOptions.config,
      });

      const contribution = this.registry.getContributionMetadata(extensionId);
      try {
        this.assertDeclaredCapabilities(
          packageName,
          packageManifest.capabilities,
          contribution,
        );
      } catch (error) {
        await this.registry.unregister(extensionId);
        throw error;
      }

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
          error instanceof Error
            ? error.message
            : "Unknown error loading package",
      };
    }
  }

  /**
   * Unload a previously loaded package.
   *
   * @param packageName - The package name to unload
   */
  async unloadPackage(packageName: string): Promise<boolean> {
    const extensionId = this.loadedPackages.get(packageName);
    if (!extensionId) {
      return false;
    }

    try {
      return await this.registry.unregister(extensionId);
    } finally {
      if (!this.registry.has(extensionId)) {
        this.loadedPackages.delete(packageName);
      }
    }
  }

  /**
   * Reload a package (unload then load again).
   *
   * @param packageName - The package name to reload
   * @param config - Optional new configuration
   */
  async reloadPackage(
    packageName: string,
    config?: Record<string, unknown>,
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
      }),
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
  async getPackageInfo(
    packageName: string,
  ): Promise<ExtensionPackageInfo | null> {
    // Check cache first
    if (this.packageInfoCache.has(packageName)) {
      return this.packageInfoCache.get(packageName)!;
    }

    const { packageJson, packagePath } =
      await this.readPackageJsonWithPath(packageName);
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
    packageJson: ExtensionPackageJson,
  ): ExtensionPackageInfo | null {
    if (packageJson.name !== packageName) {
      throw new Error(
        `Package '${packageName}' contains manifest for '${packageJson.name}'`,
      );
    }
    const descriptor = createExtensionPackageDescriptor(packageJson);
    return descriptor ? { ...descriptor, packagePath } : null;
  }

  /**
   * Read and parse package.json for a package, returning both the parsed JSON and the package path.
   */
  private async readPackageJsonWithPath(packageName: string): Promise<{
    packageJson: ExtensionPackageJson | null;
    packagePath: string | null;
  }> {
    for (const root of this.config.packageRoots) {
      if (root.layout === "packages") {
        const packagePath = this.joinPath(root.path, ...packageName.split("/"));
        const packageJsonPath = this.joinPath(packagePath, "package.json");
        if (!(await this.config.pathExists(packageJsonPath))) continue;
        return {
          packageJson: parseExtensionPackageJson(
            await this.config.readFile(packageJsonPath),
          ),
          packagePath,
        };
      }

      for (const entry of await this.config.readDirectory(root.path)) {
        if (entry.startsWith(".")) continue;
        const packagePath = this.joinPath(root.path, entry);
        const packageJsonPath = this.joinPath(packagePath, "package.json");
        if (!(await this.config.pathExists(packageJsonPath))) continue;
        const packageJson = parseExtensionPackageJson(
          await this.config.readFile(packageJsonPath),
        );
        if (packageJson.name === packageName) {
          return { packageJson, packagePath };
        }
      }
    }

    return { packageJson: null, packagePath: null };
  }

  private resolveHostEnvironment(
    manifest: ExtensionManifest,
  ): ExtensionHostEnvironment {
    if (this.config.getHostEnvironment) {
      const env = this.config.getHostEnvironment(manifest);
      if (env) {
        return env;
      }
      throw new Error(
        `Host environment resolver did not return a value for extension '${manifest.id}'.`,
      );
    }
    if (this.config.hostEnvironment) {
      return this.config.hostEnvironment;
    }
    throw new Error(
      `No host environment provided for extension '${manifest.id}'. Configure hostEnvironment or getHostEnvironment when creating the loader.`,
    );
  }

  /**
   * Extract a RagdollExtension from module exports.
   */
  private extractExtension(
    exports: ExtensionModuleExports,
    config?: Record<string, unknown>,
  ): RagdollExtension | null {
    if (typeof exports.createExtension === "function") {
      return exports.createExtension(config);
    }

    return null;
  }

  private assertDeclaredCapabilities(
    packageName: string,
    declared: ExtensionPackageManifest["capabilities"],
    contribution: ExtensionContributionMetadata | undefined,
  ): void {
    if (!declared || !contribution) return;

    type PackageCapability = NonNullable<
      ExtensionPackageManifest["capabilities"]
    >[number];
    const actual = new Set<PackageCapability>();
    if (contribution.tools.length > 0) actual.add("tools");
    if (contribution.services.length > 0) actual.add("services");
    if (contribution.stateChannels.length > 0) actual.add("stateChannels");
    if (contribution.slots.length > 0) actual.add("slots");

    const expected = new Set(declared);
    const missing = declared.filter((capability) => !actual.has(capability));
    const undeclared = [...actual].filter(
      (capability) => !expected.has(capability),
    );
    if (missing.length > 0 || undeclared.length > 0) {
      throw new Error(
        `Package '${packageName}' capability manifest does not match its runtime contribution` +
          ` (missing: ${missing.join(", ") || "none"}; undeclared: ${undeclared.join(", ") || "none"}).`,
      );
    }
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
    const joined = segments.join("/").replaceAll("\\", "/");
    const prefix = joined.startsWith("/") ? "/" : "";
    const normalized: string[] = [];

    for (const segment of joined.split("/")) {
      if (!segment || segment === ".") {
        continue;
      }
      if (
        segment === ".." &&
        normalized.length > 0 &&
        normalized.at(-1) !== ".."
      ) {
        normalized.pop();
        continue;
      }
      normalized.push(segment);
    }

    return `${prefix}${normalized.join("/")}`;
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
 * const loader = createLoader(registry, {
 *   packageRoots: [{ path: extensionsDirectory, layout: "installed" }],
 *   fileSystem: hostFileSystem,
 *   hostEnvironment,
 * });
 *
 * await loader.discoverAndLoad();
 * ```
 */
export function createLoader(
  registry: ExtensionRegistry,
  config: ExtensionLoaderConfig,
): ExtensionLoader {
  return new ExtensionLoader(registry, config);
}
