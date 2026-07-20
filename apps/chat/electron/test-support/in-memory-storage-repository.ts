import type {
  StorageData,
  StorageInput,
  StorageRepository,
} from "../infrastructure/storage-repository.js";
import { storageSchema } from "../infrastructure/storage-repository.js";

export interface InMemoryStorageRepository extends StorageRepository {
  snapshot(): StorageData;
}

export function createInMemoryStorageRepository(
  initial: StorageInput = {},
): InMemoryStorageRepository {
  let data = storageSchema.parse(initial);

  return {
    filePath: "in-memory",
    read: async () => structuredClone(data),
    write: async (next) => {
      data = structuredClone(next);
    },
    update: async (mutator) => {
      const draft = structuredClone(data);
      mutator(draft);
      data = structuredClone(draft);
      return structuredClone(data);
    },
    snapshot: () => structuredClone(data),
  };
}
