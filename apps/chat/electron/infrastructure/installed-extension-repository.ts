import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { writePrivateFile } from "./write-private-file.js";
import { z } from "zod";
import type { InstalledExtension } from "../electron-api.js";

const installedExtensionSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9._-]*$/),
    name: z.string().min(1),
    version: z.string().min(1),
    description: z.string(),
    repoUrl: z.url(),
    installedAt: z.iso.datetime(),
  })
  .strict();

const registrySchema = z
  .object({
    extensions: z.record(z.string(), installedExtensionSchema),
  })
  .refine(
    (registry) =>
      Object.entries(registry.extensions).every(
        ([id, extension]) => id === extension.id,
      ),
    {
      message: "Extension registry keys must match their extension ids",
    },
  );

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && Reflect.get(error, "code") === "ENOENT";
}

type StoredExtension = z.infer<typeof installedExtensionSchema>;

export class InstalledExtensionRepository {
  private updateQueue = Promise.resolve();

  constructor(
    private readonly filePath: string,
    private readonly extensionsPath: string,
  ) {}

  async list(): Promise<InstalledExtension[]> {
    await this.updateQueue;
    return Object.values((await this.read()).extensions).map((extension) =>
      this.toInstalledExtension(extension),
    );
  }

  async get(extensionId: string): Promise<InstalledExtension | null> {
    await this.updateQueue;
    const { extensions } = await this.read();
    if (!Object.hasOwn(extensions, extensionId)) return null;
    return this.toInstalledExtension(extensions[extensionId]);
  }

  async set(extension: InstalledExtension): Promise<void> {
    await this.update((registry) => {
      registry.extensions[extension.id] = {
        id: extension.id,
        name: extension.name,
        version: extension.version,
        description: extension.description,
        repoUrl: extension.repoUrl,
        installedAt: extension.installedAt,
      };
    });
  }

  async delete(extensionId: string): Promise<void> {
    await this.update((registry) => {
      delete registry.extensions[extensionId];
    });
  }

  private async read(): Promise<z.infer<typeof registrySchema>> {
    try {
      return registrySchema.parse(
        JSON.parse(await readFile(this.filePath, "utf8")),
      );
    } catch (error) {
      if (isMissingFile(error)) return { extensions: {} };
      throw error;
    }
  }

  private update(
    mutate: (registry: z.infer<typeof registrySchema>) => void,
  ): Promise<void> {
    const operation = this.updateQueue.then(async () => {
      const registry = await this.read();
      mutate(registry);
      await this.write(registry);
    });
    this.updateQueue = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  private async write(registry: z.infer<typeof registrySchema>): Promise<void> {
    const validated = registrySchema.parse(registry);
    await writePrivateFile(this.filePath, JSON.stringify(validated, null, 2));
  }

  private toInstalledExtension(extension: StoredExtension): InstalledExtension {
    return {
      ...extension,
      path: join(this.extensionsPath, extension.id),
    };
  }
}
