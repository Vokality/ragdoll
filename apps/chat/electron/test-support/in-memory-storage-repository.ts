import type {
  StorageData,
  StorageRepository,
} from "../infrastructure/storage-repository.js";

export interface InMemoryStorageRepository extends StorageRepository {
  snapshot(): StorageData;
}

export function createInMemoryStorageRepository(
  initial: StorageData = {},
): InMemoryStorageRepository {
  let data = structuredClone(initial);

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
