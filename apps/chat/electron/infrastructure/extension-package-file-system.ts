import { access, readFile, readdir } from "node:fs/promises";
import type { ExtensionLoaderConfig } from "@vokality/ragdoll-extensions/loader";

export function createExtensionPackageFileSystem(): ExtensionLoaderConfig["fileSystem"] {
  return {
    readFile: (filePath) => readFile(filePath, "utf8"),
    readDirectory: (directoryPath) => readdir(directoryPath),
    pathExists: async (candidatePath) => {
      try {
        await access(candidatePath);
        return true;
      } catch (error) {
        if (error instanceof Error && Reflect.get(error, "code") === "ENOENT") {
          return false;
        }
        throw error;
      }
    },
  };
}
